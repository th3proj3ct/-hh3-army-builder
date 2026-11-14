import type { BattlefieldRole } from '../../src/model';
import { roleLabel } from '../../src/validate';
import { useRoleIconOverride } from './roleIconOverrides';

/**
 * Original line icons for the 15 Battlefield Roles (24×24, drawn with currentColor so
 * they follow light/dark themes). Not the Games Workshop artwork — deliberately simple
 * glyphs: crowns for leaders, vehicles for vehicle roles, and so on.
 */
const PATHS: Record<BattlefieldRole, JSX.Element> = {
  // Big crown with a star above: the Primarch-level leader.
  Warlord: (
    <>
      <path d="M3 18 L4.5 8.5 L8.5 12.5 L12 6.5 L15.5 12.5 L19.5 8.5 L21 18 Z" />
      <path d="M3 21 H21" />
      <path d="M12 1.5 L12.9 3.3 L14.8 3.5 L13.4 4.8 L13.8 6.6 L12 5.7 L10.2 6.6 L10.6 4.8 L9.2 3.5 L11.1 3.3 Z" strokeWidth="1.2" />
    </>
  ),
  // Three-point crown.
  HighCommand: (
    <>
      <path d="M4 18 L5 8 L9.5 12.5 L12 6 L14.5 12.5 L19 8 L20 18 Z" />
      <path d="M4 21 H20" />
    </>
  ),
  // Double rank chevron.
  Command: (
    <>
      <path d="M5 11 L12 5 L19 11" />
      <path d="M5 18 L12 12 L19 18" />
    </>
  ),
  // Shield guarding a small crown: bodyguards of the officers.
  Retinue: (
    <>
      <path d="M12 2.5 L20 5.5 V11.5 C20 16.5 16.5 20 12 21.5 C7.5 20 4 16.5 4 11.5 V5.5 Z" />
      <path d="M8.5 14 L9 9.5 L10.8 11.3 L12 8.5 L13.2 11.3 L15 9.5 L15.5 14 Z" strokeWidth="1.4" />
    </>
  ),
  // Five-point star.
  Elites: <path d="M12 3 L14.6 8.6 L20.6 9.3 L16.1 13.4 L17.4 19.4 L12 16.3 L6.6 19.4 L7.9 13.4 L3.4 9.3 L9.4 8.6 Z" />,
  // A walker: box body, two legs, arm.
  WarEngine: (
    <>
      <rect x="7" y="4" width="10" height="9" rx="1.5" />
      <path d="M9.5 13 L8 20 H6" />
      <path d="M14.5 13 L16 20 H18" />
      <path d="M17 7 H21 V11" />
      <path d="M7 7 H3 V10" />
    </>
  ),
  // Plain heater shield with a bar.
  Troops: (
    <>
      <path d="M12 2.5 L20 5.5 V11.5 C20 16.5 16.5 20 12 21.5 C7.5 20 4 16.5 4 11.5 V5.5 Z" />
      <path d="M12 6 V18" />
    </>
  ),
  // Cross in a circle: specialists, apothecaries, weapon batteries backing the line.
  Support: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5 V16.5 M7.5 12 H16.5" />
    </>
  ),
  // Fortress tower: the biggest war machines.
  LordOfWar: (
    <>
      <path d="M5 21 V8 H8 V5 H10.5 V8 H13.5 V5 H16 V8 H19 V21 Z" />
      <path d="M10 21 V16 A2 2 0 0 1 14 16 V21" />
    </>
  ),
  // Wheeled carrier with a hatch.
  Transport: (
    <>
      <path d="M3 15 V10 L6 7 H18 L21 10 V15 Z" />
      <circle cx="7.5" cy="17.5" r="2" />
      <circle cx="16.5" cy="17.5" r="2" />
      <path d="M10 7 V5 H14 V7" />
    </>
  ),
  // Warhammer.
  HeavyAssault: (
    <>
      <rect x="4" y="3.5" width="12" height="6" rx="1" transform="rotate(-35 10 6.5)" />
      <path d="M11.5 10 L19.5 21" />
    </>
  ),
  // Big tracked box with an arrow (carries troops).
  HeavyTransport: (
    <>
      <path d="M2.5 15 V8 L5 5.5 H19 L21.5 8 V15 Z" />
      <rect x="2.5" y="15" width="19" height="4.5" rx="2.25" />
      <path d="M9 10.5 H15 M13 8.5 L15 10.5 L13 12.5" strokeWidth="1.5" />
    </>
  ),
  // Tank: tracks, hull and turret barrel.
  Armour: (
    <>
      <rect x="2.5" y="14.5" width="19" height="5" rx="2.5" />
      <path d="M4.5 14.5 L6 10.5 H16 L17.5 14.5" />
      <path d="M9 10.5 V8 H14 V10.5" />
      <path d="M14 9 H22" />
    </>
  ),
  // Crosshair.
  Recon: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="1.5" />
      <path d="M12 2 V6 M12 18 V22 M2 12 H6 M18 12 H22" />
    </>
  ),
  // Lightning bolt.
  FastAttack: <path d="M13.5 2.5 L5 13.5 H11 L9.5 21.5 L19 9.5 H13 Z" />,
};

