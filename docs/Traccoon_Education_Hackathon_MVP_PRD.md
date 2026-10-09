# Traccoon Education: Hackathon MVP Product Requirements Document

**PRD 002 · Version 1.0 · October 9, 2026**

| Field | Detail |
|---|---|
| Status | P0 implementation laid down; pending live Chrome model spike and offline rehearsal |
| Timebox | 20 hours |
| Primary demo device | WebGPU-capable Mac laptop |
| Primary surface | Responsive browser application, demonstrated on desktop or laptop |
| Parent direction | Hybrid generation: Local Private and Cloud Enhanced |
| Hackathon scope | A complete Local Private flow; Cloud Enhanced is a post-hackathon integration |

## 1. Product summary

Traccoon Education turns a learner's text-based PDF into editable, source-verified multiple-choice study cards. The hackathon MVP runs its complete generation path on the learner's device. After its model assets are cached, it can import a PDF, generate cards, review them, and study offline.

The product's wider direction retains two deliberate generation modes:

- **Local Private:** The PDF, extracted text, embeddings when used, prompts, and generation stay on the learner's device.
- **Cloud Enhanced:** A future connected mode for stronger card generation. It will send only text from learner-selected pages after explicit consent.

Cloud Enhanced is not built in this MVP. The demo proves that Local Private is real, useful, and does not need a cloud inference call.

## 2. Problem and promise

Learners have course PDFs but do not always have the time or confidence to turn them into useful practice. Cloud generation can make high-quality cards, but it asks learners to transmit material that may be private.

Traccoon gives learners a private alternative. It generates cards from a local PDF, preserves the evidence for every card, and lets the learner correct or discard weak output before studying.

**Product promise:** A learner can create source-linked study cards from their PDF without sending study content to a remote inference service.

## 3. Goals

1. Demonstrate a full local loop: PDF import, page selection, card generation, review, study, reload offline.
2. Make every generated card traceable to a real quote on a selected source page.
3. Make local processing visible and credible through an explicit model state and an offline demonstration.
4. Preserve learner control through editing, manual card authoring, and a clear delete-my-data action.
5. Finish a stable three-minute demo on the primary Mac before adding personality features or cloud generation.

## 4. Non-goals

- Cloud Enhanced API, provider integration, account sign-in, source backup, or cross-device sync.
- OCR or support for scanned or image-only PDFs.
- Embeddings and retrieval unless the model spike proves that they improve local card quality enough to justify their time cost.
- General-purpose card reordering, full deck management, advanced scheduling, or analytics.
- Streaks, Satisfaction, snacks, Hungry Rokki, cosmetics, and the card-value function.
- Native applications, payment features, collaboration, teacher tools, and a public marketing site.

## 5. Users and primary journey

The primary user is a learner with a text-based course PDF and a WebGPU-capable laptop. Phone layouts should remain legible for review and study, but local generation is optimized and demonstrated on the laptop.

1. The learner opens Traccoon and sees that Local Private is either ready, needs a model download, or is unsupported.
2. The learner starts the one supported local model from the generation control. The app shows its identifier and download or initialization progress.
3. The learner imports one local PDF. The browser extracts text from its pages and flags pages that lack usable text.
4. The learner selects up to three usable pages. No page is selected by default.
5. The app generates up to three cards in a worker, validates the output, and verifies each quoted source passage.
6. The learner keeps, edits, discards, or manually adds a card, then starts a short study session.
7. The learner sees immediate answer feedback and can open the card's source page and verified quote.
8. After a reload with the network disabled, the saved deck and study session remain available.
9. The learner can delete the pantry, its PDF, extracted text, cards, and attempts from the device.

## 6. Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | The application opens without an account and identifies the current device-local profile. |
| FR-02 | Before local generation, the app checks for WebGPU support and sufficient browser storage. It reports ready, download required, unsupported, or initialization failed. It does not claim to know the device's VRAM. |
| FR-03 | The app has one supported local model for the hackathon. Download starts only after a learner action and shows progress and the selected model identifier. |
| FR-04 | The learner can import a text-based PDF from the device. The raw PDF is never uploaded. |
| FR-05 | The browser extracts page text locally and marks empty, garbled, or symbol-heavy pages as unavailable with a plain-language reason. |
| FR-06 | The learner selects one to three usable pages. The app generates from no other page. |
| FR-07 | Local card generation runs in a dedicated worker and exposes progress, cancellation, and a recoverable failure state. |
| FR-08 | Each generated card contains a question, exactly four distinct options, one correct index, a source page, and a source quote. Output must pass the shared schema before entering review. |
| FR-09 | The app verifies that a card's source quote occurs in its cited local page text. A non-matching card is rejected or visibly flagged for correction. |
| FR-10 | Review supports keep, discard, edit, and simple manual card authoring. Reordering is out of scope. Edited and manual cards are marked. |
| FR-11 | A study session presents one card at a time, records the selected answer locally, shows immediate feedback, and exposes the card's source reference. |
| FR-12 | Pantries, extracted source text, cards, and attempts persist in IndexedDB. The raw PDF is read in memory and is not retained. The cached app shell reloads offline after the first successful visit. |
| FR-13 | The learner can delete a pantry and all of its local source data after confirmation. The app states that the MVP has no cloud backup. |
| FR-14 | Local Private mode sends no PDF bytes, extracted text, prompts, embeddings, retrieved passages, cards, or study attempts to an inference service. |

## 7. Local model approach

The model-feasibility spike selects the exact model and runtime before product screens are built. The selected runtime must run fully in the browser, use WebGPU on the primary demo Mac, report loading progress, and produce schema-valid card JSON.

