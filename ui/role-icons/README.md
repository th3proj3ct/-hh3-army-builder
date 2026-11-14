# Your own Battlefield Role icons

Put image files here to replace the builder's drawn role icons on your machine.
Git ignores everything in this folder except this README, so images you add are
never committed. Production builds leave them out unless you opt in (see below).

Only add images you have the right to use. The official Games Workshop role icons
are their artwork, so keep them for personal use and don't publish a build that
contains them.

## File names

One file per role, as `.png`, `.webp`, `.svg` or `.jpg`. Letter case, spaces,
hyphens and a leading `roles_` are ignored, so `HighCommand.png`,
`high-command.png` and `roles_HighCommand.png` all work.

| Role | Example file name |
|---|---|
| Warlord | `Warlord.png` |
| High Command | `HighCommand.png` |
| Command | `Command.png` |
| Retinue | `Retinue.png` |
| Elites | `Elites.png` |
| War-engine | `WarEngine.png` |
| Troops | `Troops.png` |
| Support | `Support.png` |
| Lord of War | `LordOfWar.png` |
| Transport | `Transport.png` |
| Heavy Assault | `HeavyAssault.png` |
| Heavy Transport | `HeavyTransport.png` |
| Armour | `Armour.png` |
| Recon | `Recon.png` |
| Fast Attack | `FastAttack.png` |

Plural or alternative spellings like `LordsOfWar`, `Armor` and `HQ` are accepted too.
Any role without a file keeps the drawn icon. They're shown at about 16–20 px.

**Colour:** single-colour images, such as black shapes on a transparent background,
are painted in the theme's gold, so they match the drawn icons in light and dark
mode. Your files aren't changed. Multi-colour images are shown as they are.

## When they show up

- `npm run dev`: images here are picked up straight away. Adding or removing a
  file reloads the page.
- `npm run build`: images are **left out** by default. To build a copy with them
  for your own use, run it with `ROLE_ICONS=include` set, for example
  `ROLE_ICONS=include npm run build` in Git Bash.
