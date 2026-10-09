import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { writeOnboardingState } from '../onboarding/onboardingState'
import { pantryRepository } from '../pantries/repository'
import { ingredientById } from '../treats/catalog'
import { totalIngredients } from '../treats/engine'

// jsdom has no HTMLDialogElement.showModal; stub the open/close behaviour.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const manualCard = (id: string) => ({
  id,
  question: `Question ${id}?`,
  options: ['Right answer', 'Wrong one', 'Wrong two', 'Wrong three'],
  correctIndex: 0,
  sourcePage: 0,
  sourceQuote: '',
  sourceChunkId: '',
  generationMode: 'local-private' as const,
  generationMethod: 'manual' as const,
  createdAt: new Date().toISOString(),
})

const createPantry = async (title: string, cardCount: number) => {
  const pantry = await pantryRepository.createPantry({ title, sourceName: 'Written by hand', sourcePages: [] })
  await pantryRepository.saveCards(pantry.id, Array.from({ length: cardCount }, (_, index) => manualCard(`${title}-${index}`)))
  return pantry
}

describe('Learning Hub practice', () => {
  beforeEach(() => {
    localStorage.clear()
    writeOnboardingState({ completed: true, mode: 'local-private' })
    window.history.replaceState(null, '', '/')
  })

  it('offers Practice and Quiz', async () => {
    window.history.replaceState(null, '', '/learn')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Pick how you want to study.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Practice/ })).toHaveAttribute('href', '/learn/practice')
    expect(screen.getByRole('link', { name: /Quiz/ })).toHaveAttribute('href', '/learn/quiz')
  })

  it('runs a five-card round from a larger pantry and returns to the Learning Hub', async () => {
    const pantry = await createPantry('Big set', 8)
    window.history.replaceState(null, '', '/learn/practice')
    render(<App />)

    const row = (await screen.findByText('Big set')).closest('li') as HTMLElement
    expect(row).toHaveTextContent('8 cards · round of 5')
    fireEvent.click(within(row).getByRole('link', { name: 'Practice Big set' }))

    expect(await screen.findByText(/PRACTICE · 5 CARDS/)).toBeInTheDocument()
    expect(window.location.pathname).toBe(`/learn/practice/${pantry.id}`)
    expect(screen.getByText('Card 1 of 5')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to Learning Hub' }))
    expect(await screen.findByRole('heading', { name: 'Choose a pantry.' })).toBeInTheDocument()
  })

  it('points pantries without cards back to authoring instead of starting a round', async () => {
    const pantry = await createPantry('Empty set', 0)
    window.history.replaceState(null, '', '/learn/practice')
    render(<App />)

    const row = (await screen.findByText('Empty set')).closest('li') as HTMLElement
    expect(within(row).queryByRole('link', { name: /Practice/ })).toBeNull()
    expect(within(row).getByRole('link', { name: 'Add cards' })).toHaveAttribute('href', `/pantries/${pantry.id}`)
  })

  it('labels the pantry shortcut with the round size when a pantry has more than five cards', async () => {
    const pantry = await createPantry('Long set', 12)
    window.history.replaceState(null, '', `/pantries/${pantry.id}`)
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Study 5 of 12 cards' }))

    expect(await screen.findByRole('button', { name: 'Back to pantry' })).toBeInTheDocument()
    expect(window.location.pathname).toBe(`/learn/practice/${pantry.id}`)
  })
})

