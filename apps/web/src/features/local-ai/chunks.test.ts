import { describe, expect, it } from 'vitest'
import { chunkSourcePages, selectSourcePages } from './chunks'
import { MAX_SELECTED_PAGES } from './policy'
import type { SourcePage } from './types'

const pages: SourcePage[] = [
  { id: 'page-1', pageNumber: 1, text: 'One. Two. Three. Four.' },
  { id: 'page-2', pageNumber: 2, text: 'Five. Six. Seven. Eight.' },
  { id: 'page-3', pageNumber: 3, text: 'Nine. Ten. Eleven. Twelve.' },
  { id: 'page-4', pageNumber: 4, text: 'Thirteen. Fourteen. Fifteen.' },
]

describe('selectSourcePages', () => {
  it('keeps selected pages in page order and enforces the three-page P0 limit', () => {
    expect(selectSourcePages(pages, [3, 1, 2]).map((page) => page.pageNumber)).toEqual([1, 2, 3])
    expect(() => selectSourcePages(pages, [1, 2, 3, 4])).toThrow(`Choose between one and ${MAX_SELECTED_PAGES} pages`)
  })
})

describe('chunkSourcePages', () => {
  it('keeps every chunk tied to its local source page', () => {
    const chunks = chunkSourcePages([pages[0]], 12)

    expect(chunks).toHaveLength(2)
    expect(chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'page-1-chunk-1', pageNumber: 1 }),
        expect.objectContaining({ id: 'page-1-chunk-2', pageNumber: 1 }),
      ]),
    )
    expect(chunks.map((chunk) => chunk.text).join(' ')).toContain('One.')
    expect(chunks.map((chunk) => chunk.text).join(' ')).toContain('Four.')
  })
})
