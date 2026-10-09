import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { StudySession } from './StudySession'
import { TEST_CARDS, TEST_PAGES } from './testCards'

// jsdom has no HTMLDialogElement.showModal; stub the open/close behaviour.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const renderSession = (onAttempt = vi.fn().mockResolvedValue(undefined)) => {
  render(
    <StudySession cards={TEST_CARDS} onAttempt={onAttempt} onBack={vi.fn()} sourceName="lecture-4.pdf" sourcePages={TEST_PAGES} />,
  )
  return onAttempt
}

const answer = (optionName: RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: optionName }))
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
}

describe('StudySession', () => {
  it('does not preselect an answer', () => {
    renderSession()
    expect(screen.getByRole('button', { name: 'Check answer' })).toBeDisabled()
  })

  it('shows feedback, saves the attempt, and reveals the correct answer when wrong', () => {
    const onAttempt = renderSession()
    answer(/Nucleus/)

    expect(screen.getByText('Not quite.')).toBeInTheDocument()
    expect(screen.getByText('The answer is A, Cytoplasm.')).toBeInTheDocument()
    expect(onAttempt).toHaveBeenCalledWith(1, false, 'card-1')
  })

  it('ends with a score and missed cards instead of looping', () => {
    renderSession()
    answer(/Cytoplasm/)
    fireEvent.click(screen.getByRole('button', { name: /Next card/ }))
    answer(/Nucleus/)
    fireEvent.click(screen.getByRole('button', { name: /See results/ }))

    expect(screen.getByRole('heading', { name: '1 of 2 correct' })).toBeInTheDocument()
    const missed = screen.getByRole('list')
    expect(within(missed).getByText('Where does the Krebs cycle take place?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Study 1 missed card' }))
    expect(screen.getByRole('heading', { name: 'Card 1 of 1' })).toBeInTheDocument()
  })

  it('opens the cited page with the quote highlighted', () => {
    const { container } = render(
      <StudySession cards={TEST_CARDS} onAttempt={vi.fn().mockResolvedValue(undefined)} onBack={vi.fn()} sourceName="lecture-4.pdf" sourcePages={TEST_PAGES} />,
    )
    answer(/Cytoplasm/)
    fireEvent.click(screen.getByRole('button', { name: 'See source · p.11' }))

    expect(screen.getByRole('heading', { name: 'Page 11 · lecture-4.pdf' })).toBeInTheDocument()
    expect(container.querySelector('mark')).toHaveTextContent('Glycolysis occurs in the cytoplasm and splits one molecule of glucose')

    fireEvent.click(screen.getByRole('button', { name: 'Back to card' }))
    expect(container.querySelector('dialog[open]')).toBeNull()
  })

  it('moves focus to the next step so keyboard users are not dropped', () => {
    renderSession()
    answer(/Cytoplasm/)
    expect(screen.getByRole('button', { name: /Next card/ })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: /Next card/ }))
    expect(screen.getByRole('heading', { name: 'Where does the Krebs cycle take place?' })).toHaveFocus()
  })

  it('does not claim the quote was found when it cannot be located on the page', () => {
    const misquoted = { ...TEST_CARDS[0], sourceQuote: 'A passage that is not on this page at all, word for word.' }
    render(
      <StudySession cards={[misquoted]} onAttempt={vi.fn().mockResolvedValue(undefined)} onBack={vi.fn()} sourceName="lecture-4.pdf" sourcePages={TEST_PAGES} />,
    )
    answer(/Cytoplasm/)
    fireEvent.click(screen.getByRole('button', { name: 'See source · p.11' }))

    expect(screen.queryByText(/Quote found/)).toBeNull()
    expect(screen.getByText('Saved quote from page 11')).toBeInTheDocument()
  })

  it('tells the learner when an attempt fails to save', async () => {
    renderSession(vi.fn().mockRejectedValue(new Error('quota')))
    answer(/Cytoplasm/)
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved on this device')
  })
})
