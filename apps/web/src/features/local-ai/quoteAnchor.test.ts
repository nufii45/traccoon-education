import { describe, expect, it } from 'vitest'
import { isQuoteOnSourcePage, normaliseEvidenceText } from './cardRules'
import { chunkSourcePages } from './chunks'
import { MIN_NORMALIZED_QUOTE_CHARS } from './policy'
import { anchorQuote, anchorQuoteInChunk, QUOTE_ANCHOR_MIN_SCORE } from './quoteAnchor'
import type { SourcePage } from './types'

const page1: SourcePage = {
  id: 'page-1',
  pageNumber: 1,
  text: 'Photosynthesis takes place in the chloroplasts of plant cells. Chlorophyll absorbs red and blue light most strongly.',
}

const page2: SourcePage = {
  id: 'page-2',
  pageNumber: 2,
  text: 'The mitochondrion is often called the “powerhouse” of the cell. It produces most of the cell’s supply of adenosine triphosphate — the molecule cells use for energy. ATP stores energy. Mitochondria have their own DNA. This DNA is inherited from the mother in most animals.',
}

const pages = [page1, page2]
const chunks = chunkSourcePages(pages)
const chunk2 = chunks.find((chunk) => chunk.pageNumber === 2)!

const sentence1 = 'The mitochondrion is often called the “powerhouse” of the cell.'
const sentence2 = 'It produces most of the cell’s supply of adenosine triphosphate — the molecule cells use for energy.'

const expectAnchored = (quote: string, expected: string) => {
  const result = anchorQuoteInChunk(quote, chunk2, page2)

  expect(result.ok).toBe(true)
  if (!result.ok) {
    return
  }
  const start = chunk2.text.indexOf(expected)
  expect(start).toBeGreaterThanOrEqual(0)
  expect(result.quote).toBe(chunk2.text.slice(start, start + expected.length))
  expect(result.score).toBeGreaterThanOrEqual(QUOTE_ANCHOR_MIN_SCORE)
  expect(isQuoteOnSourcePage(result.quote, page2)).toBe(true)
}

describe('anchorQuoteInChunk', () => {
  it('keeps each fixture page in one chunk whose text is on the page', () => {
    expect(chunks.map((chunk) => chunk.id)).toEqual(['page-1-chunk-1', 'page-2-chunk-1'])
    expect(isQuoteOnSourcePage(chunk2.text, page2)).toBe(true)
  })

  it('anchors a straight-quote copy to the sentence with its curly quotes preserved', () => {
    expectAnchored('The mitochondrion is often called the "powerhouse" of the cell.', sentence1)
  })

  it('anchors a hyphen and straight apostrophe copy to the em dash sentence', () => {
    expectAnchored(
      "It produces most of the cell's supply of adenosine triphosphate - the molecule cells use for energy.",
      sentence2,
    )
  })

  it('anchors a quote with a dropped word', () => {
    expectAnchored(
      'It produces most of the supply of adenosine triphosphate, the molecule cells use for energy.',
      sentence2,
    )
  })

  it('anchors a quote that ends with an ellipsis', () => {
    expectAnchored('The mitochondrion is often called the "powerhouse"...', sentence1)
  })

  it('anchors two merged sentences to the real two-sentence span', () => {
    expectAnchored(
      'Mitochondria have their own DNA, which is inherited from the mother in most animals.',
      'Mitochondria have their own DNA. This DNA is inherited from the mother in most animals.',
    )
  })

  it('extends a short sentence so the quote meets the evidence minimum', () => {
    const expected = 'ATP stores energy. Mitochondria have their own DNA.'
    expectAnchored('ATP stores energy.', expected)
    expect(normaliseEvidenceText(expected).length).toBeGreaterThanOrEqual(MIN_NORMALIZED_QUOTE_CHARS)
  })

  it('rejects an unrelated same-topic sentence', () => {
    expect(anchorQuoteInChunk('Cells burn sugar inside chloroplasts to make heat.', chunk2, page2)).toEqual({
      ok: false,
      reason: 'quote-not-found',
    })
  })

  it('rejects a quote with too few words to anchor', () => {
    expect(anchorQuoteInChunk('the cell', chunk2, page2)).toEqual({ ok: false, reason: 'quote-not-found' })
  })

  it('rejects a match when the whole chunk is shorter than the evidence minimum', () => {
    const shortPage: SourcePage = { id: 'page-3', pageNumber: 3, text: 'Cells divide fast.' }
    const [shortChunk] = chunkSourcePages([shortPage])

    expect(anchorQuoteInChunk('Cells divide fast', shortChunk, shortPage)).toEqual({
      ok: false,
      reason: 'quote-too-short',
    })
  })
})

describe('anchorQuote', () => {
  const quote = 'The mitochondrion is often called the "powerhouse" of the cell.'

  it('moves the card to the chunk that really contains the quote', () => {
    const result = anchorQuote(quote, chunks, pages, 'page-1-chunk-1')

    expect(result).toMatchObject({ ok: true, chunkResolved: true, quote: sentence1 })
    expect(result.ok && result.chunk.id).toBe('page-2-chunk-1')
  })

  it('falls back to the best-matching chunk for an unknown chunk id', () => {
    const result = anchorQuote(quote, chunks, pages, 'chunk-9')

    expect(result).toMatchObject({ ok: true, chunkResolved: false, quote: sentence1 })
    expect(result.ok && result.chunk.id).toBe('page-2-chunk-1')
  })

  it('tolerates an id= prefix on the cited chunk id', () => {
    expect(anchorQuote(quote, chunks, pages, 'id=page-2-chunk-1')).toMatchObject({ ok: true, chunkResolved: true })
  })
})
