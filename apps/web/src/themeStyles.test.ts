import { describe, expect, it } from 'vitest'
import { themes } from './themes'

function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/../g)!.map((channel) => Number.parseInt(channel, 16) / 255)
    const [red, green, blue] = channels.map((channel) => (
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    ))

    return red * 0.2126 + green * 0.7152 + blue * 0.0722
  }

  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((left, right) => right - left)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('global theme styles', () => {
  it('keeps muted text readable on the canvas and card surfaces', () => {
    expect(contrastRatio(themes.colors.muted, themes.colors.secondary)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(themes.colors.muted, themes.colors.surface)).toBeGreaterThanOrEqual(4.5)
  })
})
