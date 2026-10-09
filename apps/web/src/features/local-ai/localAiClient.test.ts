import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chunkSourcePages } from './chunks'
import {
  formatGenerationDiagnostics,
  generateCardsLocally,
  LocalGenerationOutputError,
  LocalGenerationUnsupportedError,
  releaseLocalModel,
} from './localAiClient'
import { MAX_REGENERATION_RETRIES } from './policy'
import type { SourcePage } from './types'

const engineMock = vi.hoisted(() => ({
  create: vi.fn(),
  interruptGenerate: vi.fn(),
  unload: vi.fn(async () => undefined),
}))

vi.mock('@mlc-ai/web-llm', () => ({
  CreateWebWorkerMLCEngine: vi.fn(async () => ({
    chat: { completions: { create: engineMock.create } },
    interruptGenerate: engineMock.interruptGenerate,
    unload: engineMock.unload,
  })),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Local Private network boundary', () => {
  it('does not request a fallback service when WebGPU is unavailable', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await expect(
      generateCardsLocally({
        chunks: [],
        sourcePages: [],
      }),
    ).rejects.toBeInstanceOf(LocalGenerationUnsupportedError)

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('generateCardsLocally with a local engine', () => {
  const page2: SourcePage = {
    id: 'page-2',
    pageNumber: 2,
    text: 'The mitochondrion is often called the “powerhouse” of the cell. It produces most of the cell’s supply of adenosine triphosphate — the molecule cells use for energy. Mitochondria have their own DNA.',
  }
  const sourcePages = [page2]
  const chunks = chunkSourcePages(sourcePages)

  const unmatchedCard = {
    question: 'Where do cells burn sugar?',
    options: ['Chloroplasts', 'Nucleus', 'Ribosome', 'Vacuole'],
    correctIndex: 0,
    sourcePage: 2,
    sourceChunkId: 'page-2-chunk-1',
    sourceQuote: 'Cells burn sugar inside chloroplasts to make heat.',
  }
  const threeOptionCard = {
    question: 'What is the mitochondrion called?',
    options: ['Powerhouse', 'Library', 'Factory'],
    correctIndex: 0,
    sourcePage: 2,
    sourceChunkId: 'page-2-chunk-1',
    sourceQuote: 'The mitochondrion is often called the "powerhouse" of the cell.',
  }
  const goodCard = {
    question: 'What is the mitochondrion often called?',
    options: ['The powerhouse', 'The library', 'The factory', 'The gate'],
    correctIndex: 0,
    sourcePage: 5,
    sourceChunkId: 'page-2-chunk-1',
    sourceQuote: 'The mitochondrion is often called the "powerhouse" of the cell',
  }

  const completion = (content: string) => ({ choices: [{ message: { content } }] })

  beforeEach(() => {
    engineMock.create.mockReset()
    vi.stubGlobal('Worker', class { terminate() {} })
    Object.defineProperty(navigator, 'gpu', { value: {}, configurable: true })
  })

  afterEach(async () => {
    await releaseLocalModel()
    Reflect.deleteProperty(navigator, 'gpu')
  })

  it('reports reason codes and counts without learner content when every response is rejected', async () => {
    const logSpies = [
      vi.spyOn(console, 'log'),
      vi.spyOn(console, 'warn'),
      vi.spyOn(console, 'error'),
    ]
    const rejected = JSON.stringify({ cards: [unmatchedCard, threeOptionCard] })
    engineMock.create
      .mockResolvedValueOnce(completion('not json'))
      .mockResolvedValueOnce(completion(rejected))
      .mockResolvedValueOnce(completion(rejected))

    const error = await generateCardsLocally({ chunks, sourcePages }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(LocalGenerationOutputError)
    expect(engineMock.create).toHaveBeenCalledTimes(1 + MAX_REGENERATION_RETRIES)
    const outputError = error as LocalGenerationOutputError
    expect(outputError.message.startsWith(
      'The local model could not produce source-verified cards. Try a smaller selection or author a card manually.',
    )).toBe(true)
    expect(outputError.message).toContain('Checked 3 local response(s): 0 of 4 candidates passed (')
    expect(outputError.message).toContain('2 options-invalid, 2 quote-not-found, 1 invalid-json')
    expect(outputError.diagnostics?.reasons).toEqual({
      'invalid-json': 1,
      'quote-not-found': 2,
      'options-invalid': 2,
    })

    const fixtureText = [
      page2.text,
      ...page2.text.split(/(?<=\.)\s+/),
      unmatchedCard.question,
      unmatchedCard.sourceQuote,
      ...unmatchedCard.options,
      threeOptionCard.question,
      threeOptionCard.sourceQuote,
      ...threeOptionCard.options,
      'page-2-chunk',
      'mitochondri',
    ]
    for (const text of fixtureText) {
      expect(outputError.message).not.toContain(text)
    }
    for (const spy of logSpies) {
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    }
  })

  it('admits a lightly paraphrased card with a wrong page using JSON mode', async () => {
    engineMock.create.mockResolvedValueOnce(completion(JSON.stringify({ cards: [goodCard] })))

    const result = await generateCardsLocally({ chunks, sourcePages, requestedCount: 1 })

    expect(engineMock.create).toHaveBeenCalledTimes(1)
    expect(engineMock.create.mock.calls[0][0]).toMatchObject({ response_format: { type: 'json_object' } })
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]).toMatchObject({
      sourcePage: 2,
      sourceChunkId: 'page-2-chunk-1',
      sourceQuote: 'The mitochondrion is often called the “powerhouse” of the cell.',
    })
    expect(page2.text).toContain(result.cards[0].sourceQuote)
  })

  it('retries the same attempt without JSON mode when the engine rejects it', async () => {
    engineMock.create
      .mockRejectedValueOnce(new Error('response_format unsupported'))
      .mockResolvedValueOnce(completion(JSON.stringify([goodCard])))

    const result = await generateCardsLocally({ chunks, sourcePages })

    expect(result.cards).toHaveLength(1)
    expect(engineMock.create).toHaveBeenCalledTimes(2)
    expect(engineMock.create.mock.calls[0][0]).toHaveProperty('response_format')
    expect(engineMock.create.mock.calls[1][0]).not.toHaveProperty('response_format')
  })
})

describe('formatGenerationDiagnostics', () => {
  it('orders reasons by count, then code', () => {
    expect(
      formatGenerationDiagnostics({
        responses: 2,
        candidates: 5,
        reasons: { schema: 1, 'quote-not-found': 3, 'options-invalid': 1 },
      }),
    ).toBe('Checked 2 local response(s): 0 of 5 candidates passed (3 quote-not-found, 1 options-invalid, 1 schema).')
  })
})
