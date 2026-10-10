import { FileSearchIcon, FileNotFoundIcon } from '@hugeicons/core-free-icons'
import { Dialog } from '../../components/Dialog/Dialog'
import { Icon } from '../../components/Icon/Icon'
import { TEXT_SOURCE_LABELS, textSourceOf } from '../local-ai/provenance'
import type { SourcePage } from '../local-ai/types'
import type { StoredCard } from '../pantries/repository'
import { findQuoteHighlight } from './quoteHighlight'
import styles from './StudySession.module.css'

interface SourceViewProps {
  card: StoredCard | undefined
  sourcePages: SourcePage[]
  sourceName: string
  onClose: () => void
}

/**
 * Drawer showing a card's cited page with its source quote highlighted.
 * A matched quote proves the passage exists, not that the marked answer is
 * right, so the copy asks the learner to check the answer against it.
 */
export function SourceView({ card, sourcePages, sourceName, onClose }: SourceViewProps) {
  const page = card ? sourcePages.find((candidate) => candidate.pageNumber === card.sourcePage) : undefined
  const highlight = card && page ? findQuoteHighlight(page.text, card.sourceQuote) : undefined
  const textSource = page ? textSourceOf(page) : undefined

  return (
    <Dialog
      eyebrow={textSource ? `Source · ${TEXT_SOURCE_LABELS[textSource]}` : 'Source'}
      footer={<button className={`primary-button ${styles.tapTarget}`} onClick={onClose} type="button">Back to card</button>}
      isOpen={card !== undefined}
      onClose={onClose}
      title={card ? `Page ${card.sourcePage} · ${sourceName}` : 'Source'}
      variant="drawer"
    >
      {card ? (
        <>
          <div className={styles.evidenceNote}>
            {highlight ? (
              <>
                <strong><Icon icon={FileSearchIcon} size={16} />Quote found on page {card.sourcePage}</strong>
                <span>This is the passage the card was written from. Check the answer against it yourself.</span>
              </>
            ) : (
              <>
                <strong><Icon icon={FileNotFoundIcon} size={16} />Saved quote from page {card.sourcePage}</strong>
                <span>
                  {page
                    ? "This exact passage couldn't be pinpointed in the page text below, so the saved quote is shown on its own."
                    : "Page text isn't stored for this card, so only the saved quote is shown."}
                </span>
              </>
            )}
            {textSource && textSource !== 'text-layer' ? (
              <span>
                This page’s text was read by {TEXT_SOURCE_LABELS[textSource]}, so a word may be misread. Compare it with your PDF if something looks off.
              </span>
            ) : null}
          </div>
          <div className={styles.pageText}>
            {highlight ? (
              <p>
                {highlight.before}
                <mark className={styles.quoteMark}>{highlight.match}</mark>
                {highlight.after}
              </p>
            ) : (
              <>
                <p className={styles.quoteBlock}>
                  <mark className={styles.quoteMark}>{card.sourceQuote}</mark>
                </p>
                {page ? <p className={styles.fullPage}>{page.text}</p> : null}
              </>
            )}
          </div>
        </>
      ) : null}
    </Dialog>
  )
}
