# Pocket Deck (app)

A phone-first daytime meal planner. React 18 + TypeScript + Vite, installed as a PWA. All data stays on the phone (IndexedDB). The product spec and design notes are kept outside this repo; the code comments explain the rules that matter.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # vitest: planner, stock, shopping, backup, calendar, content
npm run build          # type-check + production build into dist/
npm run build:single   # one self-contained HTML file in dist-single/ (used for the Artifact preview)
scripts/deploy.sh      # build and publish dist/ to the gh-pages branch (GitHub Pages)
```

End-to-end checks (need `npm run build:single` first; Playwright's Chromium is installed with the dev deps):

```bash
node scripts/smoke.mjs   <shots-dir>   # check-in, Today, eat/undo + stock, reload, empty kitchen
node scripts/kitchen.mjs <shots-dir>   # unlock, list, restock with price, pantry, flavour kit
node scripts/setup.mjs   <shots-dir>   # the first-run Setup flow end to end
node scripts/me.mjs                    # your numbers replace the placeholders
node scripts/week.mjs    <shots-dir>   # plan the week, tag nights, swap, shopping from the plan
node scripts/scenarios.mjs             # preview-only test scenarios
node scripts/progress.mjs <shots-dir>   # day dots, summaries, blood results, doctor summary
node scripts/newmeals.mjs <shots-dir>   # "new meals unlocked": preview, decide
node scripts/offplan.mjs  <shots-dir>   # had something else, extras, skipping
node scripts/nudges.mjs   <shots-dir>   # Sunday look-back, backup reminder (fixed clock)
node scripts/ownmeal.mjs  <shots-dir>   # add your own meal
node scripts/update.mjs   <shots-dir>   # update toast + what's new (needs npm run build)
node scripts/tomorrow.mjs <shots-dir>   # daytime done: prep, shopping, tell supper now
node scripts/shoplist.mjs <shots-dir>     # running out, sorted list, take off when restocked by hand
node scripts/replan.mjs <shots-dir>       # why a swipe found nothing, and Plan again
node scripts/diet.mjs <shots-dir>         # My diet in plain words
node scripts/serving.mjs <shots-dir>      # serving size from a label becomes a measure
node scripts/auditfixes.mjs <shots-dir>  # dry-vs-cooked label, drained tin, per-100 g column
node scripts/nutrients.mjs <shots-dir>    # every nutrient marker for a meal and for a day
node scripts/backfill.mjs <shots-dir>      # fill in yesterday: meals, supper, habits, extras, undo, bell nudge
node scripts/order.mjs <shots-dir> [screenshot.png]  # import an order: pasted text, and a real screenshot via the reader
node scripts/tuna.mjs <shots-dir>        # two sides of a tin merged, needs-rinse, list hint
node scripts/sheetdrag.mjs .            # dragging content scrolls a sheet; only the handle closes it
node scripts/newfood.mjs <shots-dir>    # new food from a label, custom pack size, new ingredient in own meal
node scripts/menufeel.mjs <shots-dir>   # hold and slide across the menu: lens, magnet, lean
node scripts/switcher.mjs <shots-dir>   # the dots bring another meal to the top
node scripts/med.mjs <shots-dir>   # add, edit and remove the medication under Me
node scripts/mealtimes.mjs <shots-dir>   # set meal times under Me; cards follow
node scripts/touch.mjs   # no selection on a firm press; sideways asks to turn upright
node scripts/label.mjs    <shots-dir>   # label scan: pasted text and a photo (needs npm run build)
```

## Where things are

| Path | What |
|---|---|
| `src/core/` | Pure logic with tests: `planner.ts` (budget, dealing, swiping), `setup.ts` (which foods and meals to ask, gaps), `week.ts` (week plan, needs, cook-ahead), `nutrition.ts`, `stock.ts` (pantry, list, unlock), `shopping.ts`, `backup.ts`, `ics.ts`, `db.ts` (IndexedDB). No React. |
| `src/content/` | Shipped data: `foods.json` (built from USDA), `meals.json`, `suppers.json`. Rebuild foods with `../tools/build-foods.py`; validate meals with `../tools/check-meals.py`. |
| `src/app/` | `useApp.ts` (state, persistence, actions), `viewModel.ts` (core meal → card), `defaults.ts` (placeholder profile, starter pantry), `aisles.ts`. |
| `src/components/` | `Deck`, `CheckIn`, `Setup`, `Kitchen`, `Week`, `Me`, `RadialMenu`, `Sheets`. |
| `src/styles.css` | All styling, driven by the tokens at the top (see DESIGN.md). |
| `public/` | PWA manifest, service worker (`sw.js`), icons. |

## Rules that are easy to break

- **Planner and stock functions are pure and never modify their inputs.** Add a test with any change.
- **IndexedDB:** each store's key field is set in `core/db.ts` (`KEY_FIELD`). Queue transaction requests synchronously; don't `await` between them.
- **Seed only on the very first run** (`useApp.ts`). An empty pantry later is real.
- **Writes must never break the screen.** The hook falls back to memory if storage is blocked.
- **Light theme only. No red/amber. No scolding copy.** Kitchen measures on screen; grams only in shop/label/number panels.
- **Pin every dependency to an exact version.**
- Prototype leftovers: the Claude-powered label scanner lives in `../prototypes/label-scanner/` and is not part of the app.

## Not built yet

the Week look-back, on-device label OCR, "Had something else" / "+ Extra", new-meal check-in, "Add your own meal". See SPEC.md §6.
