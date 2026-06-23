# Qwen Coder — Reglas y Backlog (trabajo en paralelo con Claude)

> **Léeme antes de empezar cada tarea.** Este documento define cómo Qwen Coder
> contribuye a AXOS OS en paralelo con Claude, sin pisarse. Complementa a
> `AGENTS.md` (que manda en convenciones generales) y a `/docs`.

## 0. Reparto de territorio (evitar conflictos)

- **Claude trabaja en:** `line-engineering`, `line-control-tower`, `bay-layout`,
  `industrial-engineering` (el CAD/MES de disposición de líneas). **Qwen NO toca
  estos módulos.**
- **Qwen trabaja en:** un módulo del backlog por sesión (OEE, mantenimiento,
  herramientas, inventario, conteos cíclicos, calidad/NCR, proveedores,
  pronóstico…). **Un PR = un módulo.** Nunca edites dos módulos de negocio en el
  mismo PR (sólo se permite tocar archivos compartidos como `*.module.ts` /
  `app.module.ts` cuando registras algo nuevo de TU módulo).
- Si una tarea te obliga a tocar algo de Claude, **párate y deja una nota en el
  PR** en vez de editarlo.

## 1. Reglas duras (para que el PR sea funcional y mergeable)

1. **Funcional, no relleno.** Cada PR entrega una capacidad que de verdad sirve
   (un cálculo correcto + su endpoint + su panel), no código por escribir.
2. **Rebanada vertical, patrón del repo:**
   `helper puro (.ts) + su spec (.spec.ts)` → método de servicio → ruta de
   controlador → (opcional) panel web. Mira cualquier módulo existente como
   plantilla (p. ej. `apps/api/src/modules/oee/oee.ts` + `oee.spec.ts`,
   `tooling/tool-life.ts` + `tool-life.spec.ts`).
3. **La lógica vive en helpers PUROS y testeados con Jest.** Los tests de API
   corren en CI: si no hay spec, no hay confianza. Mínimo 6–7 casos por helper,
   incluyendo bordes (vacío, nulos, división por cero).
4. **Esquema: ADITIVO y NULLABLE.** El smoke de CI materializa TODO el esquema
   (synchronize) contra Postgres real. Una columna mal tipada **rompe el gate**.
   - Columnas nuevas: `nullable: true` y con los helpers del repo
     (`JSON_COLUMN_TYPE`, `DATE_COLUMN_TYPE`) para compatibilidad Postgres.
   - Nada destructivo (no borres/renombres columnas ni cambies tipos).
   - Multi-tenant: respeta el patrón `tenant_id` del módulo.
5. **Frontend:** sólo Tailwind + primitivos shadcn/ui; estética AXOS premium
   (oscuro, minimalista). Los paneles de análisis pueden seguir el patrón de los
   de line-engineering (modal `glass` + `createPortal` al `body`).
6. **Lectura cruzada de otros módulos: sí. Escritura: no.** Puedes leer datos de
   otros módulos (read-only) para tu análisis; sólo escribes en el tuyo.

## 2. Verificación obligatoria antes de mergear

Corre y deja en verde (desde la raíz del repo):

```bash
npm ci                 # una vez por entorno
npm run build          # turbo build (API nest build + web next build)
npm test               # tests unitarios de API (Jest) — TUS specs deben pasar
npm run lint           # lint (web es BLOQUEANTE: 0 errores; warnings ok)
```

- El **smoke** (`Build · Test · Lint · Smoke`) corre en CI contra Postgres; no
  lo puedes correr local sin Postgres, pero si tu esquema es aditivo/nullable
  pasará. **Nunca mergees en rojo** — *cada merge a `main` despliega a
  producción.*

## 3. Git / PR (igual que el resto del equipo)

- `git config user.email noreply@anthropic.com && git config user.name Qwen`
  (o tu identidad de agente) al iniciar sesión.
- Rama por tarea → PR a `main` → **Squash and merge** cuando CI esté verde.
- Commits **Conventional Commits en español**:
  `feat(oee): desglose de pérdidas (Pareto de 6 grandes pérdidas)`.
- Un PR pequeño y revisable por tarea. Claude revisa/tropicaliza después.

## 4. Backlog (toma una tarea por sesión, de arriba hacia abajo)

Cada tarea es una rebanada vertical: **helper puro + spec → servicio → ruta →
panel**. "DoD" (Definition of Done) = `tsc` limpio, spec en verde con los casos
indicados, `lint` web sin errores, `build` en verde, PR squasheado con CI verde.

### F-Q1 · OEE — desglose de pérdidas (Pareto de las 6 grandes pérdidas)
- **Módulo:** `oee` (API) + panel en `dashboard/.../metrics` u `oee`.
- **Helper:** `lossBreakdown(input)` — a partir de disponibilidad/desempeño/
  calidad reparte las **6 grandes pérdidas** (paro planificado, paro no
  planificado/averías, ajustes/cambios, microparos, velocidad reducida,
  scrap/retrabajo) y devuelve cada pérdida en puntos de OEE, **ordenadas + %
  acumulado (Pareto)** y la pérdida #1.
