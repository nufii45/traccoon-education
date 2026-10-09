# Paste this into your coding agent (Codex, Claude Code, etc.)

You are implementing the **desktop-first Traccoon Education onboarding and empty-pantry welcome state** into my EXISTING repository. I will attach / copy the `traccoon-rokki-onboarding-kit` folder from this delivery. This is a real integration task, not a request for another static mockup.

## 0. Inspect before changing anything

1. Review `AGENTS.md`, `PRD.md`, relevant design-system or task documentation, and `superpowers/plans/2026-10-06-web-foundation.md` **if these files exist in the current checkout**.
2. Inspect current `package.json`, framework, routing, authentication, local storage, PDF intake, current Home/Pantry/Rokki screens, tests, and asset directories. Don't assume the old Expo proof of concept is still the active client or that Vite migration was completed. The approved product direction is a responsive **website-first React application**; do not revert to Expo / React Native or implement mobile-app-specific navigation.
3. Note conflicts with the PRD and existing functionality before editing. Preserve everything already working. Reuse current router, styling conventions, state, and test harness instead of duplicating infrastructure.

## 1. Use the attached repository kit

Copy these original materials into appropriate repo directories, adjusting paths/imports if the repo structure differs:

- `public/assets/rokki/rokki-welcome.webp`: Rokki welcoming the learner (transparent).
- `public/assets/rokki/rokki-pages.webp`: Rokki selecting relevant PDF pages (transparent).
- `public/assets/rokki/rokki-cards.webp`: Rokki editing a card (transparent; additional pose available).
- `public/assets/rokki/rokki-offline.webp`: Rokki studying offline (transparent).
- `public/assets/rokki/rokki-choice.webp`: Rokki waving with a notebook (transparent).
- `public/assets/rokki/rokki-classic.svg`: canonical **original head-only** Rokki vector.
- `src/components/Rokki.tsx` and `src/components/rokki.css`: typed reusable component.
- `src/styles/traccoon-tokens.css`: supplied palette and derived dark surfaces.
- `src/features/onboarding/TraccoonOnboarding.tsx` and `onboarding.css`: 5-screen React reference implementation.

The `source/` folder contains the full-resolution transparent PNG originals and original vector reference. Production web uses WebP images; the newly generated full-body poses are **raster images**, NOT editable vectors and NOT an animation rig. Do not rasterize the original `rokki-classic.svg` unnecessarily, do not redraw Rokki's face, and do not use screenshot crops as UI.

If the app serves assets from a non-root base path, adapt asset URLs to that base safely. Use existing image infrastructure if appropriate, maintain aspect ratio, avoid layout shift, provide image descriptions where semantic and hide purely decorative images from screen readers. The provided `Rokki` component already supports motion and reduced-motion.

## 2. Match the five DESKTOP-WEBSITE screens

At 1440×900 desktop viewport, recreate the approved dark onboarding layout with large typographic copy on the left, Rokki / contextual illustrations on the right, generous negative space, and a quiet top brand bar. Use semantic HTML, real buttons, and editable CSS, never a full-screen image of the mocks.

Screen 1, **Welcome**: Header `traccoon. / EDUCATION`; headline `study the material that matters.`; copy `Turn selected PDF pages into editable study cards.`; primary `Get started`; secondary `I already have an account`; use `Rokki variant="welcome"`.

Screen 2, **How it works**: Headline `from your notes to recall.`; three visibly numbered steps: (01) Choose pages: `Select only the pages relevant to your class.` (02) Review cards: `Check and edit AI-generated questions before studying.` (03) Study anywhere: `Saved study material remains available offline.`; continue/back controls; use `Rokki variant="pages"`, optionally small `cards` pose as a supportive visual if space allows.

Screen 3, **Offline first**: Headline `your study material goes with you.`; distinguish GENERATE `Requires internet` from STUDY `Available offline after save`; continue/back; use `Rokki variant="offline"`. Do NOT claim AI generation, uploads, or syncing works offline.

Screen 4, **Your space**: Headline `How do you want to start?`; **recommended** `Continue locally: Study without creating an account.`; **optional** `Sign in for cloud sync: Keep your library across devices.`; note account can be added later. Use `Rokki variant="choice"`. Do not make cloud sign-in mandatory. Connect the local choice to the existing initialization/state and navigate to Home, and the sign-in choice to the real auth route if one exists. If auth is not implemented, present a nondeceptive disabled/coming-soon flow, not fake account success.

