# Nunito theme design

**Status:** approved
**Date:** 2026-10-09

## Goal

Give Traccoon Education one warm, reusable visual system. Nunito becomes the
global typeface. A TypeScript theme module owns the palette, typography,
spacing, radii, shadows, semantic feedback colors, and reusable element
recipes.

## Scope

Create `apps/web/src/themes.ts` with a `themes` export, a flattened
`themeCssVariables` export, and `applyTheme(target)` for setting the variables
on a document element. The module provides values for the existing global CSS;
it does not change application behavior, copy, or page layout.

The reference anchors are:

| Token | Value | Use |
| --- | --- | --- |
| `primary` | `#8D6748` | Main actions and active controls |
| `secondary` | `#F5EFEB` | Canvas and soft surfaces |
| `tertiary` | `#E5A93C` | Accent and progress states |
| `neutral` | `#2B2625` | Primary text and inverted controls |

The theme also defines contrast-safe hover, border, muted-text, success,
danger, and informational colors. These are semantic values rather than page
specific colors.

## Theme interface

`themes` has five groups:

- `colors`: reference anchors and semantic UI colors.
- `typography`: Nunito font stack, weights, line heights, and letter spacing.
- `spacing`, `radii`, and `shadows`: reusable layout primitives.
- `elements`: button, card, input, navigation, and feedback recipes.
- `motion`: normal and reduced-motion-safe transition durations.

`themeCssVariables` maps the CSS-facing values to names such as
`--color-primary`, `--font-sans`, `--radius-card`, and `--shadow-card`.
`applyTheme(target)` writes the mapping to `target.style` before React mounts.

## Font loading

The client installs `@fontsource/nunito` and imports weights 400, 500, 600,
700, and 800 in `main.tsx`. The bundled font is available in the deployed app
and does not require a Google Fonts request during the demo.

## CSS migration

`index.css`, `App.css`, and the study and dialog CSS modules use the theme CSS
variables for colors, font families, radii, and shared surfaces. Existing
class names and responsive breakpoints remain unchanged.

## Verification

Unit tests first verify the exact four reference colors, the Nunito font
family, element recipes, and `applyTheme` output on a supplied element. The
full Vitest suite, linter, and production build validate the font imports and
the converted CSS.
