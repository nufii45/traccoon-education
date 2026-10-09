# Traccoon Education Local Private MVP: Implementation Plan

> **Owner:** Member 1 / repository owner
> **Execution:** Directly in the shared repository, as requested.
> **Scope source:** `docs/Traccoon_Education_Hackathon_MVP_PRD.md`

## Goal

Replace the starter Vite screen with a demo-ready, offline-capable study-card
workflow. A learner imports a text-based PDF, chooses up to three pages, asks
for cards, reviews evidence-linked suggestions, and studies the kept cards.
The browser-only implementation stores data locally and never calls a cloud
service.

## Technical choices

- React + TypeScript in `apps/web`.
- `pdfjs-dist` extracts selectable PDF text in the browser.
- A dedicated Web Worker owns the WebLLM engine so model work cannot freeze the
  interface. Unsupported, unavailable, and malformed-output states preserve
  the source and direct the learner to manual authoring.
- `@mlc-ai/web-llm` provides the optional on-device WebGPU model path. Its
  status and failures are visible in the interface; it is never represented as
  a cloud call.
- Dexie/IndexedDB holds pantries and cards locally.
- Vite PWA supplies a cacheable shell and manifest for offline reloads after
  first load.
- Vitest verifies the P0 invariants without requiring a GPU or model download.

## Constraints

- P0 is Local Private only. No Cloud Enhanced endpoint, API key, backend call,
  embeddings, OCR, account system, or synchronization is added.
- Generated cards have exactly four distinct, nonempty options; a correct
  option; source page; source quote; source chunk ID; and `local-private` mode.
- A card is reviewable only when its quote occurs in the locally extracted text
  for its cited source page.
- PDF support is text-layer only. The UI states that OCR is unavailable.

## Work sequence

### 1. Set up dependencies and test harness

**Files**
- Modify: `apps/web/package.json`, `apps/web/vite.config.ts`
- Add: `apps/web/vitest.config.ts`, `apps/web/src/test/setup.ts`

**Tests first**
- Prove the test command discovers a simple domain test in jsdom.

**Implementation**
- Install the browser-local runtime, PDF extraction, IndexedDB, PWA, and test
  dependencies with pnpm so the existing pnpm lockfile remains authoritative.
- Add `test` and `test:watch` scripts and a PWA manifest/cache setup.

### 2. Build the source and card domain layer

**Files**
- Add: `apps/web/src/features/local-ai/types.ts`
- Add: `apps/web/src/features/local-ai/cardRules.ts`
- Add: `apps/web/src/features/local-ai/cardRules.test.ts`
- Add: `apps/web/src/features/local-ai/chunks.ts`
- Add: `apps/web/src/features/local-ai/chunks.test.ts`

**Tests first**
- Reject invalid option sets and quotes that are not present in their cited page.
- Verify deterministic page/chunk selection and the one-to-three-page limit.

**Implementation**
- Define one shared card schema, local source pages, chunks, validation, and
  small text chunking utilities that preserve source evidence.

### 3. Add browser-only model orchestration

**Files**
- Add: `apps/web/src/workers/localAi.worker.ts`
- Add: `apps/web/src/features/local-ai/localAiClient.ts`
- Add: `apps/web/src/features/local-ai/localGenerator.ts`
- Add: `apps/web/src/features/local-ai/localGenerator.test.ts`

**Tests first**
- Validate a generated card result and its evidence before it reaches the UI.

**Implementation**
- Add worker messages for model status and generation.
- Attempt WebGPU/WebLLM generation on supported browsers; otherwise expose a
  recoverable local error and manual-authoring route. No request leaves the
  device.
- Keep model choice behind one constant for the live Mac model spike.

### 4. Extract PDF text and store pantries locally

**Files**
- Add: `apps/web/src/features/pantries/pdfText.ts`
- Add: `apps/web/src/features/pantries/pdfText.test.ts`
- Add: `apps/web/src/features/pantries/repository.ts`
- Add: `apps/web/src/features/pantries/repository.test.ts`

**Tests first**
- Cover page-range selection and local repository create/update/delete flows.

**Implementation**
- Extract text from a selected local PDF, normalize each page, and report when
  a file has no usable text layer.
- Persist pantries, source metadata, and kept cards in IndexedDB; do not save
  the raw PDF.

### 5. Assemble the demo workflow and accessible UI

**Files**
- Replace: `apps/web/src/App.tsx`, `apps/web/src/App.css`, `apps/web/src/index.css`
- Add: `apps/web/src/features/pantries/PantryWorkspace.tsx`
- Add: `apps/web/src/features/study/StudySession.tsx`
- Add: `apps/web/src/App.test.tsx`

**Tests first**
- Cover the initial privacy copy, manual-card path, and generated-card review
  status using mocked browser services.

**Implementation**
- Provide the import, selected-page, generate, review/edit/keep/discard,
  manual author, study, and delete-pantry experiences.
- Present model status and offline/privacy language as an honest part of the
  demo, including visible unsupported and error states.

### 6. Validate the release candidate on the demo Mac

**Files**
- Add: `docs/local-demo-runbook.md`

**Checks**
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.
- Manual run: import each of the three planned PDFs; test 1, 2, and 3 selected
  pages; review a generated card; edit and keep another; add a manual card;
  reload; disconnect from the network; reload again; delete a pantry.
- Run one optional WebLLM model spike in Chrome and record model, load time,
  first-card latency, and any unsupported or error condition in the runbook.

## Acceptance evidence

- Automated tests prove card/source invariants and local persistence behavior.
- Production build succeeds.
- The browser network panel remains free of generation/upload requests during
  the demo flow.
- A reviewer can see the cited source quote for every kept generated card.
