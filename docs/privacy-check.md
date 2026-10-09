# Local Private privacy check (Task 9)

## Run it

From `apps/web`:

```bash
# Mac (Chrome at /Applications/Google Chrome.app)
pnpm test:privacy

# Live model warm-up on the demo Mac only (downloads model assets into the Playwright profile)
TRACCOON_E2E_LIVE_MODEL=1 pnpm test:privacy
```

```powershell
# Windows (Chrome at C:\Program Files\Google\Chrome\Application\chrome.exe is detected)
pnpm test:privacy

# Windows with Edge
$env:PLAYWRIGHT_CHROME_EXECUTABLE='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'; pnpm test:privacy

# Live model run
$env:TRACCOON_E2E_LIVE_MODEL='1'; pnpm test:privacy
```

`PLAYWRIGHT_CHROME_EXECUTABLE` overrides the browser on any platform. No
`playwright install` download is needed.

## What it checks

`e2e/local-private-network.spec.ts` wraps each flow with the guard in
`e2e/networkGuard.ts`, which routes every request in the browser context
(pages and the WebLLM dedicated worker) and records the WebSocket URL and sent
frames. A request is a violation if:

- its origin is not on the allowlist (it is also aborted), or
- its URL, headers, or body contain a per-run canary from the fixture PDF or
  the manual card, raw, lower-case, URL-encoded, form-encoded, base64, or
  base64url, or
- its body or URL query contains prompt, chunk, card, or attempt markers
  (`SOURCE_CHUNK`, `page-N-chunk-M`, `sourceQuote`, `selectedIndex`, ...), or
- its body contains PDF bytes (`%PDF-`).

The checks run on every request from the first one, including app and
model-asset requests. Flows covered: PDF import, page selection, and pantry
creation; manual card, study, reload, and deletion; generation without WebGPU
(unsupported message and manual authoring); generation with the browser's real
WebGPU while model assets are stubbed with HTTP 503, so no model downloads;
an optional live-model run; the visible label
`Local Private: no study content sent for generation` and no byte-count claim.
A negative self-test sends canaries to a blocked origin (fetch and
`sendBeacon`), to `huggingface.co`, and same-origin (base64 and PDF bytes),
and passes only when the guard flags all of them. Nothing in it leaves the
machine.

## Allowlist

Defined once in `apps/web/e2e/networkPolicy.ts`:

- App: `http://127.0.0.1:4174` (also used by `playwright.config.ts`).
- Model assets, from `@mlc-ai/web-llm` 0.2.85 `prebuiltAppConfig`:
  `https://huggingface.co` (weights and config) and
  `https://raw.githubusercontent.com` (model WASM library).
- Hugging Face redirect CDN hosts, HTTPS only: `*.hf.co`, `*.huggingface.co`.
  These are assumed, not in the library. Confirm them in a live run.

For the 4B model, Member 1 updates `MODEL_ASSET_ORIGINS` and
`MODEL_ASSET_REDIRECT_HOST_SUFFIXES` if the model or library comes from a
different or pinned origin. `mlc-ai/Qwen3-4B-q4f16_1-MLC` is also served from
`huggingface.co`. Run the live mode once on the demo Mac and compare the
`live-model` annotation's origins with the list. The test does not reference
any model ID.

## What it cannot prove

- The WebGPU generation path with a real model only runs fully on the demo Mac
  with `TRACCOON_E2E_LIVE_MODEL=1` and a cached model. The default run stubs
  model assets, so the model never loads and no prompt reaches it.
- Service workers are blocked in this suite (`pnpm dev` registers none). The
  production Workbox worker only precaches same-origin build assets.
- WebSocket frames received and content that is encrypted, compressed, or
  otherwise transformed before sending are not detected.
- Browser traffic outside the page (Chrome updates, Safe Browsing, sync) is
  not visible to Playwright.
- It does not replace the offline Network-panel check on the demo Mac, and it
  does not support a "0 bytes sent" claim.

## Privacy-check result for demo notes

On 2026-10-10, `pnpm test:privacy` ran twice on Windows with Chrome
154.0.8037.99 (headless, system install) against the Vite dev server: 7 passed,
1 skipped (live model run), 0 failed each time. The guard recorded no request
to a non-allowlisted origin and no request carrying canary page text, prompt
markers, PDF bytes, card text, or attempt data during import, pantry creation,
manual authoring, study, reload, deletion, and both generation attempts. In
the real-WebGPU test, Chrome exposed `navigator.gpu`. The app made one
`huggingface.co` model-asset request, which the guard intercepted and stubbed,
and then showed the error state with manual authoring available. The negative
self-test confirmed that the guard flags injected leaks. A live cached-model
run on the demo Mac is still pending.
