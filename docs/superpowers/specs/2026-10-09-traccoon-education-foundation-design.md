# Traccoon Education foundation design

**Status:** approved architecture, revised foundation slice pending implementation-plan review
**Date:** 2026-10-09
**Product source:** `docs/Traccoon_Education_PRD_001_v1.0.md`

## Purpose

Build Traccoon Education as a responsive, offline-capable browser study application. A learner uploads a text-based PDF, selects relevant pages, reviews editable source-linked cards, and studies them from a pantry. Rokki rewards study through ingredients, snacks, and Satisfaction, but never blocks study.

The product is web-first. The client uses Vite, React, and TypeScript. Expo and native application packaging are outside this project.

## Decisions and constraints

- Support responsive widths from 360 px through desktop. Validate the core flow at 390 px and 1440 px.
- Use TypeScript in the client, API, contracts, and study domain. Replace the generated Python API starter rather than retain a mixed-language server.
- Persist prepared material and queued mutations in IndexedDB so a learner can study and edit offline after preparation.
- Keep the server authoritative for account-owned content and reconciled attempts. The client may show a provisional attempt while an event is waiting to sync.
- Support text-based PDFs only. When the server finds no meaningful text layer, it declines generation and offers manual card authoring.
- Include no payment, entitlement, advertising, subscription, native-app, social, classroom, or OCR feature.
- Never put AI-provider credentials in the browser. Only selected page text may reach the server-side card generator.
- Start with the PDF-to-card study basics. Ingredient, snack, feeding, Satisfaction, and Hungry Rokki surfaces are present as non-interactive placeholders in the first slice.

## Repository structure

```text
traccoon-educ-web/
├── .agents/
│   ├── skills/
│   │   ├── ui-ux-pro-max/
│   │   ├── ponytail/
│   │   ├── superpowers/
│   │   └── traccoon-design/
│   └── SOURCES.md
├── apps/
│   ├── web/                     # Vite, React, browser UI, IndexedDB
│   └── api/                     # TypeScript HTTP API and server adapters
├── packages/
│   ├── contracts/                # Zod schemas, API payloads, shared identifiers
│   └── study-engine/             # Pure card and attempt rules; companion economy later
├── docs/
│   ├── Traccoon_Education_PRD_001_v1.0.md
│   └── superpowers/specs/
├── package.json
├── pnpm-workspace.yaml
└── docker-compose.yml            # local PostgreSQL and S3-compatible object storage
```

The root becomes a pnpm workspace. It owns shared lint, type-check, test, build, and development scripts. Generated Vite starter assets and the Python starter files are removed only when their TypeScript replacements are in place.

The existing PRD remains untouched. The existing `docs/` directory is preserved; this document is an additional specification.

## Application architecture

### Browser client

`apps/web` remains a Vite React TypeScript app. React Router provides these authenticated application routes:

| Route | Responsibility |
|---|---|
| `/sign-in` | Register, sign in, sign out, and explain the local-first study model. |
| `/` | Dashboard: pantry list, Rokki summary, static companion-progress placeholders, and sync state. |
| `/pantries/new` | Upload a PDF or begin manual authoring. |
| `/pantries/:pantryId/pages` | Show processing state, text availability, and an empty-by-default page selection. |
| `/pantries/:pantryId/review` | Inspect, edit, reorder, remove, or manually add cards before study. |
| `/pantries/:pantryId/study` | Run one-card-at-a-time study, immediate feedback, source reference, and a static ingredient-progress placeholder. |
| `/settings/rokki` | Select from the starter cosmetic options. |

The route shell is responsive rather than split into mobile and desktop products. Small screens use a compact top bar and single-column task flow; larger screens add persistent navigation and give page selection and card editing more space.

### API

`apps/api` becomes a TypeScript Fastify service. Fastify request schemas validate inputs with the shared Zod contracts. The API exposes a JSON HTTP interface for authentication, PDF preparation, pantry content, event sync, and canonical progress.

Adapters isolate external systems:

| Adapter | Development implementation | Production implementation |
|---|---|---|
| Account and session store | PostgreSQL-backed local database | PostgreSQL-backed managed database |
| PDF and thumbnail storage | local S3-compatible object storage | account-scoped object storage |
| PDF extraction and previews | server-side text extraction and rendered page images | same contract, managed object storage |
| Card generation | deterministic fixture generator when no key is configured | server-side configured AI provider |

The API keeps its provider configuration in environment variables. A missing AI key never produces a fake successful generation in production mode; it returns a recoverable, plain-language error. The deterministic generator exists only for local development and automated tests.

