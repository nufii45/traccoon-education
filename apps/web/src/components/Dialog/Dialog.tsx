import { useEffect, useId, useRef, type MouseEvent, type ReactNode, type SyntheticEvent } from 'react'
import styles from './Dialog.module.css'

export type DialogVariant = 'modal' | 'drawer'

interface DialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  variant?: DialogVariant
  footer?: ReactNode
  children: ReactNode
}

/**
 * Modal or right-edge drawer built on the native <dialog> element, which
 * provides the focus trap, inert background, and Esc handling. Clicking the
 * backdrop or the close button also closes it, and focus returns to the
 * element that opened it. Both variants become full-screen below 600px.
 */
export function Dialog({ isOpen, onClose, title, eyebrow, variant = 'modal', footer, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<Element | null>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    if (isOpen && !dialog.open) {
      openerRef.current = document.activeElement
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
      if (openerRef.current instanceof HTMLElement) {
        openerRef.current.focus()
      }
    }
  }, [isOpen])

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
    onClose()
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      onClose()
    }
  }

  return (
    <dialog
      aria-labelledby={titleId}
      className={`${styles.dialog} ${styles[variant]}`}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      ref={dialogRef}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.heading}>
            {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
            <h2 className={styles.title} id={titleId}>{title}</h2>
          </div>
          <button aria-label="Close" className={styles.close} onClick={onClose} type="button">
            <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
            </svg>
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </dialog>
  )
}
