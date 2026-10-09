import { describe, expect, it } from 'vitest'
import { hasUsableTextLayer, normalisePdfText } from './pdfText'

describe('PDF text preparation', () => {
  it('normalises extracted text while keeping readable word boundaries', () => {
    expect(normalisePdfText('  Plants\n\n capture    light.  ')).toBe('Plants capture light.')
  })

  it('rejects scanned or empty pages that have no usable text layer', () => {
    expect(hasUsableTextLayer([{ pageNumber: 1, text: 'Readable source text.' }])).toBe(true)
    expect(hasUsableTextLayer([{ pageNumber: 1, text: '   ' }])).toBe(false)
  })
})
