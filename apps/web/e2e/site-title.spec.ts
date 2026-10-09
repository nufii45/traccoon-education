import { expect, test } from '@playwright/test'

test('uses the Traccoon Education browser title', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Traccoon | Education')
})
