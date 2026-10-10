import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

/** OCR-friendly render settings: about 2x the PDF's point size, longest side capped near 2000 px. */
export const OCR_RENDER_SCALE = 2
export const OCR_MAX_LONG_SIDE_PX = 2000

const abortError = () => new DOMException('Page rendering was cancelled.', 'AbortError')

const canvasToPng = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('This page could not be turned into an image.'))
      }
    }, 'image/png')
  })

/**
 * Renders one PDF page to a PNG on this device with PDF.js, for OCR. The image
 * is returned to the caller only; nothing is stored or sent from here.
 */
export const renderPdfPageImage = async (
  document: PDFDocumentProxy,
  pageNumber: number,
  options: { signal?: AbortSignal } = {},
): Promise<Blob> => {
  const { signal } = options
  if (signal?.aborted) {
    throw abortError()
  }

  const page = await document.getPage(pageNumber)
  const canvas = window.document.createElement('canvas')
  let renderTask: RenderTask | undefined
  const cancelRender = () => renderTask?.cancel()
  signal?.addEventListener('abort', cancelRender, { once: true })

  try {
    const naturalSize = page.getViewport({ scale: 1 })
    const scale = Math.min(OCR_RENDER_SCALE, OCR_MAX_LONG_SIDE_PX / Math.max(naturalSize.width, naturalSize.height))
    const viewport = page.getViewport({ scale })
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    renderTask = page.render({ canvas, viewport })
    await renderTask.promise
    if (signal?.aborted) {
      throw abortError()
    }
    return await canvasToPng(canvas)
  } finally {
    signal?.removeEventListener('abort', cancelRender)
    // Release the bitmap memory right away; scanned pages can be large.
    canvas.width = 0
    canvas.height = 0
    page.cleanup()
  }
}
