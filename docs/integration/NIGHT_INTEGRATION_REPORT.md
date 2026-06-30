# AXOS OS — Reporte de Integración Nocturna

> Auditoría de la integración nocturna de PRs de Codex/Claude.
> Fecha: 2026-06-29. Generado durante la sesión de auditoría `claude/axos-night-integration-audit-w0yvaf`.

---

## 1. Main actual (SHA)

```
3a39658822f6447ad18195b0be622ed2950ed8f5
```

Último commit: `feat(mes): render protected work instructions (#848)`.

> Nota: durante esta auditoría se mergearon dos PRs verdes e independientes
> (#851 y #848). Antes de esos merges, `main` estaba en
> `1043a2b` (`QA: tiras de tabs sin overflow en móvil (CRM, Permisos) (#834)`).

Configuración de CI detectada:
- Workflow **`CI` → check `Build · Test · Lint · Smoke`** (es el check requerido / "verde").
- Workflow **`Auto-merge Codex PRs`** (`automerge-codex.yml`): intenta `gh pr merge --auto --rebase`
  para ramas `codex/*` o con label `codex`. **Requiere "Allow auto-merge" activado en
  Settings → General**; como no lo está, el workflow sólo deja un aviso y **los PRs verdes de
  Codex quedan esperando merge manual**. Esto explica por qué hay tantos PRs verdes abiertos.

---

## 2. PRs mergeados directamente a main

Mergeados como commit individual (squash) directamente sobre `main`:

| PR | Título | Rama | Tipo |
|----|--------|------|------|
| #774 | feat(mes): require operator action confirmation | `codex/night-mes-operator-confirm` | UI (operador) |
| #775 | feat(event-ledger): add filtered query endpoint | `codex/night-event-ledger-query` | **Backend/API** |
| #777 | feat(planning): block unsafe wo cancellation | codex | **Backend/API** |
| #778 | feat(import): expose SAP coverage matrix | codex | UI (import) + API |
| #779 | feat(platform): add shared api response envelope | `codex/night-platform-response-envelope` | **Backend/API** |
| #781 | feat(inventory): surface cycle count discrepancies | codex | UI (inventory) |
| #784 | feat(warehouse): add location visibility | codex | UI (warehouse) |
| #786 | feat(packing): gate packing by passed serial readiness | `codex/night-packing-passed-readiness` | UI (packing) + API |
| #793 | feat(event-ledger): filter audit queries by industrial context | `codex/night-platform-ledger-query-0629` | **Backend/API** |
| #807 | feat(mes): acknowledge and resolve andons from live board | codex | UI (operador/MES) |
| #824 | feat(inventory): filter stock by location | codex | UI (inventory) |
| #825 | feat(erp): filter planned orders by material | codex | UI (ERP/planning) |
| #833 | UX pase 2: sidebar como cajón + herramientas a pantalla completa | claude | UI (shell global) |
| #834 | QA: tiras de tabs sin overflow en móvil (CRM, Permisos) | claude | UI (CRM/permisos) |
| **#848** | feat(mes): render protected work instructions | `codex/night-mes-wi-viewer-0629` | UI (operador) — *mergeado en esta auditoría* |
| **#851** | fix(import-data): mark product model import as supported | `codex/night-import-model-capability` | UI (import) + API — *mergeado en esta auditoría* |

---

## 3. PRs incorporados por batch (rebased)

Tres PRs "batch" consolidaron PRs hermanos que sólo chocaban entre sí (conflictos de
keep-both en docs y en archivos compartidos). Cada batch ya está **mergeado en main**:

### #832 — `batch/cad` → main
Rebase de:
- **#821** — CAD DXF export readiness
- **#814** — object inspector pro
- **#826** — DXF label export

### #835 — `batch/backend` → main
Rebase de:
- **#791** — backflush SAP outbox
- **#783** — product-model import target (+ fix: `MODEL` en `targetLabel`)
- **#828** — planning material readiness

### #836 — `batch/cad` → main
Rebase de:
- **#796** — CAD validation center
- **#812** — industrial layout templates

---

## 4. PRs cerrados como superseded / duplicados

| PR | Estado | Motivo |
|----|--------|--------|
| #821, #814, #826 | closed | Superseded — incorporados a main vía batch **#832** |
| #791, #783, #828 | closed | Superseded — incorporados a main vía batch **#835** |
| #796, #812 | closed | Superseded — incorporados a main vía batch **#836** |
| #785, #787 | closed | Superseded por **#779 / #793** (envelope/ledger ya mergeados directo) |
| #805, #801 | closed | Superseded — reescribían capas/snapshot de forma competitiva contra #796/#814 ya mergeados (deben re-aplicarse sobre el `Layout3DEditor` actual) |
| **#839** | **closed (esta auditoría)** | **Duplicado de #844** — ambos implementan el mismo generador de filas de rack. Se conserva #844 (más robusto: cap de racks + auto-escala al footprint). |

---

## 5. PRs aún abiertos

22 PRs abiertos tras esta auditoría. Estado de CI a la hora de la auditoría
(`✅` = check `Build · Test · Lint · Smoke` en verde; `🟡` = en progreso; `📝` = borrador).

### Cluster CAD (verdes, ramas `codex/night-cad-*`)
| PR | Título | CI | Decisión |
|----|--------|----|----------|
| #838 | feat(cad): add line balance command | ✅ | Integrar vía **batch CAD** |
| #844 | feat(cad): add warehouse rack generator | ✅ | Integrar vía **batch CAD** (gana sobre #839) |
| #847 | feat(cad): add plot package metadata | ✅ | Integrar vía **batch CAD** |
| #850 | feat(cad): add flow health reorder preview | ✅ | Integrar vía **batch CAD** |
| #853 | feat(cad): add supermarket kitting template | ✅ | Integrar vía **batch CAD** |

### Cluster Sheets (verdes, ramas `codex/night-sheets-*`)
| PR | Título | CI | Decisión |
|----|--------|----|----------|
| #840 | feat(sheets): surface formula recalc plan | ✅ | Integrar vía **batch Sheets** |
| #843 | feat(sheets): harden xlsx readiness scanner | ✅ | Integrar vía **batch Sheets** |
| #852 | feat(sheets): detect approval content drift | ✅ | Integrar vía **batch Sheets** |
| #854 | feat(sheets): add data quality inspector | ✅ | Integrar vía **batch Sheets** |
| #856 | feat(sheets): add print report readiness | 🟡 | Integrar vía **batch Sheets** cuando cierre CI |

### Slides (borradores) y otros
| PR | Título | CI | Decisión |
|----|--------|----|----------|
| #837 | feat(slides): add presentation quality audit | 📝 | Borrador — no mergear |
| #841 | feat(slides): add presenter readiness preflight | 📝 | Borrador — no mergear |
| #842 | feat(slides): add industrial table presets | 📝 | Borrador — **solapa con #845** (mismas `slides/table.ts` + `SlideTableEditor.tsx`) |
| #846 | feat(slides): add animation timeline workflow | 📝 | **Duplicado de #849** — consolidar, no mergear ambos |
| #849 | feat(slides): add animation timeline presets | 📝 | **Duplicado de #846** — consolidar, no mergear ambos |
| #855 | feat(slides): add industrial chart preset gallery | 📝 | Borrador — no mergear |
| #831 | fix(slides): replace duplicate navigation merge with reuse search | 📝 | Borrador — no mergear |
| #845 | feat(inventory): track lot expiry on receipts | ✅ | **Needs-work** — ver §6 (scope contaminado + migración) |
| #857 | QA: encabezados/filas responsivas en móvil (`claude/*`) | 📝 | Borrador — QA visual, no mergear aún |
| #780 | fix(ui): barrido visual — alineación/contraste (`ux/visual-sweep`) | 📝 | Borrador antiguo — revisar/triage |
| #792 | docs: branch backlog triage + cleanup plan (`chore/branch-triage`) | 📝 | Borrador antiguo — triage |
| #746 | Integración nocturna: consolidar PRs verificados (`claude/*`) | 📝 | Borrador antiguo — superado por el trabajo nocturno actual |

---

## 6. PRs que NO deben mergearse

- **#839** — duplicado de #844 (ya **cerrado** en esta auditoría).
- **#846 / #849** — son la **misma** función (timeline de animación en `SlideAnimationPanel.tsx`).
  No mergear ambos; consolidar en uno. Comentados en ambos PRs.
- **#842 vs #845** — **solapan** en `slides/table.ts` + `SlideTableEditor.tsx` (presets de tabla
  industriales). Mergear ambos duplicaría la función. Decidir cuál sobrevive.
