# AXOS OS — Night Log · Carril E2E-2 (Playwright · flujos por dominio)

Bitácora del carril **E2E-2**. Rama `claude/tender-lovelace-masv7v`.
Fecha: 2026-06-16.

## 1. Objetivo y contexto

Ampliar la suite Playwright **de G1** (el golden-path) con flujos E2E por dominio,
cada uno independiente: **materiales** (inventario→escasez), **calidad**
(disposición de hold), **operador** (abrir estación). Todo determinista, contra el
dev server real con el backend mockeado en la frontera de red.

> **Nota de integración.** Cuando arranqué, G1 aún no estaba en mi rama, así que
> construí un harness propio (autocontenido) bajo `apps/web/e2e/`. Para el merge,
> G1 ya había aterrizado en `main` con su harness canónico
> (`e2e/fixtures/{constants,session,mock-backend}.ts`, `e2e/golden/01..05`,
> `@playwright/test` como devDependency, `playwright.config.ts`, y `data-testid`
> añadidos a los componentes del golden path). **Reescribí mis flujos sobre el
> harness de G1 y descarté el mío** para no duplicar/competir. Resultado: la suite
> queda unificada, sin dos configs ni dos mocks.

## 2. Qué contribuí (sobre el harness de G1)

Tres specs **aditivos** en `apps/web/e2e/golden/`, todos usando
`installMockBackend(context)` + `loginAsMaster(context)` de G1 y **sobreponiendo**
solo los endpoints que cada flujo necesita (registrados después del mock base, así
ganan), con localizadores semánticos (estas páginas no traen `data-testid`):

| Spec | Dominio · flujo | Página | Endpoints añadidos al mock |
| --- | --- | --- | --- |
| `06-materials-shortage.spec.ts` | **Materiales** · inventario→escasez (+ Existencias agrupa/expande) | `/dashboard/inventory` | `/inventory/positions`, `/material-staging`, `/replenishment/rules` |
| `07-quality-hold-disposition.spec.ts` | **Calidad** · disposición de hold (proponer→aprobar→ejecutar) | `/dashboard/quality/holds` | `/quality/holds/active`, `/quality/dispositions` (GET/POST), `PATCH .../approve\|execute`, `/quality/transfers` |
| `08-operator-station.spec.ts` | **Operador** · abrir estación (MES board) — elegir orden / escanear WO | `/dashboard/operador` | `/mes/executions`, `/mes/board` (+ aborta `/socket.io/**`) |

**Por qué solo estos tres** (los otros dos dominios del enunciado ya estaban en
G1, así que evité duplicar):

- **Planeación** (publicar plan→muro) ya lo cubre `03-planning-muro` (publica WO en
  el Muro → Clear-to-Build, y publica plan → "Publicado"/"Solicitar").
- **Calidad · crear NCR** ya lo cubre `05-quality-ncr`.
- **Operador**: `04-operator-terminal` prueba `/dashboard/operator-terminal`
  (endpoint `/operator-terminal/*`). Mi `08` prueba la **otra** página de operador,
  el board MES en `/dashboard/operador` (`/mes/executions` + `/mes/board`,
  "Monta tu orden" → estación) — página distinta, cobertura nueva.

## 3. Resultados de ejecución (dev server real + Chromium 141)

| Corrida | Resultado |
| --- | --- |
| Suite completa (G1 `01-05` + míos `06-08`), `npm run e2e` | **11/11 ✅** (38.6 s) |
| Auditoría de flaky — `06+07+08 --repeat-each=5 --retries=0` (25 ejecuciones) | **25/25 ✅, 0 flaky** |
| `eslint` sobre `06/07/08` (puerta "Lint web") | **0 errores ✅** |

Los specs usan `import { test, expect } from '@playwright/test'` (devDep real de
G1), sin `@ts-nocheck` y sin parámetros `use` → pasan `Build web` y `Lint web` sin
necesidad de excluir `e2e/**`.

## 4. Determinismo / no-flaky — cómo se sostiene

- Reuso del harness de G1: `loginAsMaster` (cookie `axos_session` firmada con el
  mismo HMAC que `src/lib/session.ts` + JWT sembrado) e `installMockBackend`
  (intercepta `NEXT_PUBLIC_API_URL`, nunca 401/403, baseline auth/me/enterprise).
- Mis overrides son **stateful** donde el flujo lo exige (07: proponer→aprobar→
  ejecutar muta el arreglo que el GET siguiente devuelve, ejercitando el re-fetch
  de SWR).
- **Localizadores durables** (filas/badges/botones), no toasts (se autodescartan a
  3.5 s y repiten campos del registro → causaban *strict-mode multi-match*). Donde
  el DOM es ambiguo: scope a `main`, al panel del modal (heading + botón Cancelar),
  o `xpath=ancestor` de la fila; `exact: true` en badges.
- Socket MES (sin servidor) abortado en `08` → sin loop de reconexión.
- Cada test: su propio contexto + mock base + overrides → independencia total.

Dos detalles atrapados durante el bring-up (ambos en los specs, no en la app):
(1) `material.description` no debe contener el número de parte, o `getByText(part)`
empata dos `<p>`; (2) el plural que pinta la app es "ubicaci**ó**nes" (acento) —
se empata laxo con `/2 ubicaci/`.

## 5. Hooks `data-testid` recomendados (a los carriles dueños del `src/**`)

G1 añadió `data-testid` a las páginas de su golden path. Las **tres páginas que yo
cubro no los tienen** y mi carril es solo-e2e, así que usé localizadores semánticos
+ scoping (estable, pero más sensible a refactors de marcado). Recomiendo a los
dueños del `src/**` añadir, para endurecer:

| Página (src) | Elemento | `data-testid` sugerido |
| --- | --- | --- |
| `dashboard/inventory/page.tsx` | tab Escasez · fila de escasez · tiles `FlowKpi` | `inv-tab-shortage` · `shortage-row-<part>` · `kpi-<label>` |
| `dashboard/quality/holds/page.tsx` | fila de hold · botones disposición · `Modal` | `hold-row-<id>` · `dispo-approve`/`dispo-execute` · `modal` (role=dialog) |
| `dashboard/operador/page.tsx` | tarjeta del picker · riel · barra de acción | `exec-card-<id>` · `station-rail` · `confirm-advance` |

## 6. Alcance

- Archivos nuevos: `apps/web/e2e/golden/06-08*.spec.ts` + este log. **Nada más**
  tocado en `src/**`, ni `ci.yml`, ni el harness de G1.
- La suite corre con el `playwright.config.ts` de G1 (`npm run e2e -w web`).

## 7. Cómo correr

```bash
npm run e2e -w web                                   # toda la suite (01..08)
npm run e2e -w web -- e2e/golden/06-materials-shortage.spec.ts
npm run e2e -w web -- e2e/golden/0{6,7,8}-*.spec.ts --repeat-each=5 --retries=0   # flaky
```
