import { CloudUploadIcon } from '@hugeicons/core-free-icons'
import { Dialog } from '../../components/Dialog/Dialog'
import { Icon } from '../../components/Icon/Icon'
import { formatPageList } from '../local-ai/provenance'
import styles from './PageOcrPanel.module.css'

/** The Cloud OCR model named in the consent copy (shared brief section 4). */
export const CLOUD_OCR_MODEL_NAME = 'PaddleOCR-VL-1.6'

interface CloudOcrConsentDialogProps {
  isOpen: boolean
  /** Exactly the pages whose images would be sent. */
  pageNumbers: readonly number[]
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Asks before anything leaves the device. Cloud OCR never starts without this
 * confirmation, including after on-device OCR fails or is unsupported.
 */
export function CloudOcrConsentDialog({ isOpen, pageNumbers, onCancel, onConfirm }: CloudOcrConsentDialogProps) {
  const pages = formatPageList(pageNumbers)
  const imageCount = pageNumbers.length === 1 ? '1 page image' : `${pageNumbers.length} page images`

  return (
    <Dialog
      eyebrow="Cloud Enhanced"
      footer={(
        <div className={styles.consentFooter}>
          <button className="secondary-button" onClick={onCancel} type="button">Keep on this device</button>
          <button className="primary-button" onClick={onConfirm} type="button">
            <Icon icon={CloudUploadIcon} />Send {imageCount}
          </button>
        </div>
      )}
      isOpen={isOpen}
      onClose={onCancel}
      title="Use Cloud OCR for these pages?"
    >
      <div className={styles.consent}>
        <dl className={styles.consentList}>
          <div>
            <dt>What leaves this device</dt>
            <dd>Only images of {pages}, rendered here in your browser. Not the PDF file and not any other page.</dd>
          </div>
          <div>
            <dt>Where it goes</dt>
            <dd>Through Traccoon’s server to {CLOUD_OCR_MODEL_NAME} on Baidu AI Studio, which reads the text and sends it back.</dd>
          </div>
          <div>
            <dt>What changes</dt>
            <dd>This pantry becomes Cloud Enhanced. It and its cards are labelled Cloud Enhanced, never Local Private.</dd>
          </div>
        </dl>
        <p className={styles.copy}>
          Cards are still generated on this device. Choose “Keep on this device” to read the pages with on-device OCR or write cards by hand instead.
        </p>
      </div>
    </Dialog>
  )
}
