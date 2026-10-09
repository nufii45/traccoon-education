/** Default loader copy per real operation. Override with an action-specific, truthful title when needed. */
export type RokkiLoadingMode = 'preparing' | 'generating' | 'saving' | 'syncing'

export const loadingMessages: Record<RokkiLoadingMode, { title: string; description: string }> = {
  preparing: {
    title: 'Rokki is getting ready.',
    description: 'Preparing your study space.',
  },
  generating: {
    title: 'Rokki is making your cards.',
    description: 'Turning your selected pages into questions you can review.',
  },
  saving: {
    title: 'Saving to your pantry.',
    description: 'Keeping your study material ready for next time.',
  },
  syncing: {
    title: 'Syncing your library.',
    description: 'Updating your study material across devices.',
  },
}
