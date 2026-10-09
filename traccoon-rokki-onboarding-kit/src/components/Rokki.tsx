import type { CSSProperties, ImgHTMLAttributes } from 'react';
import './rokki.css';

/** Five editorial poses + the canonical vector head-only mascot. */
export type RokkiVariant = 'welcome' | 'pages' | 'cards' | 'offline' | 'choice' | 'classic';
export type RokkiMotion = 'none' | 'float' | 'gentle';

const source: Record<RokkiVariant, string> = {
  welcome: '/assets/rokki/rokki-welcome.webp',
  pages: '/assets/rokki/rokki-pages.webp',
  cards: '/assets/rokki/rokki-cards.webp',
  offline: '/assets/rokki/rokki-offline.webp',
  choice: '/assets/rokki/rokki-choice.webp',
  classic: '/assets/rokki/rokki-classic.svg',
};

const descriptions: Record<RokkiVariant, string> = {
  welcome: 'Rokki welcomes you to Traccoon Education',
  pages: 'Rokki helps select useful study pages',
  cards: 'Rokki reviews and edits a study card',
  offline: 'Rokki studies with a tablet while offline',
  choice: 'Rokki waves while holding a notebook',
  classic: 'Rokki, the original Traccoon Education mascot',
};

export type RokkiProps = {
  variant?: RokkiVariant;
  motion?: RokkiMotion;
  size?: number | string;
  className?: string;
  style?: CSSProperties;
  /** Decorative images should be hidden from assistive technology. */
  decorative?: boolean;
  /** Load immediately if visible in the initial viewport. */
  priority?: boolean;
  alt?: string;
} & Pick<ImgHTMLAttributes<HTMLImageElement>, 'onLoad' | 'onError'>;

/**
 * Usage: <Rokki variant="pages" size="min(48vw, 620px)" motion="float" />
 * Copy the matching public/assets/rokki files into the consuming Vite app.
 */
export function Rokki({
  variant = 'classic',
  motion = 'gentle',
  size = '100%',
  className = '',
  style,
  decorative = false,
  priority = false,
  alt,
  onLoad,
  onError,
}: RokkiProps) {
  const accessibleName = decorative ? '' : (alt ?? descriptions[variant]);
  return (
    <span
      className={`tc-rokki tc-rokki--${motion} ${className}`.trim()}
      style={{ width: size, ...style }}
    >
      <img
        src={source[variant]}
        alt={accessibleName}
        aria-hidden={decorative ? true : undefined}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        onLoad={onLoad}
        onError={onError}
      />
    </span>
  );
}

/** Optional semantic wrappers, useful when a screen consistently uses one pose. */
type RokkiSceneProps = Omit<RokkiProps, 'variant'>;
export const RokkiWelcome = (props: RokkiSceneProps) => <Rokki variant="welcome" {...props} />;
export const RokkiPages = (props: RokkiSceneProps) => <Rokki variant="pages" {...props} />;
export const RokkiCards = (props: RokkiSceneProps) => <Rokki variant="cards" {...props} />;
export const RokkiOffline = (props: RokkiSceneProps) => <Rokki variant="offline" {...props} />;
export const RokkiChoice = (props: RokkiSceneProps) => <Rokki variant="choice" {...props} />;
export const RokkiClassic = (props: RokkiSceneProps) => <Rokki variant="classic" {...props} />;
