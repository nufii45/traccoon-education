import { describe, expect, it } from 'vitest'

type ThemeModule = {
  applyTheme?: (target: HTMLElement) => void
  themes?: {
    colors?: {
      primary?: string
      secondary?: string
      tertiary?: string
      neutral?: string
    }
    typography?: {
      fontFamily?: string
    }
    elements?: {
      buttons?: Record<string, unknown>
      card?: Record<string, unknown>
      input?: Record<string, unknown>
      navigation?: Record<string, unknown>
    }
  }
}

async function loadThemeModule(): Promise<ThemeModule | undefined> {
  try {
    const path = './' + 'themes'
    return await import(/* @vite-ignore */ path) as ThemeModule
  } catch {
    return undefined
  }
}

describe('Traccoon theme', () => {
  it('provides the reference palette, Nunito typography, and reusable element recipes', async () => {
    const themeModule = await loadThemeModule()

    expect(themeModule).toBeDefined()
    expect(themeModule?.themes?.colors).toMatchObject({
      primary: '#8D6748',
      secondary: '#F5EFEB',
      tertiary: '#E5A93C',
      neutral: '#2B2625',
    })
    expect(themeModule?.themes?.typography?.fontFamily).toContain('Nunito')
    expect(themeModule?.themes?.elements?.buttons).toMatchObject({
      primary: expect.any(Object),
      secondary: expect.any(Object),
      inverted: expect.any(Object),
      outlined: expect.any(Object),
    })
    expect(themeModule?.themes?.elements?.card).toEqual(expect.any(Object))
    expect(themeModule?.themes?.elements?.input).toEqual(expect.any(Object))
    expect(themeModule?.themes?.elements?.navigation).toEqual(expect.any(Object))
  })

  it('applies semantic CSS variables to the supplied element', async () => {
    const themeModule = await loadThemeModule()
    const target = document.createElement('div')

    themeModule?.applyTheme?.(target)

    expect(target.style.getPropertyValue('--color-primary')).toBe('#8D6748')
    expect(target.style.getPropertyValue('--color-neutral')).toBe('#2B2625')
    expect(target.style.getPropertyValue('--font-sans')).toContain('Nunito')
    expect(target.style.getPropertyValue('--radius-card')).toBe('18px')
  })
})
