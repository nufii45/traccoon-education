/**
 * Builds a small text-layer PDF in memory, one page per entry, so no binary
 * fixture is committed. Text must be ASCII without parentheses or backslashes
 * (no PDF string escaping is applied).
 */
export const buildTextPdf = (pages: readonly string[]): Buffer => {
  const pageCount = pages.length
  const firstPageObject = 4
  const kids = pages.map((_, index) => `${firstPageObject + index * 2} 0 R`).join(' ')
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  pages.forEach((text, index) => {
    const contentObject = firstPageObject + index * 2 + 1
    const stream = `BT /F1 10 Tf 36 720 Td (${text}) Tj ET`
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObject} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    )
  })

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
