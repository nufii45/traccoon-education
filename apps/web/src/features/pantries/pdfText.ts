import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { SourcePage } from '../local-ai/types'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export const normalisePdfText = (value: string) => value.replace(/\s+/g, ' ').trim()

export const hasUsableTextLayer = (pages: Array<Pick<SourcePage, 'text' | 'pageNumber'>>) =>
  pages.some((page) => normalisePdfText(page.text).length > 0)

export class PdfTextLayerError extends Error {
  constructor() {
    super('This PDF does not contain selectable text. Try a text-based PDF; OCR is not part of this demo.')
    this.name = 'PdfTextLayerError'
  }
}

export const extractPdfText = async (file: File): Promise<SourcePage[]> => {
  if (file.type && file.type !== 'application/pdf') {
    throw new Error('Choose a PDF file.')
  }

  const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const document = await loadingTask.promise

  try {
    const pages: SourcePage[] = []

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = normalisePdfText(
        content.items
          .map((item) => ('str' in item ? item.str : ''))
          .filter((item): item is string => typeof item === 'string')
          .join(' '),
      )

      pages.push({ id: `page-${pageNumber}`, pageNumber, text })
    }

    if (!hasUsableTextLayer(pages)) {
      throw new PdfTextLayerError()
    }

    return pages
  } finally {
    await document.cleanup()
    await loadingTask.destroy()
  }
}
