import type { PDFDocumentProxy } from 'pdfjs-dist'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderPdfPageImage } from './pdfPageImage'

afterEach(() => vi.restoreAllMocks())

describe('PDF page image rendering', () => {
  it('uses a white JPEG for Cloud OCR and keeps PNG as the local default', async () => {
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
      callback(new Blob(['image'], { type: type ?? 'image/png' }))
    })
    const render = vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() }))
    const cleanup = vi.fn()
    const document = {
      getPage: vi.fn().mockResolvedValue({
        getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
        render,
        cleanup,
      }),
    } as unknown as PDFDocumentProxy

    const cloudImage = await renderPdfPageImage(document, 1, { format: 'image/jpeg' })
    expect(cloudImage.type).toBe('image/jpeg')
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.9)
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ background: '#ffffff' }))

    const localImage = await renderPdfPageImage(document, 1)
    expect(localImage.type).toBe('image/png')
    expect(toBlob).toHaveBeenLastCalledWith(expect.any(Function), 'image/png', undefined)
    expect(cleanup).toHaveBeenCalledTimes(2)
  })
})
