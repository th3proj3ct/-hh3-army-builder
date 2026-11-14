/**
 * Optional user-supplied role icons from ui/role-icons/ (see the README there).
 * Loaded lazily so a build made without ROLE_ICONS=include contains none of them:
 * when __ROLE_ICONS__ is false the glob below is dead code and Vite emits no assets.
 *
 * Single-colour images (e.g. black shapes on transparency) are flagged `mono` so the
 * UI can paint them in the theme colour; multi-colour images are shown as they are.
 */
import { useSyncExternalStore } from 'react';
import { BATTLEFIELD_ROLES, type BattlefieldRole } from '../../src/model';

declare const __ROLE_ICONS__: boolean;

export interface RoleIconOverride {
  url: string;
  mono: boolean;
  /** Image size and the box its visible pixels occupy, so the icon can be cropped to its shape. */
  image?: { w: number; h: number };
  ink?: { x: number; y: number; w: number; h: number };
}

const norm = (s: string) => s.toLowerCase().replace(/^roles?_/, '').replace(/[^a-z0-9]/g, '');
const byNorm = new Map<string, BattlefieldRole>(BATTLEFIELD_ROLES.map((r) => [norm(r), r]));
// Common alternative spellings.
for (const [alias, role] of [
  ['lordsofwar', 'LordOfWar'],
  ['lordofwars', 'LordOfWar'],
  ['warengines', 'WarEngine'],
  ['armor', 'Armour'],
  ['hq', 'HighCommand'],
] as const)
  byNorm.set(alias, role);

let icons: Partial<Record<BattlefieldRole, RoleIconOverride>> = {};
/** True while user icons exist but haven't finished loading (avoids flashing the drawn icons). */
let pending = false;
const listeners = new Set<() => void>();

/**
 * Scan an image once: is every visible pixel (nearly) the same colour, so it can be
 * tinted, and where do the visible pixels sit, so empty margins can be cropped away?
 */
function analyse(url: string): Promise<Omit<RoleIconOverride, 'url'>> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        const w = (c.width = img.naturalWidth || 64);
        const h = (c.height = img.naturalHeight || 64);
        const ctx = c.getContext('2d');
        if (!ctx) return resolve({ mono: false });
        ctx.drawImage(img, 0, 0, w, h);
        const d = ctx.getImageData(0, 0, w, h).data;
        let ref: [number, number, number] | null = null;
        let mono = true;
        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            if (d[i + 3]! < 40) continue; // ignore (nearly) transparent pixels
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            const px: [number, number, number] = [d[i]!, d[i + 1]!, d[i + 2]!];
            if (!ref) ref = px;
            else if (Math.abs(px[0] - ref[0]) + Math.abs(px[1] - ref[1]) + Math.abs(px[2] - ref[2]) > 60) mono = false;
          }
        if (maxX < 0) return resolve({ mono: false });
        resolve({ mono, image: { w, h }, ink: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } });
      } catch {
        resolve({ mono: false });
      }
    };
    img.onerror = () => resolve({ mono: false });
    img.src = url;
  });
}

if (__ROLE_ICONS__) {
  const files = import.meta.glob('../role-icons/*.{png,webp,svg,jpg,jpeg}', { query: '?url', import: 'default' });
  pending = Object.keys(files).length > 0;
  Promise.all(
    Object.entries(files).map(async ([path, load]) => {
      const stem = path.split('/').pop()!.replace(/\.[^.]+$/, '');
      const role = byNorm.get(norm(stem));
      if (!role) {
        console.warn(`[role icons] "${stem}" doesn't match a Battlefield Role; see ui/role-icons/README.md`);
        return null;
      }
      const url = (await load()) as string;
      return [role, { url, ...(await analyse(url)) }] as const;
    }),
  ).then((found) => {
    icons = Object.fromEntries(found.filter(Boolean) as [BattlefieldRole, RoleIconOverride][]);
    pending = false;
    listeners.forEach((l) => l());
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The user's image for this role, 'pending' while loading, or undefined to use the drawn icon. */
export function useRoleIconOverride(role: BattlefieldRole): RoleIconOverride | 'pending' | undefined {
  return useSyncExternalStore(subscribe, () => (pending ? 'pending' : icons[role]));
}