describe('Learning Hub quiz', () => {
  beforeEach(() => {
    localStorage.clear()
    writeOnboardingState({ completed: true, mode: 'local-private' })
    window.history.replaceState(null, '', '/')
  })

  const answer = async (option: string) => {
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(option) }))
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
  }

  it('starts a Quiz round from the picker', async () => {
    const pantry = await createPantry('Quiz set', 3)
    window.history.replaceState(null, '', '/learn/quiz')
    render(<App />)

    const row = (await screen.findByText('Quiz set')).closest('li') as HTMLElement
    fireEvent.click(within(row).getByRole('link', { name: 'Quiz Quiz set' }))

    expect(await screen.findByText(/QUIZ · 3 CARDS/)).toBeInTheDocument()
    expect(window.location.pathname).toBe(`/learn/quiz/${pantry.id}`)
  })

  it('shows the stored ingredient after a correct answer and saves it with the attempt', async () => {
    const pantry = await createPantry('Correct set', 1)
    const before = totalIngredients(await pantryRepository.loadTreatEconomy())
    window.history.replaceState(null, '', `/learn/quiz/${pantry.id}`)
    render(<App />)

    await answer('Right answer')

    const popup = await screen.findByRole('dialog', { name: /^You found .+!$/ })
    const economy = await pantryRepository.loadTreatEconomy()
    expect(totalIngredients(economy)).toBe(before + 1)
    const [attempt] = await pantryRepository.listAttempts(pantry.id)
    expect(attempt).toMatchObject({ isCorrect: true, mode: 'quiz' })
    const stored = economy.events[`quiz:${attempt.id}`]
    if (stored.type !== 'quiz_correct') throw new Error('Expected a stored ingredient')
    const name = ingredientById[stored.ingredientId].name
    expect(popup).toHaveAccessibleName(`You found ${name}!`)
    expect(within(popup).getByRole('img', { name })).toBeInTheDocument()

    fireEvent.click(within(popup).getByRole('button', { name: 'Keep going' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: /See results/ })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: /See results/ }))
    expect(await screen.findByText('1 ingredient collected')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Visit Treat Shelf' })).toHaveAttribute('href', '/treats')
  })

  it('finds no ingredient for a wrong answer', async () => {
    const pantry = await createPantry('Wrong set', 1)
    const before = totalIngredients(await pantryRepository.loadTreatEconomy())
    window.history.replaceState(null, '', `/learn/quiz/${pantry.id}`)
    render(<App />)

    await answer('Wrong one')

    expect(await screen.findByText(/No ingredient this time/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(totalIngredients(await pantryRepository.loadTreatEconomy())).toBe(before)
  })

  it('reopens a completed Quiz from its URL without awarding another ingredient', async () => {
    const pantry = await createPantry('Saved result', 1)
    window.history.replaceState(null, '', `/learn/quiz/${pantry.id}`)
    const view = render(<App />)

    await answer('Right answer')
    const popup = await screen.findByRole('dialog', { name: /^You found .+!$/ })
    fireEvent.click(within(popup).getByRole('button', { name: 'Keep going' }))
    fireEvent.click(await screen.findByRole('button', { name: /See results/ }))
    expect(await screen.findByRole('heading', { name: /Session complete/i })).toBeInTheDocument()

    const resultId = new URLSearchParams(window.location.search).get('result')
    expect(resultId).toBeTruthy()
    const saved = await pantryRepository.loadQuizSession(resultId!)
    expect(saved?.attempts).toHaveLength(1)
    expect(saved?.awardedIngredients).toHaveLength(1)
    const ingredientCount = totalIngredients(await pantryRepository.loadTreatEconomy())

    view.unmount()
    render(<App />)
    expect(await screen.findByRole('heading', { name: /Session complete/i })).toBeInTheDocument()
    expect(totalIngredients(await pantryRepository.loadTreatEconomy())).toBe(ingredientCount)
    expect((await pantryRepository.listAttempts(pantry.id)).filter((attempt) => attempt.mode === 'quiz')).toHaveLength(1)
  })

  it('retries only missed cards from the saved round and retains the original result', async () => {
    const pantry = await createPantry('Retry set', 2)
    window.history.replaceState(null, '', `/learn/quiz/${pantry.id}`)
    render(<App />)

    for (let index = 0; index < 2; index += 1) {
      const question = await screen.findByRole('heading', { name: /^Question Retry set-/ })
      const isMissed = question.textContent?.includes('Retry set-1') ?? false
      await answer(isMissed ? 'Wrong one' : 'Right answer')
      if (!isMissed) {
        const popup = await screen.findByRole('dialog', { name: /^You found .+!$/ })
        fireEvent.click(within(popup).getByRole('button', { name: 'Keep going' }))
      }
      fireEvent.click(await screen.findByRole('button', { name: /Next card|See results/ }))
    }

    expect(await screen.findByRole('heading', { name: /Session complete/i })).toBeInTheDocument()
    const originalId = new URLSearchParams(window.location.search).get('result')
    expect(originalId).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: 'Practice 1 missed card' }))
    expect(await screen.findByRole('heading', { name: 'Card 1 of 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Question Retry set-1?' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Question Retry set-0?' })).toBeNull()
    expect((await pantryRepository.loadQuizSession(originalId!))?.attempts).toHaveLength(2)
  })

  it('studies every original card again without changing the completed attempt', async () => {
    const pantry = await createPantry('Study all set', 2)
    window.history.replaceState(null, '', `/learn/quiz/${pantry.id}`)
    render(<App />)

    for (let index = 0; index < 2; index += 1) {
      await answer('Wrong one')
      fireEvent.click(await screen.findByRole('button', { name: /Next card|See results/ }))
    }

    expect(await screen.findByRole('heading', { name: /Session complete/i })).toBeInTheDocument()
    const originalId = new URLSearchParams(window.location.search).get('result')
    expect(originalId).toBeTruthy()
    const original = await pantryRepository.loadQuizSession(originalId!)
    expect(original?.cards).toHaveLength(2)
    expect(original?.attempts).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Study all again' }))
    expect(await screen.findByRole('heading', { name: 'Card 1 of 2' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: original?.cards[0].question })).toBeInTheDocument()
    await answer('Wrong one')
    fireEvent.click(await screen.findByRole('button', { name: 'Next card' }))
    expect(screen.getByRole('heading', { name: 'Card 2 of 2' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: original?.cards[1].question })).toBeInTheDocument()
    await answer('Wrong one')
    fireEvent.click(await screen.findByRole('button', { name: /See results/ }))

    expect(await screen.findByRole('heading', { name: /Session complete/i })).toBeInTheDocument()
    const retryId = new URLSearchParams(window.location.search).get('result')
    expect(retryId).toBeTruthy()
    expect(retryId).not.toBe(originalId)
    expect((await pantryRepository.loadQuizSession(retryId!))?.attempts.map((attempt) => attempt.sourceSessionId)).toEqual([originalId, originalId])
    expect((await pantryRepository.loadQuizSession(originalId!))?.attempts.map((attempt) => attempt.id)).toEqual(original?.attempts.map((attempt) => attempt.id))
    expect((await pantryRepository.listAttempts(pantry.id)).filter((attempt) => attempt.mode === 'quiz')).toHaveLength(4)
  })
})
