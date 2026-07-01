# Plan de Higiene de Repositorio — AXOS OS

> **Propósito.** Dejar el repo con aspecto profesional para revisión de IT
> (Jabil): orden, licencia, sin logs de depuración sueltos, deuda técnica
> visible, vulnerabilidades no-breaking corregidas (y las breaking documentadas
> con plan), raíz limpia y documentación que no contradiga el código.
>
> **Regla rectora.** Esto es **higiene verificable, no reescritura.** Menos
> cambios = mejor. Cero refactors de lógica. Cero optimización especulativa.
> Ante la duda de si algo es higiene o refactor → es refactor → **se documenta,
> no se toca.**

**Estado:** FASE 1 — aprobado y ejecutado (ver §3 para las decisiones tomadas).
**Fecha:** 2026-07-01

---

## 0. Alcance y guardarraíles

**PROHIBIDO en esta sesión:**
- Optimizar rendimiento sin medir.
- Refactorizar código que funciona por "estilo".
- Tocar lógica de negocio (inventario, MES, kitting, backflush, calidad) ni
  auth / tenancy / migraciones.

**Rama y PR.**
- Rama de trabajo: **`chore/repo-hygiene` desde `origin/main`** (decisión del
  owner, ver §3 #2). Al re-sincronizar, `origin/main` avanzó para **incluir la
  dieta** (office/crm/legal/expenses/fixed-assets ya removidos: 81 módulos), así
  que la rama de higiene parte de un `main` limpio y consistente con estos
  hallazgos.
- **UN PR, en draft, sin mergear.**

**Gate obligatorio antes de commit final:**
`api build ✅ · api test ✅ · web lint ✅ · web build ✅ · typecheck ✅`
(el smoke de bootstrap requiere Postgres; se delega a CI). Si un auto-fix rompe
algo, se revierte ese fix.

---

## 1. Contexto de rama (resuelto)

El owner eligió una **rama `chore/repo-hygiene` limpia desde `origin/main`**. Al
re-sincronizar `origin/main` con el remoto, éste avanzó para **incluir la
"dieta"** del producto (remoción de `office`/`crm`/`legal`/`expenses`/
`fixed-assets`). Verificado: `origin/main` quedó con **81 módulos** de backend
(los 5 admin removidos). Por eso este PR de higiene:

- parte de un `main` limpio y ya post-dieta,
- es un diff **sólo-higiene** (no arrastra commits de otras features),
- y los hallazgos de docs (README/NEWCOMER) aplican tal cual (los módulos
  citados sí están removidos en `main`).

---

## 2. Tareas A–F: hallazgos y acciones planeadas

### A. LICENSE — falta (bandera roja legal)

**Hallazgo:** no existe archivo `LICENSE` en la raíz. Sí existe
`THIRD_PARTY_NOTICES.md` (atribuciones de terceros).

**Acción planeada:** agregar `LICENSE` en la raíz. Dado que es software para
vender/licenciar a un cliente enterprise, lo apropiado es **propietario /
"All Rights Reserved"**, no una licencia OSS permisiva.
→ **Requiere tu decisión: tipo de licencia y titular del copyright.** Ver
**Decisión #1**.

**Riesgo:** nulo (archivo nuevo). No toca código.

---

### B. `console.log` en producción

**Hallazgo (excluyendo specs):** hay `console.log`/`console.debug` en **9
archivos** no-spec. Al revisarlos, **8 de 9 son intencionales** (salida de CLI o
diagnóstico de arranque/deploy), y **1 es un residuo de depuración real**:

| Archivo | Naturaleza | Acción |
| --- | --- | --- |
| `apps/web/src/hooks/usePermissions.ts:72` | `console.debug('[usePermissions] auth snapshot', …)` — reproducción de un fix, dev-only, dejada en el código | **QUITAR** (higiene real) |
| `apps/api/src/main.ts` | diagnóstico de arranque/deploy (el comentario dice explícitamente "el log de deploy prueba si el owner puede entrar") | dejar (intencional) |
| `apps/api/src/common/config/jwt-secret.ts` | ya lleva `// eslint-disable-next-line no-console` → **explícitamente intencional** | dejar |
| `apps/api/src/seed.ts` | CLI de seed | dejar |
| `apps/api/src/seed/seed-demo.ts` | CLI de seed (su salida ES el reporte) | dejar |
| `apps/api/src/seed/seed-demo-clear.ts` | CLI de limpieza de datos | dejar |
| `apps/api/src/seed/seed-verify.ts` | CLI de verificación (reporte golden path) | dejar |
| `apps/api/src/seed/seed-audit-forbidden.ts` | CLI de auditoría (reporte) | dejar |
| `apps/api/src/seed/seed-purge-clients.ts` | CLI de purga (reporte legal) | dejar |

**Acción planeada:** quitar únicamente el `console.debug` residual de
`usePermissions.ts` (y su `useEffect` dev-only envolvente si queda vacío),
cuidando no dejar imports sin usar (`useEffect`) que rompan el lint. **No** se
tocan los logs intencionales de CLI/arranque — la regla dice "no toques logs
intencionales", y son la interfaz de esas herramientas.

**Nota:** `usePermissions` calcula flags de permisos, pero el `console.debug`
vive dentro de un `useEffect` que **sólo loguea**; quitarlo no cambia ningún
flag devuelto. Es higiene pura, no cambio de lógica de auth.

> Opción (por defecto: **NO**): convertir los `console.*` de arranque del API
> (`main.ts`, `jwt-secret.ts`) al `Logger` de NestJS que ya usa el proyecto. Es
> más "premium", pero toca el bootstrap (sensible, auth-seeding) y raya en
> refactor → por la regla "ante la duda, no tocar", queda **fuera** salvo que
> lo pidas.

**Riesgo:** mínimo (una eliminación en web, sin lógica).

---

### C. TODO / FIXME / HACK — visibilidad en `docs/TECH-DEBT.md`

**Hallazgo:** el grep crudo daba ~20 archivos, pero **la gran mayoría son la
palabra española "TODO"** ("valida TODO el catálogo", "TODOS los…") o
placeholders de UI/XML (`SN-0000-XXXX`, `Moneda="XXX"`), **no marcadores de
deuda.** Los marcadores **reales** son sólo estos:

| Archivo:línea | Texto | Tipo |
| --- | --- | --- |
| `apps/api/src/modules/kits/kits.service.ts:132` | `// TODO: Verify organizational scope if user is provided` | lógica (tenancy/scope) |
| `apps/api/src/modules/production-runtime/production-runtime.service.ts:77` | `// TODO: Verify scope` | lógica (scope) |
| `apps/api/src/modules/production-runtime/production-runtime.service.ts:403` | `// TODO: Verify scope` | lógica (scope) |
| `apps/api/src/modules/production-runtime/production-runtime.service.ts:457` | `// TODO: Verify scope` | lógica (scope) |
| `apps/api/src/modules/inventory/warehouse.service.ts:510` | `TODO (integración SAP — fuera de alcance de este PR): …` | lógica (integración SAP) |
| `apps/api/src/modules/people/people.service.ts:300` | `Se deja como TODO del owner — NO se activa en este PR` | diferido (ya documentado en código) |

**Acción planeada:** crear `docs/TECH-DEBT.md` listando **archivo:línea + qué
dice + por qué se difiere**. **Ninguno se resuelve** en este PR: todos tocan
scope/tenancy/integración SAP → lógica → explícitamente fuera de alcance. Es
decir, cumplimos el objetivo (visibilidad) sin tocar lógica. **No hay TODOs
"triviales y seguros"** que resolver.

**Riesgo:** nulo (sólo se crea un doc; no se toca código).

---

### D. Vulnerabilidades npm — con cuidado

**Hallazgo (`npm audit`):** **37 totales — 20 high, 14 moderate, 3 low, 0
critical.**

**No-breaking (se corrigen con `npm audit fix`, sin `--force`):**
`@babel/core`, `brace-expansion`, `dompurify`, `fast-uri` (high),
`form-data` (high), `ip-address`, `js-yaml` (nivel superior).

**Breaking (requieren `--force` → NO se fuerzan):**
- Cadena `@tootallnate/once → http-proxy-agent → make-fetch-happen → node-gyp →
  **sqlite3** (5.x) → **typeorm**`. `npm audit fix --force` instalaría
  `sqlite3@6.0.1` (breaking) y potencialmente un `typeorm` nightly. **sqlite3
  es sólo el driver de DEV** (prod usa Postgres) y las vulns están en sus deps
  de *build* (node-gyp/tar/make-fetch-happen), no explotables en runtime de
  prod. → **documentar, no forzar.**
- Cadena `@nestjs/swagger → @nestjs/core → js-yaml` (si `audit fix` no la
  resuelve sin subir mayor de NestJS) → documentar.

**Acción planeada:**
1. `npm ci` (node_modules no está instalado).
2. `npm audit fix` (SIN `--force`).
3. Re-correr el gate completo. Si algo se rompe → revertir ese fix.
4. `npm audit` de nuevo y documentar el remanente en
   `docs/SECURITY-KNOWN-ISSUES.md` (paquete · severidad · por qué es breaking ·
   plan sugerido).

**NUNCA** `npm audit fix --force`.

**Riesgo:** medio → mitigado por el gate obligatorio + regla de revertir.

---

### E. Higiene de raíz y estructura + alineación de docs

**E.1 — Raíz limpia.** **Verificado: la raíz ya está limpia.** No hay logs
sueltos, temporales, `.DS_Store` ni outputs de scripts. `git status --ignored`
no reporta basura. `.gitignore` ya es comprensivo (`*.log`, `*.tmp`, `dist/`,
`node_modules/`, `coverage/`, `.env*`, `.DS_Store`, etc.). → **sin cambios**
(sólo se confirma). No hay nada que borrar.

**E.2 — README.md desalineado (referencias a módulos borrados).** El README
cita módulos que **la dieta ya removió de esta rama**:
- `office` / "suite Office" (línea 64) y ruta `/documents`
- `crm` (líneas 66, 70–76: sección "Suite comercial" + link a
  `docs/commercial-suite.md`)
- `materials`, `expenses`, `fixed-assets`, `legal` (módulos inexistentes)

→ **Acción propuesta (higiene): quitar/corregir esas referencias** para que el
README refleje el código real de la rama. **PERO** el prompt pide reencuadrar el
README como "capa de piso sobre SAP/MES, no un OS que hace todo". Eso **no
coincide con el código**: aun después de la dieta la rama tiene **81 módulos**
(accounting, erp-core, forecast, ai/CIDE, semantic, analytics,
decision-intelligence, control-tower…) — sigue siendo una plataforma ERP/MES
amplia, no una capa delgada. Reencuadrarla así haría que el doc **contradiga**
el código (lo contrario a la higiene). → Ver **Decisión #3**.

**E.3 — NEWCOMER_GUIDE.md obsoleto (contradice el producto).** **Bandera roja
para IT:** describe una arquitectura que **ya no existe**:
- Frontend **Angular** en `frontend/` — la realidad es **Next.js** en `apps/web`.
- Backend en `backend/` — la realidad es `apps/api`.
- ~10 módulos (`advances`, `exceptions`, `bay-layout`…) — la realidad son 81.
- Rutas/archivos Angular (`app.routes.ts`, `shell.ts`, `orm.options.ts`) que no
  existen.

→ Ver **Decisión #4** (corregir a la arquitectura actual vs. sólo documentarlo).

**E.4 — AXOS_OS_ARCHITECTURE.md.** Es un doc de **plan/visión** ("Master
Architecture & Design System Plan"); describe agrupaciones de módulos
aspiracionales. No contradice frontalmente al código como el NEWCOMER_GUIDE.
→ propuesta: **no tocar** (es un doc de diseño, no una descripción del estado).

**E.5 — DECISIONS.md.** 199 KB de ADR/rationale histórico. → **no tocar**
(registro histórico; reescribir sería destruir contexto, no higiene).

---

### F. CI verde

**Hallazgo:** CI (`.github/workflows/ci.yml`) corre `Build · Test · Lint ·
Smoke` en cada PR a `main`. El **lint del API es no-bloqueante** a propósito
(~2.9k hallazgos de formato preexistentes; DECISIONS §13). Puertas bloqueantes:
build API, test API, lint web, build web, smoke bootstrap (Postgres efímero).

**Resultado (local, tras los cambios):**

| Gate | Resultado |
| --- | --- |
| API build (`nest build`) | ✅ exit 0 |
| API test (`jest`) | ✅ 166 suites · 1173 tests |
| API typecheck (`tsc --noEmit`) | ⚠️ 7 errores **pre-existentes** en `.spec.ts` (ver TECH-DEBT; CI no corre este paso) |
| web lint (`eslint`) | ✅ 0 errores (6 warnings pre-existentes) |
| web build (`next build`) | ✅ exit 0 (incluye typecheck de web) |
| bootstrap smoke | requiere Postgres → se delega a CI |

**No se ocultó ningún spec.** Los 7 errores de `tsc --noEmit` son
pre-existentes (este PR no toca código del API) y quedan **anotados** en
`docs/TECH-DEBT.md`, no maquillados.

**Riesgo:** nulo (sólo verificación).

---

## 3. Decisiones tomadas (aprobadas por el owner)

1. **LICENSE:** Propietario / **All Rights Reserved**. Titular:
   **Sergio Valle Zárate**. → `LICENSE` creado + `"license": "UNLICENSED"` en
   `package.json` raíz.
2. **Rama:** **`chore/repo-hygiene` limpia desde `main`** (ver §1).
3. **README:** **corrección factual mínima** — se quitaron referencias a
   módulos/rutas removidos, manteniendo el encuadre "ERP/MES para EMS".
4. **NEWCOMER_GUIDE.md:** **corregido a la arquitectura real** (monorepo
   Turborepo, Next.js `apps/web` + NestJS `apps/api`, `packages/contracts`).

**Por defecto (alineado a las reglas):**
- B: se quitó sólo el `console.debug` residual; logs intencionales intactos.
- D: `npm audit fix` sin `--force`; breaking documentados en
  `docs/SECURITY-KNOWN-ISSUES.md`.
- E.1/E.4/E.5: raíz ya limpia; `AXOS_OS_ARCHITECTURE.md`/`DECISIONS.md` no se
  tocan.

---

## 4. Entregables al terminar

- `LICENSE` (según Decisión #1)
- `docs/cleanup/REPO-HYGIENE-PLAN.md` (este archivo)
- `docs/TECH-DEBT.md`
- `docs/SECURITY-KNOWN-ISSUES.md`
- README/NEWCOMER corregidos (según Decisiones #3/#4)
- `console.debug` residual eliminado
- vulns no-breaking corregidas
- **UN PR en draft, sin mergear**, con gate verde.

## 5. Definición de "Hecho"

LICENSE agregado · console.log residual fuera · TODOs documentados (sin tocar
lógica) · vulns no-breaking arregladas y breaking documentadas con plan · raíz
confirmada limpia · docs alineados al código real · CI verde · **cero refactors
de lógica, cero optimización especulativa.**