The first implementation generates cards directly from bounded chunks of the selected pages. It keeps the source chunk identifier alongside the generated card and derives the source page and quote from that chunk. This produces stronger provenance than asking the model to invent a citation.

Embeddings and retrieval are an optional improvement. Add them only when the spike shows that direct chunk generation fails the card-quality gate. A vector database is not part of the MVP; a small set of local vectors can be searched in memory.

## 8. Data and privacy boundary

| Data | Storage and handling |
|---|---|
| PDF bytes and page text | PDF bytes are read in browser memory and then discarded. Selected page text is stored in IndexedDB; neither is uploaded in Local Private mode. |
| Model assets | Browser-managed model cache after a deliberate download. The app reports its installed state and size. |
| Generated cards and attempts | IndexedDB only. |
| Source quotes | Stored with the card after a local quote-match check. |
| Network requests | App and model-asset downloads may use the network before offline use. Local Private does not send study content for inference. |

The user interface labels the mode as **Local Private: no study content sent for generation**. It must not display a broad claim such as “0 bytes sent,” because app and model assets may legitimately download before the offline demonstration.

## 9. Acceptance criteria

1. On the primary Mac, a learner can install the supported local model and generate three schema-valid cards from one to three selected PDF pages.
2. Every displayed generated card has four distinct non-empty options, one correct answer, a source page, and a source quote that matches the cited page text.
3. In a network-inspected Local Private run, no request contains source PDF bytes, extracted text, prompts, embeddings, generated cards, or study attempts.
4. With the model already cached, the learner can disable the network, import a new text-based PDF, generate cards, review them, and study them.
5. An unsupported runtime, model initialization failure, or malformed model response preserves the imported pantry source text and offers manual authoring.
6. The learner can edit, discard, or manually author a card without an AI request.
7. A saved deck and its attempts survive a page reload with the network disabled.
8. Deleting a pantry removes its page text, cards, and attempts from IndexedDB.
9. The core import, review, and study screens are legible at 390 px and 1440 px. Local generation is required only on the laptop demo path.

### Quality gates

The model spike must use three real, text-based course PDFs. Before the demo build proceeds, it must establish:

- A local generation run produces its first card in under 60 seconds on the primary Mac after the model is cached.
- At least 70 percent of the generated cards are usable without an edit across the sample PDFs.
- Every displayed source quote matches its cited source page.

If the quality gate fails, reduce the card count or page count, improve the source-chunk prompt, or switch the selected local model. Do not add embeddings, cloud generation, or companion features before repeating the spike.

## 10. P1 after the demo is stable

| Feature | Reason it is deferred |
|---|---|
| Cloud Enhanced generation | Requires a provider choice, secure service, explicit consent UI, provider-retention review, and request-boundary tests. |
| Cloud consent screen | Ships with the Cloud Enhanced endpoint so it represents a real flow, not a simulated capability. |
| Model-cache removal | Retain only if the chosen runtime exposes a reliable deletion path within the timebox. |
| Embeddings and retrieval | Direct selected-page chunks are the baseline. Add only for measured card-quality improvement. |
| Missed-card review, Leitner scheduling, Rokki reactions | Helpful learning and personality features, but not required to prove local AI. |
| Advanced mobile optimisation | The demo is laptop-first; narrow layouts only need to remain readable. |

## 11. Three-minute demo

The model is pre-cached on the primary Mac before judging.

1. Open the app and show the Local Private model's selected identifier and ready or download state.
2. Turn on airplane mode and show the Local Private label.
3. Import a real course PDF and select one to three pages.
4. Generate three cards while the app shows local progress.
5. Open a source view and show that the displayed quote occurs on the cited page.
6. Edit or discard one generated card, then answer a few cards in study mode.
7. Reload offline to show that the app shell, deck, and attempts persist.
8. Open browser network tools to show that the local generation run made no study-content request.
9. Delete the pantry to demonstrate device-local data control.

## 12. Delivery plan

| Time | Outcome |
|---|---|
| Hours 0 to 2 | Run the model spike on the primary Mac. Stop and change model or runtime if it cannot produce valid cards from a real PDF. |
| Hours 2 to 10 | Build local PDF intake, page selection, worker generation, schema validation, quote verification, and basic review. |
| Hours 10 to 14 | Build study mode, IndexedDB persistence, pantry deletion, and offline shell caching. |
| Hours 14 to 17 | Test error states and the privacy boundary. Fix the demo path before visual additions. |
| Hours 17 to 20 | Run the complete demo repeatedly, refine copy and layout, record a backup demo, and prepare the submission material. |

## 13. Risks and responses

| Risk | Response |
|---|---|
| The selected local model produces weak questions or distractors. | Test real PDFs first, restrict prompts to short source chunks, require review, and select a different model before building more product surface. |
| The model is slow or fails to initialize at the venue. | Pre-cache it, test the exact Mac, limit a run to three cards, and prepare a recorded backup demo. |
| The model invents evidence. | Use source-chunk identifiers and programmatic local quote matching. |
| PDF extraction produces unreadable slide or column text. | Flag poor pages, limit the demo PDF to verified text pages, and route image-only PDFs to manual authoring. |
| Scope returns to gamification or cloud work. | Treat this document's P0 as frozen until the three-minute offline demo passes repeatedly. |

## 14. Follow-up product direction

After the hackathon, add Cloud Enhanced as the recommended connected path for learners who approve sending selected-page text. It must use the same card contract, return source-linked candidates, hold the provider credential on a server, and never become a silent fallback from Local Private mode.
