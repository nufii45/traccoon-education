import { CookieIcon, FolderLibraryIcon, Mortarboard02Icon, SmileIcon } from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'

export const TREATS_PATH = '/treats'

export interface NavItem {
  id: 'learn' | 'pantries' | 'treats' | 'rokki'
  label: string
  to: string
  icon: IconSvgElement
  /** False until the destination ships; the item renders as "Soon" and is not a link. */
  isAvailable: boolean
}

/**
 * The four primary destinations.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'learn', label: 'Learning Hub', to: '/learn', icon: Mortarboard02Icon, isAvailable: true },
  { id: 'pantries', label: 'My Pantries', to: '/pantries', icon: FolderLibraryIcon, isAvailable: true },
  { id: 'treats', label: 'Treat Shelf', to: TREATS_PATH, icon: CookieIcon, isAvailable: true },
  { id: 'rokki', label: 'Rokki', to: '/rokki', icon: SmileIcon, isAvailable: true },
]

/** `/` renders My Pantries, so it counts as the pantries area. */
export const isPantriesPath = (pathname: string) => pathname === '/' || pathname === '/pantries' || pathname.startsWith('/pantries/')

/** Route for a pantry, by id only: titles are learner content and stay out of URLs and history. */
export const pantryPath = (pantryId: string) => `/pantries/${pantryId}`
export const PRACTICE_PICKER_PATH = '/learn/practice'
export const practicePath = (pantryId: string) => `/learn/practice/${pantryId}`
export const QUIZ_PICKER_PATH = '/learn/quiz'
export const quizPath = (pantryId: string) => `/learn/quiz/${pantryId}`

/** Where a Practice round was started from, so its exit button returns there. */
export interface PracticeRouteState {
  from?: 'pantry'
}
