# AXOS OS — Plan de Convergencia de CAD

> Convergencia de las ~30 ramas CAD (`claude/*` + `codex/night-cad-*`) hacia `main`.
> Mismo método que FASE 2/3, acotado a CAD.
>
> Generado en la sesión `claude/cad-convergence-plan-7ag4nv`. Fecha: 2026-06-30.
> `main` en el momento del análisis: `27c4a78d7d9d1f4e439cba984c46190aaa79516e`
> (`Merge pull request #902 ... fix/mes-consume-inventory`).

---

## ✅ Resultado de ejecución (aprobado por el owner)

**FASE 0** (plan) → aprobada. **FASE 1** (integración) → **6 KEEP integradas**, gate verde
(`next build` + lint + typecheck + specs). **FASE 2/3** → cerrar duplicados + cuarentena.

Durante la integración se confirmó que **2 de las 9 "KEEP" tentativas eran en realidad
duplicados de `axos-cad-factory-scale` (#900)** y chocaban con ella en el mismo código
(footprint/fit-view/focus): `cad-tree-active` y `night-cad-canvas-focus-mode`. Con aprobación
del owner se reclasificaron a **CLOSE-DUPLICATE**. `night-cad-shortcuts-workbench` se cerró como
**superseded** (divergencia +91/−64 vs el sistema de atajos ya evolucionado en `main`).

**Integradas en esta rama (`claude/cad-convergence-plan-7ag4nv`), en orden:**

| # | Feature | Commits | Estado |
|---|---------|---------|--------|
| 1 | factory-scale (#900) — world presets, minimap, scale bar, focus, zoom-to-fit | `74c686d4`·`e257f5c1`·`bfc4705c`·`c720bbe4` | ✅ build verde |
| 2 | viewport saved views | `f3bcffc8` | ✅ |
| 3 | material route command | `db38d9fb` | ✅ |
| 4 | dock staging generator | `2b587964` | ✅ |
| 5 | supermarket kitting generator | `c2b2cfd9` | ✅ |
| 6 | layer quick actions (unlock all / hide empty, port adaptado) | `2b624c62` | ✅ |

> `polar array` y `cad-array` ya estaban en `main`; el workbench CAD (#726) de factory-scale
> también → solo se reaplicaron los 4 commits con valor neto. Generadores rack/warehouse,
> validación, símbolos, flow, plot, edge, dxf, capas base, etc. ya estaban en `main` (STALE).

---

## 0. Hallazgo estructural (leer antes que la tabla)

`main` fue **re-escrito por squash/curación**: tiene solo **51 commits** y un *root* nuevo
(`ac5fae2d`). Las ramas CAD se construyeron sobre **otras dos líneas de historia**:

- `a9fa556b` — la mayoría de `codex/night-cad-*` y `claude/axos-cad-factory-scale`.
- `bf553898` — `claude/cad-contracts-67-69` y `claude/cad-tool-summary`.

**Consecuencia:** muchas ramas **no comparten *merge-base* con `main`**, así que un `git diff`
ingenuo contra `main` es ruido (cientos de archivos). El análisis de abajo se hizo sobre el
**delta real de cada feature** (commits propios sobre su línea base) y comparando **archivo por
archivo** el contenido de la lógica (`lib/cad/*.ts`) contra `main`.

Regla de lectura usada para clasificar:
- `Layout3DEditor.tsx` y `lib/cad/index.ts` **siempre** difieren (son la superficie de
  integración compartida) → no son señal.
- La señal real es el **archivo de lógica** de cada feature:
  - `SAME-as-main` o *subset* de `main` → **STALE** (ya integrada).
  - Adición pura (`+N / -0`) o archivo nuevo ausente en `main` → **valor no integrado**.

**`main` ya integró buena parte del CAD** vía:
`#897` (FASE 2 — 7 features del clúster Layout3DEditor), `#901` (FASE 3 — incluye CAD layer
visibility + safety path zones), `#836` (validation center + industrial templates),
`#850` (flow health), `#853` (supermarket kitting template), `#869` (manufacturing symbols).

Por eso el resultado no es "mergear 30", sino: **9 KEEP** con valor real no integrado,
**19 STALE** ya en `main`, **2 CLOSE-DUPLICATE**, y **1 en cuarentena**.

---

## 1. Conteos

| Clasificación | Nº | Significado |
|---|---|---|
| **KEEP** (integradas) | 6 | Única o ganadora; valor no integrado → **integradas en FASE 1**. |
| **CLOSE-DUPLICATE** | 5 | Funcionalidad ya cubierta por una ganadora / por `main`. Cerrar (FASE 2). |
| **STALE** | 19 | Contenido ya presente en `main` (subset o idéntico). Cerrar sin mergear. |
| **QUARANTINE-RED** | 1 | Toca zona prohibida (entities/auth/guards/synchronize/tenancy). No mergear (FASE 3). |
| **TOTAL** | **31** | |

> Nota: el plan inicial (FASE 0) propuso 9 KEEP / 2 CLOSE. La integración demostró que
> `cad-tree-active`, `canvas-focus-mode` (duplican #900) y `shortcuts-workbench` (divergencia)
> debían cerrarse → **6 KEEP / 5 CLOSE** (decisión del owner).

---

## 2. Inventario completo (31 ramas)

`base`: `merge` = comparte historia con `main` (rebase normal) · `reapply` = sin *merge-base*
(requiere cherry-pick / re-aplicación del delta). `fc` = nº de commits de feature (sin merges).

| # | Rama | SHA (full) | fc | base | Conflicto vs main | Zona sensible | Archivo(s) de lógica vs `main` | Clase |
|---|------|-----------|----|------|-------------------|---------------|--------------------------------|-------|
| 1 | `claude/axos-cad-factory-scale-yd546i` | `38b3e376e505853c696d60fa64650d0339e40d0d` | 12 | reapply | re-aplicar | no¹ | `world-scale.ts`, `minimap.ts`, `PlantMinimap.tsx`, `ScaleBar.tsx` **(NEW)** | **KEEP** |
| 2 | `codex/night-cad-canvas-focus-mode` | `21cf9d005a487462fd60c734042f4f9f586610ca` | 1 | merge | limpio | no | `workbench-chrome.ts` — focus compite con #900 | **CLOSE-DUP** |
| 3 | `codex/night-cad-viewport-bookmarks-0630` | `23440dae8410cd92d14f757c524e0e6728007a7d` | 1 | merge | limpio | no | `viewport-bookmarks.ts` **(NEW)** | **KEEP** |
| 4 | `codex/night-cad-layer-quick-actions` | `618e7547ba2a8e97a5b5aa4522c8e21478dcfb17` | 1 | reapply | re-aplicar | no | `layers.ts` (+56 / −40) | **KEEP** |
| 5 | `codex/cad-tree-active` | `4ee3db827fcda8e217aea1f144762aeba16224b1` | 2 | merge | limpio | no | `plant-scale.ts` — escala compite con #900 | **CLOSE-DUP** |
| 6 | `codex/night-cad-material-route-command` | `d7a2349eed223697399cf1cc08e2c16805eb71ee` | 1 | merge | limpio | no | `material-flow-route.ts` **(NEW)** + `registry.ts` (+164) | **KEEP** |
| 7 | `codex/night-cad-dock-staging-generator` | `a6ccc413fab6c9544cc90b603c2ae11a06dc9d63` | 1 | merge | limpio | no | `warehouse-generators.ts` (+364 / −0) | **KEEP** |
| 8 | `codex/night-cad-supermarket-generator-0630` | `b610e7d276feea0db96c38311e36cbcf9764e5ab` | 1 | merge | limpio | no | `warehouse-generators.ts` (+498 / −0) | **KEEP** |
| 9 | `codex/night-cad-shortcuts-workbench` | `9c1ee24e0314a01942ef185d3f3606858e3da40c` | 2 | reapply | re-aplicar | no | `keyboard-shortcuts.ts` (+91 / −64) — superseded por main | **CLOSE-DUP** |
| 10 | `codex/night-cad-dxf-export-readiness` | `e1bfb39b60e1600099d183199f2b916476a8aaca` | 1 | reapply | re-aplicar | no | `dxf-export-readiness.ts` (versión competidora) | **CLOSE-DUP** |
| 11 | `codex/night-cad-rack-row-generator` | `2004640a0f67659dc95200b477770c58aadb9568` | 1 | merge | limpio | no | `warehouse-generator.ts` (NEW, dup. funcional) | **CLOSE-DUP** |
| 12 | `claude/cad-contracts-67-69` | `fbbd7f143ff58f97661b22da09fb1d87c2432215` | 2 | reapply | — | no | `line-dxf.ts`, `geom-edit.ts` **== main** | STALE |
| 13 | `codex/night-cad-command-line-hints` | `5e6227dcddaed41b57e7f2abf5f8f85855ea5c23` | 1 | merge | (conf.) | no | `command-line-assist.ts` **== main** (#897) | STALE |
| 14 | `codex/night-cad-dxf-critical-label-preflight` | `aeef5b6eefba660ab7c88711aa4b940606bcdb8a` | 1 | merge | limpio | no | `dxf-export-readiness.ts` **== main** (#897) | STALE |
| 15 | `codex/night-cad-dxf-label-export` | `b36b9659ef7eeaf2f7aa417a77050d0727b77590` | 1 | reapply | — | no | `dxf-export.ts`, `layout-export-adapter.ts` **== main** | STALE |
| 16 | `codex/night-cad-edge-clearance-dimensions` | `c6152a7a2270d7cd3c1f7c9dda5c0ff041474891` | 1 | merge | limpio | no | `measurements.ts` **== main** (#897) | STALE |
| 17 | `codex/night-cad-flow-health-panel` | `89adbca7ef7470fba3ac0dea5ebad4c3b7b33640` | 1 | merge | limpio | no | `flow-optimization.ts` **== main** (#850) | STALE |
| 18 | `codex/night-cad-kitting-supermarket-template` | `b6c9f63a7f3cfb4eff670efd06e66d142dc64761` | 1 | merge | limpio | no | `templates.ts` **== main** (#853) | STALE |
| 19 | `codex/night-cad-layer-isolation` | `02aef2c84ced4edf4cde106d48e6480bc8db27b9` | 1 | merge | (conf.) | no | `layers.ts` **== main** (#901) | STALE |
| 20 | `codex/night-cad-layer-lock-edit-guards` | `5ac6aceb6309fc820b28cec5091f2fa1216107e6` | 2 | reapply | — | no | `layers.ts` *subset* de main (+26 / −53) | STALE |
| 21 | `codex/night-cad-line-balance-command` | `30116d10d3268c0e727115ff0b7f24c8dfd1517a` | 1 | merge | (conf.) | no | `line-balance.ts`, `registry.ts` **== main** (#897) | STALE |
| 22 | `codex/night-cad-manufacturing-symbols` | `4f863170ab4e63b1f3b232502230b5a2778f4329` | 1 | merge | limpio | no | `symbols.ts` **== main** (#869) | STALE |
| 23 | `codex/night-cad-object-inspector-pro` | `c782b59d68e0a73160bba878724e7ac4429092da` | 1 | reapply | — | no | `object-properties.ts` *subset* de main (+1 / −5) | STALE |
| 24 | `codex/night-cad-plot-package-metadata` | `08edee601a1d4b9670bfdd0bc73dbf0fb99c68fa` | 1 | merge | limpio | no | `plot-sheet.ts` **== main** (#897) | STALE |
| 25 | `codex/night-cad-rack-row-command` | `b8efc430b9df8c7e07f406ae1ccf4547e433312f` | 1 | reapply | — | no | `registry.ts` *subset* de main (−154) | STALE |
| 26 | `codex/night-cad-safety-path-zones` | `1771ab9123954481be145017be63c9a748d5e361` | 1 | merge | (conf.) | no | `safety-zones.ts` **== main** (#901) | STALE |
| 27 | `codex/night-cad-validation-center` | `4382a733c05f517c115e6e5ff755b082102d27c1` | 1 | reapply | — | no | `validation-report.ts` **== main** (#836) | STALE |
| 28 | `codex/night-cad-validation-quickfixes` | `0226afb355d1420e1def9525ddbc265bfb534711` | 1 | merge | limpio | no | `validation-report.ts` **== main** (#897) | STALE |
| 29 | `codex/night-cad-warehouse-generator` | `c6b43ce6853f9703c942a7979365ee079d12cc95` | 1 | merge | (conf.) | no | `warehouse-generators.ts` **== main** (#897) | STALE |
| 30 | `codex/night-cad-industrial-templates` | `d1df924131e9f124d76031becdd9f8506cbaa91d` | 2 | reapply | — | no | `templates.ts` *subset* de main (−46) (#836) | STALE |
| 31 | `claude/cad-tool-summary-5d9krp` | `3789ff6c1ee785e64b9ebc98839101c0a2972755` | 28 | reapply | — | **SÍ** | entities ×~90, migrations, `auth/guards`, `orm.options.ts`/synchronize, tenancy | **QUARANTINE-RED** |

¹ El escaneo de zona sensible marcó `factory-scale` por `dashboard/maintenance/page.tsx`, pero
es un **falso positivo**: la regex `tenanc` casa con "main**tenanc**e". La rama es **solo
frontend** (sin entities/migrations/auth) → segura para integrar.

---

## 3. Clusters y ganadoras

Agrupados por tema/función. Cada clúster con duplicados elige **UNA ganadora**; el resto se
marca STALE/CLOSE-DUPLICATE.

### A. Escala de fábrica / focus / viewport
- **`axos-cad-factory-scale`** (#900) → minimap, scale bar, world-scale, focus/zoom, polar array. **GANADORA / integrada.**
- **`night-cad-viewport-bookmarks-0630`** → vistas guardadas. **KEEP / integrada** (archivo propio, complementario).
- `cad-tree-active` → "factory scale workspace" con `plant-scale.ts`: **misma feature que #900** por otra vía; choca en el mismo código de footprint/fit-view → **CLOSE-DUPLICATE** (la integración lo confirmó; ver §"Resultado").
- `night-cad-canvas-focus-mode` → `workbench-chrome` focus: **mutuamente excluyente** con el focus mode de #900 → **CLOSE-DUPLICATE**.

### B. Generadores rack / almacén / supermarket
`main` ya tiene `warehouse-generators.ts` con generación de rack (FASE 2 #897).
- **`dock-staging-generator`** (+364) → genera **dock staging**. KEEP (valor nuevo).
- **`supermarket-generator-0630`** (+498) → genera **supermarket kitting** (procedural, distinto del *template* de #853). KEEP (valor nuevo).
- `rack-row-generator` → archivo `warehouse-generator.ts` (singular) duplica el rack ya en `main`. **CLOSE-DUPLICATE**.
- `warehouse-generator`, `kitting-supermarket-template`, `rack-row-command` → ya en `main` → **STALE**.

### C. Capas (layers)
- **`layer-quick-actions`** → **GANADORA / integrada** como *port adaptado* a los tipos de `main`: se añadieron `unlockAllCadLayers` + `hideEmptyCadLayers` (botones Unlock / Ocultar 0); `showAllCadLayers` ya estaba en `main` (no duplicado).
- `layer-isolation` → ya en `main` (#901) → STALE.
- `layer-lock-edit-guards` → *subset* de `main` → STALE.

### D. DXF labels / export
- `dxf-critical-label-preflight` → **es la versión que entró en `main`** (#897) → STALE.
- `dxf-export-readiness` → versión competidora del mismo archivo, no integrada → **CLOSE-DUPLICATE** (supersedida por la de `main`).
- `dxf-label-export` → ya en `main` → STALE.

### E. Comandos / atajos
- **`material-route-command`** → `material-flow-route.ts` (NEW) + ruta de material. **GANADORA / integrada.**
- `shortcuts-workbench` → `keyboard-shortcuts.ts` divergente (+91/−64): `main` ya evolucionó más allá → **CLOSE-DUPLICATE** (superseded, no valor neto claro).
- `command-line-hints`, `line-balance-command`, `rack-row-command` → ya en `main` → STALE.

### F. Validación
- `validation-center` (#836) y `validation-quickfixes` (#897) → ambas ya en `main` → STALE.

### G. Inspector / símbolos / dimensiones / flow / plot (otros, ya integrados)
- `object-inspector-pro`, `manufacturing-symbols`, `edge-clearance-dimensions`,
  `flow-health-panel`, `plot-package-metadata`, `industrial-templates` → STALE.

### H. Backend line-engineering
- `cad-contracts-67-69` → `line-dxf.ts` + `geom-edit.ts` ya idénticos en `main` → STALE.
- `cad-tool-summary` → **QUARANTINE** (ver §6).

---

## 4. Orden de integración propuesto (FASE 1, tras aprobación)

Todas las KEEP comparten `Layout3DEditor.tsx` / `lib/cad/index.ts` → se serializaron, gate por
feature (**`next build` ✅ lint ✅ typecheck ✅ specs ✅**) y **stop-on-red**. Resultado real
(2 de las 9 propuestas se reclasificaron CLOSE durante la integración):

| Orden | Rama | Resultado | Riesgo realizado |
|------|------|-----------|--------|
| 1 | `axos-cad-factory-scale` (#900) | ✅ integrada (`reapply` de 4 commits; `Layout3DEditor.tsx` resuelto preservando `main` + escala). | Alto — resuelto |
| 2 | `night-cad-viewport-bookmarks-0630` | ✅ integrada (archivo nuevo + export). | Bajo |
| 3 | `night-cad-material-route-command` | ✅ integrada (`material-flow-route.ts` + `registry.ts` +164, exports conservados). | Bajo |
| 4 | `night-cad-dock-staging-generator` | ✅ integrada (+364 en `warehouse-generators.ts`). | Bajo |
| 5 | `night-cad-supermarket-generator-0630` | ✅ integrada — `warehouse-generators.ts` y las dos `apply*Generator` reconstruidas como funciones completas (git las había colapsado). | Medio — resuelto |
| 6 | `night-cad-layer-quick-actions` | ✅ integrada como **port adaptado** (unlock all / hide empty sobre los tipos de `main`). | Medio — resuelto |
| — | `cad-tree-active` | ❌ **CLOSE-DUPLICATE** — duplica la escala de #900 (choca en footprint/fit-view). | — |
| — | `night-cad-canvas-focus-mode` | ❌ **CLOSE-DUPLICATE** — focus mutuamente excluyente con #900. | — |
| — | `night-cad-shortcuts-workbench` | ❌ **CLOSE-DUPLICATE** — divergente (+91/−64), superseded por `main`. | — |

> Choques en `cad/index.ts` resueltos **conservando ambos exports**. Choques de funciones que git
> colapsó (`warehouse-generators.ts`, `applyDockStagingGenerator`/`applySupermarketGenerator`)
> reconstruidos a mano en dos funciones completas, no por unión ciega.

---

## 5. CLOSE-DUPLICATE (FASE 2 — cerrar tras integrar ganadoras)

Cerrar el PR con comentario `superseded by <ganadora>` y registrar SHA. **El borrado de rama lo
hace el owner** (auto-delete / script).

| Rama | SHA | Superseded by |
|------|-----|---------------|
| `codex/night-cad-dxf-export-readiness` | `e1bfb39b60e1600099d183199f2b916476a8aaca` | `dxf-export-readiness.ts` ya en `main` (vía `dxf-critical-label-preflight`, #897) |
| `codex/night-cad-rack-row-generator` | `2004640a0f67659dc95200b477770c58aadb9568` | `warehouse-generators.ts` en `main` (#897) + `dock-staging` / `supermarket` (KEEP) |
| `codex/cad-tree-active` | `4ee3db827fcda8e217aea1f144762aeba16224b1` | `axos-cad-factory-scale` (#900) — misma escala de fábrica (`plant-scale.ts` vs `world-scale.ts`), choca en footprint/fit-view |
| `codex/night-cad-canvas-focus-mode` | `21cf9d005a487462fd60c734042f4f9f586610ca` | `axos-cad-factory-scale` (#900) — focus mode ya provisto; `workbench-chrome` choca con el panel-hiding de #900 |
| `codex/night-cad-shortcuts-workbench` | `9c1ee24e0314a01942ef185d3f3606858e3da40c` | sistema de atajos ya evolucionado en `main`; `keyboard-shortcuts.ts` diverge +91/−64 (regresión, no valor neto) |

> Las **19 STALE** (filas 12–30) también se cierran sin mergear, con comentario
> `already in main` y el SHA de su tabla. No requieren acción de integración.

---

## 6. Cuarentena (FASE 3 — NO MERGEAR)

### `claude/cad-tool-summary-5d9krp` — `3789ff6c1ee785e64b9ebc98839101c0a2972755`

**Brief:** la rama mezcla trabajo CAD (`cad-command.ts`, `snap-engine.ts`, `precision-input.ts`,
`line-engineering.dto.ts`) con un volumen enorme de cambios de **plataforma/seguridad** fuera de
alcance CAD:

- **~90 `*.entity.ts`** modificadas (`tenant_id` nullable en entidades de negocio).
- **Migrations** (`1713000000002-AddCustomerAndProgram.ts`).
- **Auth / guards**: `jwt-auth.guard.ts`, `public.decorator.ts`, `auth.controller.ts`, `auth.service.ts`, `APP_GUARD` global, `@RequirePermissions` en decenas de controllers.
- **`orm.options.ts`** + `synchronize` fail-fast.
- **Tenancy**: backfill SQL, `docs/TENANCY-ACTIVATION.md`, `docs/PROD-MIGRATION-CUTOVER.md`.

**Riesgo:** toca **todas** las zonas prohibidas por la regla de oro (migrations, `*.entity.ts`,
`orm.options.ts`/synchronize, auth, guards, tenancy). Un merge automático podría romper el
esquema de BD, el arranque (synchronize) y el modelo de permisos/tenant.

**Acción:** dejar **`needs-human-review`**. **NO mergear.** Si se quiere su parte CAD, extraerla
en una rama separada y solo-frontend/contratos, revisada a mano por el owner.

---

## 7. Reglas de oro aplicadas

- ✅ **Plan primero**: FASE 0 aprobada por el owner antes de tocar nada.
- 🚫 **No mergear** ramas con migrations / `*.entity.ts` / `orm.options.ts`/synchronize / auth /
  guards / tenancy → `cad-tool-summary` a cuarentena (nunca se mergeó).
- 🚦 **Gate por merge**: `next build` ✅ lint ✅ typecheck ✅ specs ✅ en cada feature. **Stop-on-red**.
- 🔒 **No se tocó `main`** directamente: todo va por PR #911 (squash a `main` tras CI verde).
- 🧾 **SHA registrado** de cada rama (tablas §2/§5/§6) antes de cualquier cierre irreversible.

---

## 8. Entregable / definición de "hecho"

- [x] **FASE 0** — Inventario + clusters + clasificación + este documento. Aprobado.
- [x] **FASE 1** — Integradas **6 KEEP** (factory-scale #900 + viewport-bookmarks + material-route
  + dock-staging + supermarket + layer-quick-actions) en `claude/cad-convergence-plan-7ag4nv`,
  gate verde. Ver tabla de §"Resultado de ejecución".
- [ ] **FASE 2** — Cerrar **5 CLOSE-DUPLICATE** + 19 STALE con comentario `superseded by` y SHA.
- [ ] **FASE 3** — `cad-tool-summary` queda `needs-human-review` (no mergear).

**Estado final esperado:** `main` (vía PR #911) con la escala de fábrica (#900) + las features CAD
únicas integradas, CI verde, sin duplicados; solo queda abierta la RED en cuarentena.
