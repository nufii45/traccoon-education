import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import * as legacy from '../features/pantries/repository'
import {
  CardNotFoundError,
  LocalPantryRepository,
  PantryNotFoundError,
  pantryRepository,
  type StoredCard,
  type StudyAttempt,
} from './pantryRepository'
import type { GeneratedCard, SourcePage } from '../features/local-ai/types'
import { INGREDIENTS, TREAT_RECIPES } from '../features/treats/catalog'
import { totalIngredients } from '../features/treats/engine'

const databaseNames = new Set<string>()
const repositories: LocalPantryRepository[] = []

const newDatabaseName = (): string => {
  const name = `traccoon-test-${crypto.randomUUID()}`
  databaseNames.add(name)
  return name
}

const openRepository = (name: string = newDatabaseName()): LocalPantryRepository => {
  const repository = new LocalPantryRepository(name)
  repositories.push(repository)
  return repository
}

// Raw read in Dexie dynamic mode (no version declared). Call only after the
// repository has opened the database; otherwise this creates an empty one.
const readStore = async <T>(databaseName: string, storeName: string): Promise<T[]> => {
  const raw = new Dexie(databaseName)
  try {
    await raw.open()
    return await raw.table<T>(storeName).toArray()
  } finally {
    raw.close()
  }
}

const readStoreNames = async (databaseName: string): Promise<string[]> => {
  const raw = new Dexie(databaseName)
  try {
    await raw.open()
    return raw.tables.map((table) => table.name).sort()
  } finally {
    raw.close()
  }
}

afterEach(async () => {
  repositories.splice(0).forEach((repository) => repository.close())
  await Promise.all([...databaseNames].map((name) => Dexie.delete(name)))
  databaseNames.clear()
})

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

// Realistic id: two pantries generated from page 1 produce the same card id.
const sharedCardId = 'webllm-page-1-chunk-1-1'

const cardWith = (overrides: Partial<GeneratedCard>): GeneratedCard => ({ ...card, ...overrides })

const pantryInput = (title: string) => ({ title, sourceName: `${title}.pdf`, sourcePages })

const findBinary = (value: unknown, path = 'record'): string | undefined => {
  if (
    ArrayBuffer.isView(value) ||
    Object.prototype.toString.call(value) === '[object ArrayBuffer]' ||
    (typeof Blob !== 'undefined' && value instanceof Blob)
  ) {
    return path
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const found = findBinary(child, `${path}.${key}`)
      if (found) {
        return found
      }
    }
  }
  return undefined
}

