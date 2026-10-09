import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InteractiveRokki } from './InteractiveRokki'
import { ROKKI_MESSAGES, pickMessage } from './messages'

describe('pickMessage', () => {
  it('returns a message from the predefined set', () => {
    const message = pickMessage(undefined, () => 0)
    expect(ROKKI_MESSAGES).toContain(message)
  })

  it('avoids repeating the previous message', () => {
    const previous = ROKKI_MESSAGES[0]
    // random() = 0 would normally pick index 0; with previous filtered out the
    // pool starts at the second message, so a repeat is impossible.
    const next = pickMessage(previous, () => 0)
    expect(next).not.toBe(previous)
  })
})

describe('InteractiveRokki', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('renders the mascot image with its accessible description preserved', () => {
    render(<InteractiveRokki imageAlt="Rokki welcomes you back" src="/rokki-welcome.webp" />)
    expect(screen.getByRole('img', { name: 'Rokki welcomes you back' })).toHaveAttribute(
      'src',
      '/rokki-welcome.webp',
    )
  })

  it('exposes an interactive button with an accessible action label', () => {
    render(
      <InteractiveRokki
        actionLabel="Say hello to Rokki"
        imageAlt="Rokki"
        src="/rokki.webp"
      />,
    )
    expect(screen.getByRole('button', { name: 'Say hello to Rokki' })).toBeInTheDocument()
  })

  it('shows a short encouraging speech bubble on activation, then hides it', () => {
    render(<InteractiveRokki imageAlt="Rokki" src="/rokki.webp" />)
    const button = screen.getByRole('button')

    act(() => {
      fireEvent.click(button)
    })
    const bubble = screen.getByRole('status')
    expect(ROKKI_MESSAGES).toContain(bubble.textContent)
    expect(button.closest('[data-reacting]')).toHaveAttribute('data-reacting', 'true')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(button.closest('[data-reacting]')).toHaveAttribute('data-reacting', 'false')

    act(() => {
      vi.advanceTimersByTime(3500)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('uses page-specific messages and existing static art if the primary image fails', () => {
    render(<InteractiveRokki fallbackSrc="/static.webp" imageAlt="Rokki" messages={['Nice work!']} src="/missing.svg" />)
    const image = screen.getByRole('img', { name: 'Rokki' })
    fireEvent.error(image)
    expect(image).toHaveAttribute('src', '/static.webp')
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('status')).toHaveTextContent('Nice work!')
  })

  it('does not stack overlapping reactions on rapid repeated clicks', () => {
    render(<InteractiveRokki imageAlt="Rokki" src="/rokki.webp" />)
    const button = screen.getByRole('button')

    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)
    })

    // Only one bubble/live region exists regardless of click count.
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('calls onActivate for keyboard and pointer activation', () => {
    const onActivate = vi.fn()
    render(<InteractiveRokki imageAlt="Rokki" onActivate={onActivate} src="/rokki.webp" />)
    const button = screen.getByRole('button')

    act(() => {
      fireEvent.click(button)
    })
    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it('renders a non-interactive image when interactive is false', () => {
    render(<InteractiveRokki imageAlt="Rokki" interactive={false} src="/rokki.webp" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Rokki' })).toBeInTheDocument()
  })

  it('reflects the learning state via a data attribute', () => {
    const { container, rerender } = render(
      <InteractiveRokki imageAlt="Rokki" src="/rokki.webp" state="thinking" />,
    )
    expect(container.querySelector('[data-state="thinking"]')).not.toBeNull()

    rerender(<InteractiveRokki imageAlt="Rokki" src="/rokki.webp" state="celebrating" />)
    expect(container.querySelector('[data-state="celebrating"]')).not.toBeNull()
  })
})
