import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'

interface IconProps {
  icon: IconSvgElement
  size?: 16 | 20 | 24 | 32
}

/**
 * HugeIcons glyph at a consistent stroke. Decorative by default: the visible
 * text next to it names the control, so screen readers skip the icon.
 */
export function Icon({ icon, size = 20 }: IconProps) {
  return <HugeiconsIcon aria-hidden="true" color="currentColor" focusable="false" icon={icon} size={size} strokeWidth={2} />
}