### Shared domain

`packages/contracts` owns JSON-safe entities and request/response schemas. `packages/study-engine` owns pure card-order and attempt functions with no browser or server imports. Both web and API use the same contracts for provisional and canonical attempts.

Key entities are:

- `Pantry`: learner-owned collection, source metadata, selected page numbers, card order, and timestamps.
- `Card`: question, exactly four options, correct index, optional source page and quote, position, edit metadata, manual flag, and soft-delete metadata.
- `Attempt`: append-only event with a client-generated stable ID, card ID, session ID, sequence, answer, correctness, and timestamp.
- `OutboxEntry`: local-only queued mutation with event ID, payload, status, attempts, and retry metadata.

The initial contracts omit derived card mastery, ingredients, snacks, feeding, Satisfaction, and Hungry Rokki state. Their names and intended rules stay in the PRD, while the first slice uses presentation-only placeholders that cannot mutate learner progress.

## Offline and synchronization model

The browser keeps an IndexedDB database with `pantries`, `cards`, `attempts`, `outbox`, and `syncMeta` stores. Every local write is transactional: update local state first, add an outbox entry with a stable ID, then notify the sync worker.

The sync worker runs at startup, after a local mutation, on the browser `online` event, and when the learner requests retry. It sends pending entries in order. The API de-duplicates by event ID and returns canonical attempt state. The client replaces a provisional attempt only when the server result differs, then shows a concise explanation without blocking study.

Prepared pantries, edits, and study attempts remain available while offline. Authentication, upload, page extraction, and generation remain online-only actions. Offline status is visible but never disables access to prepared study material.

## PDF preparation and card generation

1. The authenticated learner uploads a PDF to the API.
2. The API stores the source under the account scope, extracts text by page, creates preview assets, and returns every page's availability and a plain-language reason when text is unusable.
3. The page-selection view starts with no selected pages. It permits only pages with usable text.
4. The browser sends the chosen page numbers. The API passes only those page texts to the server-side generator.
5. The generator returns schema-validated four-option cards. Every generated card includes a source page and short source quote.
6. The review route saves the generated cards locally and remotely. The learner can edit, reorder, remove, or add cards before entering study.

If extraction finds no usable text, the API labels the document as scanned or image-only, declines generation, and links to manual authoring. It does not attempt OCR.

## Study basics and companion placeholders

The first study route presents one card at a time, immediate answer feedback, and a source-page control. It records an append-only attempt locally and queues it for server reconciliation.

The study and dashboard screens include an ingredient tray, snack area, Satisfaction value, scrap summary, and Rokki status as deliberately non-interactive placeholders. They communicate that the companion system is planned but do not award ingredients, form snacks, enable feeding, calculate Satisfaction, or offer scrap-focused sessions.

Card selection uses a simple deterministic order in the first slice. The PRD priority function, snack tiers, feeding rules, Satisfaction calculation, and Hungry Rokki trigger are deferred together so the companion economy is introduced as one coherent feature.

The server accepts and de-duplicates study attempts. The client uses the same shared attempt schema for local persistence and sync. Derived card mastery and companion progress remain deferred.

## Authentication, data, and security

The first implementation uses account registration and sign-in with email, password hashing, and HTTP-only same-site session cookies. This keeps the foundation self-contained and avoids making a third-party identity account a development dependency.

Account ownership is verified at every pantry, source-file, card, and event operation. Server routes validate schema, file type, size, account scope, and card constraints. Cookie and CSRF configuration are set by environment for local and deployed origins. PDF files and page-preview URLs are never public by default.

PostgreSQL stores account-owned content, source metadata, append-only events, and idempotency keys. Derived mastery and companion progress are added with the deferred companion economy. Object storage stores original PDFs and preview images. A local compose environment provides PostgreSQL and S3-compatible storage without committing secrets.

## Traccoon design system and Rokki assets

The original Bryl layout principles remain useful: readable hierarchy, compact mono labels, generous whitespace, fine dividers, soft radii, low-elevation shadows, restrained motion, system-aware theming, and reduced-motion support. The monochrome color rule is replaced.

| Semantic role | Light value | Use |
|---|---:|---|
| Canvas | `#FFF8F3` | Page background |
| Surface | `#FFFCF9` | Cards and sheets |
| Ink | `#2E292A` | Primary text and primary action |
| Fur | `#B58B70` | Structural warm neutral and illustrations |
| Blush | `#E88991` | Positive learner progress and active emphasis |
| Peach | `#E9B58F` | Celebration and snack warmth |
| Mist | `#F2E5DD` | Subtle fills and dividers |

