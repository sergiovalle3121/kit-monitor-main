# AXOS OS — Night Log · Carril UI-COGS (Frontend Finanzas/Costos)

Bitácora del carril **frontend** que cablea COGS y variancia **reales** en las
páginas de Finanzas/Costos. Rama `claude/nifty-ramanujan-rvfemc`.

Es la continuación natural del backend del **Bloque M** (`NIGHT_LOG_COGS.md`),
cuyo "▶ RETOMAR AQUÍ" pedía exactamente esta página. **Cero backend tocado.**

> **Reglas que seguí (no negociables):**
> - **Archivos: SOLO** `apps/web/src/app/dashboard/finance/**` (más este log).
>   No toqué backend, ni hooks/libs compartidos, ni la página `cost-rollup`.
> - **GREP antes de inventar:** leí el módulo `cost-intelligence` en `apps/api`
>   (controller + service + math + entidad + dto) para cablear las rutas y los
>   contratos **reales**, no inventados.
> - **Estado vacío honesto** en todos lados: cuando no hay consumo del piso no se
>   pinta un `$0` como si fuera un costo real — se explica que aún no hay dato.
> - **Puertas web en verde** antes de cerrar: `eslint` ✅ · `tsc --noEmit` ✅.

---

## Qué entregué

### 1) Página nueva — `dashboard/finance/cost-intelligence`
`apps/web/src/app/dashboard/finance/cost-intelligence/page.tsx` — el puente vivo
piso↔dinero en la UI, en el sistema de diseño estándar (glass + `PageHeader` del
dominio `finance` + motion), con soporte claro/oscuro y `prefers-reduced-motion`.

Tres bloques, todos contra rutas reales (vía `useApi`, auto-refresh):

- **Selector de alcance** — toggle **Por orden (WO)** / **Por programa**.
  - WO: buscador (folio / modelo / línea / programa) + lista del plan
    (`GET /production-plan`); al elegir, fija `woId`.
  - Programa: chips de los programas distintos derivados del plan (con conteo de
    WOs). Estado vacío honesto si ninguna orden tiene programa asignado.

- **COGS en vivo**
  - **Por WO** → `GET /cost-intelligence/cogs?woId=`: tiles de COGS total, costo
    unitario y avance; **composición** (material / mano de obra / overhead) con
    barras y %; detalle de costeo con **badges de fuente** honestos
    (`real` = ROLLUP_ACTUAL · `estimado` = STANDARD_TIME_ESTIMATE · `absorción`
    = RATE_ABSORPTION), horas estándar ganadas y tarifas usadas.
  - **Por programa** → `GET /cost-intelligence/cogs/program?programId=`: totales
    agregados + composición + **tabla por WO** (material, COGS, unitario);
    tocar una fila hace **drill-down** a esa WO (cambia a modo WO).

- **Variancia de uso + scrap (modo WO)** → `GET /cost-intelligence/variance?woId=`:
  tiles de plan vs real, **variancia de uso** ($ y %), **scrap** (qty + costo) y
  **variancia total**; tabla **por parte** ordenada por impacto. Color honesto:
  positivo (rojo) = se consumió de más; negativo (verde) = de menos.

- **KPIs de cierre de periodo** → `GET /cost-intelligence/snapshots/kpis` +
  `GET /cost-intelligence/snapshots`: filtros por **periodo** (`YYYY-MM`) y
  **programa**; tiles de COGS cerrado, costo unitario promedio, variancia de uso
  y scrap; **tabla del histórico congelado** (periodo, orden, unidades, COGS,
  unitario, var. uso, scrap, fecha de cierre). **Solo lectura** — el cierre
  (`POST /snapshots`, `finance:write`) vive en el backend y no se dispara aquí.

### 2) Hub de Finanzas — `dashboard/finance`
`apps/web/src/app/dashboard/finance/page.tsx` — agregué una herramienta
**"Inteligencia de costos"** (icono `Gauge`) que enlaza a la página nueva. Es la
única edición a esa página; KPIs y movimientos existentes intactos.

---

## Estados vacíos / honestidad del dato (lo importante del brief)

- **Sin selección:** invita a elegir WO/programa (no muestra ceros).
- **Sin acceso (401/403):** panel claro "requiere `finance:read`" (vía el flag
  `forbidden` de `useApi`, que además auto-recambia el JWT si caducó).
- **COGS = 0 real:** si material+labor+overhead son 0, se dice explícitamente
  "Aún sin consumo en el piso" — el `$0` es genuino, no un placeholder.
- **Variancia sin base:** si no hay BOM (ruteo) ni backflush ni scrap, se explica
  que no hay plan ni real que comparar (no inventa una variancia de 0).
- **Cierre vacío:** "No hay cierres congelados" diferenciando "ningún periodo
  cerrado" de "el filtro no arroja snapshots".
- **Fuente del costo visible:** labor/overhead marcan si son **reales** (rollup) o
  **estimados/absorbidos**, para no presentar una estimación como dato medido.

---

## Cómo cablé las rutas (decisiones)

1. **`useApi` con paths "desnudos"** (`/cost-intelligence/...`), igual que el hub
   de Finanzas (`/accounting/transactions`) y ~30 páginas del dashboard. El
   controlador `@Controller('cost-intelligence')` es estructuralmente idéntico a
   los bare-controllers que ya funcionan (`production-plan`, `cost-rollup`), así
   que resuelve por la misma convención. Esto trae gratis: unwrap de
   `{success,data}`, detección de `forbidden` y el self-healing de JWT.
2. **Tipos espejo del backend** declarados en la página (`WoCogs`, `ProgramCogs`,
   `WoVariance`/`PartVariance`, `SnapshotKpis`, `Snapshot`) tomados del
   `cost-intelligence.service.ts` y la entidad `fin_wo_cost_snapshot`. Sin tocar
   contratos ni añadir hooks compartidos (carril limitado a `finance/**`).
3. **Catálogo de WOs/Programas desde `/production-plan`** (ya usado por otras
   páginas) para poblar los selectores; los programas se derivan en cliente.
4. **Solo lectura.** El brief dice "no toques backend"; el cierre de periodo es
   `finance:write` y queda fuera de este carril. La tabla de snapshots refleja lo
   que el backend ya congeló.

---

## Puertas (verdes este turno)

- **`eslint`** sobre los 2 archivos tocados: ✅ (0 findings).
- **`tsc --noEmit`** del proyecto web completo: ✅ (0 errores).
- **`next build`**: corrido como verificación extra del turno.

---

## ▶ RETOMAR AQUÍ (siguiente, sin salir del carril)

- **Cierre de periodo desde la UI** (cuando se autorice tocar/llamar write):
  botón `POST /cost-intelligence/snapshots` con confirmación, gateado por
  `finance:write`, que refresque la tabla de snapshots.
- **Waterfall de variancia** plan → real → scrap (gráfica) además de la tabla.
- **Sembrar el filtro de cierre** con el programa/WO ya seleccionado arriba, para
  saltar de "vivo" a "cerrado" en un toque.
- **Tendencia de COGS/unitario por periodo** una vez haya varios cierres
  (`/snapshots` agrupado por `period`).
