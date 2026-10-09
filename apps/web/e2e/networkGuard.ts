import type { BrowserContext, Page, Request, Route, WebSocket } from '@playwright/test'
import { encodedVariants, PDF_MAGIC, STRUCTURAL_MARKERS, type StudyCanaries } from './fixtures/studyContent'
import { classifyUrl, originOf, type RequestClass } from './networkPolicy'

export type RecordedRequest = {
  url: string
  method: string
  origin: string
  resourceType: string
  classification: RequestClass
  /** Header values joined; never printed. */
  headerText: string
  /** Body decoded as UTF-8 and latin1; never printed. */
  bodyText: string
  bodyBytes: number
  /** True when the PDF signature 25 50 44 46 2D starts the raw body. */
  bodyStartsWithPdfMagic: boolean
  fromServiceWorker: boolean
  /** True when context.route saw it, so the guard could abort or stub it. */
  intercepted: boolean
}

export type Violation = { request: RecordedRequest; reasons: string[] }

/**
 * `stub`: model-asset requests are answered locally with 503, so no model is
 * downloaded and nothing reaches those hosts. `live`: they continue to the
 * real allowlisted origin (demo Mac warm-up only).
 */
export type ModelAssetMode = 'stub' | 'live'

export type NetworkGuard = {
  records: RecordedRequest[]
  violations: () => Violation[]
  assertClean: (label: string) => void
  modelAssetRequests: () => RecordedRequest[]
}

export type NetworkGuardOptions = { canaries: StudyCanaries; modelAssetMode?: ModelAssetMode }

/** Same-origin paths the negative self-test posts to; answered locally. */
const SELF_TEST_PATH_PREFIX = '/__selftest'
const PDF_SIGNATURE = Buffer.from(PDF_MAGIC, 'latin1')

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    return value
  }
}

/** Query string and hash only; paths are dev-server module names. */
const urlQueryAndHash = (url: string): string => {
  try {
    const parsed = new URL(url)
    return `${parsed.search} ${parsed.hash}`
  } catch {
    return url
  }
}

const bodyFields = (body: Buffer | null) => ({
  bodyText: body ? `${body.toString('utf8')}\n${body.toString('latin1')}` : '',
  bodyBytes: body?.length ?? 0,
  bodyStartsWithPdfMagic: body ? body.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE) : false,
})

/** Keeps failure messages readable and avoids echoing long leaked payloads. */
const MAX_REPORTED_URL_CHARS = 120
const shortUrl = (url: string): string =>
  url.length > MAX_REPORTED_URL_CHARS ? `${url.slice(0, MAX_REPORTED_URL_CHARS)}… (${url.length} chars)` : url

const headerValues = (headers: Record<string, string>): string => Object.values(headers).join('\n')

const findViolationReasons = (request: RecordedRequest, needles: string[]): string[] => {
  const reasons: string[] = []
  if (request.classification === 'blocked') {
    reasons.push(`non-allowlisted origin ${request.origin}`)
  }

  const everywhere = [request.url, safeDecode(request.url), request.headerText, request.bodyText]
    .join('\n')
    .toLowerCase()
  const canary = needles.find((needle) => everywhere.includes(needle))
  if (canary) {
    reasons.push('contains study canary')
  }

  const queryAndBody = [urlQueryAndHash(request.url), safeDecode(urlQueryAndHash(request.url)), request.bodyText].join('\n')
  const marker = STRUCTURAL_MARKERS.find((candidate) =>
    typeof candidate === 'string' ? queryAndBody.includes(candidate) : candidate.test(queryAndBody),
  )
  if (marker) {
    reasons.push(`contains structural marker ${String(marker)}`)
  }

  if (request.bodyStartsWithPdfMagic || request.bodyText.includes(PDF_MAGIC)) {
    reasons.push('contains PDF bytes')
  }
  return reasons
}

/**
 * Records every request the context makes (pages and dedicated workers via
 * context.route plus the request event, WebSocket URLs and sent frames) and
 * reports any request to a non-allowlisted origin or carrying study content.
 * Non-allowlisted requests are always aborted. Messages list only method,
 * URL, and reasons, never request bodies.
 */
export const installNetworkGuard = async (
  context: BrowserContext,
  { canaries, modelAssetMode = 'stub' }: NetworkGuardOptions,
): Promise<NetworkGuard> => {
  const records: RecordedRequest[] = []
  const byRequest = new Map<Request, RecordedRequest>()
  const needles = [...new Set(canaries.tokens.flatMap(encodedVariants).map((value) => value.toLowerCase()))]

  const record = (request: Request): RecordedRequest => {
    const existing = byRequest.get(request)
    if (existing) {
      return existing
    }
    const url = request.url()
    const recorded: RecordedRequest = {
      url,
      method: request.method(),
      origin: originOf(url),
      resourceType: request.resourceType(),
      classification: classifyUrl(url),
      headerText: headerValues(request.headers()),
      ...bodyFields(request.postDataBuffer()),
      fromServiceWorker: request.serviceWorker() !== null,
      intercepted: false,
    }
    byRequest.set(request, recorded)
    records.push(recorded)
    return recorded
  }

  const handleRoute = async (route: Route): Promise<void> => {
    const request = route.request()
    const recorded = record(request)
    recorded.intercepted = true
    try {
      recorded.headerText = headerValues(await request.allHeaders())
    } catch {
      // Provisional headers from record() stay in place.
    }

    if (recorded.classification === 'blocked') {
      await route.abort('blockedbyclient')
      return
    }
    if (recorded.classification === 'model-asset' && modelAssetMode === 'stub') {
      await route.fulfill({ status: 503, contentType: 'text/plain', body: 'stubbed by networkGuard' })
      return
    }
    if (recorded.classification === 'app' && new URL(recorded.url).pathname.startsWith(SELF_TEST_PATH_PREFIX)) {
      await route.fulfill({ status: 204 })
      return
    }
    await route.continue()
  }

  const watchWebSockets = (page: Page): void => {
    page.on('websocket', (socket: WebSocket) => {
      const url = socket.url()
      const recorded: RecordedRequest = {
        url,
        method: 'WEBSOCKET',
        origin: originOf(url),
        resourceType: 'websocket',
        classification: classifyUrl(url),
        headerText: '',
        bodyText: '',
        bodyBytes: 0,
        bodyStartsWithPdfMagic: false,
        fromServiceWorker: false,
        intercepted: false,
      }
      records.push(recorded)
      socket.on('framesent', ({ payload }) => {
        const frame = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload
        recorded.bodyText += `\n${frame.toString('utf8')}\n${frame.toString('latin1')}`
        recorded.bodyBytes += frame.length
      })
    })
  }

  await context.route('**/*', handleRoute)
  context.on('request', (request) => void record(request))
  context.pages().forEach(watchWebSockets)
  context.on('page', watchWebSockets)

  const violations = (): Violation[] =>
    records
      .map((request) => ({ request, reasons: findViolationReasons(request, needles) }))
      .filter((violation) => violation.reasons.length > 0)

  return {
    records,
    violations,
    modelAssetRequests: () => records.filter((request) => request.classification === 'model-asset'),
    assertClean: (label: string) => {
      const found = violations()
      if (found.length === 0) {
        return
      }
      const lines = found.map(
        ({ request, reasons }) => `  - ${request.method} ${shortUrl(request.url)} (${reasons.join('; ')})`,
      )
      throw new Error(
        `[${label}] Local Private network boundary violated by ${found.length} request(s):\n${lines.join('\n')}`,
      )
    },
  }
}