- **Ruta:** `GET oee/losses?...`. **Panel:** barras Pareto + "empieza por".
- **Spec ≥6:** suma de pérdidas + OEE = 100; Pareto ordenado desc; acumulado
  llega a 100; sin pérdidas → OEE 100; entradas nulas seguras.

### F-Q2 · Mantenimiento — MTBF / MTTR / disponibilidad por activo
- **Módulo:** `maintenance`.
- **Helper:** `reliabilityStats(orders)` — de las órdenes de trabajo por activo
  calcula **MTBF**, **MTTR**, **disponibilidad** y nº de fallas; ordena los
  peores activos (menor MTBF) y marca los que bajan de un umbral.
- **Ruta:** `GET maintenance/reliability`. **Panel:** tabla + peores activos.
- **Spec ≥6:** MTBF/MTTR correctos, 1 sola falla, sin fallas (∞/N/A), orden por
  peor, vacío seguro.

### F-Q3 · Herramientas — vida restante + alerta de cambio
- **Módulo:** `tooling` (ya hay `tool-life.ts`; **extiéndelo, no dupliques**).
- **Helper:** `toolLifeStatus(tools, usage)` — % de vida restante, piezas hasta
  el cambio, estado `ok | pronto | vencido`; lista de las que hay que cambiar.
- **Ruta:** `GET tooling/life-status` (+ opcional `tooling-alerts.task` ya
  existe — engánchate si aplica). **Panel:** barras de vida + alertas.
- **Spec ≥6:** % vida, umbral "pronto", vencido, herramienta nueva, vacío.

### F-Q4 · Inventario — clasificación ABC + punto de reorden
- **Módulo:** `inventory`.
- **Helper:** `abcReorder(items)` — clase **ABC** por valor anual (≈80/15/5),
  **ROP** = demanda·lead time + stock de seguridad, y bandera de **reorden**
  (si on-hand ≤ ROP) con cantidad sugerida.
- **Ruta:** `GET inventory/abc-reorder`. **Panel:** tabla ABC + a reordenar.
- **Spec ≥7:** corte ABC, ROP con/sin seguridad, reorden disparado/no, lead
  time 0, ítems sin demanda, vacío.

### F-Q5 · Conteos cíclicos — exactitud (IRA) + plan ABC
- **Módulo:** `cycle-counts`.
- **Helper:** `inventoryAccuracy(counts)` — **IRA** (exactitud de registro por
  ubicación/SKU), varianza absoluta y en valor, y un **plan de conteo** ponderado
  por clase (A más seguido que C).
- **Ruta:** `GET cycle-counts/accuracy`. **Panel:** IRA global + plan.
- **Spec ≥6:** IRA 100% (todo cuadra), con varianzas, valor de la varianza,
  plan ABC, vacío.

### F-Q6 · Calidad/NCR — Pareto de defectos + PPM / DPMO / yield
- **Módulos:** `defect-codes` + lee `ncr` (read-only).
- **Helper:** `defectPareto(records, opportunities)` — **Pareto** de causas de
  defecto (% + acumulado), **DPMO**, **PPM** y **first-pass yield**.
- **Ruta:** `GET quality-analytics/defect-pareto` (o en `defect-codes`).
- **Spec ≥7:** Pareto ordenado, acumulado, DPMO/PPM, yield, 0 defectos, 0
  oportunidades (sin /0), vacío.

### F-Q7 · Proveedores — scorecard (OTD, calidad PPM, índice A–D)
- **Módulo:** `suppliers`.
- **Helper:** `supplierScorecard(receipts, ncrs)` — **entregas a tiempo (OTD%)**,
  **PPM de calidad**, y un **índice ponderado 0–100 con calificación A–D** (mismo
  patrón que el scorecard de layout de Claude: dimensiones opcionales, pesos
  renormalizados, los peores primero).
- **Ruta:** `GET suppliers/scorecard`. **Panel:** badge + dimensiones.
- **Spec ≥7:** OTD, PPM, índice/calificación, dimensión faltante renormaliza,
  peor proveedor, sin recibos, vacío.

### F-Q8 · Pronóstico — error (MAPE / MAD / bias) + señal de seguimiento
- **Módulo:** `forecast`.
- **Helper:** `forecastError(series)` — **MAPE**, **MAD**, **bias** y **tracking
  signal**, con bandera de sesgo (si |TS| > 4) por SKU.
- **Ruta:** `GET forecast/error`. **Panel:** tabla + SKUs sesgados.
- **Spec ≥6:** MAPE/MAD, bias +/−, tracking signal, actual 0 (sin /0), perfecto
  (error 0), vacío.

## 5. Qué hace Claude después (tropicalizar)

Tras cada PR de Qwen, Claude: revisa la corrección del cálculo y los specs,
ajusta la UI al look AXOS premium, lo engancha en la navegación del dashboard si
falta, verifica multi-tenant/permisos, y abre un PR de complemento si hace falta.
Qwen entrega el motor funcional; Claude lo integra y pule.
