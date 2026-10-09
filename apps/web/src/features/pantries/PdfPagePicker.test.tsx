import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { PdfPagePicker } from './PdfPagePicker'
import type { PdfSource } from './pdfText'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

const makeSource = () => {
  const renderPage = vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() }))
  const getPage = vi.fn().mockResolvedValue({
    getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
    render: renderPage,
  })
  const source: PdfSource = {
    pages: Array.from({ length: 4 }, (_, index) => ({ id: `page-${index + 1}`, pageNumber: index + 1, text: `Text for page ${index + 1}` })),
    document: { getPage } as unknown as PDFDocumentProxy,
    destroy: vi.fn().mockResolvedValue(undefined),
  }
  return { source, getPage, renderPage }
}

const nextPage = () => fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
const selectPage = (number: number) => fireEvent.click(screen.getByRole('button', { name: `Select page ${number}`, exact: true }))

describe('PDF page picker', () => {
  it('renders actual PDF pages to a bounded canvas and stops at the first and last page', async () => {
    const { source, getPage, renderPage } = makeSource()
    render(<PdfPagePicker isOpen source={source} sourceName="lecture.pdf" selectedPages={[]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save selection' })).toBeDisabled()
    const canvas = await screen.findByRole('img', { name: 'Preview of page 1' })
    expect(getPage).toHaveBeenCalledWith(1)
    expect(renderPage).toHaveBeenCalledWith({ canvas, viewport: { width: 1200, height: 1600 } })
    expect(canvas).toHaveAttribute('width', '1200')
    nextPage()
    expect(await screen.findByRole('img', { name: 'Preview of page 2' })).toBeVisible()
    nextPage()
    nextPage()
    expect(await screen.findByRole('img', { name: 'Preview of page 4' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('limits selection to three, allows deselection, and saves sorted page numbers', async () => {
    const { source } = makeSource()
    const onSave = vi.fn()
    render(<PdfPagePicker isOpen source={source} sourceName="lecture.pdf" selectedPages={[]} onClose={vi.fn()} onSave={onSave} />)
    nextPage()
    selectPage(2)
    nextPage()
    selectPage(3)
    nextPage()
    selectPage(4)
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(screen.getByRole('button', { name: 'Select page 1', exact: true })).toBeDisabled()
    nextPage()
    fireEvent.click(screen.getByRole('button', { name: 'Page 2 selected' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    selectPage(1)
    expect(screen.getByRole('button', { name: 'Page 1 selected' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Save selection' }))
    expect(onSave).toHaveBeenCalledWith([1, 3, 4])
    await screen.findByRole('img', { name: 'Preview of page 1' })
  })

  it('discards unsaved changes on close and restores the saved selection when reopened', async () => {
    const { source } = makeSource()
    const onClose = vi.fn()
    const onSave = vi.fn()
    const props = { source, sourceName: 'lecture.pdf', selectedPages: [2], onClose, onSave }
    const { rerender } = render(<PdfPagePicker {...props} isOpen />)
    fireEvent.click(screen.getByRole('button', { name: 'Page 2 selected' }))
    nextPage()
    selectPage(3)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onSave).not.toHaveBeenCalled()
    rerender(<PdfPagePicker {...props} isOpen={false} />)
    rerender(<PdfPagePicker {...props} isOpen />)
    expect(screen.getByRole('button', { name: 'Page 2 selected' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Pages 2')).toBeVisible()
    fireEvent.cancel(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(3)
    await screen.findByRole('img', { name: 'Preview of page 2' })
  })

  it('cancels an in-flight render when navigating and ignores its late rejection', async () => {
    const { source, renderPage } = makeSource()
    let rejectRender!: (reason: Error) => void
    const cancel = vi.fn()
    renderPage.mockReturnValueOnce({ promise: new Promise<void>((_, reject) => { rejectRender = reject }), cancel })
    render(<PdfPagePicker isOpen source={source} sourceName="lecture.pdf" selectedPages={[]} onClose={vi.fn()} onSave={vi.fn()} />)
    await waitFor(() => expect(renderPage).toHaveBeenCalledOnce())
    nextPage()
    expect(cancel).toHaveBeenCalledOnce()
    await act(async () => rejectRender(new Error('Rendering cancelled')))
    expect(await screen.findByRole('img', { name: 'Preview of page 2' })).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an error for a failed preview and recovers on the next page', async () => {
    const { source, getPage } = makeSource()
    getPage.mockRejectedValueOnce(new Error('Broken page'))
    render(<PdfPagePicker isOpen source={source} sourceName="lecture.pdf" selectedPages={[]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('This page could not be previewed')
    nextPage()
    expect(await screen.findByRole('img', { name: 'Preview of page 2' })).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
