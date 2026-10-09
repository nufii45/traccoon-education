# Traccoon Education Hackathon Task Checklist

**Source of truth:** [Hackathon MVP PRD](docs/Traccoon_Education_Hackathon_MVP_PRD.md)

## Build rules

- **P0 is Local Private only.** Do not build a Cloud Enhanced endpoint, provider integration, embeddings, scheduling, or companion economy until the offline demo passes repeatedly.
- **Target device:** the WebGPU-capable Mac used in the demo. Chrome or Edge is the primary test browser.
- **Commit cadence:** each owner commits at a completed handoff. Do not mix another owner's files into that commit.
- **Integration rule:** every handoff includes the stated command or manual check. A broken handoff stops new feature work until it is repaired.
- **Demo freeze:** at hour 17, stop adding features. Use the final three hours for the acceptance checks, rehearsal, and submission assets.

## Current implementation snapshot

The repository now contains the P0 code path. This is an implementation
snapshot, not a substitute for the live acceptance checks below.

- [x] Browser-local WebLLM worker, schema validation, source-quote checks, and recoverable unsupported or malformed-output states.
- [x] Text-based PDF extraction, one-to-three-page selection, review/edit/keep/discard, manual authoring, study feedback, and IndexedDB persistence.
- [x] PWA shell, production build, unit tests, and lint checks.
- [ ] Live Chrome model spike on the demo Mac, including first-card timing after warm cache.
- [ ] Offline import and generation rehearsal with browser Network inspection.
- [ ] Three-PDF quality gate and final three-minute demo rehearsal.

## Ownership and boundaries

| Member | Role | Owns | Must not build in P0 |
|---|---|---|---|
| **Member 1** | Local AI engineer | `apps/web/src/features/local-ai/`, `apps/web/src/workers/`, local-model spike, source-chunk generation, quote verification | Cloud API, general deck UI, gamification |
| **Member 2** | Learner experience engineer | `apps/web/src/app/`, `apps/web/src/components/`, `apps/web/src/features/pantries/`, `apps/web/src/features/study/` | Model-runtime internals, PWA setup, cloud endpoint |
| **Member 3** | Local-data and quality engineer | `apps/web/src/data/`, PWA setup, tests, network-boundary checks, demo rehearsal | Generation prompts, advanced UI, cloud endpoint |

## Handoff contract

All generated cards use this shape. Member 1 supplies it; Members 2 and 3 may rely on it without reading the model implementation.

```ts
type GeneratedCard = {
  id: string
  question: string
  options: string[] // runtime validation requires exactly four distinct values
  correctIndex: number // runtime validation requires an index from 0 to 3
  sourcePage: number
  sourceQuote: string
  sourceChunkId: string
  generationMode: 'local-private'
}
```

`sourceQuote` must be copied from, or verified against, the text for `sourceChunkId`. Cards that fail schema or quote verification never reach the review screen.

## Milestones

| Checkpoint | Deadline | Required evidence |
|---|---:|---|
| Model go or no-go | Hour 2 | One local model produces one valid card from a real PDF page on the demo Mac. |
| First end-to-end flow | Hour 10 | Import, select, generate, review, and answer one card using fixture or local data. |
| Offline proof | Hour 14 | A pre-cached model generates cards from a new PDF with the network disabled. |
| Feature freeze | Hour 17 | All P0 acceptance criteria pass once. Only fixes, rehearsal, and submission assets remain. |

## Checklist

- [ ] **1. [Member 1] Run the local-model feasibility spike**
  Spec ref: `Traccoon_Education_Hackathon_MVP_PRD.md > 7. Local model approach; 9. Acceptance criteria`
  Depends on: None.
  What to build: On the demo Mac and primary browser, test one small quantized local instruct model in a web worker against one real text-based PDF page. Ask for one four-option card as strict JSON, then record model name, version, cached size, first-card time, and failure behaviour in `docs/model-spike.md`.
  Acceptance: The model produces one parseable card with four distinct options in under 60 seconds after caching. If it fails, choose another model or runtime before any product feature is built.
  Verify: Disable the network after the model cache is ready; run the spike again and save its console output and timing in `docs/model-spike.md`.
  Handoff: Export the selected model identifier and the `GeneratedCard` contract to Members 2 and 3.

