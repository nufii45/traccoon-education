import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { IngredientCelebration } from './IngredientCelebration'

// jsdom has no HTMLDialogElement.showModal; stub the open/close behaviour.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

describe('IngredientCelebration', () => {
  it('stays closed without an ingredient', () => {
    render(<IngredientCelebration ingredientId={null} onClose={vi.fn()} />)

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('names the ingredient, its art, and the recipes it goes into', () => {
    render(<IngredientCelebration ingredientId="rainbow_sprinkles" onClose={vi.fn()} />)

    const popup = screen.getByRole('dialog', { name: 'You found Rainbow Sprinkles!' })
    expect(within(popup).getByRole('img', { name: 'Rainbow Sprinkles' })).toHaveAttribute('src', '/assets/treats/ingredients/rainbow_sprinkles.webp')
    expect(popup).toHaveTextContent('+1 Rainbow Sprinkles is on your Treat Shelf.')
    expect(popup).toHaveTextContent('Goes into Choco Sprinkle Donut.')
  })

  it('closes from Keep going or Esc', () => {
    const onClose = vi.fn()
    render(<IngredientCelebration ingredientId="egg" onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }))
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
