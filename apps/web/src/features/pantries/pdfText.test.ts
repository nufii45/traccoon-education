import { getDocument } from 'pdfjs-dist'
import { describe, expect, it, vi } from 'vitest'
import { hasUsableTextLayer, loadPdfSource, normalisePdfText, PdfTextLayerError } from './pdfText'

vi.mock('pdfjs-dist', () => ({ getDocument: vi.fn(), GlobalWorkerOptions: {} }))

const pdfFile = () => Object.assign(new File(['pdf'], 'lecture.pdf', { type: 'application/pdf' }), {
  arrayBuffer: async () => new ArrayBuffer(4),
})

const mockDocument = (text: string) => {
  const page = { getTextContent: vi.fn().mockResolvedValue({ items: [{ str: text }] }), cleanup: vi.fn() }
  const document = { numPages: 1, getPage: vi.fn().mockResolvedValue(page) }
  const destroy = vi.fn().mockResolvedValue(undefined)
  vi.mocked(getDocument).mockReturnValue({ promise: Promise.resolve(document), destroy } as unknown as ReturnType<typeof getDocument>)
  return { document, destroy, page }
}

describe('PDF text preparation', () => {
  it('normalises extracted text while keeping readable word boundaries', () => {
    expect(normalisePdfText('  Plants\n\n capture    light.  ')).toBe('Plants capture light.')
  })

  it('rejects scanned or empty pages that have no usable text layer', () => {
    expect(hasUsableTextLayer([{ pageNumber: 1, text: 'Readable source text.' }])).toBe(true)
    expect(hasUsableTextLayer([{ pageNumber: 1, text: '   ' }])).toBe(false)
  })

  it('retains the local document for previews until the caller releases it', async () => {
    const { document, destroy, page } = mockDocument('  Readable source text.  ')
    const source = await loadPdfSource(pdfFile())
    expect(source.pages).toEqual([{ id: 'page-1', pageNumber: 1, text: 'Readable source text.' }])
    expect(source.document).toBe(document)
    expect(page.cleanup).toHaveBeenCalledOnce()
    expect(destroy).not.toHaveBeenCalled()
    await source.destroy()
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('destroys documents without a usable text layer', async () => {
    const { destroy } = mockDocument('   ')
    await expect(loadPdfSource(pdfFile())).rejects.toBeInstanceOf(PdfTextLayerError)
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('destroys the loading task even when opening the document fails', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined)
    vi.mocked(getDocument).mockImplementationOnce(() => ({ promise: Promise.reject(new Error('Invalid PDF')), destroy }) as unknown as ReturnType<typeof getDocument>)
    await expect(loadPdfSource(pdfFile())).rejects.toThrow('Invalid PDF')
    expect(destroy).toHaveBeenCalledOnce()
  })
})