- [ ] **2. [Member 3] Establish the web, test, and offline baseline**
  Spec ref: `Traccoon_Education_Hackathon_MVP_PRD.md > 6. FR-01, FR-12; 12. Delivery plan`
  Depends on: None.
  What to build: Replace the Vite starter baseline with project scripts for type-checking, unit tests, and production builds. Configure the PWA shell so a successful first visit can reload offline. Add the local test helpers needed for IndexedDB and network interception.
  Acceptance: The application shell builds and reloads from a warm cache with the network disabled. Tests can simulate IndexedDB and assert that a request was or was not made.
  Verify: Run the project test, type-check, and build commands. In the browser, load the shell once, disable the network, and reload it.
  Handoff: Publish the project commands and test helper locations in this file's build notes or the repository README for Members 1 and 2.

- [ ] **3. [Member 2] Build the fixture-backed learner flow**
  Spec ref: `Traccoon_Education_Hackathon_MVP_PRD.md > 5. Users and primary journey; 6. FR-01, FR-06, FR-10, FR-11`
  Depends on: Task 2 for the application baseline. May use static fixture cards until Task 6 is complete.
  What to build: Create the desktop-first shell and the four product states: model readiness, local PDF selection, card review, and study. Use the `GeneratedCard` contract for fixture data. Keep, discard, edit, and manual authoring are the only review controls.
  Acceptance: A fixture deck can be reviewed and studied without model code. The core controls remain legible at 390 px and 1440 px.
  Verify: Add component or browser tests for card review and answer feedback. Manually check the two reference widths.
  Handoff: Member 1 can replace fixture generation with the local generator without changing the review or study data shape.

- [ ] **4. [Member 3] Implement local pantry persistence and deletion**
  Spec ref: `Traccoon_Education_Hackathon_MVP_PRD.md > 6. FR-12, FR-13; 8. Data and privacy boundary`
  Depends on: Task 2.
  What to build: Create IndexedDB repositories for pantries, extracted pages, cards, and attempts. Read raw PDFs in browser memory only. Implement an atomic pantry deletion that removes every associated record after confirmation.
  Acceptance: A saved deck and attempts survive a reload. Deleting one pantry removes its stored page text, cards, and attempts without affecting another pantry.
  Verify: Add repository tests with fake IndexedDB, including a deletion test and a reload-read test.
  Handoff: Provide Member 2 with repository methods for save, list, load, appendAttempt, and deletePantry.

- [ ] **5. [Member 1] Implement local PDF extraction and source chunks**
  Spec ref: `Traccoon_Education_Hackathon_MVP_PRD.md > 6. FR-04 to FR-06; 7. Local model approach`
  Depends on: Task 1 selects the runtime. Task 4 defines source-page persistence.
  What to build: Load a local PDF from an `ArrayBuffer`, extract text per page in the browser, classify pages as usable or unavailable, and split selected pages into bounded chunks containing page number, text, and a stable chunk ID. Limit selection to three usable pages. Keep model generation in a dedicated worker.
  Acceptance: The pipeline reads a text-based PDF without uploading it, reports unavailable pages clearly, and emits no chunks from unselected pages.
  Verify: Add tests using one text-based and one image-only PDF fixture. Inspect browser network activity during import.
  Handoff: Export `SourcePage` and `SourceChunk` types plus the local extraction function for Members 2 and 3.

- [ ] **6. [Member 1] Build worker-based Local Private generation**
  Spec ref: `Traccoon_Education_Hackathon_MVP_PRD.md > 6. FR-03, FR-07 to FR-09, FR-14`
  Depends on: Tasks 1 and 5.
  What to build: Implement the model download state, cache status, initialization, progress, cancellation, and card generation in a dedicated worker. Generate at most three cards from selected chunks. Validate each response against `GeneratedCard`, then reject or flag cards whose quote does not occur in the cited source-page text.
  Acceptance: A cached model can generate three valid cards offline on the demo Mac. Unsupported, initialization, malformed-output, and cancellation states leave the imported pantry intact.
  Verify: Run the worker with the network disabled after cache warmup. Unit-test the schema and quote verifier. Demonstrate that the UI remains interactive while generation runs.
  Handoff: Give Member 2 a `generateLocalCards(selectedPages, onProgress)` interface and expected error states.

- [ ] **7. [Member 2] Integrate import, page selection, and local review**
  Spec ref: `Traccoon_Education_Hackathon_MVP_PRD.md > 5. Users and primary journey; 6. FR-04 to FR-10`
  Depends on: Tasks 3, 4, 5, and 6.
  What to build: Connect local PDF intake to page selection and worker generation. Persist valid cards, show source page and quote in review, and keep review limited to keep, discard, edit, and manual add. Mark edited and manual cards.
  Acceptance: From a real local PDF, the learner selects one to three pages, receives no more than three verified cards, changes one card, adds one manual card, and saves the resulting pantry.
  Verify: Perform this journey in the browser using a fixture PDF. Confirm that a deliberately mismatched quote does not enter review.
  Handoff: Hand the saved pantry route to Member 2's study feature and Member 3's privacy checks.

