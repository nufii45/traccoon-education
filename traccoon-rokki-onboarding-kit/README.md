# Traccoon Education: Rokki and five-screen desktop onboarding

A **desktop-first React/TypeScript + Vite** implementation reference, transparent Rokki pose assets, reusable `<Rokki />` component and copy-ready coding-agent prompt. This is designed for integration into an existing Traccoon repository; it does **not** include actual auth, PDF processing, pantry storage or cloud sync.

## Open as a stand-alone preview

```bash
npm install
npm run dev
```

Open the local URL that Vite prints. `npm run build` verifies a production bundle. Five screens: Welcome → How it works → Offline first → Guest vs cloud → Empty Home/Pantry.

## Integration into the main repository

Copy `public/assets/rokki/` into the existing Vite public directory, then copy `src/components/Rokki.tsx`, `rokki.css`, `src/styles/traccoon-tokens.css`, and `src/features/onboarding/` to corresponding app locations. Import and adapt the onboarding to existing routes. Do **not** blindly replace the app's current `App.tsx`.

```tsx
import { Rokki, RokkiWelcome, RokkiPages, RokkiCards, RokkiOffline, RokkiChoice } from './components/Rokki';

<Rokki variant="welcome" size="580px" motion="float" priority />
<Rokki variant="pages" size="min(48vw, 620px)" />
<Rokki variant="cards" motion="gentle" />
<Rokki variant="offline" />
<Rokki variant="choice" decorative />
<Rokki variant="classic" /> // canonical original head-only SVG
<RokkiWelcome size={460} /> // named wrappers are also exported
```

The illustration file registry is in `src/components/Rokki.tsx`. The `size` prop is a CSS width. The actual image displays with `object-fit: contain` to preserve its full pose. `motion="none"` disables bobbing; reduced-motion OS settings disable animations automatically.

Use the supplied flow:

```tsx
import { TraccoonOnboarding } from './features/onboarding/TraccoonOnboarding';

<TraccoonOnboarding
  displayName={user?.displayName ?? 'Learner'}
  onChooseLocal={() => initializeLocalStudySession()}
  onSignIn={() => navigate('/sign-in')}
  onCreateFromPdf={() => navigate('/create/pdf')}
  onCreateManually={() => navigate('/create/manual')}
  onOpenPantry={() => navigate('/pantry')}
  onOpenRokki={() => navigate('/rokki')}
  onOpenProfile={() => navigate('/profile')}
/>
```

**The callback functions and route paths above are illustrative**; map them to actual functions/paths in your repository. With no handlers, the standalone preview shows informational notices in place of actions and does not pretend upload/auth succeeds.

## Files

| Location | Purpose |
| --- | --- |
| `public/assets/rokki/rokki-*.webp` | 5 optimized transparent character poses (web delivery) |
| `public/assets/rokki/rokki-classic.svg` | Canonical original head-only vector character |
| `source/rokki-png/*.png` | Full-resolution transparent PNG illustrations |
| `source/rokki-original-head.svg` | Source copy of original head-only vector |
| `src/components/Rokki.tsx` | Typed `<Rokki variant="..." />` component |
| `src/components/rokki.css` | Optional floating animation and motion preferences |
| `src/features/onboarding/TraccoonOnboarding.tsx` | 5-screen reference flow and callback contracts |
| `src/features/onboarding/onboarding.css` | Responsive desktop-first website layout |
| `src/styles/traccoon-tokens.css` | User-supplied palette / surface tokens |
| `AGENT_PROMPT.md` | Copy-ready implementation prompt for Codex or another coding agent |

## Palette

- Primary brown `#8D6748`
- Secondary cream `#F5EFEB`
- Tertiary gold `#E5A93C`
- Neutral charcoal `#2B2625`
- Derived dark page surface `#110F10`
- Nunito Sans, with system fallbacks

## Art and technical notes

The five newly illustrated poses are **raster artwork** rendered as transparent PNGs and optimized transparent WebPs. They are reusable as images but are not editable layered vectors or a Rive animation rig. The bundled `rokki-classic.svg` is the previously approved, original head-only mascot vector. This intentional distinction preserves the original mascot identity while supplying contextual scene art.

The standalone reference Home screen intentionally displays an *empty-pantry example*. Real integration must check actual pantry data; never show empty state for a populated pantry. Generation/upload/auth/offline storage are existing product responsibilities, not features implemented by this visual kit. Font loading via Google Fonts is optional and falls back locally if unavailable.