/** Six triangular points around a ring, one at the top (Prime slot frame). */
const PRIME_POINTS = Array.from({ length: 6 }, (_, i) => {
  const a = ((-90 + i * 60) * Math.PI) / 180;
  const half = (12 * Math.PI) / 180;
  const p = (r: number, ang: number) => `${(50 + r * Math.cos(ang)).toFixed(2)},${(50 + r * Math.sin(ang)).toFixed(2)}`;
  return `M${p(38, a - half)} L${p(50, a)} L${p(38, a + half)} Z`;
}).join(' ');

export type RoleFrame = 'none' | 'circle' | 'prime';

/**
 * Battlefield Role icon. By default it sits in a gold ring; `frame="prime"` adds six
 * points around the ring to mark a Prime slot. `size` is the outer size in px.
 */
export function RoleIcon({ role, size = 24, title, frame = 'circle' }: { role: BattlefieldRole; size?: number; title?: boolean; frame?: RoleFrame }) {
  if (frame === 'none') return <RoleGlyph role={role} size={size} title={title} />;
  const label = `${roleLabel(role)}${frame === 'prime' ? ' (Prime slot)' : ''}`;
  return (
    <span
      className={`role-icon role-badge ${frame === 'prime' ? 'prime' : ''}`}
      style={{ width: size, height: size }}
      role={title ? 'img' : undefined}
      aria-label={title ? label : undefined}
      title={title ? label : undefined}
      aria-hidden={title ? undefined : true}
    >
      <svg className="role-frame" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false">
        {frame === 'prime' ? (
          <>
            <circle className="ring" cx="50" cy="50" r="36" fill="none" stroke="currentColor" strokeWidth="5" />
            <path d={PRIME_POINTS} fill="currentColor" />
          </>
        ) : (
          <circle className="ring" cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="5" />
        )}
      </svg>
      <RoleGlyph role={role} size={Math.round(size * (frame === 'prime' ? 0.46 : 0.58))} />
    </span>
  );
}

/** The bare icon: your image from ui/role-icons/ if present, else the drawn one. */
function RoleGlyph({ role, size = 20, title }: { role: BattlefieldRole; size?: number; title?: boolean }) {
  // Your own image from ui/role-icons/, if you've added one for this role.
  const override = useRoleIconOverride(role);
  // Reserve the space while your icons load, rather than flashing the drawn ones.
  if (override === 'pending') return <span className="role-icon" style={{ display: 'inline-block', width: size, height: size }} aria-hidden />;
  const custom = override;
  // Single-colour images are painted in the current text colour (the theme's gold
  // wherever icons appear) through a CSS mask, so they match the drawn icons.
  if (custom?.mono) {
    // Crop away the image's empty margins: scale so the visible shape fills the box.
    let crop: Record<string, string> = {};
    if (custom.image && custom.ink) {
      const k = (size * 0.94) / Math.max(custom.ink.w, custom.ink.h);
      const size2 = `${custom.image.w * k}px ${custom.image.h * k}px`;
      const pos = `${size / 2 - (custom.ink.x + custom.ink.w / 2) * k}px ${size / 2 - (custom.ink.y + custom.ink.h / 2) * k}px`;
      crop = { WebkitMaskSize: size2, maskSize: size2, WebkitMaskPosition: pos, maskPosition: pos };
    }
    return (
      <span
        className="role-icon role-icon-mask"
        style={{ width: size, height: size, WebkitMaskImage: `url("${custom.url}")`, maskImage: `url("${custom.url}")`, ...crop }}
        role={title ? 'img' : undefined}
        aria-label={title ? roleLabel(role) : undefined}
        title={title ? roleLabel(role) : undefined}
        aria-hidden={title ? undefined : true}
      />
    );
  }
  if (custom)
    return (
      <img
        className="role-icon role-icon-img"
        src={custom.url}
        width={size}
        height={size}
        alt={title ? roleLabel(role) : ''}
        title={title ? roleLabel(role) : undefined}
        aria-hidden={title ? undefined : true}
      />
    );
  return (
    <svg
      className="role-icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title ? roleLabel(role) : undefined}
      focusable="false"
    >
      {title && <title>{roleLabel(role)}</title>}
      {PATHS[role]}
    </svg>
  );
}
