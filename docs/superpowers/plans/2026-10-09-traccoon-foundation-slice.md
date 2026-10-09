# Traccoon Foundation Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the web-first Traccoon foundation: account-scoped PDF-to-card preparation, basic study attempts with offline retry, and non-interactive Rokki progression placeholders.

**Architecture:** A pnpm workspace contains a Vite React browser client, a Fastify TypeScript API, shared Zod contracts, and a browser-independent study package. IndexedDB persists prepared content and an ordered outbox; the API owns account data and idempotently accepts attempts. Rokki is a static raster composite in this slice, while the ingredient and companion economy remains a disabled UI placeholder.

**Tech Stack:** Node 24, pnpm 11, TypeScript, Vite, React 19, React Router, Fastify, Zod, Drizzle ORM, PostgreSQL, S3-compatible object storage, `pdfjs-dist`, Dexie, Vitest, React Testing Library, MSW, Playwright, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-09-traccoon-education-foundation-design.md`

## Global Constraints

- Build a responsive browser application with Vite, React, and TypeScript; do not introduce Expo or native packaging.
- Support core tasks at 390 px and 1440 px without a separate mobile product.
- Only text-based PDFs are eligible for generation. Decline image-only documents and direct learners to manual authoring; do not add OCR.
- Generated cards have exactly four options, a correct index, a source-page number, and a short source quote. Manual cards may omit source metadata.
- The page selection starts empty; only pages with usable text may be submitted for generation.
- Store prepared pantries, cards, attempts, outbox entries, and sync metadata in IndexedDB. Upload, extraction, and generation remain online-only.
- Every attempt has a stable client-generated ID. Retry it in order and ensure the API de-duplicates it by account ID plus event ID.
- Ingredient, snack, feeding, Satisfaction, scraps, and Hungry Rokki remain labelled, disabled placeholders. They do not mutate state or gate study in this slice.
- Keep AI-provider credentials server-only. Use the deterministic generator only in development and tests; production returns a recoverable configuration error until an AI adapter is supplied.
- Copy the supplied Rokki PNG layers as raster assets. Do not imply that they form a completed Rive animation.
- Keep the uploaded PRD unmodified and uncommitted unless the user later asks to commit it.

## Review Focus

- A learner retries the same offline attempt after a timeout; it appears once in the API ledger. Covered by Task 4's duplicate-event integration test and Task 8's outbox retry test.
- A PDF with no meaningful text has no selectable pages and always exposes manual authoring. Covered by Task 5's scanned-document integration test and Task 8's page-selection UI test.
- A learner submits an empty selection or includes an unusable page number; the API returns a field error and generation never runs. Covered by Task 5's generation-input integration tests.
- A signed-in learner guesses another pantry ID; every API route returns `404` without exposing its cards, PDF metadata, or attempts. Covered by Task 4's account-isolation integration test.
- A manual card with a blank option, duplicate option, or an out-of-range correct index cannot be saved. Covered by Task 3's contract tests and Task 7's editor UI test.

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` | Workspace commands, package discovery, shared strict TypeScript options. |
| `.agents/skills/*`, `.agents/SOURCES.md`, `.agents/AGENTS.md` | Versioned upstream skill imports, provenance, and project instruction entrypoint. |
| `packages/contracts/src/index.ts` | Shared Zod schemas, wire types, identifiers, and API error shapes. |
| `packages/study-engine/src/attempts.ts` | Pure deterministic card ordering and attempt event helpers. |
| `apps/api/src/*` | Fastify server, authentication, database schema, storage adapter, PDF extraction, generation adapter, and HTTP routes. |
| `apps/web/src/*` | Vite app shell, routes, IndexedDB repository, outbox synchronizer, page components, and companion placeholders. |
| `apps/web/public/rokki/*` | Original named Rokki PNG layer folders. |
| `e2e/*` | Playwright flow tests at required viewport widths. |

### Task 1: Create the project workspace and import the requested skills

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `docker-compose.yml`
- Create: `.agents/AGENTS.md`, `.agents/SOURCES.md`, `.agents/skills/traccoon-design/SKILL.md`, `.agents/skills/traccoon-design/LICENSE`
- Create: `scripts/verify-project-assets.mjs`, `scripts/verify-project-assets.test.mjs`
- Import: `.agents/skills/ui-ux-pro-max/`, `.agents/skills/ponytail/`, `.agents/skills/superpowers/`
- Modify: `apps/web/package.json`, `apps/api/package.json`

