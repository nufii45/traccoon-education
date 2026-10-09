import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { pantryRepository } from './repository'
import { loadPdfSource, type PdfSource } from './pdfText'

vi.mock('./pdfText', () => ({ loadPdfSource: vi.fn() }))

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

beforeEach(() => vi.mocked(loadPdfSource).mockReset())

const makeSource = (): PdfSource => ({
  pages: [1, 2, 3, 4].map((pageNumber) => ({ id: `page-${pageNumber}`, pageNumber, text: `Source text on page ${pageNumber}` })),
  document: {
    getPage: vi.fn().mockResolvedValue({
      getViewport: () => ({ width: 600, height: 800 }),
      render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }),
    }),
  } as unknown as PDFDocumentProxy,
  destroy: vi.fn().mockResolvedValue(undefined),
})

const upload = (name = 'lecture.pdf') => {
  fireEvent.change(screen.getByLabelText('Choose a PDF'), { target: { files: [new File(['pdf'], name, { type: 'application/pdf' })] } })
}

describe('PDF import selection', () => {
  it('opens previews after import and creates a pantry using only saved pages', async () => {
    const source = makeSource()
    vi.mocked(loadPdfSource).mockResolvedValue(source)
    const createPantry = vi.spyOn(pantryRepository, 'createPantry')
    render(<App />)
    upload()
    await screen.findByRole('dialog', { name: 'Select pages' })
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create local pantry' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select page 2', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Save selection' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Selected pages: 2')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Edit page selection' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select page 3', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByText('Selected pages: 2')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Create local pantry' }))
    await waitFor(() => expect(createPantry).toHaveBeenCalledWith({ title: 'lecture', sourceName: 'lecture.pdf', sourcePages: [source.pages[1]] }))
    await screen.findByRole('button', { name: 'Generate local cards' })
    expect(source.destroy).toHaveBeenCalledOnce()
    createPantry.mockRestore()
  })

  it('clears the previous file and saved selection if its replacement fails', async () => {
    const source = makeSource()
    vi.mocked(loadPdfSource).mockResolvedValueOnce(source).mockRejectedValueOnce(new Error('Invalid PDF'))
    render(<App />)
    upload()
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Select page 1', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Save selection' }))
    upload('broken.pdf')
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid PDF')
    expect(screen.queryByText('lecture.pdf')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create local pantry' })).not.toBeInTheDocument()
    expect(source.destroy).toHaveBeenCalledOnce()
  })

  it('ignores a superseded import and releases both documents', async () => {
    const oldSource = makeSource()
    const newSource = makeSource()
    let finishOld!: (source: PdfSource) => void
    vi.mocked(loadPdfSource)
      .mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve }))
      .mockResolvedValueOnce(newSource)
    const { unmount } = render(<App />)
    upload('old.pdf')
    upload('new.pdf')
    await screen.findByRole('dialog')
    await act(async () => finishOld(oldSource))
    expect(oldSource.destroy).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Pantry name')).toHaveValue('new')
    unmount()
    expect(newSource.destroy).toHaveBeenCalledOnce()
  })
})
