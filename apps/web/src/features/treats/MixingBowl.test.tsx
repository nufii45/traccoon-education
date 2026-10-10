import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { TREAT_RECIPES, ingredientById } from './catalog'
import { initialTreatEconomy, type TreatEconomy } from './engine'
import { MixingBowl } from './MixingBowl'

// jsdom has no HTMLDialogElement.showModal; stub the open/close behaviour.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const recipe = TREAT_RECIPES[0]

const economyWith = (owned: Record<string, number>): TreatEconomy => ({
  ...initialTreatEconomy(),
  ingredients: owned,
})

const fullStock = (): TreatEconomy =>
  economyWith(Object.fromEntries(recipe.ingredients.map((part) => [part.id, 1])))

const placeAll = (dialog: HTMLElement) => {
  for (const part of recipe.ingredients) {
    fireEvent.click(within(dialog).getByRole('button', { name: `Add ${ingredientById[part.id].name}` }))
  }
}

const mixToCompletion = (dialog: HTMLElement) => {
  fireEvent.click(within(dialog).getByRole('button', { name: "Let's mix!" }))
  const mixButton = within(dialog).getByRole('button', { name: 'Hold to mix' })
  for (let i = 0; i < 24; i += 1) fireEvent.keyDown(mixButton, { key: 'Enter' })
}

describe('MixingBowl', () => {
  it('stays closed without a treat', () => {
    render(<MixingBowl economy={fullStock()} onClose={vi.fn()} onCommitCraft={vi.fn()} onViewShelf={vi.fn()} treatId={null} />)
    expect(screen.queryByRole('dialog', { name: recipe.name })).toBeNull()
  })

  it('disables ingredients the learner does not own', () => {
    // Owns only the first ingredient of the recipe.
    const first = recipe.ingredients[0]
    render(
      <MixingBowl economy={economyWith({ [first.id]: 1 })} onClose={vi.fn()} onCommitCraft={vi.fn()} onViewShelf={vi.fn()} treatId={recipe.id} />,
    )
    const dialog = screen.getByRole('dialog', { name: recipe.name })
    expect(within(dialog).getByRole('button', { name: `Add ${ingredientById[first.id].name}` })).toBeEnabled()
    const second = recipe.ingredients[1]
    expect(within(dialog).getByRole('button', { name: `${ingredientById[second.id].name} not collected yet` })).toBeDisabled()
  })

  it('lets a learner remove a placed ingredient before mixing', () => {
    render(<MixingBowl economy={fullStock()} onClose={vi.fn()} onCommitCraft={vi.fn()} onViewShelf={vi.fn()} treatId={recipe.id} />)
    const dialog = screen.getByRole('dialog', { name: recipe.name })
    const first = recipe.ingredients[0]
    fireEvent.click(within(dialog).getByRole('button', { name: `Add ${ingredientById[first.id].name}` }))
    // Placed ingredient is removable from the bowl.
    fireEvent.click(within(dialog).getByRole('button', { name: `Remove ${ingredientById[first.id].name}` }))
    expect(within(dialog).getByRole('button', { name: `Add ${ingredientById[first.id].name}` })).toBeEnabled()
  })

  it('commits the craft once, reveals the exact treat, and reports the next economy', async () => {
    const next = fullStock()
    const onCommitCraft = vi.fn().mockResolvedValue(next)
    const onViewShelf = vi.fn()
    render(<MixingBowl economy={fullStock()} onClose={vi.fn()} onCommitCraft={onCommitCraft} onViewShelf={onViewShelf} treatId={recipe.id} />)
    const dialog = screen.getByRole('dialog', { name: recipe.name })

    placeAll(dialog)
    mixToCompletion(dialog)

    const viewButton = await within(dialog).findByRole('button', { name: 'View in Treat Shelf' })
    expect(onCommitCraft).toHaveBeenCalledTimes(1)
    expect(onCommitCraft).toHaveBeenCalledWith(recipe.id)
    // The revealed treat is the exact recipe output.
    expect(within(dialog).getByRole('img', { name: recipe.name })).toBeInTheDocument()
    expect(within(dialog).getByText(`Yay! You made a ${recipe.name}!`)).toBeInTheDocument()

    fireEvent.click(viewButton)
    expect(onViewShelf).toHaveBeenCalledWith(next)
  })

  it('shows a failure state without crafting when the commit rejects', async () => {
    const onCommitCraft = vi.fn().mockRejectedValue(new Error('Missing ingredients for this recipe.'))
    render(<MixingBowl economy={fullStock()} onClose={vi.fn()} onCommitCraft={onCommitCraft} onViewShelf={vi.fn()} treatId={recipe.id} />)
    const dialog = screen.getByRole('dialog', { name: recipe.name })

    placeAll(dialog)
    mixToCompletion(dialog)

    expect(await within(dialog).findByText('Missing ingredients for this recipe.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'View in Treat Shelf' })).toBeNull()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('closes on Esc without crafting', async () => {
    const onClose = vi.fn()
    const onCommitCraft = vi.fn()
    render(<MixingBowl economy={fullStock()} onClose={onClose} onCommitCraft={onCommitCraft} onViewShelf={vi.fn()} treatId={recipe.id} />)
    const dialog = screen.getByRole('dialog', { name: recipe.name })

    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onCommitCraft).not.toHaveBeenCalled()
  })
})
