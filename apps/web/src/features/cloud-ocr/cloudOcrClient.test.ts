import { afterEach, describe, expect, it, vi } from 'vitest'
import { runCloudOcrForPage } from './cloudOcrClient'

afterEach(() => vi.unstubAllGlobals())

describe('Cloud OCR client', () => {
  it('checks the completed job immediately after upload', async () => {
    const fetchRequest = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: 'job-1', model: 'PaddleOCR-VL-1.6' }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jobId: 'job-1',
        state: 'done',
        pages: [{ pageIndex: 0, markdown: 'Readable source text' }],
      })))
    vi.stubGlobal('fetch', fetchRequest)

    const result = await runCloudOcrForPage({
      image: new Blob(['image'], { type: 'image/jpeg' }),
      pageNumber: 2,
      consent: { kind: 'cloud-ocr', grantedAt: new Date().toISOString(), pageNumbers: [2] },
      pollIntervalMs: 60_000,
      timeoutMs: 1_000,
    })

    expect(result.text).toBe('Readable source text')
    expect(fetchRequest).toHaveBeenCalledTimes(2)
    expect(fetchRequest.mock.calls[0][0]).toBe('/api/cloud-ocr/jobs')
    expect(fetchRequest.mock.calls[1][0]).toBe('/api/cloud-ocr/jobs/job-1')
  })
})