- [ ] **8. [Member 2] Complete study and source-view states**
  Spec ref: `Traccoon_Education_Hackathon_MVP_PRD.md > 6. FR-11; 11. Three-minute demo`
  Depends on: Task 7.
  What to build: Present one card at a time, persist the selected answer, show correct or incorrect feedback, and provide a source view that shows the cited page and exact verified quote. Keep missed cards as locally recorded attempts only; do not build a scheduling system.
  Acceptance: A learner can answer all cards in a pantry, reload, and still see the deck and recorded attempts. Every source view resolves to the card's cited page and quote.
  Verify: Add tests for correct and incorrect answers and manual browser verification of the source view.
  Handoff: Notify Member 3 when the complete learner path is ready for offline and privacy tests.

- [ ] **9. [Member 3] Enforce the Local Private network boundary**
  Spec ref: `Traccoon_Education_Hackathon_MVP_PRD.md > 8. Data and privacy boundary; 9. Acceptance criteria`
  Depends on: Tasks 5 through 8.
  What to build: Add an automated test that fails when Local Private mode sends PDF bytes, extracted text, source chunks, prompts, embeddings, generated cards, or study attempts to an inference endpoint. Add a clear Local Private label to the application; do not add a misleading “0 bytes sent” counter.
  Acceptance: The test passes for app and model cache traffic but fails for any request carrying study content. The UI accurately describes Local Private processing.
  Verify: Run the interception test and inspect the browser Network panel during an offline local-generation run.
  Handoff: Publish the test command and a one-paragraph privacy-check result for the final demo notes.

- [ ] **10. [Member 3] Run the offline persistence acceptance pass**
  Spec ref: `Traccoon_Education_Hackathon_MVP_PRD.md > 6. FR-12 to FR-14; 9. Acceptance criteria`
  Depends on: Tasks 4, 7, 8, and 9.
  What to build: Exercise the exact offline path: warm the app and model cache, disable the network, import a new text-based PDF, generate cards, review, study, reload, and delete the pantry. Record failures as P0 blockers.
  Acceptance: The full path completes without a study-content request. Pantry deletion removes its local data. Any unsupported PDF is routed to manual authoring without corrupting stored data.
  Verify: Complete the manual offline test on the demo Mac and save a short result checklist in `docs/demo-verification.md`.
  Handoff: Report P0 blockers by hour 14. Member 1 fixes runtime blockers; Member 2 fixes journey blockers; Member 3 re-runs verification.

- [ ] **11. [Member 1] Harden the demo model path**
  Spec ref: `Traccoon_Education_Hackathon_MVP_PRD.md > 9. Quality gates; 13. Risks and responses`
  Depends on: Task 10.
  What to build: Test the selected model against three real course PDFs. Tune the source-chunk prompt or reduce pages and card count until the quality gate is met. Pre-cache the selected model and preserve a backup recording of a successful local run.
  Acceptance: The model produces a first card within 60 seconds after cache warmup, at least 70 percent of sample cards need no edit, and every displayed quote passes verification.
  Verify: Update `docs/model-spike.md` with results for all three PDFs and record a short offline backup demo.
  Handoff: Declare the model configuration frozen at the feature-freeze checkpoint.

- [ ] **12. [Member 3] Freeze, rehearse, and prepare the handoff**
  Spec ref: `Traccoon_Education_Hackathon_MVP_PRD.md > 11. Three-minute demo; 12. Delivery plan`
  Depends on: Tasks 1 through 11.
  What to build: Run the three-minute script three times on the demo Mac. Capture screenshots of model-ready state, page selection, generation progress, verified source view, offline reload, and delete-data action. Write the submission proof points and final demo instructions.
  Acceptance: The demo completes reliably within three minutes with the network disabled after model warmup. The team has a backup video, screenshots, test results, and a clear explanation of Local Private processing.
  Verify: Time all three rehearsals. Run the production build and the full test suite. Confirm no unfinished P1 feature is exposed as working.
  Handoff: The project is ready for submission preparation. Cloud Enhanced remains deferred until after the hackathon.

## P0 completion checklist

- [ ] Tasks 1 through 10 are complete and verified.
- [ ] Task 11 records a passing model-quality gate.
- [ ] Task 12's three demo rehearsals pass on the primary Mac.
- [ ] Cloud Enhanced, embeddings, gamification, and advanced scheduling remain absent or visibly marked as deferred.