**Interfaces:**
- Consumes: existing Vite app in `apps/web` and the approved specification.
- Produces: `pnpm` workspace commands `dev`, `build`, `lint`, `test`, `test:e2e`, `typecheck`, and `verify`; verified project-local skills available to later work.

- [ ] **Step 1: Write the failing asset-provenance test**

Create `scripts/verify-project-assets.test.mjs` that calls `verifyProjectAssets(root)` and asserts it reports all three upstream imports, one Traccoon derivative skill, source URLs, pinned revisions, and a Bryl license file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/verify-project-assets.test.mjs`

Expected: FAIL because the verifier, provenance file, and local skills do not exist.

- [ ] **Step 3: Implement workspace metadata and `verifyProjectAssets(root: string): VerificationResult`**

Create the root pnpm workspace for `apps/*` and `packages/*`, with Node `>=24` enforced by `packageManager` and `engines`. Use strict shared TypeScript options and root `lint`, `test`, `typecheck`, `build`, and `verify` commands that delegate through `pnpm --recursive`; `verify` runs lint, typecheck, test, and build in that order.

Write `docker-compose.yml` with only PostgreSQL and MinIO development services, non-secret development defaults, named volumes, and health checks. Add corresponding placeholders to `.env.example`; `.env` files and generated storage data stay ignored.

Import the requested upstream content into `.agents/skills` without nested `.git` directories. Copy the `ui-ux-pro-max` skill directory from the upstream `.claude/skills`, the Ponytail `skills` directory tree, and Superpowers `skills` directory tree. Record the exact Git URL, resolved commit SHA, MIT license location, import date, and local path in `.agents/SOURCES.md`.

Write the Traccoon derivative from Bryl's `SKILL.md`; retain its layout, typography, motion, accessibility, and attribution rules but replace monochrome tokens with `canvas #FFF8F3`, `surface #FFFCF9`, `ink #2E292A`, `fur #B58B70`, `blush #E88991`, `peach #E9B58F`, and `mist #F2E5DD`. `.agents/AGENTS.md` must direct future workers to read the PRD, the foundation spec, and this derivative before visual work.

- [ ] **Step 4: Run the asset test and workspace checks**

Run: `node --test scripts/verify-project-assets.test.mjs && pnpm install --frozen-lockfile=false && pnpm typecheck`

Expected: PASS; the workspace resolves all packages and reports no TypeScript error.

- [ ] **Step 5: Commit the workspace and skill import**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .env.example docker-compose.yml .agents scripts apps/web/package.json apps/api/package.json pnpm-lock.yaml
git commit -m "chore: initialize Traccoon workspace and skills"
```

### Task 2: Define shared contracts and test tooling

**Files:**
- Create: `packages/contracts/package.json`, `packages/contracts/tsconfig.json`, `packages/contracts/src/index.ts`, `packages/contracts/src/index.test.ts`
- Create: `packages/study-engine/package.json`, `packages/study-engine/tsconfig.json`, `packages/study-engine/src/attempts.ts`, `packages/study-engine/src/attempts.test.ts`, `packages/study-engine/src/index.ts`
- Create: `vitest.workspace.ts`

**Interfaces:**
- Consumes: root TypeScript and Vitest configuration from Task 1.
- Produces: `createCardSchema`, `generatedCardSchema`, `attemptEventSchema`, `syncAttemptResponseSchema`, `apiErrorSchema`, `orderCardsForStudy(cards)`, and `createAttemptEvent(input)` for API and web tasks.

- [ ] **Step 1: Write failing contract and study-engine tests**

In `packages/contracts/src/index.test.ts`, assert that a valid manual card accepts exactly four distinct non-empty options and no source metadata; generated cards require positive `sourcePage` and a non-empty `sourceQuote`; blank options, duplicate options, and `correctIndex: 4` fail.

In `packages/study-engine/src/attempts.test.ts`, assert `orderCardsForStudy` returns cards by ascending `position` then `id`, and `createAttemptEvent` preserves a supplied UUID event ID, selected index, correctness, ISO timestamp, and session ID.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `pnpm --filter @traccoon/contracts test && pnpm --filter @traccoon/study-engine test`

Expected: FAIL because package manifests, schemas, and functions do not exist.

- [ ] **Step 3: Implement the contracts and pure helpers**

Define branded string aliases only where the type crosses a package boundary: `UserId`, `PantryId`, `CardId`, and `AttemptEventId`. Export inferred payload types from Zod schemas.

Add `zod` to `@traccoon/contracts`; add `vitest` and TypeScript test scripts to both shared packages. Configure `vitest.workspace.ts` to discover only `src/**/*.test.ts` and `src/**/*.test.tsx` inside workspace packages.

`createCardSchema` accepts `{ pantryId, question, options: [string, string, string, string], correctIndex, position, sourcePage?: number, sourceQuote?: string }`; enforce source fields as both present or both absent. `attemptEventSchema` accepts `{ id, cardId, sessionId, selectedIndex, correct, occurredAt }` and rejects values outside card-option bounds. `orderCardsForStudy` must not calculate mastery or companion economy.

- [ ] **Step 4: Run all shared-package checks**

Run: `pnpm --filter @traccoon/contracts test && pnpm --filter @traccoon/study-engine test && pnpm --filter @traccoon/contracts typecheck && pnpm --filter @traccoon/study-engine typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the shared domain**