Text, focus, and interactive states use contrast-safe pairings. Blush and peach do not carry meaning alone: copy, iconography, or shape explains outcomes. The app includes visible focus treatment, semantic landmarks, keyboard escape routes, and a complete reduced-motion presentation.

Rokki's supplied PNG layers are copied into `apps/web/public/rokki/`, preserving their named folders. The initial client uses a static, deterministic composite and starter cosmetic selection. Companion-progress controls are disabled placeholders. The app does not claim to provide Rive animation; the supplied source contains transparent raster layers rather than a completed animation rig.

## Project-local skill integration

The requested upstream skills are imported under `.agents/skills` and remain versioned with the repository. `.agents/SOURCES.md` records each source URL, pinned revision, license, import date, and local purpose.

| Local skill | Upstream source | Project use |
|---|---|---|
| `ui-ux-pro-max` | `nextlevelbuilder/ui-ux-pro-max-skill` | Responsive UI research, accessibility, and design-system checks. |
| `ponytail` | `DietrichGebert/ponytail` | Scope discipline, deletion-first review, and simple implementation choices. |
| `superpowers` | `obra/superpowers` | Design, planning, test-driven implementation, verification, and review workflow. |
| `traccoon-design` | derivative of `bryllim/bryl-minimal-design` | Traccoon palette, Rokki asset guidance, and the adapted visual language. |

The Traccoon derivative carries Bryl's required license and source attribution. It is a separate local skill, so upstream updates cannot overwrite the mascot palette.

## Error handling and recovery

- Upload failures identify whether the issue is file type, file size, connection, or server processing, then preserve the learner’s next action.
- PDF pages lacking usable text are disabled with a reason. A fully unusable document offers manual authoring.
- Card-generation failures preserve the selected pages and link back to retry or manual authoring.
- Card-validation failures never save a partial malformed card. The review UI identifies the field to repair.
- Sync failures retain ordered outbox entries and show pending or retry status without disabling a prepared pantry.
- Attempt reconciliation never changes a placeholder companion value in the first slice.

## Verification strategy

| Layer | Verification |
|---|---|
| Contracts and study engine | Unit tests for card validation, page selection, deterministic card order, attempt idempotency, and reconciliation. |
| Web data layer | Fake IndexedDB tests for transactional writes, offline reads, ordered outbox retries, and canonical reconciliation. |
| API | Route integration tests for account isolation, PDF rejection, text-page availability, generation validation, manual cards, and duplicate-event handling. |
| UI | React component tests for keyboard behavior, error states, source references, disabled companion placeholders, and responsive-safe text. |
| End to end | Browser tests at 390 px and 1440 px for PDF-to-first-answer, manual authoring, offline study, and reconnect-without-double-counting attempts. |

The repository must pass type-checking, linting, unit and integration tests, production builds, and the two end-to-end viewport scenarios before the MVP is called complete.

## Current foundation-slice acceptance criteria

1. A learner can create an account, sign in, and open a responsive dashboard at 390 px and 1440 px.
2. A learner can create a pantry manually, add and edit a valid four-option card, and begin a study session.
3. A text-based PDF can be uploaded, inspected page by page with an empty default selection, and converted into reviewable cards through the configured development generator.
4. A study answer is stored locally while offline, appears as pending sync, and reaches the API exactly once when connectivity returns.
5. A scanned or image-only PDF declines generation and offers manual authoring.
6. The ingredient tray, snack area, feeding action, Satisfaction, scraps, and Hungry Rokki are labelled as forthcoming and cannot change state or prevent studying.

## Delivery sequence

1. Create the TypeScript workspace, local development services, shared contracts, root quality scripts, and project-local skills.
2. Replace the Vite starter with the accessible application shell, Traccoon design tokens, Rokki assets, routing, and local storage layer.
3. Build authentication, API persistence, source storage, PDF extraction, page selection, and manual authoring.
4. Add generated-card review with server-side generation adapters, source references, and a basic study session that records attempts.
5. Add IndexedDB persistence, attempt sync, disabled companion placeholders, and the responsive dashboard.
6. Build the companion economy later: ingredient awards, snack formation, manual feeding, Satisfaction, scrap-focused invitations, and derived card mastery.
7. Run responsive, offline, account-isolation, idempotency, and accessibility verification against the current slice's acceptance criteria.
