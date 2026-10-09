# Traccoon Education agent guide

## Commands and completion

The active application is `apps/web`. Run its commands from that directory:

```bash
pnpm test
pnpm test -- src/features/local-ai/cardRules.test.ts
pnpm lint
pnpm build
pnpm dev
```

The checked-in package does not declare supported engine versions. This
workspace currently uses Node `24.18.0` and pnpm `11.20.0`; use those versions
until the repository declares its own requirement. The `apps/web/pnpm-lock.yaml`
file is authoritative.

Before marking a product change finished, run the closest focused test, then
`pnpm test`, `pnpm lint`, and `pnpm build`. Changes to the privacy boundary
also require its automated browser network test. Documentation-only changes
need a Markdown review and `git diff --check`.

## Authority, scope, and lanes

Direct user instructions take priority. Within repository documents, the PRD
defines product scope, `tasks.md` defines the active P0 gate and file lanes,
and a matching implementation plan defines its task sequence. This guide
defines engineering constraints only; it does not silently change product
scope. When those documents conflict, report the specific conflict and ask for
a decision before expanding scope.

The active P0 sequence is Local Private first. Do not start Cloud Enhanced,
accounts, synchronization, OCR, embeddings, scheduling, gamification, or
companion work before the demo gate. After the gate, a consented Cloud Enhanced
fallback is P1; it must never be a silent Local Private fallback. Add
embeddings only after measured source-card quality shows that direct selected
page chunks miss the quality target.

The demo gate passes only after the P0 checklist in `tasks.md` succeeds in
three consecutive runs on the demo Mac. Use a fresh dedicated browser profile,
warm the application and model cache while online, then disable the network
before importing the test PDF. Record the browser, model version, and result
of each run in the demo evidence.

Edit only files in the lane assigned by `tasks.md`. Ask before crossing a lane.
`apps/api/` is excluded from P0 builds and tests; leave it unchanged unless a
task explicitly covers it.

## Repository safety and git

The working tree may contain another contributor's unfinished changes. Inspect
`git status` before editing, preserve unrelated work, and do not reset,
overwrite, delete, rebase, commit, or push someone else's work. Do not commit
or push unless the current task explicitly requests it.

Never commit credentials, tokens, private PDFs, extracted learner text, model
weights, browser caches, or generated demo data. Keep secrets in untracked
local environment files and provide a redacted `.env.example` only when needed.

## Architecture and local-model decision

- `apps/web/` is the React, TypeScript, and Vite application.
- `apps/web/src/features/local-ai/` owns card/source types, generation,
  parsing, and validation.
- `apps/web/src/workers/` owns Web Worker entry points. Keep model work off the
  UI thread.
- `apps/web/src/test/` provides shared Vitest setup and fake IndexedDB.

The current runtime is `@mlc-ai/web-llm` `0.2.85` in a dedicated worker. The
selected model ID is `Qwen3.5-4B-q4f16_1-MLC`. The code does not yet pin the
model-asset origin, revision, or size. Before the release candidate, record
those values in `docs/model-spike.md`, add the approved origin to the
network-test allowlist, and pin the runtime configuration. Model files stay in
the browser cache and are never committed to this repository.

Use TypeScript with explicit types at feature boundaries, `import type` for
type-only imports, single quotes, and no semicolons. Add or update colocated
`*.test.ts` or `*.test.tsx` coverage when behavior changes. Avoid silent error
recovery: show unsupported-browser, model-initialization, malformed-output,
and local-storage failures in a recoverable UI state.

## Card and evidence rules

Define and export these constants from one shared module. Use them in the UI,
generation, validation, and tests:

```ts
MAX_SELECTED_PAGES = 3
MAX_CARDS_PER_RUN = 3
MIN_NORMALIZED_QUOTE_CHARS = 32
MAX_REGENERATION_RETRIES = 2
```

Generated cards reach review only when they have exactly four distinct,
nonempty answer options; a valid correct-option index; a source page, source
chunk ID, and source quote; and `generationMode: 'local-private'`.

Compare source quotes with locally extracted page text after applying the same
normalization to both values: Unicode NFKC, soft-hyphen removal, joining a
letter-hyphen-line-break-letter sequence, collapsing whitespace, trimming, and
case-insensitive comparison. The normalized quote must contain at least
`MIN_NORMALIZED_QUOTE_CHARS` characters. Preserve the original quote for
display.

Reject a candidate that fails schema or evidence checks. Regenerate it at most
`MAX_REGENERATION_RETRIES` times, then show a local error and offer manual
authoring. Do not admit an invalid fallback card. Quote verification proves
only that a cited passage exists; the review UI must show the passage beside
the question and answer, and must not claim that the marked answer is correct
because the quote matched.

Generated cards use one to three explicitly selected usable text-layer pages.
For scanned, image-only, or unsupported-browser cases, show the unsupported
state and manual authoring. Do not claim OCR support. Persist learner data
locally; cancellation or failure preserves the imported work, and pantry
deletion removes its associated local records after confirmation.

## Local Private privacy boundary

The following rule applies to **Local Private** mode only: never send PDF
bytes, extracted text, source chunks, prompts, embeddings, generated cards, or
study attempts to a server or inference service. Application and model assets
may download during deliberate cache warm-up, but they must not carry learner
study content. Do not use the claim “0 bytes sent.”

Do not add analytics, telemetry, error reporting, third-party fonts or
scripts, or console logging that includes learner content to Local Private
flows. Keep any future Cloud Enhanced code isolated behind explicit consent and
a separate request boundary.

The privacy boundary requires an automated browser test with request
interception. After cache warm-up, it must fail when a Local Private flow sends
a request to a non-allowlisted origin or includes page text, prompts, PDF
bytes, cards, or attempts in a request. Manual browser network inspection is
demo evidence, not a substitute for that test.

## UI and demo expectations

The main demo device is a WebGPU-capable Mac in Chrome or Edge. Keep the core
experience legible at 390 px and 1440 px. Show the Local Private state, model
status, source evidence, manual-authoring path, review controls, and offline
behavior accurately. On browsers without WebGPU, show the unsupported state
and manual authoring rather than pretending local generation is available.
