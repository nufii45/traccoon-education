import { expect, test } from '@playwright/test'

const localSourceText = 'The Krebs cycle takes place in the mitochondrial matrix of the cell.'

// Builds a one-page, text-based PDF in memory so no binary fixture is committed.
const buildTextPdf = (text: string) => {
  const stream = `BT /F1 14 Tf 72 720 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((object, index) => {
    const offset = pdf.length
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
    return offset
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

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
  await page.getByLabel('Choose a PDF').setInputFiles({
    name: 'lecture.pdf',
    mimeType: 'application/pdf',
    buffer: buildTextPdf(localSourceText),
  })
  await expect(page.getByText(/1 text pages found/)).toBeVisible()
  await expect(page.getByRole('img', { name: 'Preview of page 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Select page 1', exact: true }).click()
  await page.getByRole('button', { name: 'Save selection' }).click()
  await page.getByRole('button', { name: 'Create local pantry' }).click()
  await page.getByRole('button', { name: 'Generate local cards' }).click()

  await expect(page.getByText(/WebGPU is unavailable in this browser/)).toBeVisible()
  expect(studyContentRequests).toEqual([])
})
