const colors = {
  primary: '#8D6748',
  primaryHover: '#725037',
  primarySoft: '#E8D9CD',
  secondary: '#F5EFEB',
  surface: '#FFFCFA',
  surfaceMuted: '#EEE5DF',
  tertiary: '#E5A93C',
  tertiaryHover: '#BD831C',
  neutral: '#2B2625',
  copy: '#594D46',
  muted: '#82746C',
  border: '#D8C9C0',
  focus: '#8D6748',
  success: '#13703A',
  successSurface: '#E6F4EB',
  danger: '#BE2A1E',
  dangerSurface: '#FDEDEB',
  info: '#2346C8',
  infoSurface: '#ECF0FD',
  warningSurface: '#FFF4D5',
  highlight: '#FFEF5A',
  white: '#FFFFFF',
  overlay: 'rgb(43 38 37 / 45%)',
} as const

const typography = {
  fontFamily: 'Nunito, ui-sans-serif, system-ui, sans-serif',
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.1,
    normal: 1.45,
    relaxed: 1.6,
  },
  letterSpacing: {
    compact: '-0.03em',
    normal: '0',
    label: '0.08em',
  },
} as const

const spacing = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
} as const

const radii = {
  control: '10px',
  card: '18px',
  pill: '999px',
} as const

const shadows = {
  card: '0 14px 32px rgb(43 38 37 / 8%)',
  floating: '0 24px 48px rgb(43 38 37 / 16%)',
} as const

export const themes = {
  colors,
  typography,
  spacing,
  radii,
  shadows,
  motion: {
    quick: '160ms',
    standard: '200ms',
  },
  elements: {
    buttons: {
      primary: {
        background: colors.primary,
        color: colors.white,
        borderColor: colors.primary,
        hoverBackground: colors.primaryHover,
      },
      secondary: {
        background: colors.secondary,
        color: colors.neutral,
        borderColor: colors.border,
        hoverBackground: colors.surfaceMuted,
      },
      inverted: {
        background: colors.neutral,
        color: colors.secondary,
        borderColor: colors.neutral,
      },
      outlined: {
        background: 'transparent',
        color: colors.primary,
        borderColor: colors.primary,
      },
    },
    card: {
      background: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      shadow: shadows.card,
    },
    input: {
      background: colors.white,
      color: colors.neutral,
      borderColor: colors.border,
      focusColor: colors.focus,
    },
    navigation: {
      background: colors.secondary,
      activeBackground: colors.surface,
      activeColor: colors.primary,
      borderColor: colors.border,
    },
    feedback: {
      success: {
        background: colors.successSurface,
        color: colors.success,
      },
      danger: {
        background: colors.dangerSurface,
        color: colors.danger,
      },
      info: {
        background: colors.infoSurface,
        color: colors.info,
      },
    },
  },
} as const

export const themeCssVariables = {
  '--paper': colors.secondary,
  '--ink': colors.neutral,
  '--copy': colors.copy,
  '--muted': colors.muted,
  '--line': colors.border,
  '--green': colors.primary,
  '--green-dark': colors.primaryHover,
  '--sans': typography.fontFamily,
  '--serif': typography.fontFamily,
  '--mono': typography.fontFamily,
  '--color-primary': colors.primary,
  '--color-primary-hover': colors.primaryHover,
  '--color-primary-soft': colors.primarySoft,
  '--color-secondary': colors.secondary,
  '--color-surface': colors.surface,
  '--color-surface-muted': colors.surfaceMuted,
  '--color-tertiary': colors.tertiary,
  '--color-tertiary-hover': colors.tertiaryHover,
  '--color-neutral': colors.neutral,
  '--color-copy': colors.copy,
  '--color-muted': colors.muted,
  '--color-border': colors.border,
  '--color-focus': colors.focus,
  '--color-success': colors.success,
  '--color-success-surface': colors.successSurface,
  '--color-danger': colors.danger,
  '--color-danger-surface': colors.dangerSurface,
  '--color-info': colors.info,
  '--color-info-surface': colors.infoSurface,
  '--color-warning-surface': colors.warningSurface,
  '--color-highlight': colors.highlight,
  '--color-white': colors.white,
  '--color-overlay': colors.overlay,
  '--font-sans': typography.fontFamily,
  '--font-weight-regular': String(typography.weight.regular),
  '--font-weight-medium': String(typography.weight.medium),
  '--font-weight-semibold': String(typography.weight.semibold),
  '--font-weight-bold': String(typography.weight.bold),
  '--font-weight-extrabold': String(typography.weight.extrabold),
  '--line-height-tight': String(typography.lineHeight.tight),
  '--line-height-normal': String(typography.lineHeight.normal),
  '--line-height-relaxed': String(typography.lineHeight.relaxed),
  '--letter-spacing-compact': typography.letterSpacing.compact,
  '--letter-spacing-normal': typography.letterSpacing.normal,
  '--letter-spacing-label': typography.letterSpacing.label,
  '--space-1': spacing[1],
  '--space-2': spacing[2],
  '--space-3': spacing[3],
  '--space-4': spacing[4],
  '--space-5': spacing[5],
  '--space-6': spacing[6],
  '--space-8': spacing[8],
  '--space-10': spacing[10],
  '--space-12': spacing[12],
  '--radius-control': radii.control,
  '--radius-card': radii.card,
  '--radius-pill': radii.pill,
  '--shadow-card': shadows.card,
  '--shadow-floating': shadows.floating,
  '--motion-quick': themes.motion.quick,
  '--motion-standard': themes.motion.standard,
} as const

export function applyTheme(target: HTMLElement): void {
  for (const [name, value] of Object.entries(themeCssVariables)) {
    target.style.setProperty(name, value)
  }
}