- **#845 (como está)** — aunque su CI está verde, **mezcla dos features no relacionadas** en un
  solo PR: "lot expiry en recibos" (backend + migración) **y** los presets de tabla de Slides
  (que son el feature de #842). Además introduce una **migración de esquema**
  (`AddInventoryLotExpiry`, columnas `expires_at`). Recomendación: **split** (separar lot-expiry de
  los presets de Slides) o, si el bundle es intencional, cerrar #842 como superseded y revisar la
  migración antes de mergear. No mergear sin esa decisión.
- **#746 / #780 / #792** — borradores antiguos de triage/limpieza/integración, ya superados por el
  trabajo nocturno; no son features. Revisar y cerrar en limpieza de backlog.

---

## 7. PRs verdes que SÍ deben mergearse

- **Ya mergeados en esta auditoría** (verdes, independientes, sin solapamiento, sin migración):
  - ✅ **#851** — `fix(import-data): mark product model import as supported`
  - ✅ **#848** — `feat(mes): render protected work instructions`

- **Verdes que deben entrar, pero vía batch rebase** (no mergear individualmente porque comparten
  `lib/cad/index.ts` / `sheetOps.ts` + los mismos docs → se conflictúan en cascada, igual que el
  patrón ya usado en #832/#835/#836):
  - **Batch CAD**: #838, #844, #847, #850, #853
  - **Batch Sheets**: #840, #843, #852, #854 (+ #856 cuando cierre CI)

> Por qué batch y no merge individual: cada PR de estos clusters hace *append* a
> `docs/codex-night-log.md`, `docs/cad/AXOS_CAD_TREE_STATUS.md`,
> `docs/cad/AXOS_CAD_CAPABILITY_AUDIT.md` (CAD) y a `sheetOps.ts`/docs de sheets. Mergear uno
> deja a los demás en conflicto. Un solo PR batch los rebasea juntos, resuelve los keep-both y
> pasa CI una vez.

---

## 8. Cambios backend/API (por eso NO se ven en la UI)

Estos PRs ya están en main pero **no tienen consumidor visual todavía** — son primitivas de
backend/contrato:

| PR | Qué añade | Endpoint / superficie |
|----|-----------|-----------------------|
| #775 | Query paginado y filtrable del Event Ledger | `GET /api/ledger/query` (sin UI explorer) |
| #793 | Filtros por contexto industrial (plant, line, shift, customer, program, model) | `GET /api/ledger/query` (sin UI) |
| #779 | Envelope de respuesta compartido (`ApiResponseEnvelope`) | `GET /ledger/query/envelope` (opt-in; sin UI) |
| #835 → #791 | Outbox de backflush SAP | servicio backend (sin UI) |
| #835 → #828 | Planning material readiness | servicio backend (production-plan) |
| #777 | Guard que bloquea cancelación insegura de work orders | validación backend (se manifiesta como error al cancelar) |

> Estos son la causa típica de "el PR se mergeó pero no veo nada": son API/lógica de servidor.
> Para validarlos hay que pegarle al endpoint o ejercitar el flujo que los dispara, no buscar UI.

---

## 9. Cambios que SÍ deberían ser visibles, y en qué ruta

| PR | Cambio visible | Ruta para validar |
|----|----------------|-------------------|
| #851 | Matriz de cobertura import marca **Product Model como READY** (4 destinos); copy menciona Product Models | `/dashboard/import` |
| #778 | Matriz de cobertura SAP/import-data | `/dashboard/import` |
| #835 → #783 | Destino de import **Product Models** (MODEL) | `/dashboard/import` |
| #786 | Panel de **readiness de packing** + gate por seriales con PASS | `/dashboard/packing` |
| #824 | Filtro de stock por ubicación | `/dashboard/inventory` |
| #781 | Discrepancias de conteo cíclico | `/dashboard/inventory` |
| #784 | Visibilidad de ubicación de almacén | `/dashboard/warehouse` |
| #807 | **Ack/Resolve de andons** desde el live board | `/dashboard/operador` (board MES) |
| #774 | Confirmación de acción crítica del operador (doble-tap) + confirmación de paro de línea | `/dashboard/operador` |
| #848 | **Visor de work instructions protegidas** (carga blob autenticado, fallback) | `/dashboard/operador` |
| #825 | Filtro de órdenes planeadas por material | ERP / planning |
| #833 | Navegación como cajón + herramientas a pantalla completa (Chat/CAD/⌘K) | shell global (todas las rutas) |
| #834 | Tabs CRM sin overflow móvil + filtros de permisos con `flex-wrap` | `/dashboard/crm`, `settings/permissions` |
| #832 | CAD: **DXF export**, object inspector, etiquetas DXF | CAD / line-engineering |
| #836 | CAD: **validation center** + plantillas de layout industrial | CAD / line-engineering |

---

## 10. Módulos a revisar en producción para validar

| Ruta | Qué validar | PRs relacionados |
|------|-------------|------------------|
| `/dashboard/import` | Wizard muestra Product Models + Material/BOM/Routing; matriz de cobertura con 4 destinos en **READY**; sin gap falso `PRODUCT_MODEL_IMPORT_TARGET` | #851, #778, #835(#783) |
| `/dashboard/packing` | Panel de readiness; no deja empacar seriales sin PASS / duplicados / ya empacados | #786 |
| `/dashboard/inventory` | Filtro por ubicación; tarjetas de discrepancias de conteo cíclico. *(Lot-expiry de #845 NO está mergeado — no debe verse aún.)* | #824, #781 |
| `/dashboard/warehouse` | Visibilidad de ubicaciones | #784 |
| `/dashboard/operador` | Confirmación doble-tap; ack/resolve de andons en el board; **visor de work instructions** (carga, loading, error, respaldo) | #774, #807, #848 |
| `/dashboard/office` | Mayormente **sin cambios funcionales** todavía: los PRs de Sheets/Slides siguen **abiertos** (clusters por integrar). Sólo aplica el shell global (#833). | (pendientes: #840/#843/#852/#854/#856 sheets; slides en borrador) |
| CAD / line-engineering | DXF export + object inspector + etiquetas DXF (#832); validation center + plantillas (#836). Generadores de rack/kitting/line-balance **aún por integrar** vía batch CAD. | #832, #836, (pendientes #838/#844/#847/#850/#853) |

---

## Acciones ejecutadas en esta auditoría

1. **Mergeados** (verdes, independientes, seguros, sin redundancia): #851, #848.
2. **Cerrado** #839 como duplicado de #844 (con comentario explicativo).
3. **Comentados** #846 y #849 advirtiendo que son duplicados entre sí (no mergear ambos).
4. **Documentada** la causa de los PRs verdes sin mergear (auto-merge requiere "Allow auto-merge"
   en Settings) y la estrategia de batch para los clusters CAD/Sheets.

## Acciones recomendadas (siguiente paso)

1. Activar **"Allow auto-merge"** en Settings → General para que `automerge-codex.yml` cierre el
   loop solo en los PRs verdes de Codex.
2. Crear **batch CAD** (`batch/cad`) rebaseando #838, #844, #847, #850, #853 sobre `main`
   (resolver keep-both en los 3 docs CAD + `lib/cad/index.ts`).
3. Crear **batch Sheets** (`batch/sheets`) rebaseando #840, #843, #852, #854 (+#856) sobre `main`.
4. Resolver **#845**: separar lot-expiry de los presets de Slides (o cerrar #842 como superseded
   y revisar la migración) antes de mergear.
5. Consolidar **#846/#849** (timeline de animación) en un único PR.
6. Triage de borradores antiguos: #746, #780, #792.
