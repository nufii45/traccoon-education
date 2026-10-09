/**
 * Network allowlist for the Local Private privacy check (Task 9).
 *
 * Every request the app makes during an e2e run is classified here. App and
 * model-asset requests are allowed by origin, but the guard in
 * `networkGuard.ts` still inspects all of them for study content. Anything
 * else is a violation.
 */

/** Origin of the local Vite server Playwright starts (see playwright.config.ts). */
export const APP_ORIGIN = 'http://127.0.0.1:4174'

/**
 * Origins WebLLM fetches model assets from during deliberate cache warm-up.
 *
 * Read from `@mlc-ai/web-llm` 0.2.85 `prebuiltAppConfig`:
 * - `https://huggingface.co`: every `model` entry (weights, tokenizer, and
 *   `mlc-chat-config.json`, fetched through `/resolve/main/...`).
 * - `https://raw.githubusercontent.com`: `modelLibURLPrefix`
 *   (`mlc-ai/binary-mlc-llm-libs/main/web-llm-models/`, version
 *   `v0_2_84/base`) for the compiled model WASM library.
 *
 * Other URLs in the bundle (github.com, apache.org, webgpureport.org,
 * developer.chrome.com, w3.org, ...) are comments or error text and are not
 * fetched, so they are deliberately not allowlisted.
 *
 * Member 1 must confirm or update this list when switching to the 4B model or
 * pinning a model-asset origin and revision (see AGENTS.md and
 * docs/model-spike.md).
 */
export const MODEL_ASSET_ORIGINS: readonly string[] = [
  'https://huggingface.co',
  'https://raw.githubusercontent.com',
]

/**
 * Hugging Face serves large LFS/Xet files through server-side redirects to CDN
 * hosts (for example `cdn-lfs-us-1.hf.co`, `cas-bridge.xethub.hf.co`,
 * `cdn-lfs.huggingface.co`). These hosts are not in the library bundle; they
 * are assumed from Hugging Face behavior and must be confirmed in a live run on
 * the demo Mac. HTTPS only.
 */
export const MODEL_ASSET_REDIRECT_HOST_SUFFIXES: readonly string[] = ['.hf.co', '.huggingface.co']

export type RequestClass = 'app' | 'model-asset' | 'blocked'

/** Maps ws/wss to http/https so the Vite HMR socket compares as the app origin. */
const httpOrigin = (url: URL): string => {
  const protocol = url.protocol === 'ws:' ? 'http:' : url.protocol === 'wss:' ? 'https:' : url.protocol
  return `${protocol}//${url.host}`
}

/** Returns the comparable origin for a URL, or the raw string if it is unparseable. */
export const originOf = (url: string): string => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') {
      return parsed.protocol
    }
    return httpOrigin(parsed)
  } catch {
    return url
  }
}

export const classifyUrl = (url: string): RequestClass => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'blocked'
  }

  // data: and blob: URLs resolve inside the browser and never leave it.
  if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') {
    return 'app'
  }

  const origin = httpOrigin(parsed)
  if (origin === APP_ORIGIN) {
    return 'app'
  }
  if (MODEL_ASSET_ORIGINS.includes(origin)) {
    return 'model-asset'
  }
  if (
    parsed.protocol === 'https:' &&
    MODEL_ASSET_REDIRECT_HOST_SUFFIXES.some((suffix) => parsed.hostname.endsWith(suffix))
  ) {
    return 'model-asset'
  }
  return 'blocked'
}
