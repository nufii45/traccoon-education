import type { SourceChunk, SourcePage } from './types'
import { MAX_SELECTED_PAGES } from './policy'

const tidyText = (value: string) => value.replace(/\s+/g, ' ').trim()

export const selectSourcePages = (pages: SourcePage[], selectedPageNumbers: number[]) => {
  const selected = [...new Set(selectedPageNumbers)]

  if (selected.length < 1 || selected.length > MAX_SELECTED_PAGES) {
    throw new Error(`Choose between one and ${MAX_SELECTED_PAGES} pages`)
  }

  const pageNumbers = new Set(pages.map((page) => page.pageNumber))
  const missingPage = selected.find((pageNumber) => !pageNumbers.has(pageNumber))

  if (missingPage !== undefined) {
    throw new Error(`Page ${missingPage} is not available in this source`)
  }

  return pages.filter((page) => selected.includes(page.pageNumber)).sort((a, b) => a.pageNumber - b.pageNumber)
}

export const chunkSourcePages = (pages: SourcePage[], maxCharacters = 700): SourceChunk[] => {
  if (!Number.isFinite(maxCharacters) || maxCharacters < 1) {
    throw new Error('Chunk size must be at least one character')
  }

  return pages.flatMap((page) => {
    const sentences = tidyText(page.text).match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []
    const chunks: string[] = []
    let current = ''

    for (const sentence of sentences) {
      const next = tidyText(sentence)
      const candidate = tidyText(`${current} ${next}`)

      if (current && candidate.length > maxCharacters) {
        chunks.push(current)
        current = next
      } else {
        current = candidate
      }
    }

    if (current) {
      chunks.push(current)
    }

    return chunks.map((text, index) => ({
      id: `${page.id}-chunk-${index + 1}`,
      pageNumber: page.pageNumber,
      text,
    }))
  })
}
