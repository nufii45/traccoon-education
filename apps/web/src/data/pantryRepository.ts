import Dexie, { type EntityTable, type Table } from 'dexie'
import type { GeneratedCard, SourcePage } from '../features/local-ai/types'

interface PantryRecord {
  id: string
  title: string
  sourceName: string
  sourcePages: SourcePage[]
  createdAt: string
  updatedAt: string
}

/**
 * A card queued for saving. Extends {@link GeneratedCard} with an optional
 * `isEdited` flag set when a learner has manually edited the card. Plain
 * `GeneratedCard` values stay assignable because `isEdited` is optional.
 */
export interface CardToSave extends GeneratedCard {
  isEdited?: boolean
}

export interface StoredCard extends CardToSave {
  pantryId: string
}

export interface PantrySummary {
  id: string
  title: string
  sourceName: string
  pageCount: number
  cardCount: number
  createdAt: string
  updatedAt: string
}

export interface Pantry extends Omit<PantryRecord, 'updatedAt'> {
  updatedAt: string
  cards: StoredCard[]
}

/** A pantry with its cards and every study attempt recorded for it. */
export interface LoadedPantry extends Pantry {
  attempts: StudyAttempt[]
}

export interface StudyAttempt {
  id: string
  pantryId: string
  cardId: string
  selectedIndex: number
  isCorrect: boolean
  createdAt: string
}

export type CreateStudyAttemptInput = Omit<StudyAttempt, 'id' | 'createdAt'>

export interface CreatePantryInput {
  title: string
  sourceName: string
  sourcePages: SourcePage[]
}

/**
 * Input for {@link LocalPantryRepository.save}.
 *
 * - Without `id`: create a new pantry with optional initial cards.
 * - With `id`: upsert `cards` into that existing pantry.
 */
export type SavePantryInput =
  | (CreatePantryInput & { id?: undefined; cards?: CardToSave[] })
  | { id: string; cards: CardToSave[] }

export class PantryNotFoundError extends Error {
  constructor() {
    super('Pantry not found')
    this.name = 'PantryNotFoundError'
  }
}

export class CardNotFoundError extends Error {
  constructor() {
    super('Card not found in this pantry')
    this.name = 'CardNotFoundError'
  }
}

type TraccoonTables = {
  pantries: EntityTable<PantryRecord, 'id'>
  pantryCards: Table<StoredCard, [string, string]>
  attempts: EntityTable<StudyAttempt, 'id'>
}

