# AXOS OS — Runbook de Demo de Beta (el hilo end-to-end)

- **Objetivo:** demostrar AXOS OS de punta a punta sobre el **carril que sí conecta**
  (carril 1: `plans → mes-execution`), tal como lo verifica
  [`docs/BETA-READINESS-AUDIT.md`](BETA-READINESS-AUDIT.md).
- **Audiencia:** demo a stakeholders / onboarding. Guion de ~10 pasos, cada uno con
  la pantalla, la acción exacta y qué esperar.
- **Pre-requisitos:** app corriendo (`npm run dev` → web en :3001, API en :3000) y un
  usuario con rol amplio (admin/executive ve todo). Sin `DATABASE_URL` la API usa
  SQLite local — suficiente para la demo.

> **El pitch en una frase.** *AXOS toma un producto nuevo desde ingeniería, le arma
> BOM/ruteo/materiales, publica un plan, lo ejecuta en el piso consumiendo material,
> captura calidad y deja trazabilidad y KPIs — todo en una plataforma.*

---

## Guion (10 pasos)

### 1. Producto / Modelo — `/dashboard/models`
- Click **"Nuevo modelo"** → nombre (p. ej. `Demo Board A`), opcional número/cliente → crear.
- Abre el modelo y **actívalo** (DRAFT → ACTIVE).
- *Qué mostrar:* el folio `MDL-…` autogenerado y el estado.

### 2. Maestro de Materiales — `/dashboard/materials`
- Crea 2–3 partes (p. ej. `RES-0402-10K`, `PCB-DEMO`, `CONN-2P`). Déjalas en **ACTIVE**.
- *Qué mostrar:* tipo de ítem (PURCHASED/MANUFACTURED), folio `MAT-…`.

### 3. BOM multinivel — `/dashboard/bom`
- **"Nuevo BOM"** para `Demo Board A` → agrega líneas eligiendo las partes del maestro.
- *Qué mostrar:* la estructura por `materialId` (no texto libre) y la explosión.

### 4. Ruteo — `/dashboard/routing`
- **"Nuevo ruteo"** para el material/modelo → agrega operaciones (p. ej. `SMT`, `AOI`,
  `Test`) y, en una operación, materiales de **backflush**.
- *Qué mostrar:* operaciones secuenciadas + consumo asociado.

### 5. (Opcional) NPI — `/dashboard/npi`
- **"Nuevo proyecto"** por modelo+revisión → se crean **gates** automáticos y el
  **readiness** agrega señales reales (BOM, ruteo, FAI, AVL).
- Decide un gate y, si quieres, **release a MP** (es *advisory* — no activa el modelo;
  la activación se hizo en el paso 1).

### 6. Plan de producción — `/dashboard/planning`
- **"Nuevo plan"** (`plan-new-btn`) → elige el modelo, cantidad → **"Crear plan"**.
- En el plan, click **"Publicar"** (`plan-publish`).
- *Qué pasa por detrás:* se explota el BOM, se genera el **Kit/PickList** y el plan
  pasa a `published` (`pick-list.service.ts:71`).

### 7. Piso / Terminal de operador — `/dashboard/operador`
- Escanea/teclea el **workOrder** del plan → **"Montar"**.
- *Qué pasa:* se crea `WorkOrderExecution` ligada al `Plan`, se **explota el ruteo en
  pasos** y se cargan los materiales del kit (`mes-execution.service.ts:154`).

### 8. Ejecutar + consumir material — `/dashboard/operador`
- En un paso, **"Confirmar"** la cantidad buena (y scrap si aplica).
- *Qué pasa:* `ExecutionStepMaterial` y `KitMaterial` se descuentan, y el inventario
  se decrementa con una transacción **CONSUME** atómica + `InventoryMovement`
  (`mes-execution.service.ts:478`, `inventory.service.ts`). Se registra genealogía.
- *Opcional:* dispara un **Andon** o reporta una **incidencia** desde el mismo panel.

### 9. Calidad / MRB — `/dashboard/floor-quality`
- **"Nuevo hold"** → serial/lote, defecto, severidad → crear (pone el lote en
  cuarentena y bloquea consumo/embarque de la WO).
- Mueve el hold: **"A MRB"** → captura **Disposición** (USE_AS_IS exige *waiver*, RTV
  exige *SCAR*) → rework/reinspect/close.

### 10. Trazabilidad + KPIs
- **Genealogía** — `/dashboard/genealogy`: as-built **por serial** (qué material,
  estación, operador, hora) construido de los eventos reales del paso 8.
- **OEE** — `/dashboard/oee`: el scrap del paso 9 entra al factor de calidad.
- **Control Tower** — `/dashboard/control-tower`: cockpit ejecutivo con semáforos,
  **incluida la card "Calidad · Piso (MRB)"** (holds abiertos / vencidos / scrap).

---

## Qué EVITAR en la demo (huecos conocidos)

- **No** uses `/dashboard/production-plan` ("Muro de WOs") como ruta de ejecución: es
  un tablero de **supervisión/secuenciación** (carril 2, `SfWorkOrder`) que **no**
  llega al terminal del operador ni consume material. El piso real es
  `/dashboard/operador`. (Hay un banner en esa pantalla que lo aclara.)
- **Where-used por lote/reel** en genealogía es **incompleto**: el terminal de piso
  aún no captura lote/reel (`genealogy.service.ts:87`). Demuestra **as-built por
  serial**, que sí está completo.
- **NCR admin** (`/dashboard/quality` → NCR) y los **holds de piso**
  (`/dashboard/floor-quality`) son hoy **colas separadas** (sin FK). Para la demo de
  calidad, usa el flujo de **floor-quality** (paso 9), que es el que conecta a OEE y
  genealogía.

---

## Datos de arranque (opcional)

Para una demo con datos preexistentes en lugar de capturar todo en vivo, ver
[`docs/RUNBOOK-seed-demo.md`](RUNBOOK-seed-demo.md).

> Este runbook describe el flujo verificado al 2026-06-28. Si cambian rutas o
> labels, actualízalo junto con el cambio (regla de `/docs` en `AGENTS.md`).
</content>
