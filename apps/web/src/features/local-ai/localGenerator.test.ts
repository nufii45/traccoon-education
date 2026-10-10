import { describe, expect, it } from 'vitest'
import { validateGeneratedCard } from './cardRules'
import { chunkSourcePages } from './chunks'
import {
  analyseModelCards,
  buildLocalGenerationPrompt,
  LOCAL_CARD_RESPONSE_SCHEMA,
  parseModelCards,
} from './localGenerator'
import type { SourceChunk, SourcePage } from './types'

const pages: SourcePage[] = [
  {
    id: 'page-1',
    pageNumber: 1,
    text: 'Plants use chlorophyll to capture light during photosynthesis.',
  },
]

const chunks: SourceChunk[] = [
  {
    id: 'page-1-chunk-1',
    pageNumber: 1,
    text: 'Plants use chlorophyll to capture light during photosynthesis.',
  },
]

// The second argument is new: provenance (page and quote) is derived from the
// chunks used in the prompt, so the parser now needs them.
describe('parseModelCards', () => {
  it('only admits a source-linked local model response that passes validation', () => {
    const cards = parseModelCards(
      JSON.stringify([
        {
          question: 'What do plants use chlorophyll to capture?',
          options: ['Light', 'Sound', 'Water', 'Soil'],
          correctIndex: 0,
          sourcePage: 1,
          sourceQuote: chunks[0].text,
          sourceChunkId: chunks[0].id,
        },
      ]),
      chunks,
      pages,
      () => '2026-10-09T08:00:00.000Z',
    )

    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({
      generationMode: 'local-private',
      generationMethod: 'webllm',
      sourcePage: 1,
      sourceChunkId: 'page-1-chunk-1',
      sourceQuote: 'Plants use chlorophyll to capture light during photosynthesis.',
    })
    expect(validateGeneratedCard(cards[0], pages)).toEqual({ valid: true, errors: [] })
  })

  const validCard = {
    question: 'What do plants use chlorophyll to capture?',
    options: ['Light', 'Sound', 'Water', 'Soil'],
    correctIndex: 0,
    sourcePage: 1,
    sourceQuote: chunks[0].text,
    sourceChunkId: chunks[0].id,
  }

  const now = () => '2026-10-09T08:00:00.000Z'

  it('tolerates a trailing comma after the last array element', () => {
    const cards = parseModelCards(`[${JSON.stringify(validCard)},]`, chunks, pages, now)

    expect(cards).toHaveLength(1)
    expect(validateGeneratedCard(cards[0], pages)).toEqual({ valid: true, errors: [] })
  })

  it('salvages a valid object and drops malformed trailing garbage', () => {
    const content = `[${JSON.stringify(validCard)} this is not valid json at all ]`
    const cards = parseModelCards(content, chunks, pages, now)

    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ sourceChunkId: 'page-1-chunk-1' })
  })

  it('salvages complete leading objects from an array truncated by max tokens', () => {
    const content = `[${JSON.stringify(validCard)},{"question":"What is`
    const cards = parseModelCards(content, chunks, pages, now)

    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ sourceChunkId: 'page-1-chunk-1' })
  })

  it('returns an empty array for non-JSON garbage without throwing', () => {
    expect(parseModelCards('Sorry, I cannot answer that right now.', chunks, pages, now)).toEqual([])
  })

  it('parses a fenced json block containing a valid array', () => {
    const content = '```json\n' + `[${JSON.stringify(validCard)}]` + '\n```'
    const cards = parseModelCards(content, chunks, pages, now)

    expect(cards).toHaveLength(1)
    expect(validateGeneratedCard(cards[0], pages)).toEqual({ valid: true, errors: [] })
  })
})