const now = () => new Date().toISOString()

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`

// Store only declared fields so nothing extra (for example PDF bytes) reaches IndexedDB.
const toPageRecord = (page: SourcePage): SourcePage => ({
  id: page.id,
  pageNumber: page.pageNumber,
  text: page.text,
})

const toStoredCard = (pantryId: string, card: CardToSave): StoredCard => {
  const stored: StoredCard = {
    id: card.id,
    question: card.question,
    options: [...card.options],
    correctIndex: card.correctIndex,
    sourcePage: card.sourcePage,
    sourceQuote: card.sourceQuote,
    sourceChunkId: card.sourceChunkId,
    generationMode: card.generationMode,
    createdAt: card.createdAt,
    pantryId,
  }

  if (card.generationMethod !== undefined) {
    stored.generationMethod = card.generationMethod
  }

  if (card.isEdited !== undefined) {
    stored.isEdited = card.isEdited
  }

  return stored
}

/**
 * Local Private pantry storage in IndexedDB. Nothing here leaves the device.
 *
 * Card ids are unique per pantry, not globally: two pantries may each hold a
 * card with the same id, and every card read, write, and delete is scoped by
 * pantry id.
 */
export class LocalPantryRepository {
  private readonly db: Dexie & TraccoonTables

  constructor(databaseName = 'traccoon-local-private') {
    this.db = new Dexie(databaseName) as Dexie & TraccoonTables
    this.db.version(1).stores({
      pantries: 'id, updatedAt',
      cards: 'id, pantryId, createdAt',
    })
    this.db.version(2).stores({
      pantries: 'id, updatedAt',
      cards: 'id, pantryId, createdAt',
      attempts: 'id, pantryId, cardId, createdAt',
    })
    // v3: cards were keyed by a global id, so two pantries built from the same
    // page collided. Dexie cannot change a primary key in place, so copy rows
    // into a pantry-scoped table and drop the old one.
    this.db
      .version(3)
      .stores({
        pantries: 'id, updatedAt',
        cards: null,
        pantryCards: '[pantryId+id], pantryId, createdAt',
        attempts: 'id, pantryId, cardId, createdAt',
      })
      .upgrade(async (tx) => {
        const legacyCards = await tx.table<StoredCard, string>('cards').toArray()
        await tx.table<StoredCard, [string, string]>('pantryCards').bulkPut(legacyCards)
      })
  }

  private async requirePantry(pantryId: string): Promise<PantryRecord> {
    const pantry = await this.db.pantries.get(pantryId)
    if (!pantry) {
      throw new PantryNotFoundError()
    }
    return pantry
  }

  private async requireCard(pantryId: string, cardId: string): Promise<StoredCard> {
    const card = await this.db.pantryCards.get([pantryId, cardId])
    if (!card) {
      throw new CardNotFoundError()
    }
    return card
  }

  private readCards(pantryId: string): Promise<StoredCard[]> {
    return this.db.pantryCards.where('pantryId').equals(pantryId).sortBy('createdAt')
  }

  private readAttempts(pantryId: string): Promise<StudyAttempt[]> {
    return this.db.attempts.where('pantryId').equals(pantryId).sortBy('createdAt')
  }

  private async readPantry(pantryId: string): Promise<Pantry | undefined> {
    const pantry = await this.db.pantries.get(pantryId)
    if (!pantry) {
      return undefined
    }
    return { ...pantry, cards: await this.readCards(pantryId) }
  }

  private insertAttempt(input: CreateStudyAttemptInput, requireCard: boolean): Promise<StudyAttempt> {
    return this.db.transaction('rw', this.db.pantries, this.db.pantryCards, this.db.attempts, async () => {
      await this.requirePantry(input.pantryId)
      if (requireCard) {
        await this.requireCard(input.pantryId, input.cardId)
      }

      const attempt: StudyAttempt = {
        id: createId(),
        pantryId: input.pantryId,
        cardId: input.cardId,
        selectedIndex: input.selectedIndex,
        isCorrect: input.isCorrect,
        createdAt: now(),
      }
      await this.db.attempts.add(attempt)
      return attempt
    })
  }

  /**
   * Create or update a pantry atomically.
   *
   * - Without `id`: creates a new pantry (blank titles become
   *   `'Untitled pantry'`) plus any initial `cards`.
   * - With `id`: upserts `cards` into that pantry by card id; cards not listed
   *   are kept. Throws {@link PantryNotFoundError} and writes nothing when the
   *   pantry does not exist.
   *
   * Only text fields are stored. Resolves to the saved pantry with all of its
   * cards, sorted by `createdAt`.
   */
  save(input: SavePantryInput): Promise<Pantry> {
    return this.db.transaction('rw', this.db.pantries, this.db.pantryCards, async () => {
      if (input.id === undefined) {
        const timestamp = now()
        const pantry: PantryRecord = {
          id: createId(),
          title: input.title.trim() || 'Untitled pantry',
          sourceName: input.sourceName,
          sourcePages: input.sourcePages.map(toPageRecord),
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        await this.db.pantries.add(pantry)
        if (input.cards && input.cards.length > 0) {
          await this.db.pantryCards.bulkPut(input.cards.map((card) => toStoredCard(pantry.id, card)))
        }
        return { ...pantry, cards: await this.readCards(pantry.id) }
      }

      const pantryId = input.id
      await this.requirePantry(pantryId)
      await this.db.pantryCards.bulkPut(input.cards.map((card) => toStoredCard(pantryId, card)))
      await this.db.pantries.update(pantryId, { updatedAt: now() })
      const pantry = await this.requirePantry(pantryId)
      return { ...pantry, cards: await this.readCards(pantryId) }
    })
  }

  /** List pantry summaries, most recently updated first. */
  list(): Promise<PantrySummary[]> {
    return this.db.transaction('r', this.db.pantries, this.db.pantryCards, async () => {
      const pantries = await this.db.pantries.orderBy('updatedAt').reverse().toArray()
      return Promise.all(
        pantries.map(async (pantry) => ({
          id: pantry.id,
          title: pantry.title,
          sourceName: pantry.sourceName,
          pageCount: pantry.sourcePages.length,
          cardCount: await this.db.pantryCards.where('pantryId').equals(pantry.id).count(),
          createdAt: pantry.createdAt,
          updatedAt: pantry.updatedAt,
        })),
      )
    })
  }

  /**
   * Load a pantry with its cards and study attempts, both sorted by
   * `createdAt`. Resolves to `undefined` when the pantry does not exist.
   */
  load(pantryId: string): Promise<LoadedPantry | undefined> {
    return this.db.transaction('r', this.db.pantries, this.db.pantryCards, this.db.attempts, async () => {
      const pantry = await this.readPantry(pantryId)
      if (!pantry) {
        return undefined
      }
      return { ...pantry, attempts: await this.readAttempts(pantryId) }
    })
  }

  /**
   * Record a study attempt for a card in a pantry. Throws
   * {@link PantryNotFoundError} or {@link CardNotFoundError} and writes nothing
   * when the pantry, or the card within that pantry, does not exist.
   */
  appendAttempt(input: CreateStudyAttemptInput): Promise<StudyAttempt> {
    return this.insertAttempt(input, true)
  }

  /**
   * Delete a pantry with all of its cards and attempts in one transaction.
   * Other pantries are untouched, including cards that share a card id.
   * Deleting a missing pantry is a no-op.
   */
  async deletePantry(pantryId: string): Promise<void> {
    await this.db.transaction('rw', this.db.pantries, this.db.pantryCards, this.db.attempts, async () => {
      await this.db.pantryCards.where('pantryId').equals(pantryId).delete()
      await this.db.attempts.where('pantryId').equals(pantryId).delete()
      await this.db.pantries.delete(pantryId)
    })
  }

  /** Create an empty pantry. Same as {@link save} without `id` or cards. */
  createPantry(input: CreatePantryInput): Promise<Pantry> {
    return this.save({ title: input.title, sourceName: input.sourceName, sourcePages: input.sourcePages })
  }

  /** Upsert cards into a pantry. Same as {@link save} with `id`. */
  async saveCards(pantryId: string, cards: CardToSave[]): Promise<void> {
    await this.save({ id: pantryId, cards })
  }

  /** Same as {@link list}. */
  listPantries(): Promise<PantrySummary[]> {
    return this.list()
  }

  /** Get a pantry with its cards, or `undefined`. Use {@link load} to include attempts. */
  getPantry(id: string): Promise<Pantry | undefined> {
    return this.db.transaction('r', this.db.pantries, this.db.pantryCards, () => this.readPantry(id))
  }

  /** List a pantry's attempts, sorted by `createdAt`. */
  listAttempts(pantryId: string): Promise<StudyAttempt[]> {
    return this.db.transaction('r', this.db.attempts, () => this.readAttempts(pantryId))
  }

  /**
   * Record a study attempt after checking only that the pantry exists.
   *
   * @deprecated Use {@link appendAttempt}, which also checks that the card
   * exists in the pantry. Kept for current callers and tests that record
   * attempts for cards that are not stored.
   */
  saveAttempt(input: CreateStudyAttemptInput): Promise<StudyAttempt> {
    return this.insertAttempt(input, false)
  }

  /**
   * Replace an existing card in a pantry. Throws {@link PantryNotFoundError}
   * or {@link CardNotFoundError} when the pantry, or the card within it, is
   * missing.
   */
  async updateCard(pantryId: string, card: CardToSave): Promise<void> {
    await this.db.transaction('rw', this.db.pantries, this.db.pantryCards, async () => {
      await this.requirePantry(pantryId)
      await this.requireCard(pantryId, card.id)
      await this.db.pantryCards.put(toStoredCard(pantryId, card))
      await this.db.pantries.update(pantryId, { updatedAt: now() })
    })
  }

  /**
   * Delete one card from a pantry. Cards with the same id in other pantries
   * are untouched; attempts are kept. Throws {@link PantryNotFoundError} or
   * {@link CardNotFoundError} when the pantry, or the card within it, is
   * missing.
   */
  async deleteCard(pantryId: string, cardId: string): Promise<void> {
    await this.db.transaction('rw', this.db.pantries, this.db.pantryCards, async () => {
      await this.requirePantry(pantryId)
      await this.requireCard(pantryId, cardId)
      await this.db.pantryCards.delete([pantryId, cardId])
      await this.db.pantries.update(pantryId, { updatedAt: now() })
    })
  }

  /** Close the database connection without deleting data. */
  close(): void {
    this.db.close()
  }

  /** Close the connection and delete the whole local database. */
  async destroy(): Promise<void> {
    this.db.close()
    await this.db.delete()
  }
}

export const pantryRepository = new LocalPantryRepository()
