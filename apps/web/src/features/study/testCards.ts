import type { SourcePage } from '../local-ai/types'
import type { StoredCard } from '../pantries/repository'

// Synthetic study fixtures. Every sourceQuote appears on its page.

export const TEST_PAGES: SourcePage[] = [
  {
    id: 'page-11',
    pageNumber: 11,
    text: 'Glycolysis occurs in the cytoplasm and splits one molecule of glucose into two molecules of pyruvate. It does not require oxygen.',
  },
  {
    id: 'page-12',
    pageNumber: 12,
    text: 'When oxygen is available, pyruvate enters the mitochondrion. The Krebs cycle takes place in the mitochondrial matrix, where acetyl-CoA is oxidized.',
  },
]

const card = (id: string, question: string, options: string[], correctIndex: number, sourcePage: number, sourceQuote: string): StoredCard => ({
  id,
  pantryId: 'pantry-1',
  question,
  options,
  correctIndex,
  sourcePage,
  sourceQuote,
  sourceChunkId: `chunk-${sourcePage}`,
  generationMode: 'local-private',
  generationMethod: 'webllm',
  createdAt: '2026-10-09T10:00:00.000Z',
})

export const TEST_CARDS: StoredCard[] = [
  card('card-1', 'Where does glycolysis take place?', ['Cytoplasm', 'Nucleus', 'Ribosome', 'Golgi body'], 0, 11, 'Glycolysis occurs in the cytoplasm and splits one molecule of glucose'),
  card('card-2', 'Where does the Krebs cycle take place?', ['Cytoplasm', 'Mitochondrial matrix', 'Nucleus', 'Cell wall'], 1, 12, 'The Krebs cycle takes place in the mitochondrial matrix'),
]
