import { expect, test } from '@playwright/test'

const localSourceText = 'Add a source quote to ground each manual card you create.'

test('Local Private mode does not transmit local source text when WebGPU is unavailable', async ({
  context,
  page,
}) => {
  const studyContentRequests: string[] = []

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: undefined,
    })
  })

  context.on('request', (request) => {
    const body = request.postData() ?? ''
    if (body.includes(localSourceText)) {
      studyContentRequests.push(`${request.method()} ${request.url()}`)
    }
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Start a manual pantry' }).click()
  await page.getByRole('button', { name: 'Create manual pantry' }).click()
  await page.getByRole('button', { name: 'Generate local cards' }).click()

  await expect(page.getByText(/WebGPU is unavailable in this browser/)).toBeVisible()
  expect(studyContentRequests).toEqual([])
})
