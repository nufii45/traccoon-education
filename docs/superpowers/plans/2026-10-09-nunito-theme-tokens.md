# Nunito theme tokens implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the green, multi-font visual tokens with a bundled Nunito theme owned by `themes.ts`.

**Architecture:** `themes.ts` holds the typed design values and exposes a CSS-variable map. `main.tsx` applies that map before mounting React; CSS reads semantic variables instead of embedding page-specific color values.

**Tech Stack:** React 19, TypeScript 6, Vite, Vitest, `@fontsource/nunito`.

**Spec:** `docs/superpowers/specs/2026-10-09-nunito-theme-design.md`

## Global constraints

- Use the four reference anchors exactly: `#8D6748`, `#F5EFEB`, `#E5A93C`, and `#2B2625`.
- Use bundled Nunito weights 400, 500, 600, 700, and 800. Do not add a remote font request.
- Preserve current UI behavior, class names, responsive breakpoints, and local-AI privacy behavior.
- Leave the collaborator's `feat/design-system` branch unmerged and unchanged.

## Review focus

- A supplied non-document element receives every CSS variable through `applyTheme`; cover this in Task 1.
- The primary text color remains `#2B2625` after migration; cover this in Task 1.
- Keyboard focus remains visible after palette migration; inspect and cover with the existing UI test suite in Task 2.
- Reduced-motion users do not receive added animation; retain existing dialog media query in Task 2.
- The production bundle contains the font files and has no external font dependency; cover this with the Task 3 build.

### Task 1: Theme module

**Files:**
- Create: `apps/web/src/themes.ts`
- Create: `apps/web/src/themes.test.ts`

**Interfaces:**
- Produces: `themes`, `themeCssVariables`, and `applyTheme(target: HTMLElement): void`.
- Consumes: no application modules.

- [ ] **Step 1: Write failing theme tests**

Assert the four palette anchors, `themes.typography.fontFamily` containing
`Nunito`, button variants for primary, secondary, inverted, and outlined
controls, and the variables applied to a created `div`.

- [ ] **Step 2: Run the focused test and confirm it fails because the module is absent**

Run: `pnpm test -- src/themes.test.ts`

Expected: a failing assertion from the test's guarded theme import.

- [ ] **Step 3: Implement the typed theme module**

Export the five groups in the spec, the flattened CSS variable mapping, and
the DOM-independent `applyTheme` function.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `pnpm test -- src/themes.test.ts`

Expected: PASS.

### Task 2: Global token migration

**Files:**
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/components/Dialog/Dialog.module.css`
- Modify: `apps/web/src/features/study/StudySession.module.css`
- Modify: `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `applyTheme` and CSS variables from Task 1.
- Produces: a Nunito-based UI that uses semantic CSS variables.

- [ ] **Step 1: Add a failing UI assertion for the visible local-only entry state**

Keep the current heading and local-only copy assertions so the CSS migration
does not change the initial workflow.

- [ ] **Step 2: Run the focused UI test**

Run: `pnpm test -- src/App.test.tsx`

Expected: PASS before CSS work, proving the behavior baseline.

- [ ] **Step 3: Apply the theme before React mounts and replace global visual tokens**

Call `applyTheme(document.documentElement)` in `main.tsx`. Use variables in
the listed stylesheets for colors, font families, radii, and shared shadows.
Keep class selectors and media queries intact.

- [ ] **Step 4: Run focused UI and theme tests**

Run: `pnpm test -- src/App.test.tsx src/themes.test.ts`

Expected: PASS.

### Task 3: Local Nunito font and release verification

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/pnpm-lock.yaml`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Consumes: the theme font-family token from Task 1.
- Produces: local imports for Nunito weights 400, 500, 600, 700, and 800.

- [ ] **Step 1: Add `@fontsource/nunito` as an application dependency**

Use pnpm from `apps/web` so the workspace lockfile records the package.

- [ ] **Step 2: Import the five required Nunito weights in `main.tsx`**

Import the package styles before the app CSS and retain the existing app entry
imports.

- [ ] **Step 3: Verify the release candidate**

Run: `pnpm test && pnpm lint && pnpm build`

Expected: all commands exit with code 0.