```bash
git add packages vitest.workspace.ts pnpm-lock.yaml
git commit -m "feat: add shared card and attempt contracts"
```

### Task 3: Build the API foundation, persistence, and account isolation

**Files:**
- Delete: `apps/api/main.py`, `apps/api/.python-version`, `apps/api/pyproject.toml`, `apps/api/uv.lock`
- Create: `apps/api/tsconfig.json`, `apps/api/src/server.ts`, `apps/api/src/app.ts`, `apps/api/src/config.ts`
- Create: `apps/api/src/db/client.ts`, `apps/api/src/db/schema.ts`, `apps/api/src/db/migrate.ts`
- Create: `apps/api/src/auth/passwords.ts`, `apps/api/src/auth/session.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/routes/pantries.ts`
- Create: `apps/api/src/test/app.ts`, `apps/api/src/routes/auth.test.ts`, `apps/api/src/routes/pantries.test.ts`

**Interfaces:**
- Consumes: contracts from Task 2 and `DATABASE_URL`, `SESSION_SECRET`, `CORS_ORIGIN` from Task 1's environment template.
- Produces: `buildApp(dependencies)`, session-aware `requireUser(request)`, and account-scoped pantry CRUD routes.

- [ ] **Step 1: Write failing API integration tests**

Test `POST /v1/auth/register` returns `201`, a safe user payload, and an HTTP-only session cookie; `POST /v1/auth/sign-in` rejects a bad password; `GET /v1/auth/session` returns unauthenticated without a cookie.

In the pantry route tests, create two users and assert user A receives `404` for user B's pantry ID. Assert `POST /v1/pantries` returns a user-owned pantry with an empty card list.

- [ ] **Step 2: Run focused integration tests to verify failure**

Run: `pnpm --filter @traccoon/api test -- auth.test.ts pantries.test.ts`

Expected: FAIL because Fastify routes and database tables do not exist.

- [ ] **Step 3: Implement Fastify, Drizzle persistence, and cookie authentication**

Replace the Python starter with a Fastify package. Add `fastify`, `@fastify/cookie`, `@fastify/cors`, `drizzle-orm`, `drizzle-kit`, `postgres`, `argon2`, `zod`, and `vitest` to `@traccoon/api`. `buildApp` receives a database and clock dependency for tests, registers CORS, secure cookie parsing, Zod error normalization, and `/health`.

Create Drizzle tables for `users`, `sessions`, `pantries`, `cards`, `attempts`, and `idempotency_keys`. Include `userId` on every account-owned table. Hash passwords with Argon2; issue opaque session IDs only in `httpOnly`, `sameSite: 'lax'`, secure-in-production cookies. Use `requireUser` on every pantry route and query ownership in the database condition rather than checking after a broad query.

- [ ] **Step 4: Run API checks**

Run: `pnpm --filter @traccoon/api test && pnpm --filter @traccoon/api typecheck && pnpm --filter @traccoon/api build`

Expected: PASS; cross-account reads return `404` and authentication errors return typed JSON errors.

- [ ] **Step 5: Commit the API foundation**

```bash
git add apps/api packages/contracts pnpm-lock.yaml
git commit -m "feat: add authenticated Traccoon API foundation"
```