Screen 5, **Home / empty pantry**: Desktop web app shell with left sidebar `Home / Pantry / Rokki / Create / Profile` and a welcome message based on real user/display-name state. Main text `Your pantry is empty.`; CTAs `Create from PDF` and `Create manually`; classic Rokki can be used in the empty state (or an approved mascot pose). Both CTAs must use existing real routes. Do not show the empty state if the pantry is populated. Do not overwrite the actual dashboard once onboarding is complete.

Screen flow: Welcome → How it works → Offline first → Local or cloud decision → Home. Back works on screens 2–4. Navigation count labels 01/04, 02/04, 03/04 reflect the three informational screens after welcome and before Home; choose a consistent counting scheme if the project's design system requires different numbering.

## 3. Design system / interaction expectations

Palette: primary brown `#8D6748`, secondary cream `#F5EFEB`, tertiary gold `#E5A93C`, neutral charcoal `#2B2625`. Dark backgrounds can use an accessible near-black derived surface such as `#110F10`. Font: **Nunito Sans**; UI should feel warm, polished, quiet, and editorial, not a bright gamified mobile app. Gold is an accent, cream is the main text/CTA, brown provides depth; keep contrast WCAG AA where practical.

- Desktop-first at 1440px; verify 1280px, 1024px, 768px, and 390px for graceful adaptation, but do NOT deliver a row of phone mockups as the principal UI.
- Keyboard reachable controls with strong focus indicators, clear labels, semantic headings, no navigation dead ends.
- Subtle CSS entrance/float animations only; respect `prefers-reduced-motion: reduce`. Don't add an animation framework unless already in project.
- Do not include the Figma `Preview` badges, placeholder mascot rectangles, debug outlines, temporary specimen imagery, or navigation indexes as production UI.
- No visual redesign of the product's core study features outside scope. Only implement the onboarding and empty-pantry handoff.

## 4. Product rules that must remain intact

Prepared pantry materials remain studyable even without internet. Offline state, Rokki state, a missed streak, scraps, or future monetization must NEVER block learning. Server-side PDF/AI steps require online access; do not expose AI credentials in browser. Generated card candidates must remain learner-editable with source-page references. No subscriptions, purchases, tiers, or paywalls in this website-first MVP. Manual card creation remains available. Preserve existing attempts, snacks and Rokki reward logic; onboarding must not alter them.

## 5. Integrate instead of hardcoding

- Use existing first-run/guest state and auth where available. Persistence should reflect actual local state, not just an `isOnboarded=true` flag hiding broken routes.
- Do not run side effects on first render that fabricate a logged-in identity. Never hardcode the user name `Imman` or pretend sync has succeeded.
- If current app has pantry items, route to the populated pantry/dashboard rather than displaying `Your pantry is empty.`
- The delivered `TraccoonOnboarding` component accepts `onChooseLocal`, `onSignIn`, `onCreateFromPdf`, `onCreateManually`, `onOpenPantry`, `onOpenRokki`, and `onOpenProfile` callbacks. Wire these to actual app logic; remove placeholder notices only after working implementations exist.
- Keep route guards and existing paths compatible; avoid duplicating a permanent second app shell if the project already has one.

## 6. Done criteria and handoff report

1. `/` (or existing public entry route) presents Welcome for first-time visitors; returning users land on the correct existing location.
2. All five screens match desktop design intent; buttons and back navigation operate as intended.
3. Transparent Rokki art loads without square white/black backgrounds; correct pose shown on each screen; the SVG remains available as original mascot.
4. Continue locally works with no forced account; cloud option uses genuine auth or is shown as unavailable.
5. Empty pantry vs populated pantry behaves correctly; both creation CTAs route to real features.
6. Keyboard navigation, `prefers-reduced-motion`, image accessibility, and responsive layout are verified.
7. Existing offline study, PDF, cards, reward mechanics, and tests still work.
8. Run the repo's current test, lint, typecheck, and build commands. If its approved web-foundation plan still applies, run `npm run test:run && npm run lint && npm run build && npm --prefix server run test && npm --prefix server run typecheck` as appropriate to the actual repository.
9. Report exactly which files changed, how assets were installed, how routes were wired, which commands passed, screenshots captured at desktop and narrow viewport, and any remaining functional gaps. Do not claim success for a callback that remains unimplemented.

Proceed with repository inspection and implementation. Ask only if a major product decision cannot be resolved from existing documentation.
