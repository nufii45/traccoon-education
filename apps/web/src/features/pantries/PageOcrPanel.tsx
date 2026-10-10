import { useEffect, useId, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { AlertCircleIcon, CloudUploadIcon, ImageNotFound01Icon, LaptopIcon, PencilEdit02Icon } from '@hugeicons/core-free-icons'
import { Icon } from '../../components/Icon/Icon'
import { CloudOcrError, getCloudOcrStatus, runCloudOcrForPage, type CloudOcrConsent, type CloudOcrProgress } from '../cloud-ocr'
import type { LocalOcrStatus } from '../local-ocr'
import { formatPageList } from '../local-ai/provenance'
import type { SourcePage, TextSource } from '../local-ai/types'
import { CloudOcrConsentDialog } from './CloudOcrConsentDialog'
import { loadLocalOcr, type LocalOcrModule } from './localOcrLoader'
import { renderPdfPageImage } from './pdfPageImage'
import { normalisePdfText } from './pdfText'
import styles from './PageOcrPanel.module.css'

export type OcrTextSource = Exclude<TextSource, 'text-layer'>

type OcrEngine = 'local' | 'cloud'

type ReadingStep = 'rendering' | 'recognizing' | CloudOcrProgress['state']

type OcrRun =
  | { phase: 'idle' }
  | { phase: 'preparing'; engine: 'local'; status: LocalOcrStatus }
  | { phase: 'checking'; engine: 'cloud' }
  | { phase: 'reading'; engine: OcrEngine; pageNumber: number; position: number; total: number; step: ReadingStep }
  | { phase: 'failed'; engine: OcrEngine; message: string }

interface PageOcrPanelProps {
  /** The open PDF, used only to render the selected pages to images on this device. */
  document: PDFDocumentProxy
  /** Selected pages that have no usable text yet, in page order. */
  pages: SourcePage[]
  onPageText: (pageNumber: number, text: string, textSource: OcrTextSource) => void
  onBusyChange: (busy: boolean) => void
  onStartManual: () => void
}

const CANCELLED_MESSAGE = 'OCR was cancelled. Your PDF and page selection are unchanged.'

const NOT_CONFIGURED_MESSAGE =
  'Cloud OCR isn’t set up on this Traccoon server yet, so nothing was sent. Read the pages on this device or write cards by hand.'

const READING_STEP_LABELS: Record<ReadingStep, (pageNumber: number) => string> = {
  rendering: (pageNumber) => `Preparing an image of page ${pageNumber} on this device…`,
  recognizing: (pageNumber) => `Reading page ${pageNumber} on this device…`,
  uploading: (pageNumber) => `Sending the image of page ${pageNumber} to Cloud OCR…`,
  pending: (pageNumber) => `Page ${pageNumber} is waiting for Cloud OCR…`,
  running: (pageNumber) => `Cloud OCR is reading page ${pageNumber}…`,
}

/** OCR finished but found nothing to use; reported like any other failure. */
class EmptyOcrResultError extends Error {
  readonly pageNumber: number

  constructor(pageNumber: number) {
    super('No readable text was found on this page.')
    this.name = 'EmptyOcrResultError'
    this.pageNumber = pageNumber
  }
}

const emptyResultMessage = (pageNumber: number) =>
  `No readable text was found on page ${pageNumber}. Try the other OCR option, choose a different page, or write cards by hand.`

const localStatusLabel = (status: LocalOcrStatus): string => {
  switch (status.state) {
    case 'downloading':
      return 'Downloading the on-device OCR model to this browser…'
    case 'ready':
      return 'On-device OCR is ready.'
    case 'error':
      return 'On-device OCR couldn’t start.'
    default:
      return 'Starting on-device OCR…'
  }
}

const localFailureMessage = (code: string | undefined, pageNumber: number | undefined): string => {
  switch (code) {
    case 'unsupported':
      return 'On-device OCR can’t run in this browser. Use Cloud OCR if you agree to send the page images, or write cards by hand.'
    case 'model-load-failed':
      return 'The on-device OCR model couldn’t load. Check your connection, then try again.'
    case 'offline-model-missing':
      return 'The on-device OCR model isn’t saved in this browser yet. Go online once so it can download, then try again.'
    case 'cancelled':
      return CANCELLED_MESSAGE
    default:
      return pageNumber === undefined
        ? 'On-device OCR couldn’t start. Check your connection, then try again.'
        : `On-device OCR couldn’t read page ${pageNumber}.`
  }
}

const cloudFailureMessage = (code: string | undefined, pageNumber: number | undefined): string => {
  const page = pageNumber === undefined ? 'your pages' : `page ${pageNumber}`
  switch (code) {
    case 'not-configured':
      return NOT_CONFIGURED_MESSAGE
    case 'consent-required':
      return 'Cloud OCR needs your permission before anything is sent. Nothing was sent.'
    case 'network':
      return 'Traccoon’s server couldn’t be reached. Check your connection, then try again.'
    case 'timeout':
    case 'upstream-timeout':
      return `Cloud OCR took too long to read ${page}. Try again in a moment.`
    case 'payload-too-large':
      return `The image of ${page} is too large for Cloud OCR.`
    case 'upstream-auth':
      return 'Traccoon’s server couldn’t sign in to Cloud OCR. Its access token may need updating.'
    case 'cancelled':
      return CANCELLED_MESSAGE
    default:
      return `Cloud OCR couldn’t read ${page}. Try again, or read the pages on this device.`
  }
}

/** Accepts a 0–1 fraction or a 0–100 percentage and returns a whole percentage. */
const toPercent = (progress: number | undefined): number | undefined => {
  if (progress === undefined || !Number.isFinite(progress)) {
    return undefined
  }
  const percent = progress <= 1 ? progress * 100 : progress
  return Math.round(Math.min(100, Math.max(0, percent)))
}

const capitalise = (value: string) => value.charAt(0).toLocaleUpperCase() + value.slice(1)

/**
 * OCR choices for selected pages without a text layer. On-device OCR runs only
 * in this browser. Cloud OCR runs only after the learner confirms the consent
 * dialog for exactly these pages; it is never started as a fallback.
 * Page images and OCR text are never logged or stored here.
 */
export function PageOcrPanel({ document, pages, onPageText, onBusyChange, onStartManual }: PageOcrPanelProps) {
  const headingId = useId()
  const [run, setRun] = useState<OcrRun>({ phase: 'idle' })
  const [consentPages, setConsentPages] = useState<number[]>()
  const controllerRef = useRef<AbortController | undefined>(undefined)
  const busyChangeRef = useRef(onBusyChange)
  const isBusy = run.phase === 'preparing' || run.phase === 'checking' || run.phase === 'reading'

  useEffect(() => {
    busyChangeRef.current = onBusyChange
  }, [onBusyChange])

  // Leaving the view or opening another PDF cancels any OCR still running.
  useEffect(() => () => {
    const controller = controllerRef.current
    if (controller) {
      controllerRef.current = undefined
      controller.abort()
      busyChangeRef.current(false)
    }
  }, [])

  const start = (next: OcrRun): AbortController => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    busyChangeRef.current(true)
    setRun(next)
    return controller
  }

  /** Progress from a run that was cancelled or replaced is ignored. */
  const update = (controller: AbortController, next: OcrRun) => {
    if (controllerRef.current === controller && !controller.signal.aborted) {
      setRun(next)
    }
  }

  const finish = (controller: AbortController, next: OcrRun) => {
    if (controllerRef.current !== controller) {
      return
    }
    controllerRef.current = undefined
    busyChangeRef.current(false)
    setRun(next)
  }

  const cancel = () => {
    const controller = controllerRef.current
    if (!controller) {
      return
    }
    controller.abort()
    finish(controller, { phase: 'failed', engine: 'engine' in run ? run.engine : 'local', message: CANCELLED_MESSAGE })
  }

  const readOnDevice = async () => {
    const queue = [...pages]
    const controller = start({ phase: 'preparing', engine: 'local', status: { state: 'idle' } })
    const { signal } = controller
    let localOcr: LocalOcrModule | undefined
    let pageNumber: number | undefined

    try {
      localOcr = await loadLocalOcr()
      const support = localOcr.getLocalOcrSupport()
      if (!support.supported) {
        finish(controller, {
          phase: 'failed',
          engine: 'local',
          message: `On-device OCR can’t run in this browser: ${support.reason}`,
        })
        return
      }

      await localOcr.warmUpLocalOcr({
        signal,
        onStatus: (status) => update(controller, { phase: 'preparing', engine: 'local', status }),
      })

      for (const [index, page] of queue.entries()) {
        pageNumber = page.pageNumber
        const reading = { phase: 'reading', engine: 'local', pageNumber: page.pageNumber, position: index + 1, total: queue.length } as const
        update(controller, { ...reading, step: 'rendering' })
        const image = await renderPdfPageImage(document, page.pageNumber, { signal })
        update(controller, { ...reading, step: 'recognizing' })
        const result = await localOcr.recognizeImage(image, { signal })
        if (signal.aborted) {
          return
        }
        const text = normalisePdfText(result.text)
        if (!text) {
          throw new EmptyOcrResultError(page.pageNumber)
        }
        onPageText(page.pageNumber, text, 'local-ocr')
      }

      finish(controller, { phase: 'idle' })
    } catch (reason) {
      if (signal.aborted) {
        return
      }
      const code = localOcr && reason instanceof localOcr.LocalOcrError ? reason.code : undefined
      finish(controller, {
        phase: 'failed',
        engine: 'local',
        message: reason instanceof EmptyOcrResultError ? emptyResultMessage(reason.pageNumber) : localFailureMessage(code, pageNumber),
      })
    }
  }

  const sendToCloud = async (consent: CloudOcrConsent, queue: SourcePage[]) => {
    const controller = start({ phase: 'checking', engine: 'cloud' })
    const { signal } = controller
    let pageNumber: number | undefined

    try {
      const status = await getCloudOcrStatus(signal)
      if (!status.configured) {
        finish(controller, { phase: 'failed', engine: 'cloud', message: NOT_CONFIGURED_MESSAGE })
        return
      }

      for (const [index, page] of queue.entries()) {
        pageNumber = page.pageNumber
        const reading = { phase: 'reading', engine: 'cloud', pageNumber: page.pageNumber, position: index + 1, total: queue.length } as const
        update(controller, { ...reading, step: 'rendering' })
        const image = await renderPdfPageImage(document, page.pageNumber, { signal })
        const result = await runCloudOcrForPage({
          image,
          pageNumber: page.pageNumber,
          consent,
          signal,
          onProgress: (progress) => update(controller, { ...reading, step: progress.state }),
        })
        if (signal.aborted) {
          return
        }
        const text = normalisePdfText(result.text)
        if (!text) {
          throw new EmptyOcrResultError(page.pageNumber)
        }
        onPageText(page.pageNumber, text, 'cloud-ocr')
      }

      finish(controller, { phase: 'idle' })
    } catch (reason) {
      if (signal.aborted) {
        return
      }
      finish(controller, {
        phase: 'failed',
        engine: 'cloud',
        message: reason instanceof EmptyOcrResultError
          ? emptyResultMessage(reason.pageNumber)
          : cloudFailureMessage(reason instanceof CloudOcrError ? reason.code : undefined, pageNumber),
      })
    }
  }

  const openConsent = () => setConsentPages(pages.map((page) => page.pageNumber))

  const confirmConsent = () => {
    const approved = consentPages ?? []
    setConsentPages(undefined)
    const queue = pages.filter((page) => approved.includes(page.pageNumber))
    if (queue.length === 0) {
      return
    }
    // The consent covers exactly the pages that will be sent, and no others.
    const consent: CloudOcrConsent = {
      kind: 'cloud-ocr',
      grantedAt: new Date().toISOString(),
      pageNumbers: queue.map((page) => page.pageNumber),
    }
    void sendToCloud(consent, queue)
  }

  // Retrying Cloud OCR asks for consent again rather than reusing the last one.
  const retry = () => {
    if (run.phase === 'failed' && run.engine === 'cloud') {
      openConsent()
    } else {
      void readOnDevice()
    }
  }

  const pageList = formatPageList(pages.map((page) => page.pageNumber))
  const downloadPercent = run.phase === 'preparing' ? toPercent(run.status.progress) : undefined
  // Only the step text is announced; progress bars update too often to read out.
  const statusLabel = run.phase === 'preparing'
    ? localStatusLabel(run.status)
    : run.phase === 'checking'
      ? 'Checking that Cloud OCR is set up on Traccoon’s server…'
      : run.phase === 'reading' ? READING_STEP_LABELS[run.step](run.pageNumber) : undefined

  return (
    <section aria-labelledby={headingId} className={styles.panel}>
      <h2 className={styles.heading} id={headingId}>
        <Icon icon={ImageNotFound01Icon} />
        {capitalise(pageList)} {pages.length === 1 ? 'has' : 'have'} no text layer
      </h2>
      <p className={styles.copy}>
        Rokki writes and checks cards only from page text, and {pages.length === 1 ? 'this page looks' : 'these pages look'} scanned
        or image-only. Read {pages.length === 1 ? 'it' : 'them'} with OCR, choose different pages, or write cards by hand.
      </p>

      <div className={styles.choices}>
        <button className="primary-button" disabled={isBusy} onClick={() => void readOnDevice()} type="button">
          <Icon icon={LaptopIcon} />Read on this device
        </button>
        <button className="secondary-button" disabled={isBusy} onClick={openConsent} type="button">
          <Icon icon={CloudUploadIcon} />Use Cloud OCR…
        </button>
        {run.phase === 'failed' ? null : (
          <button className="text-button" onClick={onStartManual} type="button">
            <Icon icon={PencilEdit02Icon} />Write cards by hand
          </button>
        )}
      </div>
      <p className={styles.note}>
        On-device OCR keeps the pages in this browser; its first use downloads the OCR model. Cloud OCR sends page images only after you agree.
      </p>

      <div aria-live="polite" className={styles.status}>
        {statusLabel ? <p>{statusLabel}</p> : null}
      </div>
      {run.phase === 'preparing' && run.status.state === 'downloading' ? (
        <div className={styles.progress}>
          <progress aria-label="On-device OCR model download" max={100} value={downloadPercent} />
          {downloadPercent !== undefined ? <span>{downloadPercent}%</span> : null}
        </div>
      ) : null}
      {run.phase === 'reading' ? (
        <div className={styles.progress}>
          <progress aria-label="Pages read" max={run.total} value={run.position - 1} />
          <span>Page {run.position} of {run.total}</span>
        </div>
      ) : null}

      {isBusy ? (
        <div className="generation-actions">
          <button className="secondary-button" onClick={cancel} type="button">Cancel</button>
        </div>
      ) : null}

      {run.phase === 'failed' ? (
        <div className={styles.failure} role="alert">
          <p><Icon icon={AlertCircleIcon} /><span>{run.message}</span></p>
          <div className="generation-actions">
            <button className="primary-button" onClick={retry} type="button">Try again</button>
            <button className="secondary-button" onClick={onStartManual} type="button">Write cards by hand</button>
          </div>
        </div>
      ) : null}

      <CloudOcrConsentDialog
        isOpen={consentPages !== undefined}
        onCancel={() => setConsentPages(undefined)}
        onConfirm={confirmConsent}
        pageNumbers={consentPages ?? []}
      />
    </section>
  )
}
