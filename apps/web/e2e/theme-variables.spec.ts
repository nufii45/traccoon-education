import { expect, test } from '@playwright/test'

test('the post-onboarding surfaces use the Nunito theme', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'traccoon.onboarding.v1',
      JSON.stringify({
        completed: true,
        mode: 'local-private',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    )
  })

  await page.goto('/')

  const sidebar = page.getByRole('complementary', { name: 'Pantries' })

  await expect(sidebar).toBeVisible()
  await expect(sidebar).toHaveCSS('background-color', 'rgb(238, 229, 223)')
  await page.getByRole('button', { name: 'New source' }).click()

  const privacyCallout = page.locator('.privacy-callout')

  await expect(privacyCallout).toBeVisible()
  await expect(privacyCallout).toHaveCSS('background-color', 'rgb(232, 217, 205)')
  await expect(page.locator('body')).toHaveCSS('font-family', /Nunito/)
})
