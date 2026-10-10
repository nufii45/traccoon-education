import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

  it('shows feedback, saves the attempt, and reveals the correct answer when wrong', async () => {
    const onAttempt = renderSession()
    answer(/Nucleus/)

    expect(await screen.findByText('Not quite.')).toBeInTheDocument()
    expect(screen.getByText('The answer is A, Cytoplasm.')).toBeInTheDocument()
    expect(onAttempt).toHaveBeenCalledWith(1, false, 'card-1')
  })

  it('ends with a score and missed cards instead of looping', async () => {
    renderSession()
    answer(/Cytoplasm/)
    fireEvent.click(await screen.findByRole('button', { name: /Next card/ }))
    answer(/Nucleus/)
    fireEvent.click(await screen.findByRole('button', { name: /See results/ }))

    expect(await screen.findByRole('heading', { name: '1 of 2 correct' })).toBeInTheDocument()
    const missed = screen.getByRole('list')
    expect(within(missed).getByText('Where does the Krebs cycle take place?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Study 1 missed card' }))
    expect(screen.getByRole('heading', { name: 'Card 1 of 1' })).toBeInTheDocument()
  })

  it('opens the cited page with the quote highlighted', async () => {
    const { container } = render(
      <StudySession cards={TEST_CARDS} onAttempt={vi.fn().mockResolvedValue(undefined)} onBack={vi.fn()} sourceName="lecture-4.pdf" sourcePages={TEST_PAGES} />,
    )
    answer(/Cytoplasm/)
    fireEvent.click(await screen.findByRole('button', { name: 'See source · p.11' }))

    expect(screen.getByRole('heading', { name: 'Page 11 · lecture-4.pdf' })).toBeInTheDocument()
    expect(container.querySelector('mark')).toHaveTextContent('Glycolysis occurs in the cytoplasm and splits one molecule of glucose')

    fireEvent.click(screen.getByRole('button', { name: 'Back to card' }))
    expect(container.querySelector('dialog[open]')).toBeNull()
  })

  it('moves focus to the next step so keyboard users are not dropped', async () => {
    renderSession()
    answer(/Cytoplasm/)
    expect(await screen.findByRole('button', { name: /Next card/ })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: /Next card/ }))
    expect(screen.getByRole('heading', { name: 'Where does the Krebs cycle take place?' })).toHaveFocus()
  })

  it('does not claim the quote was found when it cannot be located on the page', async () => {
    const misquoted = { ...TEST_CARDS[0], sourceQuote: 'A passage that is not on this page at all, word for word.' }
    render(
      <StudySession cards={[misquoted]} onAttempt={vi.fn().mockResolvedValue(undefined)} onBack={vi.fn()} sourceName="lecture-4.pdf" sourcePages={TEST_PAGES} />,
    )
    answer(/Cytoplasm/)
    fireEvent.click(await screen.findByRole('button', { name: 'See source · p.11' }))

    expect(screen.queryByText(/Quote found/)).toBeNull()
    expect(screen.getByText('Saved quote from page 11')).toBeInTheDocument()
  })

  it('hides the source view for a manual card with no source', () => {
    const manual = { ...TEST_CARDS[0], sourcePage: 0, sourceQuote: '', sourceChunkId: '', generationMethod: 'manual' as const }
    render(
      <StudySession cards={[manual]} onAttempt={vi.fn().mockResolvedValue(undefined)} onBack={vi.fn()} sourceName="Written by hand" sourcePages={[]} />,
    )
    expect(screen.getByText(/No source · Manual/)).toBeInTheDocument()
    answer(/Cytoplasm/)
    expect(screen.queryByRole('button', { name: /See source/ })).toBeNull()
  })

  it('tells the learner when an attempt fails to save', async () => {
    renderSession(vi.fn().mockRejectedValue(new Error('quota')))
    answer(/Cytoplasm/)
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved on this device')
  })

  it('reveals an optional explanation only after the answer is saved', async () => {
    const withExplanation = { ...TEST_CARDS[0], explanation: 'Oxygen is not required for this step.' }
    render(
      <StudySession cards={[withExplanation]} onAttempt={vi.fn().mockResolvedValue(undefined)} onBack={vi.fn()} sourceName="lecture-4.pdf" sourcePages={TEST_PAGES} />,
    )
    expect(screen.queryByText('Oxygen is not required for this step.')).toBeNull()
    answer(/Cytoplasm/)
    expect(await screen.findByText('Oxygen is not required for this step.')).toBeInTheDocument()
  })

  it('does not count an answer or accept another click until its local save succeeds', async () => {
    let finishSave: (() => void) | undefined
    const onAttempt = vi.fn(() => new Promise<void>((resolve) => { finishSave = resolve }))
    renderSession(onAttempt)

    answer(/Cytoplasm/)
    expect(screen.queryByText('Correct.')).toBeNull()
    expect(screen.getByRole('button', { name: /Saving answer/ })).toBeDisabled()
    expect(onAttempt).toHaveBeenCalledTimes(1)

    finishSave?.()
    expect(await screen.findByText('Correct.')).toBeInTheDocument()
    expect(onAttempt).toHaveBeenCalledTimes(1)
  })

  it('lets the learner retry a failed save without counting the answer twice', async () => {
    const onAttempt = vi.fn().mockRejectedValueOnce(new Error('quota')).mockResolvedValueOnce(undefined)
    renderSession(onAttempt)

    answer(/Cytoplasm/)
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved on this device')
    expect(screen.queryByText('Correct.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))

    expect(await screen.findByText('Correct.')).toBeInTheDocument()
    expect(onAttempt).toHaveBeenCalledTimes(2)
  })

  it('keeps final feedback visible until the completed round is saved', async () => {
    let finishRound: (() => void) | undefined
    const onFinish = vi.fn(() => new Promise<void>((resolve) => { finishRound = resolve }))
    render(
      <StudySession
        cards={[TEST_CARDS[0]]}
        onAttempt={vi.fn().mockResolvedValue(undefined)}
        onBack={vi.fn()}
        onFinish={onFinish}
        sourceName="lecture-4.pdf"
        sourcePages={TEST_PAGES}
      />,
    )

    answer(/Cytoplasm/)
    fireEvent.click(await screen.findByRole('button', { name: /See results/ }))
    expect(onFinish).toHaveBeenCalledWith([{ cardId: 'card-1', selectedIndex: 0, isCorrect: true }])
    expect(screen.queryByRole('heading', { name: '1 of 1 correct' })).toBeNull()

    finishRound?.()
    await waitFor(() => expect(screen.getByRole('heading', { name: '1 of 1 correct' })).toBeInTheDocument())
  })

  it('does not present a flagged saved answer as an established fact', async () => {
    render(
      <StudySession
        cards={[TEST_CARDS[0]]}
        evidenceFor={() => ({ status: 'needs-review' })}
        onAttempt={vi.fn().mockResolvedValue(undefined)}
        onBack={vi.fn()}
        sourceName="lecture-4.pdf"
        sourcePages={TEST_PAGES}
      />,
    )

    answer(/Nucleus/)
    expect(await screen.findByText('Saved answer needs review.')).toBeInTheDocument()
    expect(screen.getByText('This card says A, Cytoplasm. Check it against the source.')).toBeInTheDocument()
    expect(screen.queryByText('The answer is A, Cytoplasm.')).toBeNull()
    expect(screen.queryByText('Correct answer')).toBeNull()
  })
})
