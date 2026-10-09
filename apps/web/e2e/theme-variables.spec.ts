import { expect, test } from '@playwright/test'

test('the homepage uses the Nunito theme surfaces', async ({ page }) => {
  await page.goto('/')

  const sidebar = page.getByRole('complementary', { name: 'Pantries' })
  const privacyCallout = page.locator('.privacy-callout')

  await expect(sidebar).toBeVisible()
  await expect(privacyCallout).toBeVisible()
  await expect(sidebar).toHaveCSS('background-color', 'rgb(238, 229, 223)')
  await expect(privacyCallout).toHaveCSS('background-color', 'rgb(232, 217, 205)')
  await expect(page.locator('body')).toHaveCSS('font-family', /Nunito/)
})
