import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { ArrowLeft02Icon, ArrowRight02Icon, File01Icon, Grid2X2Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { Dialog } from '../../components/Dialog/Dialog'
import { Icon } from '../../components/Icon/Icon'
import { MAX_SELECTED_PAGES } from '../local-ai/policy'
import type { PdfSource } from './pdfText'
import styles from './PdfPagePicker.module.css'

export const GRID_PAGES_PER_VIEW = 4

type ViewMode = 'single' | 'grid'

function PdfPagePreview({ document, pageNumber, maxSize = 1600 }: { document: PDFDocumentProxy; pageNumber: number; maxSize?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    let renderTask: RenderTask | undefined

    const render = async () => {
      try {
        const page = await document.getPage(pageNumber)
        const canvas = canvasRef.current
        if (cancelled || !canvas) return

        const naturalSize = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: maxSize / Math.max(naturalSize.width, naturalSize.height) })
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        renderTask = page.render({ canvas, viewport })
        await renderTask.promise
        if (!cancelled) setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void render()
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [document, pageNumber, maxSize])

  return (
    <div aria-busy={status === 'loading'} className={styles.preview}>
      {status === 'loading' ? <p className={styles.previewMessage} role="status">Loading page preview…</p> : null}
      {status === 'error' ? <p className={styles.previewMessage} role="alert">This page could not be previewed. Try another page or reopen the PDF.</p> : null}
      <canvas aria-label={`Preview of page ${pageNumber}`} className={status === 'ready' ? styles.canvas : styles.hiddenCanvas} ref={canvasRef} role="img" />
    </div>
  )
}

interface PdfPagePickerProps {
  isOpen: boolean
  source: PdfSource
  sourceName: string
  selectedPages: number[]
  onClose: () => void
  onSave: (pages: number[]) => void
}

export function PdfPagePicker({ isOpen, source, sourceName, selectedPages, onClose, onSave }: PdfPagePickerProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('single')
  const [draftPages, setDraftPages] = useState(selectedPages)

  useEffect(() => {
    if (isOpen) {
      setDraftPages(selectedPages)
      const firstSelected = source.pages.findIndex((page) => page.pageNumber === selectedPages[0])
      setPageIndex(Math.max(0, firstSelected))
    }
  }, [isOpen, selectedPages, source])

  const pageCount = source.pages.length
  const isGrid = viewMode === 'grid'
  const step = isGrid ? GRID_PAGES_PER_VIEW : 1
  const viewStart = isGrid ? pageIndex - (pageIndex % GRID_PAGES_PER_VIEW) : pageIndex
  const visiblePages = source.pages.slice(viewStart, viewStart + step)
  const page = source.pages[pageIndex]
  const atLimit = draftPages.length >= MAX_SELECTED_PAGES

  const togglePage = (pageNumber: number) => {
    setDraftPages((current) => {
      if (current.includes(pageNumber)) return current.filter((number) => number !== pageNumber)
      if (current.length >= MAX_SELECTED_PAGES) return current
      return [...current, pageNumber].sort((a, b) => a - b)
    })
  }

  const goBack = () => setPageIndex(Math.max(0, viewStart - step))
  const goForward = () => setPageIndex(Math.min(pageCount - 1, viewStart + step))
  const canGoBack = viewStart > 0
  const canGoForward = viewStart + step < pageCount

  const isSelected = draftPages.includes(page.pageNumber)
  const lastVisible = visiblePages[visiblePages.length - 1]
  const positionLabel = isGrid
    ? `Pages ${visiblePages[0].pageNumber}–${lastVisible.pageNumber} of ${pageCount}`
    : `Page ${page.pageNumber} of ${pageCount}`
  const hint = atLimit
    ? 'Three pages selected. Deselect a page to choose another.'
    : isGrid
      ? 'Tap a page to select it. The arrows move four pages at a time.'
      : 'Browse with the arrows, then select the pages you want.'

  return (
    <Dialog
      eyebrow="YOUR FIRST CARD BATCH"
      footer={(
        <div className={styles.footer}>
          <div aria-live="polite" className={styles.selectionSummary}>
            <strong>{draftPages.length} of {MAX_SELECTED_PAGES} selected</strong>
            <span>{draftPages.length ? `Pages ${draftPages.join(', ')}` : 'No pages selected yet'}</span>
          </div>
          <button className="primary-button" disabled={!draftPages.length} onClick={() => onSave(draftPages)} type="button">
            Save selection <Icon icon={Tick02Icon} />
          </button>
        </div>
      )}
      isOpen={isOpen}
      onClose={onClose}
      title="Select pages"
      variant="preview"
    >
      {isOpen ? (
        <div className={styles.picker}>
          <div className={styles.intro}>
            <p className={styles.filename} title={sourceName}>{sourceName}</p>
            <p>Choose 1–{MAX_SELECTED_PAGES} pages for your first card batch.</p>
          </div>
          <div className={styles.toolbar}>
            <div aria-label="Preview layout" className={styles.viewToggle} role="group">
              <button aria-pressed={!isGrid} className={styles.viewOption} onClick={() => setViewMode('single')} type="button">
                <Icon icon={File01Icon} size={16} /> Single page
              </button>
              <button aria-pressed={isGrid} className={styles.viewOption} onClick={() => setViewMode('grid')} type="button">
                <Icon icon={Grid2X2Icon} size={16} /> Grid of {GRID_PAGES_PER_VIEW}
              </button>
            </div>
          </div>
          <div className={styles.viewer}>
            <button aria-label={isGrid ? 'Previous pages' : 'Previous page'} className={styles.arrow} disabled={!canGoBack} onClick={goBack} type="button">
              <Icon icon={ArrowLeft02Icon} size={24} />
            </button>
            {isGrid ? (
              <div className={styles.grid}>
                {visiblePages.map((gridPage) => {
                  const selected = draftPages.includes(gridPage.pageNumber)
                  return (
                    <button
                      aria-label={selected ? `Page ${gridPage.pageNumber} selected` : `Select page ${gridPage.pageNumber}`}
                      aria-pressed={selected}
                      className={styles.gridCell}
                      disabled={atLimit && !selected}
                      key={gridPage.pageNumber}
                      onClick={() => togglePage(gridPage.pageNumber)}
                      type="button"
                    >
                      <PdfPagePreview document={source.document} maxSize={900} pageNumber={gridPage.pageNumber} />
                      <span aria-hidden="true" className={styles.gridLabel}>
                        {selected ? <Icon icon={Tick02Icon} size={16} /> : null}
                        Page {gridPage.pageNumber}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <PdfPagePreview document={source.document} key={page.pageNumber} pageNumber={page.pageNumber} />
            )}
            <button aria-label={isGrid ? 'Next pages' : 'Next page'} className={styles.arrow} disabled={!canGoForward} onClick={goForward} type="button">
              <Icon icon={ArrowRight02Icon} size={24} />
            </button>
          </div>
          <div className={styles.pageControls}>
            <span aria-live="polite" className={styles.pageNumber}>{positionLabel}</span>
            {isGrid ? null : (
              <button aria-pressed={isSelected} className={`secondary-button ${styles.selectPage}`} disabled={atLimit && !isSelected} onClick={() => togglePage(page.pageNumber)} type="button">
                {isSelected ? <Icon icon={Tick02Icon} /> : null}
                {isSelected ? `Page ${page.pageNumber} selected` : `Select page ${page.pageNumber}`}
              </button>
            )}
            <p className={styles.hint}>{hint}</p>
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}
