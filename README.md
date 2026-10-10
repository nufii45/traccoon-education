# Traccoon Education

## Problem

Study materials can be long, while writing useful review questions takes time. Learners also need to see where an answer came from so they can check it against the source.

## Project Name

**Traccoon Education** is a local-first study app with Rokki as a learning companion.

## Brief Description

Import a text-based PDF, select one to three pages, and generate source-linked study cards in the browser. Review or edit cards before saving them to a pantry, or write cards manually. Practice and Quiz help learners review what they saved. Correct Quiz answers earn ingredients for the Treat Shelf, while Rokki's Corner celebrates progress recorded on the device and suggests what to do next.

The active application is in [`apps/web`](apps/web). Cloud Enhanced generation is marked coming soon and is not an active fallback.

## Tools

| Tool | Use |
| --- | --- |
| React, TypeScript, Vite, React Router | Interface, type checking, build, and navigation |
| PDF.js | Extract text from selected PDF pages in the browser |
| WebLLM and Web Workers | Generate cards without blocking the interface |
| Dexie and IndexedDB | Store pantries, cards, study activity, and treat inventory locally |
| Vite PWA | Cache the application shell for offline use |
| Vitest, Testing Library, Playwright, Oxlint | Test and lint the web app |

The repository also has a [Cloudflare Worker configuration](wrangler.jsonc) for serving the built web app. `apps/api` is outside the active web build.

## Assets

- [Rokki poses](apps/web/src/assets/rokki) and the [classic Rokki illustration](apps/web/public/assets/rokki/rokki-classic.svg) are reused throughout the app.
- [Treat artwork](apps/web/public/assets/treats) supports the Treat Shelf and Rokki's Corner.
- Nunito is bundled through `@fontsource/nunito`; interface icons use HugeIcons.
- The [Rokki onboarding kit](traccoon-rokki-onboarding-kit) contains additional reference artwork and flows.

## Models

Local Private card generation uses `@mlc-ai/web-llm` `0.2.85` and the `Qwen3.5-4B-q4f16_1-MLC` model. If the GPU cannot use that build, the app can try `Qwen3.5-4B-q4f32_1-MLC`. Inference runs in a dedicated browser worker and requires WebGPU. Model weights are downloaded on first use and cached by the browser; they are not included in this repository. The model asset origin, revision, and size are not yet pinned in the runtime configuration.

## What You Can Do

1. Create a pantry from a text-based PDF or start with manually authored cards.
2. Select up to three usable PDF pages and generate up to three four-option cards per run. Review each card with its source quote before keeping it.
3. Study saved cards in Practice or Quiz.
4. Collect ingredients through correct Quiz answers and craft treats on the Treat Shelf.
5. Visit Rokki's Corner for companion interactions, local progress, and learning shortcuts.

Scanned or image-only PDFs are not supported for text extraction. Manual card authoring remains available when PDF extraction or local generation is unavailable.

## Run Locally

Use Node `24.18.0` and pnpm `11.20.0` for this workspace. The [web lockfile](apps/web/pnpm-lock.yaml) is authoritative; the package does not declare engine versions.

```bash
cd apps/web
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. A WebGPU-capable Chrome or Edge browser is recommended for generation. Warm the app and model cache while online before relying on offline generation. See the [local demo runbook](docs/local-demo-runbook.md) for the demonstration workflow.

## Checks

Run these commands from `apps/web`:

```bash
pnpm test
pnpm lint
pnpm build
pnpm test:privacy
```

The [privacy check guide](docs/privacy-check.md) explains the automated browser network test and its setup.

## Privacy and Offline Use

Local Private processes selected PDF text and card generation on the device. It does not send PDF bytes, extracted text, prompts, generated cards, or study attempts to a server or inference service. Application and model assets still download during online setup. Learner records are saved in local IndexedDB, so clearing browser storage removes them. After the application and model caches are warmed, supported Local Private flows can run offline. The [privacy check guide](docs/privacy-check.md) records test coverage and the pending live cached-model validation on the demo Mac.

## Repository Layout

| Path | Purpose |
| --- | --- |
| [`apps/web`](apps/web) | Active React application and its tests |
| [`apps/api`](apps/api) | API workspace, outside the active web build |
| [`docs`](docs) | Product, privacy, and demo documentation |
| [`traccoon-rokki-onboarding-kit`](traccoon-rokki-onboarding-kit) | Rokki reference assets and onboarding material |

## License

The repository includes the [Apache License 2.0](LICENSE). Review the source context for bundled artwork before reusing it outside this project.
