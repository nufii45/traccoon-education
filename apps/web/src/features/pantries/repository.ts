import Dexie, { type EntityTable } from 'dexie'
import type { GeneratedCard, SourcePage } from '../local-ai/types'

interface PantryRecord {
  id: string
  title: string
  sourceName: string
  sourcePages: SourcePage[]
  createdAt: string
  updatedAt: string
}

export interface StoredCard extends GeneratedCard {
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

type TraccoonTables = {
  pantries: EntityTable<PantryRecord, 'id'>
  cards: EntityTable<StoredCard, 'id'>
  attempts: EntityTable<StudyAttempt, 'id'>
}

const now = () => new Date().toISOString()

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`

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
  }

  async createPantry(input: CreatePantryInput): Promise<Pantry> {
    const timestamp = now()
    const pantry: PantryRecord = {
      id: createId(),
      title: input.title.trim() || 'Untitled pantry',
      sourceName: input.sourceName,
      sourcePages: input.sourcePages,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    await this.db.pantries.add(pantry)
    return { ...pantry, cards: [] }
  }

  async listPantries(): Promise<PantrySummary[]> {
    const pantries = await this.db.pantries.orderBy('updatedAt').reverse().toArray()
    const summaries = await Promise.all(
      pantries.map(async (pantry) => ({
        id: pantry.id,
        title: pantry.title,
        sourceName: pantry.sourceName,
        pageCount: pantry.sourcePages.length,
        cardCount: await this.db.cards.where('pantryId').equals(pantry.id).count(),
        createdAt: pantry.createdAt,
        updatedAt: pantry.updatedAt,
      })),
    )

    return summaries
  }

  async getPantry(id: string): Promise<Pantry | undefined> {
    const pantry = await this.db.pantries.get(id)

    if (!pantry) {
      return undefined
    }

    const cards = await this.db.cards.where('pantryId').equals(id).sortBy('createdAt')
    return { ...pantry, cards }
  }

  async saveCards(pantryId: string, cards: GeneratedCard[]): Promise<void> {
    await this.db.transaction('rw', this.db.pantries, this.db.cards, async () => {
      const pantry = await this.db.pantries.get(pantryId)
      if (!pantry) {
        throw new Error('Pantry not found')
      }

      await this.db.cards.bulkPut(cards.map((card) => ({ ...card, pantryId })))
      await this.db.pantries.update(pantryId, { updatedAt: now() })
    })
  }

  async updateCard(pantryId: string, card: GeneratedCard): Promise<void> {
    await this.saveCards(pantryId, [card])
  }

  async deleteCard(pantryId: string, cardId: string): Promise<void> {
    await this.db.transaction('rw', this.db.pantries, this.db.cards, async () => {
      await this.db.cards.delete(cardId)
      await this.db.pantries.update(pantryId, { updatedAt: now() })
    })
  }

  async saveAttempt(input: CreateStudyAttemptInput): Promise<StudyAttempt> {
    const attempt: StudyAttempt = {
      id: createId(),
      ...input,
      createdAt: now(),
    }

    await this.db.attempts.add(attempt)
    return attempt
  }

  async listAttempts(pantryId: string): Promise<StudyAttempt[]> {
    return this.db.attempts.where('pantryId').equals(pantryId).sortBy('createdAt')
  }

  async deletePantry(pantryId: string): Promise<void> {
    await this.db.transaction('rw', this.db.pantries, this.db.cards, this.db.attempts, async () => {
      await this.db.cards.where('pantryId').equals(pantryId).delete()
      await this.db.attempts.where('pantryId').equals(pantryId).delete()
      await this.db.pantries.delete(pantryId)
    })
  }

  async destroy(): Promise<void> {
    this.db.close()
    await this.db.delete()
  }
}

export const pantryRepository = new LocalPantryRepository()
