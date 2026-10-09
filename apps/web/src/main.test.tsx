import { afterEach, describe, expect, it } from 'vitest'

afterEach(() => {
  document.documentElement.removeAttribute('style')
  document.body.innerHTML = ''
})

describe('application theme boot', () => {
  it('sets the Nunito theme variables before the application renders', async () => {
    document.body.innerHTML = '<div id="root"></div>'

    await import('./main')

    expect(document.documentElement.style.getPropertyValue('--font-sans')).toContain('Nunito')
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#8D6748')
  })
})
