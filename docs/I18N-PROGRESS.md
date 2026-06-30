# i18n & Readability — Progress

Status of the EN/ES internationalization and readability work on branch
`claude/axos-i18n-readability-03t9ir`.

- **Default language:** English. **Switch:** Spanish.
- **Library:** [next-intl](https://next-intl.dev) 4, **without** segment routing.
- **Persistence:** cookie `axos_locale` (SSR-safe — not localStorage).
- **Catalogs:** 10 namespaces, **475** keys, EN/ES at parity (see checker below).
- **Gates:** `next build`, `eslint` (0 errors), `tsc --noEmit` green; verified light + dark.

---

## 1. How it works (architecture)

| Piece | File |
| --- | --- |
| Locale config (locales, default, cookie name, BCP-47 tags) | `apps/web/src/i18n/config.ts` |
| Per-request resolver (reads cookie, loads messages, silences missing keys) | `apps/web/src/i18n/request.ts` |
| Server actions `getUserLocale` / `setUserLocale` | `apps/web/src/i18n/locale.ts` |
| Client provider (tolerant missing-key handling) | `apps/web/src/components/I18nProvider.tsx` |
| next-intl plugin wiring | `apps/web/next.config.ts` |
| Root layout (`<html lang>`, provider) | `apps/web/src/app/layout.tsx` |
| EN/ES catalogs (one JSON per namespace, merged) | `apps/web/messages/{en,es}/*.json` → `messages/{en,es}.ts` |
| Locale-aware format helpers (date/number/currency/percent/relative) | `apps/web/src/lib/i18n/format.ts` |
| EN/ES switcher | `apps/web/src/components/ui/LanguageSwitcher.tsx` |

### Adding a string
1. Add the key to `messages/en/<namespace>.json` **and** `messages/es/<namespace>.json`.
2. New namespace → add one import line to `messages/en.ts` and `messages/es.ts`.
3. In a client component: `const t = useTranslations("<namespace>"); t("key")`.
   Lists: `t.raw("key")`. Interpolation: `t("key", { name })`. Plurals: ICU
   `{count, plural, one {…} other {…}}`.

### Language switch is visible on
- Landing nav (`page.tsx`) · Login screen (`login/page.tsx`) · Dashboard avatar
  menu (`DashboardTopBar.tsx`).

---

## 2. Coverage

### ✅ Fully internationalized (EN + ES)
| Surface | Files |
| --- | --- |
| **Landing** (all sections, nav, hero, flow, galaxy, capabilities bento, platform, differentiators, solutions, enterprise, FAQ, CTA, footer, toasts, product mockup) | `app/page.tsx`, `components/landing/LandingBento.tsx`, `components/landing/LandingMockup.tsx` |
| **Login / auth / register** (form, brand panel, errors, success, toggles, a11y labels) | `app/login/page.tsx` |
| **Select workspace** | `app/dashboard/select-workspace/page.tsx` |
| **Dashboard top bar** (nav toggle, search, notifications, theme + language, avatar menu) | `components/DashboardTopBar.tsx` |
| **Command palette / Cmd-K** chrome (input, footer, records slot, area & record-type group headers, empty/degraded states) | `components/SearchPalette.tsx` |
| **Dashboard home** (greeting, KPIs, "needs attention" with ICU plurals, quick access, recent activity, locale-aware date) | `app/dashboard/page.tsx` |

### 🟡 Partially internationalized
| Surface | Done | Pending |
| --- | --- | --- |
| **Cmd-K search** | All chrome + group headers | The shared **destination catalog** labels/subs (`DESTS`) — see §4 |
| **Plan wall** (`production-plan`) | Readability wiring (WO/Plan badges, model names) | Page copy (headers, toasts, form, status labels) |
| **Production** (`production`) | Readable model names in the WO table | Column headers, status labels, drawer copy |

### 🔴 Not yet internationalized (listed, per the brief)
The **108** dashboard route pages under `app/dashboard/**` are still
Spanish-hardcoded in their body copy. The shared navigation chrome around them
(see §4) is the highest-leverage remaining item. High-traffic pages to prioritize
next, in order:

1. `operador` (MES terminal) · `material-staging` (surtido) · `inventory` · `almacen`
2. `quality` · `floor-quality` · `mrp` · `bom` · `routing` · `models` · `materials`
3. `npi` · `settings/*` · `crm` · `finance/*` · `rh/*` · `ehs` · `maintenance`
4. The long tail (reports, admin, erp/*, office, cad, etc.)

Per-page namespaces should follow the established pattern (one namespace per
module, e.g. `mes`, `materials`, `quality`, `settings`).

---

## 3. Readability (Phase C) — done, reusable

Presentation-only; no data model changes.

| Aid | File | Wired into |
| --- | --- | --- |
| **WO vs Plan badge** (distinct color/icon/name + glossary tooltip) | `components/ui/WorkTypeBadge.tsx` | Plan wall header (Plan) + WO cards (`production-plan`) |
| **Readable seed model names** (map + component, falls back to code) | `lib/readability/modelNames.ts`, `components/ui/ModelName.tsx` | `production-plan`, `production` |
| **EN/ES glossary tooltip** (WO, BOM, kitting, backflush, CTB, MES, NPI, WIP, WMS, MRP, Andon, genealogy) | `components/ui/GlossaryTerm.tsx`, `messages/{en,es}/glossary.json` | available app-wide |

**Roll-out next:** drop `<WorkTypeBadge>` / `<ModelName>` / `<GlossaryTerm>` into
the other screens where WO/Plan/model codes appear (operador, material-staging,
line-control-tower, production drawer). Extend `MODEL_DISPLAY_NAMES` if the seed
adds models.

---

## 4. Biggest remaining item — the shared module-name catalog

The module display names live in **three** independent lists, all Spanish:
- `lib/dashboardAreas.ts` (`AREAS`: ~70 entries `name`/`desc`/`section`) — feeds
  the hub wayfinding (`DashboardWayfinding`) and is described in-repo as the
  single source of areas.
- `components/SearchPalette.tsx` (`DESTS`: ~55 entries `label`/`sub`).
- `components/DashboardNavSheet.tsx` (nav drawer).

**Recommended approach (not done — needs a small, deliberate refactor):** add a
`modules` namespace keyed by route slug (e.g. `modules.operador.name` /
`.desc`), give each catalog entry a stable `id`, and resolve labels at render
via `useTranslations`. Keep `section` as a stable key with a separate
`modules.sections.*` label map so role-grouping logic is untouched. This is
pure text extraction (allowed), but it is cross-cutting, so it was scoped out of
the per-zone commits to avoid a risky wide-blast change. Doing it unlocks
consistent EN/ES across the command rail, search results, nav drawer and hub at
once.

---

## 5. Out of scope here

- **`fix/mes-consume-inventory`** — the `/operador` inventory-decrement fix is on
  its **own branch** as a **draft PR (needs human review)**, not merged, not part
  of this branch. See `docs/fixes/mes-consume-inventory.md`.

---

## 6. Quality checks

- EN/ES key parity: a structural diff confirms every key exists in both locales
  (run during development; re-run when adding namespaces).
- Missing keys never crash the UI — `request.ts` / `I18nProvider` fall back to the
  key's last segment and stay silent (no new `console.*`).
