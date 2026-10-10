export type LocalOcrModule = typeof import('../local-ocr')

let loading: Promise<LocalOcrModule> | undefined

/**
 * Loads the on-device OCR module on first use. It bundles OpenCV and ONNX
 * Runtime, so it stays out of the main bundle until a learner asks for OCR.
 * The chunk comes from the app origin; model files load only in warm-up.
 */
export const loadLocalOcr = (): Promise<LocalOcrModule> => {
  loading ??= import('../local-ocr').catch((reason: unknown) => {
    loading = undefined
    throw reason
  })
  return loading
}

/**
 * Frees the on-device OCR engine if it was ever loaded. Runs when the learner
 * leaves the import view, where no screen is left to report a failed
 * disposal; the next warm-up reports its own errors.
 */
export const releaseLocalOcr = async (): Promise<void> => {
  const localOcr = await loading?.catch(() => undefined)
  await localOcr?.disposeLocalOcr().catch(() => undefined)
}
