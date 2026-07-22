# Forge

Personal, local-first PWA for a 12-week 5/3/1 Boring But Big run (3 cycles × 4 weeks).
Dark-themed, offline-capable, one-thumb operable. No accounts, no backend — everything
lives in IndexedDB on the device.

## Commands

```sh
npm run dev      # dev server
npm test         # Vitest unit tests (program logic)
npm run build    # typecheck + production build (dist/) with service worker
npm run preview  # serve the production build locally
```

## Deploying

Live at **https://krinehart109.github.io/workout-531/** (GitHub Pages, `gh-pages` branch).
The base path `/workout-531/` is set in [vite.config.ts](vite.config.ts) — keep it in
sync with the repo name.

To ship an update:

```sh
npm run deploy   # builds and pushes dist/ to the gh-pages branch
```

Install on the phone: open the URL in Safari/Chrome → Share → **Add to Home Screen**.
After the first load it works fully offline; installed phones pick up new deploys the
next time they open the app with a connection.

## Where things live

- `src/lib/` — pure program logic (schemes, TM progression, BBB, plate math, schedule,
  assistance rotations), fully unit-tested in `src/lib/__tests__/`.
- `src/db.ts` — Dexie/IndexedDB schema (`settings`, `workoutLogs`, `bodyweight`),
  seeded from `src/lib/seed.ts` on first run.
- `src/backup.ts` — JSON export/import (Settings → Data).
- `src/screens/`, `src/components/` — UI.
- `scripts/gen-icons.mjs` — regenerates the PWA PNG icons (no deps): `node scripts/gen-icons.mjs`.

## Program notes (encoded in the app)

- TM = 1RM × TM% rounded to nearest 5; weights never drop below the 45-lb bar.
- Cycles start Mon Jul 20 / Aug 17 / Sep 14, 2026; TMs auto-increment +5 upper / +10
  lower unless held in Settings → End-of-Cycle Review (missed AMRAP minimums are flagged).
- Squat TM is deliberately 85% (groin caution — hip prep card appears on squat/DL days).
- OHP 1RM is an estimate; the app prompts to recalibrate after the C1W1 AMRAP if it
  lands ≥8 or <5 reps.
- Backups: Settings → Export JSON. Data is device-local — export after training weeks.