### Task 4: Implement card editing and idempotent attempt synchronization

**Files:**
- Create: `apps/api/src/routes/cards.ts`, `apps/api/src/routes/attempts.ts`
- Create: `apps/api/src/services/cards.ts`, `apps/api/src/services/attempts.ts`
- Create: `apps/api/src/routes/cards.test.ts`, `apps/api/src/routes/attempts.test.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/db/schema.ts`, `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: authenticated pantry ownership from Task 3 and `createCardSchema`/`attemptEventSchema` from Task 2.
- Produces: card review CRUD routes and `POST /v1/attempts` returning `SyncAttemptResponse` with `{ attempt, duplicate: boolean }`.

- [ ] **Step 1: Write failing card and duplicate-event tests**

Test create, patch, ordered-list, and soft-delete card endpoints. Assert manual cards can omit source fields, while generated-card payloads must include both `sourcePage` and `sourceQuote`.

Post the same valid attempt event twice as the same account. Assert both responses identify the same persisted attempt ID, the second has `duplicate: true`, and the attempt table contains one row. Post the same event ID as a different account and assert it is accepted as that account's independent event.

- [ ] **Step 2: Run focused route tests to verify failure**

Run: `pnpm --filter @traccoon/api test -- cards.test.ts attempts.test.ts`

Expected: FAIL because the routes and unique event constraint do not exist.

- [ ] **Step 3: Implement review CRUD and attempt handling**

Implement `CardService.create`, `update`, `listForPantry`, and `softDelete` with ownership-scoped queries. Recalculate only card positions after a reorder; do not add mastery or companion columns.

Implement `AttemptService.record(userId, event)` with a unique `(userId, eventId)` constraint. On conflict, fetch and return the original attempt as a duplicate. Validate that the card belongs to the user's pantry before recording the event.

- [ ] **Step 4: Run API test and migration checks**

Run: `pnpm --filter @traccoon/api test && pnpm --filter @traccoon/api db:generate && pnpm --filter @traccoon/api typecheck`

Expected: PASS; duplicate retries do not create extra attempt rows.

- [ ] **Step 5: Commit card and attempt routes**

```bash
git add apps/api packages/contracts pnpm-lock.yaml
git commit -m "feat: add card review and idempotent attempts"
```

### Task 5: Add PDF text inspection and development card generation

**Files:**
- Create: `apps/api/src/storage/types.ts`, `apps/api/src/storage/s3.ts`, `apps/api/src/storage/test-storage.ts`
- Create: `apps/api/src/pdf/extract.ts`, `apps/api/src/pdf/types.ts`, `apps/api/src/generation/types.ts`, `apps/api/src/generation/fixture-generator.ts`, `apps/api/src/generation/unavailable-generator.ts`
- Create: `apps/api/src/routes/sources.ts`, `apps/api/src/routes/generation.ts`
- Create: `apps/api/src/pdf/extract.test.ts`, `apps/api/src/routes/sources.test.ts`, `apps/api/src/routes/generation.test.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/db/schema.ts`, `apps/api/src/config.ts`, `packages/contracts/src/index.ts`, `.env.example`

**Interfaces:**
- Consumes: authenticated pantry ownership, object-storage configuration, and generated-card contracts.
- Produces: `POST /v1/pantries/:pantryId/source`, `GET /v1/pantries/:pantryId/pages`, and `POST /v1/pantries/:pantryId/generate`.

- [ ] **Step 1: Write failing source and generation tests**

Use a small text-based PDF fixture and an image-only PDF fixture. Assert extraction returns one-based page records `{ pageNumber, usableText, reason?, thumbnailUrl }`; image-only pages set `usableText: false` with a plain-language reason.

Assert generation rejects `pageNumbers: []`, rejects a page not marked usable, and calls the fixture generator with only the selected text. Assert fixture-generated cards conform to `generatedCardSchema`; a production-mode unavailable generator returns a recoverable `503` configuration error.

- [ ] **Step 2: Run PDF and generation tests to verify failure**

Run: `pnpm --filter @traccoon/api test -- extract.test.ts sources.test.ts generation.test.ts`

Expected: FAIL because storage, extraction, and generators do not exist.

- [ ] **Step 3: Implement account-scoped source preparation**

Add `@fastify/multipart`, `@aws-sdk/client-s3`, `pdfjs-dist`, and `@napi-rs/canvas` to `@traccoon/api`. Define `ObjectStorage.put`, `getSignedUrl`, and `delete` interfaces. Use MinIO/S3 in runtime and in-memory test storage in route tests.

Implement `extractPdfPages(bytes)` with `pdfjs-dist`: trim extracted text, classify a page usable only when it contains meaningful non-whitespace text, and generate a stored preview thumbnail URL for every page. Persist source metadata and page availability against the pantry.

Define `CardGenerator.generate(pages: SelectedPage[]): Promise<GeneratedCard[]>`. The deterministic fixture generator must create exactly four-option cards and source each card to its supplied page. Do not add a provider SDK until an AI provider and credentials are selected.

- [ ] **Step 4: Run source-workflow checks**

Run: `pnpm --filter @traccoon/api test && pnpm --filter @traccoon/api typecheck && pnpm --filter @traccoon/api build`

Expected: PASS; image-only PDFs offer manual authoring and no request can generate from an empty selection.

- [ ] **Step 5: Commit PDF preparation**

```bash
git add apps/api packages/contracts .env.example pnpm-lock.yaml
git commit -m "feat: add PDF page selection and fixture generation"
```

### Task 6: Replace the Vite starter with the PWA app shell and Traccoon visual system

**Files:**
- Delete: `apps/web/src/App.css`, `apps/web/src/App.tsx`, `apps/web/src/assets/hero.png`, `apps/web/src/assets/react.svg`, `apps/web/src/assets/vite.svg`
- Create: `apps/web/src/app/App.tsx`, `apps/web/src/app/router.tsx`, `apps/web/src/app/providers.tsx`
- Create: `apps/web/src/styles/tokens.css`, `apps/web/src/styles/global.css`, `apps/web/src/styles/motion.css`
- Create: `apps/web/src/components/AppShell.tsx`, `apps/web/src/components/AppShell.test.tsx`, `apps/web/src/components/Rokki.tsx`, `apps/web/src/components/Rokki.test.tsx`, `apps/web/src/components/CompanionPlaceholders.tsx`
- Create: `apps/web/src/pages/SignInPage.tsx`, `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/pages/NotFoundPage.tsx`
- Create: `apps/web/src/test/setup.ts`, `apps/web/src/test/server.ts`, `apps/web/vite.config.ts` PWA configuration
- Copy: `Rokki-Animation-Components/{head,eyes,mouth,cap,body}` to `apps/web/public/rokki/`
- Modify: `apps/web/package.json`, `apps/web/src/main.tsx`, `apps/web/src/index.css`, `apps/web/index.html`

**Interfaces:**
- Consumes: palette values and raster-asset limitations from the design specification.
- Produces: `AppShell`, `Rokki`, and `CompanionPlaceholders` reusable by all product routes; installable/cached Vite PWA shell.

- [ ] **Step 1: Write failing visual-component tests**

Test that `AppShell` exposes `header`, `nav`, and `main` landmarks; renders compact navigation at 390 px; and preserves keyboard focus when navigation changes.

Test that `Rokki` renders the named base/face/cap layers with meaningful alt text. Test that `CompanionPlaceholders` uses disabled controls labelled “Coming soon” and exposes no mutating callback.

- [ ] **Step 2: Run web component tests to verify failure**

Run: `pnpm --filter @traccoon/web test -- AppShell.test.tsx Rokki.test.tsx`

Expected: FAIL because the starter app has none of the required components.

- [ ] **Step 3: Implement the shell, PWA configuration, and shared visual primitives**

Add React Router, TanStack Query, Dexie, `vite-plugin-pwa`, Vitest, Testing Library, MSW, fake IndexedDB, and Lucide React to the web package. Configure the PWA to precache Vite build assets and serve navigation fallback; IndexedDB remains the content store.

Build CSS from semantic custom properties using the Traccoon values in the spec. Implement light and dark token mappings, `prefers-reduced-motion`, contrast-safe focus rings, mono micro-labels, hairline dividers, and responsive layout rules. Do not add Tailwind.

Create a static, layered `Rokki` component from the supplied PNGs; use one mouth layer at a time. `CompanionPlaceholders` displays tray, snack, Satisfaction, scraps, and Hungry Rokki panels with static copy only.

- [ ] **Step 4: Run web checks and production build**

Run: `pnpm --filter @traccoon/web test && pnpm --filter @traccoon/web typecheck && pnpm --filter @traccoon/web build`

Expected: PASS; the production bundle includes the PWA manifest and Rokki asset paths resolve.

- [ ] **Step 5: Commit the application shell**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat: add Traccoon PWA shell and Rokki placeholders"
```