describe('LocalPantryRepository', () => {
  it('persists only source text, pantry metadata, and kept cards locally', async () => {
    const repository = openRepository()
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
    const repository = openRepository()
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

  it('keeps the features/pantries import path pointing at the same repository', () => {
    expect(legacy.pantryRepository).toBe(pantryRepository)
    expect(legacy.LocalPantryRepository).toBe(LocalPantryRepository)
  })

  it('reads pantries, cards, and attempts back after the database is reopened', async () => {
    const name = newDatabaseName()
    const first = openRepository(name)
    const saved = await first.save({ ...pantryInput('Cell biology'), cards: [card] })
    await first.appendAttempt({ pantryId: saved.id, cardId: card.id, selectedIndex: 0, isCorrect: true })
    first.close()

    const second = openRepository(name)

    await expect(second.load(saved.id)).resolves.toMatchObject({
      title: 'Cell biology',
      sourceName: 'Cell biology.pdf',
      cards: [expect.objectContaining({ id: 'card-1', pantryId: saved.id })],
      attempts: [expect.objectContaining({ cardId: 'card-1', isCorrect: true })],
    })
    expect((await second.load(saved.id))?.sourcePages).toEqual(sourcePages)
    await expect(second.list()).resolves.toEqual([
      expect.objectContaining({ id: saved.id, cardCount: 1 }),
    ])
  })

  it('deletes one pantry without touching another that shares a card id', async () => {
    const name = newDatabaseName()
    const repository = openRepository(name)
    const pantryA = await repository.save({
      ...pantryInput('A'),
      cards: [cardWith({ id: sharedCardId, question: 'A question' })],
    })
    const pantryB = await repository.save({
      ...pantryInput('B'),
      cards: [cardWith({ id: sharedCardId, question: 'B question' })],
    })
    await repository.appendAttempt({ pantryId: pantryA.id, cardId: sharedCardId, selectedIndex: 0, isCorrect: true })
    await repository.appendAttempt({ pantryId: pantryB.id, cardId: sharedCardId, selectedIndex: 1, isCorrect: false })

    await repository.deletePantry(pantryB.id)

    const storedCards = await readStore<StoredCard>(name, 'pantryCards')
    expect(storedCards).toEqual([
      expect.objectContaining({ id: sharedCardId, pantryId: pantryA.id, question: 'A question' }),
    ])
    const storedAttempts = await readStore<StudyAttempt>(name, 'attempts')
    expect(storedAttempts).toEqual([expect.objectContaining({ pantryId: pantryA.id, cardId: sharedCardId })])
    const storedPantries = await readStore<{ id: string; sourcePages: SourcePage[] }>(name, 'pantries')
    expect(storedPantries).toEqual([expect.objectContaining({ id: pantryA.id, sourcePages })])

    await expect(repository.load(pantryA.id)).resolves.toMatchObject({
      cards: [expect.objectContaining({ id: sharedCardId, question: 'A question' })],
      attempts: [expect.objectContaining({ cardId: sharedCardId, isCorrect: true })],
    })
    await expect(repository.load(pantryB.id)).resolves.toBeUndefined()
  })

  it('does not move or overwrite a card when another pantry saves the same card id', async () => {
    const name = newDatabaseName()
    const repository = openRepository(name)
    const pantryA = await repository.save({
      ...pantryInput('A'),
      cards: [cardWith({ id: sharedCardId, question: 'A question' })],
    })
    const pantryB = await repository.save({
      ...pantryInput('B'),
      cards: [cardWith({ id: sharedCardId, question: 'B question' })],
    })
    await repository.saveCards(pantryB.id, [cardWith({ id: sharedCardId, question: 'B question again' })])

    const loadedA = await repository.getPantry(pantryA.id)
    const loadedB = await repository.getPantry(pantryB.id)
    expect(loadedA?.cards).toEqual([
      expect.objectContaining({ id: sharedCardId, pantryId: pantryA.id, question: 'A question' }),
    ])
    expect(loadedB?.cards).toEqual([
      expect.objectContaining({ id: sharedCardId, pantryId: pantryB.id, question: 'B question again' }),
    ])
    await expect(readStore<StoredCard>(name, 'pantryCards')).resolves.toHaveLength(2)

    const summaries = await repository.list()
    expect(summaries).toHaveLength(2)
    expect(summaries.every((summary) => summary.cardCount === 1)).toBe(true)
  })

  it('scopes updateCard and deleteCard to one pantry', async () => {
    const repository = openRepository()
    const pantryA = await repository.save({
      ...pantryInput('A'),
      cards: [cardWith({ id: sharedCardId, question: 'A question' })],
    })
    const pantryB = await repository.save({
      ...pantryInput('B'),
      cards: [cardWith({ id: sharedCardId, question: 'B question' })],
    })

    await repository.updateCard(pantryB.id, cardWith({ id: sharedCardId, question: 'edited' }))

    expect((await repository.getPantry(pantryA.id))?.cards).toEqual([
      expect.objectContaining({ question: 'A question' }),
    ])
    expect((await repository.getPantry(pantryB.id))?.cards).toEqual([
      expect.objectContaining({ question: 'edited' }),
    ])

    await repository.deleteCard(pantryB.id, sharedCardId)

    expect((await repository.getPantry(pantryA.id))?.cards).toEqual([
      expect.objectContaining({ id: sharedCardId, question: 'A question' }),
    ])
    expect((await repository.getPantry(pantryB.id))?.cards).toEqual([])

    await expect(repository.updateCard(pantryA.id, cardWith({ id: 'missing' }))).rejects.toBeInstanceOf(
      CardNotFoundError,
    )
    await expect(repository.deleteCard(pantryA.id, 'missing')).rejects.toBeInstanceOf(CardNotFoundError)
    await expect(repository.updateCard('no-such-pantry', card)).rejects.toBeInstanceOf(PantryNotFoundError)
  })

  it('rejects attempts for an unknown pantry or a card outside the pantry', async () => {
    const name = newDatabaseName()
    const repository = openRepository(name)
    const pantryA = await repository.save(pantryInput('A'))
    await repository.save({ ...pantryInput('B'), cards: [cardWith({ id: 'only-in-b' })] })

    await expect(
      repository.appendAttempt({ pantryId: 'no-such-pantry', cardId: card.id, selectedIndex: 0, isCorrect: true }),
    ).rejects.toBeInstanceOf(PantryNotFoundError)
    await expect(
      repository.appendAttempt({ pantryId: pantryA.id, cardId: 'no-such-card', selectedIndex: 0, isCorrect: true }),
    ).rejects.toBeInstanceOf(CardNotFoundError)
    await expect(
      repository.appendAttempt({ pantryId: pantryA.id, cardId: 'only-in-b', selectedIndex: 0, isCorrect: true }),
    ).rejects.toBeInstanceOf(CardNotFoundError)
    await expect(
      repository.saveAttempt({ pantryId: 'no-such-pantry', cardId: card.id, selectedIndex: 0, isCorrect: true }),
    ).rejects.toBeInstanceOf(PantryNotFoundError)

    await expect(readStore<StudyAttempt>(name, 'attempts')).resolves.toEqual([])
  })

  it('creates a pantry with save and upserts cards into it by id', async () => {
    const name = newDatabaseName()
    const repository = openRepository(name)
    const second = cardWith({ id: 'card-2', createdAt: '2026-10-09T09:00:00.000Z' })

    const created = await repository.save({ ...pantryInput('Cells'), cards: [card] })
    expect(created.id).toEqual(expect.any(String))
    expect(created.cards).toEqual([expect.objectContaining({ id: 'card-1', pantryId: created.id })])

    const updated = await repository.save({ id: created.id, cards: [second] })
    expect(updated.id).toBe(created.id)
    expect(updated.cards.map((stored) => stored.id)).toEqual(['card-1', 'card-2'])

    await expect(repository.save({ id: 'missing', cards: [card] })).rejects.toBeInstanceOf(PantryNotFoundError)
    const storedCards = await readStore<StoredCard>(name, 'pantryCards')
    expect(storedCards.some((stored) => stored.pantryId === 'missing')).toBe(false)
  })

  it('upgrades a version 2 database without losing pantries, cards, or attempts', async () => {
    const name = newDatabaseName()
    const legacyDb = new Dexie(name)
    legacyDb.version(1).stores({
      pantries: 'id, updatedAt',
      cards: 'id, pantryId, createdAt',
    })
    legacyDb.version(2).stores({
      pantries: 'id, updatedAt',
      cards: 'id, pantryId, createdAt',
      attempts: 'id, pantryId, cardId, createdAt',
    })
    const legacyCard: StoredCard = { ...card, id: sharedCardId, pantryId: 'legacy-pantry' }
    await legacyDb.table('pantries').add({
      id: 'legacy-pantry',
      title: 'Legacy',
      sourceName: 'legacy.pdf',
      sourcePages,
      createdAt: '2026-10-01T08:00:00.000Z',
      updatedAt: '2026-10-01T08:00:00.000Z',
    })
    await legacyDb.table('cards').add(legacyCard)
    await legacyDb.table('attempts').add({
      id: 'legacy-attempt',
      pantryId: 'legacy-pantry',
      cardId: sharedCardId,
      selectedIndex: 0,
      isCorrect: true,
      createdAt: '2026-10-01T09:00:00.000Z',
    })
    legacyDb.close()

    const repository = openRepository(name)

    await expect(repository.load('legacy-pantry')).resolves.toMatchObject({
      title: 'Legacy',
      sourcePages,
      cards: [legacyCard],
      attempts: [expect.objectContaining({ id: 'legacy-attempt', cardId: sharedCardId })],
    })
    await expect(readStoreNames(name)).resolves.toEqual(['attempts', 'pantries', 'pantryCards', 'treatEconomy'])

    await repository.save({ ...pantryInput('New'), cards: [cardWith({ id: sharedCardId })] })
    await expect(readStore<StoredCard>(name, 'pantryCards')).resolves.toHaveLength(2)
  })

  it('stores no binary data in pantry, card, or attempt records', async () => {
    const name = newDatabaseName()
    const repository = openRepository(name)
    const smuggledPage = { ...sourcePages[0], bytes: new Uint8Array([1, 2, 3]) } as SourcePage
    const smuggledCard = { ...card, raw: new Uint8Array([4]) } as GeneratedCard
    const smuggledInput = {
      ...pantryInput('Binary'),
      sourcePages: [smuggledPage],
      cards: [smuggledCard],
      pdfBytes: new ArrayBuffer(8),
    } as Parameters<LocalPantryRepository['save']>[0]

    const pantry = await repository.save(smuggledInput)
    await repository.appendAttempt({
      pantryId: pantry.id,
      cardId: card.id,
      selectedIndex: 0,
      isCorrect: true,
      blob: new Blob(['x']),
    } as Parameters<LocalPantryRepository['appendAttempt']>[0])

    const storedPantries = await readStore<{ sourcePages: SourcePage[] }>(name, 'pantries')
    const storedCards = await readStore<StoredCard>(name, 'pantryCards')
    const storedAttempts = await readStore<StudyAttempt>(name, 'attempts')

    expect(storedPantries).toHaveLength(1)
    expect(storedCards).toHaveLength(1)
    expect(storedAttempts).toHaveLength(1)
    for (const record of [...storedPantries, ...storedCards, ...storedAttempts]) {
      expect(findBinary(record)).toBeUndefined()
    }
    expect(storedPantries[0].sourcePages).toEqual([
      { id: sourcePages[0].id, pageNumber: sourcePages[0].pageNumber, text: sourcePages[0].text },
    ])
  })

  it('round-trips isEdited and omits the key when it is not set', async () => {
    const name = newDatabaseName()
    const repository = openRepository(name)
    const pantry = await repository.save({
      ...pantryInput('Edited cards'),
      cards: [
        { ...cardWith({ id: 'edited-card' }), isEdited: true },
        cardWith({ id: 'plain-card' }),
      ],
    })

    const loaded = await repository.getPantry(pantry.id)
    const editedCard = loaded?.cards.find((stored) => stored.id === 'edited-card')
    const plainCard = loaded?.cards.find((stored) => stored.id === 'plain-card')
    expect(editedCard?.isEdited).toBe(true)
    expect(plainCard?.isEdited).toBeUndefined()

    const storedCards = await readStore<StoredCard>(name, 'pantryCards')
    const storedEdited = storedCards.find((stored) => stored.id === 'edited-card')
    const storedPlain = storedCards.find((stored) => stored.id === 'plain-card')
    expect(storedEdited?.isEdited).toBe(true)
    expect(storedPlain && 'isEdited' in storedPlain).toBe(false)
  })
})

describe('LocalPantryRepository treat economy', () => {
  /** A `random` that makes the ingredient draw land on this catalog index. */
  const drawIndex = (index: number) => () => (index + 0.5) / INGREDIENTS.length

  it('records a correct Quiz attempt and its single ingredient together', async () => {
    const repository = openRepository()
    const pantry = await repository.save({ ...pantryInput('Quiz'), cards: [card] })

    const result = await repository.appendQuizAttempt({ pantryId: pantry.id, cardId: card.id, selectedIndex: 0 }, drawIndex(2))

    expect(result.attempt).toMatchObject({ isCorrect: true, mode: 'quiz', cardId: card.id })
    expect(result.reward).toEqual({ type: 'quiz_correct', ingredientId: INGREDIENTS[2].id })
    const economy = await repository.loadTreatEconomy()
    expect(economy.ingredients).toEqual({ [INGREDIENTS[2].id]: 1 })
    expect(economy.events[`quiz:${result.attempt.id}`]).toEqual(result.reward)
    await expect(repository.listAttempts(pantry.id)).resolves.toEqual([result.attempt])
  })

  it('takes correctness from the stored card and grants nothing for a wrong answer', async () => {
    const repository = openRepository()
    const pantry = await repository.save({ ...pantryInput('Quiz'), cards: [card] })

    const result = await repository.appendQuizAttempt({ pantryId: pantry.id, cardId: card.id, selectedIndex: 3 })

    expect(result.attempt.isCorrect).toBe(false)
    expect(result.reward).toEqual({ type: 'quiz_incorrect' })
    expect(totalIngredients(await repository.loadTreatEconomy())).toBe(0)
  })

  it('writes neither the attempt nor an ingredient when the card is missing', async () => {
    const repository = openRepository()
    const pantry = await repository.save({ ...pantryInput('Quiz'), cards: [card] })

    await expect(repository.appendQuizAttempt({ pantryId: pantry.id, cardId: 'missing', selectedIndex: 0 })).rejects.toBeInstanceOf(CardNotFoundError)
    await expect(repository.listAttempts(pantry.id)).resolves.toEqual([])
    expect(totalIngredients(await repository.loadTreatEconomy())).toBe(0)
  })

  it('keeps Practice attempts free of ingredients', async () => {
    const repository = openRepository()
    const pantry = await repository.save({ ...pantryInput('Practice'), cards: [card] })

    await repository.appendAttempt({ pantryId: pantry.id, cardId: card.id, selectedIndex: 0, isCorrect: true })

    expect(totalIngredients(await repository.loadTreatEconomy())).toBe(0)
  })

  it('crafts and feeds once per action id, and keeps the shelf after reopening', async () => {
    const name = newDatabaseName()
    const repository = openRepository(name)
    const recipe = TREAT_RECIPES[0]
    const pantry = await repository.save({ ...pantryInput('Quiz'), cards: [card] })
    for (const ingredient of recipe.ingredients) {
      const index = INGREDIENTS.findIndex((item) => item.id === ingredient.id)
      await repository.appendQuizAttempt({ pantryId: pantry.id, cardId: card.id, selectedIndex: 0 }, drawIndex(index))
    }

    const crafted = await repository.craftTreat('craft-1', recipe.id)
    expect(crafted.state.treats[recipe.id]).toBe(1)
    await expect(repository.craftTreat('craft-1', recipe.id)).resolves.toMatchObject({ duplicate: true })
    await expect(repository.craftTreat('craft-2', recipe.id)).rejects.toThrow(/Missing ingredients/)
    expect(totalIngredients(await repository.loadTreatEconomy())).toBe(0)

    repository.close()
    const reopened = openRepository(name)
    expect((await reopened.loadTreatEconomy()).treats[recipe.id]).toBe(1)

    await reopened.feedTreat('feed-1', recipe.id, '2026-10-10')
    await expect(reopened.feedTreat('feed-1', recipe.id, '2026-10-10')).resolves.toMatchObject({ duplicate: true })
    await expect(reopened.feedTreat('feed-2', recipe.id, '2026-10-10')).rejects.toThrow(/No treat/)
    expect((await reopened.loadTreatEconomy()).treats[recipe.id]).toBe(0)
  })
})
