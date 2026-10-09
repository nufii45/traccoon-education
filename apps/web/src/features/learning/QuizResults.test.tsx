import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { StoredCard, StudyAttempt } from '../../data/pantryRepository'
import { TREATS_PATH } from '../../app/navigation'
import type { SourcePage } from '../local-ai/types'
import type { IngredientId } from '../treats/catalog'
import { QuizResults } from './QuizResults'

const sourcePages: SourcePage[] = [
  {
    id: 'page-6',
    pageNumber: 6,
    text: 'On moistened paper towels, Bitongol seeds germinated after 15 days. In potting medium they germinated after 39 days.',
  },
]

const makeCard = (number: number): StoredCard => ({
  id: `card-${number}`,
  pantryId: 'pantry-1',
  question: `What happened in question ${number}?`,
  options: ['15 days', '39 days', '10 days', '20 days'],
  correctIndex: 0,
  sourcePage: 6,
  sourceQuote: 'On moistened paper towels, Bitongol seeds germinated after 15 days.',
  sourceChunkId: 'chunk-6',
  generationMode: 'local-private',
  generationMethod: 'webllm',
  createdAt: '2026-10-09T10:00:00.000Z',
})

const makeAttempt = (card: StoredCard, isCorrect: boolean): StudyAttempt => ({
  id: `attempt-${card.id}`,
  pantryId: card.pantryId,
  cardId: card.id,
  selectedIndex: isCorrect ? 0 : 1,
  isCorrect,
  createdAt: '2026-10-09T10:01:00.000Z',
  mode: 'quiz',
})

function renderResults({
  correct = [true, false, true],
  ingredientIds = [],
  pages = sourcePages,
  evidenceFor = () => ({ status: 'source-linked' as const }),
}: {
  correct?: boolean[]
  ingredientIds?: IngredientId[]
  pages?: SourcePage[]
  evidenceFor?: (card: StoredCard) => { status: 'source-linked' | 'needs-review' }
} = {}) {
  const cards = correct.map((_, index) => makeCard(index + 1))
  const attempts = cards.map((card, index) => makeAttempt(card, correct[index]))
  const onPracticeMissed = vi.fn()
  const onStudyAll = vi.fn()
  const onBack = vi.fn()
  render(
    <MemoryRouter>
      <QuizResults
        attempts={attempts}
        cards={cards}
        evidenceFor={evidenceFor}
        ingredientIds={ingredientIds}
        onBack={onBack}
        onPracticeMissed={onPracticeMissed}
        onStudyAll={onStudyAll}
        sourceName="seeds.pdf"
        sourcePages={pages}
      />
    </MemoryRouter>,
  )
  return { cards, onPracticeMissed, onStudyAll, onBack }
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

describe('QuizResults', () => {
  it('uses saved attempt correctness for a variable-length score and ordered segments', () => {
    renderResults({ correct: [false, true, true, false, true] })

    expect(screen.getByRole('heading', { level: 1, name: 'Session complete!' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Session complete!' })).toHaveFocus()
    expect(screen.getByRole('heading', { level: 2, name: 'Rewards earned' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: "Let's practice these again" })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'What happened in question 1?' })).toBeInTheDocument()
    expect(screen.getByText('3 out of 5 correct')).toBeInTheDocument()
    const segments = within(screen.getByRole('list', { name: 'Question results' })).getAllByRole('listitem')
    expect(segments).toHaveLength(5)
    expect(segments.map((segment) => segment.getAttribute('aria-label'))).toEqual([
      'Question 1: needs practice',
      'Question 2: correct',
      'Question 3: correct',
      'Question 4: needs practice',
      'Question 5: correct',
    ])
    expect(screen.getByText('2 to review')).toBeInTheDocument()
  })

  it('shows a perfect-score message and removes the missed practice action', () => {
    const { onBack, onStudyAll } = renderResults({ correct: [true] })

    expect(screen.getByText('1 out of 1 correct')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'All caught up' })).toBeInTheDocument()
    expect(screen.getByText('You got every card right.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Practice .* missed/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Study all again' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to Learning Hub' }))
    expect(onStudyAll).toHaveBeenCalledOnce()
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('keeps a zero score supportive and practices only missed cards through the callback', () => {
    const { onPracticeMissed, onStudyAll, onBack } = renderResults({ correct: [false, false] })

    expect(screen.getByText('0 out of 2 correct')).toBeInTheDocument()
    expect(screen.getByText(/Let's practice together/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Practice 2 missed cards' }))
    fireEvent.click(screen.getByRole('button', { name: 'Study all again' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to Learning Hub' }))
    expect(onPracticeMissed).toHaveBeenCalledOnce()
    expect(onStudyAll).toHaveBeenCalledOnce()
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('shows each awarded ingredient, including duplicates, and links to the Treat Shelf', () => {
    renderResults({ ingredientIds: ['flour', 'egg', 'flour'] })

    expect(screen.getByText('3 ingredients collected')).toBeInTheDocument()
    const rewards = within(screen.getByRole('list', { name: 'Ingredients collected' })).getAllByRole('listitem')
    expect(rewards).toHaveLength(3)
    expect(rewards.map((item) => item.textContent)).toEqual(['Flour', 'Egg', 'Flour'])
    expect(screen.getByRole('link', { name: /Visit Treat Shelf/ })).toHaveAttribute('href', TREATS_PATH)
  })

  it('does not invent rewards for a session with none', () => {
    renderResults({ ingredientIds: [] })

    expect(screen.getByText('No ingredients collected this round.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Ingredients collected' })).not.toBeInTheDocument()
  })

  it('shows the saved answer text and hides the source quote until opened', () => {
    renderResults({ correct: [false] })

    expect(screen.getByText('15 days')).toBeInTheDocument()
    const disclosure = screen.getByText('Page 6 · View saved quote').closest('details')
    expect(disclosure).not.toHaveAttribute('open')
    expect(within(disclosure as HTMLElement).getByText(/On moistened paper towels/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open source page 6' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Page 6 · seeds.pdf/)).toBeInTheDocument()
  })

  it('marks a missing cited page for review and omits broken page actions', () => {
    renderResults({
      correct: [false],
      pages: [],
    })

    expect(screen.getByText('Needs review')).toBeInTheDocument()
    expect(screen.getByText('Saved answer to check')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open source page/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/verified answer/i)).not.toBeInTheDocument()
  })

  it('keeps a flagged answer under review even when its cited page is available', () => {
    renderResults({
      correct: [false],
      evidenceFor: () => ({ status: 'needs-review' }),
    })

    expect(screen.getByText('Needs review')).toBeInTheDocument()
    expect(screen.getByText('Saved answer to check')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open source page 6' })).toBeInTheDocument()
  })

  it('reveals all missed cards when there are more than three', () => {
    renderResults({ correct: [false, false, false, false, false] })

    expect(screen.getAllByText(/What happened in question/)).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more' }))
    expect(screen.getAllByText(/What happened in question/)).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }))
    expect(screen.getAllByText(/What happened in question/)).toHaveLength(3)
  })
})