### Task 7: Implement local persistence, authentication UI, and pantry review

**Files:**
- Create: `apps/web/src/data/db.ts`, `apps/web/src/data/pantry-repository.ts`, `apps/web/src/data/outbox.ts`, `apps/web/src/data/api-client.ts`
- Create: `apps/web/src/features/auth/auth-service.ts`, `apps/web/src/features/auth/auth-service.test.ts`
- Create: `apps/web/src/features/pantries/pantry-service.ts`, `apps/web/src/features/pantries/pantry-service.test.ts`
- Create: `apps/web/src/features/cards/CardEditor.tsx`, `apps/web/src/features/cards/CardEditor.test.tsx`, `apps/web/src/features/cards/CardList.tsx`
- Create: `apps/web/src/pages/PantryNewPage.tsx`, `apps/web/src/pages/CardReviewPage.tsx`
- Modify: `apps/web/src/app/router.tsx`, `apps/web/src/app/providers.tsx`, `apps/web/src/pages/SignInPage.tsx`, `apps/web/src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: shared card schemas and API routes from Tasks 2–4, app shell from Task 6.
- Produces: `TraccoonDb`, `PantryRepository`, `AuthService`, `CardEditor`, and routes for sign-in, dashboard, pantry creation, and review.

- [ ] **Step 1: Write failing persistence and editor tests**

Use fake IndexedDB to assert `PantryRepository.savePantryWithCards` writes pantry and cards atomically, and a local manual card remains readable while the API is unavailable.

In `CardEditor.test.tsx`, assert save is disabled for blank, duplicate, or incomplete options; assert a valid manual four-option card without source fields is saved with a pending outbox mutation.

- [ ] **Step 2: Run local-data and editor tests to verify failure**

Run: `pnpm --filter @traccoon/web test -- pantry-service.test.ts CardEditor.test.tsx auth-service.test.ts`

Expected: FAIL because the Dexie database, services, and review UI do not exist.

- [ ] **Step 3: Implement browser repositories and account/pantry UI**

Create `TraccoonDb` with only `pantries`, `cards`, `attempts`, `outbox`, and `syncMeta` stores. Each repository mutation runs inside a Dexie transaction and appends an ordered outbox entry with a UUID before returning control to the UI.

`AuthService` calls the cookie-auth API and exposes a stable user or unauthenticated state. `PantryRepository` hydrates dashboard and review data from IndexedDB first, then refreshes from the API when online. `CardEditor` uses `createCardSchema`, displays field-level validation, and visibly marks locally edited cards.

- [ ] **Step 4: Run web data and component checks**

Run: `pnpm --filter @traccoon/web test && pnpm --filter @traccoon/web typecheck && pnpm --filter @traccoon/web build`

Expected: PASS; manual authoring works with the test API unavailable and invalid cards never enter IndexedDB.

- [ ] **Step 5: Commit local pantry review**

```bash
git add apps/web packages/contracts pnpm-lock.yaml
git commit -m "feat: add local pantries and manual card review"
```

### Task 8: Build PDF page selection, basic study, and ordered offline attempt sync

**Files:**
- Create: `apps/web/src/features/sources/source-service.ts`, `apps/web/src/features/sources/source-service.test.ts`, `apps/web/src/features/sources/PageSelector.tsx`, `apps/web/src/features/sources/PageSelector.test.tsx`
- Create: `apps/web/src/features/study/StudySession.tsx`, `apps/web/src/features/study/StudySession.test.tsx`, `apps/web/src/features/study/sync.ts`, `apps/web/src/features/study/sync.test.ts`
- Create: `apps/web/src/pages/PageSelectionPage.tsx`, `apps/web/src/pages/StudyPage.tsx`
- Modify: `apps/web/src/app/router.tsx`, `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/features/pantries/pantry-service.ts`

**Interfaces:**
- Consumes: source endpoints from Task 5, local repository/outbox from Task 7, and `orderCardsForStudy`/`createAttemptEvent` from Task 2.
- Produces: PDF upload and page selection flow, source-linked basic study route, and `syncPendingAttempts(): Promise<SyncReport>`.

- [ ] **Step 1: Write failing page-selection, study, and sync tests**

Test `PageSelector` begins with no checked pages, disables an unusable page with its server-provided reason, and does not enable Generate until at least one usable page is selected.

Test `StudySession` shows one ordered card, immediate correct/incorrect feedback, its source page/quote for generated cards, and an attempt stored in IndexedDB. Assert companion placeholders remain disabled after either answer.

Test `syncPendingAttempts` sends outbox attempts in sequence, leaves a recoverable failed attempt pending, and treats a duplicate API response as synchronized without adding a second local attempt.

- [ ] **Step 2: Run focused route and sync tests to verify failure**

Run: `pnpm --filter @traccoon/web test -- PageSelector.test.tsx StudySession.test.tsx sync.test.ts`

Expected: FAIL because upload, selection, study, and synchronizer implementations do not exist.

- [ ] **Step 3: Implement source and study features**

`SourceService.upload` sends an online-only multipart upload and persists page availability. `PageSelector` submits selected one-based page numbers only. On a fully unusable document, it exposes a single manual-authoring action and no generation control.

`StudySession` obtains cards from `orderCardsForStudy`, calls `createAttemptEvent` after an answer, writes the attempt and outbox entry transactionally, and advances only after feedback is announced. Manual cards display “Created by you” instead of a missing source reference.

Implement `syncPendingAttempts` to process queued attempt entries by increasing local sequence, stop on a recoverable network failure, retry from browser startup/online/manual retry, and mark duplicate responses as synced. Do not create ingredient, snack, Satisfaction, scrap, or Hungry Rokki data.

- [ ] **Step 4: Run web checks**

Run: `pnpm --filter @traccoon/web test && pnpm --filter @traccoon/web typecheck && pnpm --filter @traccoon/web build`

Expected: PASS; study remains usable while offline and retrying a timed-out attempt cannot visually award a second result.

- [ ] **Step 5: Commit preparation, study, and sync**

```bash
git add apps/web packages/contracts packages/study-engine pnpm-lock.yaml
git commit -m "feat: add PDF study flow and offline attempt sync"
```

### Task 9: Add cross-stack acceptance verification and delivery documentation

**Files:**
- Create: `e2e/fixtures/text-study.pdf`, `e2e/fixtures/scanned-study.pdf`, `e2e/auth-and-study.spec.ts`, `e2e/offline-attempt-sync.spec.ts`, `playwright.config.ts`
- Create: `README.md`, `docs/DEVELOPMENT.md`
- Modify: `package.json`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: working API/web applications and all acceptance criteria from Tasks 1–8.
- Produces: repeatable 390 px/1440 px browser coverage, CI quality gates, and local setup instructions.

- [ ] **Step 1: Write failing acceptance scenarios**

Add Playwright scenarios for: register → upload text PDF → select one page → generate → review → first answer at 390 px and 1440 px; manual authoring after a scanned PDF is declined; and network-disabled answer → reconnect → one recorded attempt.

Add an explicit assertion that every companion control is disabled and does not prevent beginning or completing a study attempt.

- [ ] **Step 2: Run the end-to-end suite to verify failure**

Run: `pnpm test:e2e`

Expected: FAIL until the services, test fixtures, and flows from prior tasks are wired together.

- [ ] **Step 3: Implement delivery automation and documentation**

Configure Playwright to start the API, web app, PostgreSQL, and MinIO test services. Use independent seeded users and clean database/storage state per scenario.

Add `@playwright/test` at the workspace root and define `test:e2e` as `playwright test`; CI installs browser dependencies in its Playwright job before running the suite.

Write the root README and development guide with prerequisites, `docker compose up`, environment setup, migration, test commands, fixture-generator limitation, offline behavior, asset provenance, and a note that companion progression is intentionally non-interactive in this slice. Add CI steps for install, lint, typecheck, unit/integration tests, web/API builds, and Playwright.

- [ ] **Step 4: Run the final verification suite**

Run: `pnpm verify && pnpm test:e2e`

Expected: PASS at both viewport widths, with no duplicate attempt after reconnect and no active companion-economy control.

- [ ] **Step 5: Commit acceptance coverage**

```bash
git add e2e playwright.config.ts README.md docs/DEVELOPMENT.md .github/workflows/ci.yml package.json pnpm-lock.yaml
git commit -m "test: verify Traccoon foundation slice"
```
