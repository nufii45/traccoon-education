import { afterEach, describe, expect, it } from 'vitest'
import { LocalPantryRepository } from './repository'
import type { GeneratedCard, SourcePage } from '../local-ai/types'

const repositories: LocalPantryRepository[] = []

const sourcePages: SourcePage[] = [
  { id: 'page-1', pageNumber: 1, text: 'The mitochondrion releases energy from food.' },
]

const card: GeneratedCard = {
  id: 'card-1',
  question: 'What does the mitochondrion release from food?',
  options: ['Energy', 'Water', 'Light', 'Soil'],
  correctIndex: 0,
  sourcePage: 1,
  sourceQuote: 'The mitochondrion releases energy from food.',
  sourceChunkId: 'page-1-chunk-1',
  generationMode: 'local-private',
  generationMethod: 'manual',
  createdAt: '2026-10-09T08:00:00.000Z',
}

afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repository) => repository.destroy()))
})

describe('LocalPantryRepository', () => {
  it('persists only source text, pantry metadata, and kept cards locally', async () => {
    const repository = new LocalPantryRepository(`traccoon-test-${crypto.randomUUID()}`)
    repositories.push(repository)
    const pantry = await repository.createPantry({
      title: 'Cell biology',
      sourceName: 'cells.pdf',
      sourcePages,
    })

    await repository.saveCards(pantry.id, [card])
    await repository.saveAttempt({
      pantryId: pantry.id,
      cardId: card.id,
      selectedIndex: 0,
      isCorrect: true,
    })

    await expect(repository.getPantry(pantry.id)).resolves.toMatchObject({
      title: 'Cell biology',
      sourceName: 'cells.pdf',
      sourcePages,
      cards: [expect.objectContaining({ id: 'card-1', pantryId: pantry.id })],
    })
    await expect(repository.listAttempts(pantry.id)).resolves.toEqual([
      expect.objectContaining({ cardId: 'card-1', selectedIndex: 0, isCorrect: true }),
    ])
    await expect(repository.listPantries()).resolves.toEqual([
      expect.objectContaining({ id: pantry.id, cardCount: 1 }),
    ])
  })

  it('deletes the pantry and its cards together', async () => {
    const repository = new LocalPantryRepository(`traccoon-test-${crypto.randomUUID()}`)
    repositories.push(repository)
    const pantry = await repository.createPantry({
      title: 'Cell biology',
      sourceName: 'cells.pdf',
      sourcePages,
    })
    await repository.saveCards(pantry.id, [card])
    await repository.saveAttempt({
      pantryId: pantry.id,
      cardId: card.id,
      selectedIndex: 0,
      isCorrect: true,
    })

    await repository.deletePantry(pantry.id)

    await expect(repository.getPantry(pantry.id)).resolves.toBeUndefined()
    await expect(repository.listPantries()).resolves.toEqual([])
    await expect(repository.listAttempts(pantry.id)).resolves.toEqual([])
  })
})