describe('analyseModelCards with chunk-derived provenance', () => {
  const page2: SourcePage = {
    id: 'page-2',
    pageNumber: 2,
    text: 'The mitochondrion is often called the “powerhouse” of the cell. It produces most of the cell’s supply of adenosine triphosphate — the molecule cells use for energy. ATP stores energy. Mitochondria have their own DNA. This DNA is inherited from the mother in most animals.',
  }
  const mitoPages = [page2]
  const mitoChunks = chunkSourcePages(mitoPages)
  const now = () => '2026-10-09T08:00:00.000Z'
  const sentence1 = 'The mitochondrion is often called the “powerhouse” of the cell.'

  const card = {
    question: 'What is the mitochondrion often called?',
    options: ['The powerhouse of the cell', 'The brain of the cell', 'The skin of the cell', 'The library of the cell'],
    correctIndex: 0,
    sourcePage: 7,
    sourceChunkId: 'page-2-chunk-1',
    sourceQuote: 'The mitochondrion is often called the "powerhouse" of the cell.',
  }
  const card2 = {
    question: 'Who passes mitochondrial DNA on in most animals?',
    options: ['The mother', 'The father', 'Both parents', 'Neither parent'],
    correctIndex: 0,
    sourceChunkId: 'page-2-chunk-1',
    sourceQuote: 'This DNA is inherited from the mother in most animals.',
  }
  const card3 = {
    question: 'What does ATP store?',
    options: ['Energy', 'Water', 'Light', 'Salt'],
    correctIndex: 0,
    sourceChunkId: 'page-2-chunk-1',
    sourceQuote: "It produces most of the cell's supply of adenosine triphosphate - the molecule cells use for energy.",
  }
  const card4 = {
    question: 'What do mitochondria have?',
    options: ['Their own DNA', 'Chlorophyll', 'Cell walls', 'Flagella'],
    correctIndex: 0,
    sourceChunkId: 'page-2-chunk-1',
    sourceQuote: 'Mitochondria have their own DNA, which is inherited from the mother in most animals.',
  }

  const analyse = (value: unknown) =>
    analyseModelCards(typeof value === 'string' ? value : JSON.stringify(value), mitoChunks, mitoPages, now)

  it('corrects a wrong model sourcePage from the chunk and stores the real quote', () => {
    const result = analyse([card])

    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]).toMatchObject({
      id: 'webllm-page-2-chunk-1-1',
      sourcePage: 2,
      sourceChunkId: 'page-2-chunk-1',
      sourceQuote: sentence1,
    })
    expect(validateGeneratedCard(result.cards[0], mitoPages)).toEqual({ valid: true, errors: [] })
  })

  it('falls back to the best-matching chunk for an unknown chunk id', () => {
    const result = analyse([{ ...card, sourceChunkId: 'chunk-9' }])

    expect(result.cards).toHaveLength(1)
    expect(result.cards[0].sourceChunkId).toBe('page-2-chunk-1')
  })

  it('rejects a quote with no real match as quote-not-found', () => {
    const result = analyse([{ ...card, sourceQuote: 'Cells burn sugar inside chloroplasts to make heat.' }])

    expect(result.cards).toEqual([])
    expect(result.rejections).toEqual(['quote-not-found'])
  })

  it('reports an unmatched quote with an unknown chunk id as unknown-chunk', () => {
    const result = analyse([{ ...card, sourceChunkId: 'chunk-9', sourceQuote: 'Cells burn sugar inside chloroplasts to make heat.' }])

    expect(result.rejections).toEqual(['unknown-chunk'])
  })

  it('accepts cards, questions, and single-object response shapes', () => {
    expect(analyse({ cards: [card] }).cards).toHaveLength(1)
    expect(analyse({ questions: [card] }).cards).toHaveLength(1)
    expect(analyse(card).cards).toHaveLength(1)
  })

  it('resolves the correct option from numeric strings, letters, and exact answer text', () => {
    expect(analyse([{ ...card, correctIndex: '1' }]).cards[0].correctIndex).toBe(1)
    expect(analyse([{ ...card, correctIndex: 'B' }]).cards[0].correctIndex).toBe(1)

    // JSON.stringify drops undefined, so the model output has no correctIndex.
    const withoutIndex = { ...card, correctIndex: undefined }
    expect(analyse([{ ...withoutIndex, answer: 'The skin of the cell' }]).cards[0].correctIndex).toBe(2)
    expect(analyse([{ ...withoutIndex, answer: 'The heart of the cell' }]).rejections).toEqual(['correct-index-invalid'])
    expect(analyse([{ ...card, correctIndex: 4 }]).rejections).toEqual(['correct-index-invalid'])
  })

  it('keeps valid cards when one candidate is malformed', () => {
    const result = analyse([card, { ...card2, options: ['a', 'b', 'c'] }, card3])

    expect(result.candidateCount).toBe(3)
    expect(result.rejections).toEqual(['options-invalid'])
    expect(result.cards.map((generated) => generated.id)).toEqual([
      'webllm-page-2-chunk-1-1',
      'webllm-page-2-chunk-1-3',
    ])
  })

  it('admits more than MAX_CARDS_PER_RUN parsed cards and leaves slicing to the client', () => {
    expect(analyse([card, card2, card3, card4]).cards).toHaveLength(4)
  })

  it('rejects a card whose answer the quote does not support as semantic-mismatch', () => {
    const unsupported = {
      ...card,
      question: 'What is the mitochondrion often called?',
      options: ['Sunlight', 'Rainfall', 'Gravity', 'Friction'],
      correctIndex: 0,
    }
    const result = analyse([unsupported])

    expect(result.cards).toEqual([])
    expect(result.rejections).toContain('semantic-mismatch')
  })

  it('drops a near-duplicate question and reports it', () => {
    const duplicate = {
      ...card,
      question: 'The mitochondrion is often called what?',
    }
    const result = analyse([card, duplicate])

    expect(result.cards).toHaveLength(1)
    expect(result.rejections).toContain('duplicate')
  })

  it('keeps an optional explanation on an admitted card', () => {
    const result = analyse([{ ...card, explanation: 'It makes most of the cell’s ATP.' }])

    expect(result.cards[0].explanation).toBe('It makes most of the cell’s ATP.')
  })

  it('trims options and rejects case-insensitive duplicates', () => {
    const trimmed = analyse([{ ...card2, options: ['  The mother ', 'The father', 'Both parents', 'Neither parent'] }])
    expect(trimmed.cards[0].options[0]).toBe('The mother')

    const duplicate = analyse([{ ...card2, options: ['The mother', 'the MOTHER', 'Both parents', 'Neither parent'] }])
    expect(duplicate.rejections).toEqual(['options-invalid'])
  })

  it('reports invalid JSON and unknown response shapes', () => {
    expect(analyse('Sorry, I cannot answer that right now.').rejections).toEqual(['invalid-json'])
    expect(analyse('').rejections).toEqual(['invalid-json'])
    expect(analyse({ foo: 1 }).rejections).toEqual(['schema'])
  })

  it('salvages a complete card from a truncated cards object', () => {
    const result = analyse(`{"cards":[${JSON.stringify(card)},{"question":"What is`)

    expect(result.cards).toHaveLength(1)
  })
})

describe('buildLocalGenerationPrompt', () => {
  it('keeps the chunk markers and asks for one copied sentence per card', () => {
    const page2Chunk: SourceChunk = { id: 'page-2-chunk-1', pageNumber: 2, text: 'Sample chunk text.' }
    const prompt = buildLocalGenerationPrompt([page2Chunk], 9)

    expect(prompt).toContain('SOURCE_CHUNK id=page-2-chunk-1 page=2\nSample chunk text.\nEND_SOURCE_CHUNK')
    for (const field of ['correctIndex', 'sourceChunkId', 'sourceQuote', 'Copy one complete sentence', 'up to 3']) {
      expect(prompt).toContain(field)
    }
  })

  it('exports a JSON schema that requires a cards array', () => {
    const schema = JSON.parse(LOCAL_CARD_RESPONSE_SCHEMA) as { required: string[] }

    expect(schema.required).toContain('cards')
  })
})
