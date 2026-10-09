import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { ArrowLeft02Icon, ArrowRight02Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { Dialog } from '../../components/Dialog/Dialog'
import { Icon } from '../../components/Icon/Icon'
import { MAX_SELECTED_PAGES } from '../local-ai/policy'
import type { PdfSource } from './pdfText'
import styles from './PdfPagePicker.module.css'

function PdfPagePreview({ document, pageNumber }: { document: PDFDocumentProxy; pageNumber: number }) {
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
        const viewport = page.getViewport({ scale: 1600 / Math.max(naturalSize.width, naturalSize.height) })
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
  }, [document, pageNumber])

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
  const [draftPages, setDraftPages] = useState(selectedPages)

  useEffect(() => {
    if (isOpen) {
      setDraftPages(selectedPages)
      const firstSelected = source.pages.findIndex((page) => page.pageNumber === selectedPages[0])
      setPageIndex(Math.max(0, firstSelected))
    }
  }, [isOpen, selectedPages, source])

  const page = source.pages[pageIndex]
  const isSelected = draftPages.includes(page.pageNumber)
  const atLimit = draftPages.length >= MAX_SELECTED_PAGES

  const togglePage = () => {
    setDraftPages((current) => {
      if (current.includes(page.pageNumber)) return current.filter((number) => number !== page.pageNumber)
      if (current.length >= MAX_SELECTED_PAGES) return current
      return [...current, page.pageNumber].sort((a, b) => a - b)
    })
  }

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
          <div className={styles.viewer}>
            <button aria-label="Previous page" className={styles.arrow} disabled={pageIndex === 0} onClick={() => setPageIndex((current) => current - 1)} type="button">
              <Icon icon={ArrowLeft02Icon} size={24} />
            </button>
            <PdfPagePreview document={source.document} key={page.pageNumber} pageNumber={page.pageNumber} />
            <button aria-label="Next page" className={styles.arrow} disabled={pageIndex === source.pages.length - 1} onClick={() => setPageIndex((current) => current + 1)} type="button">
              <Icon icon={ArrowRight02Icon} size={24} />
            </button>
          </div>
          <div className={styles.pageControls}>
            <span aria-live="polite" className={styles.pageNumber}>Page {page.pageNumber} of {source.pages.length}</span>
            <button aria-pressed={isSelected} className={`secondary-button ${styles.selectPage}`} disabled={atLimit && !isSelected} onClick={togglePage} type="button">
              {isSelected ? <Icon icon={Tick02Icon} /> : null}
              {isSelected ? `Page ${page.pageNumber} selected` : `Select page ${page.pageNumber}`}
            </button>
            <p className={styles.hint}>{atLimit ? 'Three pages selected. Deselect a page to choose another.' : 'Browse with the arrows, then select the pages you want.'}</p>
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}
