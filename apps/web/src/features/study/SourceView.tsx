import { Dialog } from '../../components/Dialog/Dialog'
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

  return (
    <Dialog
      eyebrow="Source"
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
                <strong>Quote found on page {card.sourcePage}</strong>
                <span>This is the passage the card was written from. Check the answer against it yourself.</span>
              </>
            ) : (
              <>
                <strong>Saved quote from page {card.sourcePage}</strong>
                <span>
                  {page
                    ? "This exact passage couldn't be pinpointed in the page text below, so the saved quote is shown on its own."
                    : "Page text isn't stored for this card, so only the saved quote is shown."}
                </span>
              </>
            )}
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
