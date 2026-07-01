# Limpieza de PRs y ramas — 2026-06-30

Resultado de la consigna: *"resolver conflictos de todos los PRs abiertos para que mergeen, y
cerrar las ramas abiertas analizando una por una."* Modo de borrado elegido por el owner:
**SEGURO** (borrar solo fusionadas/duplicadas/stale; conservar y reportar trabajo único no fusionado).

## ✅ Parte 1 — PRs abiertos: los 4 fusionados a `main`

| PR | Rama | Estado previo | Acción |
|----|------|---------------|--------|
| **#916** feat(cad): architecture drafting layer | `codex/cad-architecture-active` | `dirty` (conflictos) | Conflictos resueltos en `index.ts` y `Layout3DEditor.tsx` (3 hunks: se conservaron `applyDockStagingGenerator`/`applySupermarketGenerator`/`unlockAllCadLayers` de main **y** las mejoras arquitectura-aware del PR; fórmulas `releaseBlockers/Warnings` combinadas). CI verde → **merged**. |
| **#917** fix(materials): consume al tank LINE- | `fix/runtime-consume-line-tank` | `clean`, draft "DO NOT MERGE" | Aprobado por el owner para fusionar. Quitado de draft → **merged**. |
| **#913** docs(office): plan de convergencia | `claude/office-convergence-closure-97wjqq` | `clean`, draft | Quitado de draft → **merged**. |
| **#918** docs: auditoría CAD UI surface | `claude/cad-ui-surface-tools-c9ub0b` | `blocked` (protección), draft | CI verde, quitado de draft → **merged**. |

`main` exige el check **"Build · Test · Lint · Smoke"**; se esperó a que pasara en cada uno.
GitHub tiene activado *auto-delete head branches*, así que estas 4 ramas ya se borraron solas al fusionar.
**PRs abiertos restantes: 0.**

## ⚠️ Parte 2 — Borrado de ramas BLOQUEADO por el entorno

No es posible borrar ramas remotas desde esta sesión de Claude:
- `git push origin --delete` → **HTTP 403** (el relay git bloquea el borrado de refs).
- API REST `DELETE /git/refs/...` → **403** `"Write access to this GitHub API path is not permitted through this proxy."`
- El MCP de GitHub no expone borrado de ramas (solo `create_branch` / `delete_file`).

Es la misma limitación documentada en `docs/CONVERGENCE-PLAN.md` (FASE 1–3). El triage SÍ está hecho;
**la ejecución del borrado debe hacerla el owner con sus credenciales.**

### ▶️ Cómo borrar (un comando)
```bash
bash scripts/cleanup-stale-branches.sh
```
Borra **118 ramas** verificadas como *ya-en-main / stale / duplicadas de clúster*. Cada una lleva su
SHA en la tabla de recuperación del script. Recuperar cualquiera: `git push origin <sha>:refs/heads/<rama>`.
(Alternativa: en *Settings → General* ya está activo "Automatically delete head branches", pero solo
aplica a ramas cuyo PR se fusione; estas ya no tienen PR abierto.)

## 🛑 Ramas CONSERVADAS (23) — NO borrar a ciegas

Modo seguro: estas tienen trabajo único no fusionado o requieren criterio humano.

### A. Cuarentena backend / schema — revisión humana (trabajo único en `apps/api`)
| Rama | SHA | Motivo |
|------|-----|--------|
| `codex/night-mes-confirm-20260629` | `38edba99` | RED_SCHEMA: migración/entidad MES (api=7, web=5). |
| `codex/night-mes-downtime-reason` | `2e391a9a` | RED_SCHEMA: razón de paro (historia disjunta). |
| `codex/night-mes-material-request-0629` | `c28f8186` | RED_BACKEND: solicitud de material (api=4). |
| `codex/night-import-product-models` | `13e55fb1` | RED_BACKEND: importador de modelos (api=5). |
| `codex/night-kit-stock-gate` | `8f6e5aa3` | RED_BACKEND: gate de stock de kit (api=3). |
| `codex/night-genealogy-lot-reel` | `19f59df0` | Backend: genealogía lote/reel (api=5). |
| `codex/night-backflush-sap-outbox` | `44d288b7` | Backend: outbox SAP backflush. |
| `codex/night-inventory-location-filter-0629` | `69711ec2` | Backend (el plan la marcó stale-in-main; disjoint → revisar antes de borrar). |
| `batch/backend` | `20de0fc4` | Batch backend con cambios únicos (api=15). |

### B. Revisión del owner (PRs marcados "leave-for-owner")
| Rama | SHA | Motivo |
|------|-----|--------|
| `claude/axos-os-audit-optimize-90n6bu` | `af0aca8e` | #746: 535 archivos, historias no relacionadas, **borra backend** → recomendado cerrar y re-cortar. |
| `codex/night-slides-reuse-search-correction` | `4b17f63f` | #831: regresaría la navegación de slides (borra `slideNavigation.ts`); salvar solo `slideReuse.ts`. |
| `rebase/753-approval-signoff` | `7c2fd24c` | Rebase de feature backend en cuarentena. |
| `rebase/790-operator-material` | `b223b5d5` | Rebase de feature backend en cuarentena. |
| `rebase/821-cad-dxf-export` | `40c3b59a` | Rebase de feature CAD; verificar contra main. |

### C. CAD reciente (frontend, posterior al plan; probablemente YA en main vía #916 — verificar y luego borrar)
`codex/cad-tree-active` (`4ee3db82`, #900) · `batch/cad` (`028567bb`) ·
`codex/night-cad-canvas-focus-mode` (`21cf9d00`) · `codex/night-cad-dock-staging-generator` (`a6ccc413`) ·
`codex/night-cad-material-route-command` (`d7a2349e`) · `codex/night-cad-supermarket-generator-0630` (`b610e7d2`) ·
`codex/night-cad-viewport-bookmarks-0630` (`23440dae`).
Todas frontend-only (api=0); sus features (dock-staging, supermarket, viewport-bookmarks, material-route)
ya aparecen en `main` tras el merge de #916. Verificar diff y, si están superadas, añadirlas al borrado.

### D. Tooling de proceso
`chore/branch-triage` (`a8f5f2d6`, scripts/docs del triage) · `ux/visual-sweep` (`3efcd5f5`, barrido visual e2e).

## Resumen
- **PRs:** 4/4 fusionados, 0 abiertos.
- **Ramas:** 141 → triage completo. **118 listas para borrado seguro** (script adjunto, requiere credenciales del owner). **23 conservadas** con motivo. Todo recuperable por SHA.
