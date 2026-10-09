/** Served from public/assets/treats so the WebPs keep their filenames and work under a Vite base path. */
export const TREAT_ASSET_BASE = `${import.meta.env.BASE_URL}assets/treats`

export const treatAssetUrl = (relativePath: string, base: string = TREAT_ASSET_BASE): string =>
  `${base.replace(/\/$/, '')}/${relativePath}`
