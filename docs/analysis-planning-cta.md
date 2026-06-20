# Análisis — Bug de planeación: ¿qué carril conecta al piso? (`plans` vs `production-plan`)

> **Tipo de documento:** análisis / recomendación. **No** implementa nada.
> El cambio de CTA descrito abajo es **decisión de producto de Sergio**; aquí solo
> se deja la evidencia y el cambio exacto que haría falta. El código del CTA **no
> se tocó**.

## TL;DR

Hay **dos carriles de planeación paralelos y desconectados** entre sí:

| | Carril 1 — `plans` | Carril 2 — `production-plan` |
| --- | --- | --- |
| Entidad | `Plan` (tabla `plans`, PK numérica) | `SfWorkOrder` (tabla `sf_work_orders`, PK UUID, tenant-scoped) |
| Crea desde | **`/dashboard/planning`** ("Nuevo plan") | `/dashboard/production-plan` ("Publicar WO") |
| Piso (ejecución) | `mes-execution` → **`/dashboard/operador`** (`/mes/executions`) | `operator-terminal` → `/dashboard/operator-terminal` (`/production-plan`) |
| Riqueza del flujo | Kit/PickList + explosión de ruteo en pasos + backflush por paso + genealogía | confirmación a nivel estación + eventos de consumo; sin Kit ni pasos de ruteo |

**El que conecta de punta a punta el `Plan` que crea el planeador es el Carril 1**
(`/dashboard/planning` → `Plan` → `mes-execution` → `/dashboard/operador`).

**El bug:** la página de planeación (Carril 1) tiene en su header un CTA
**"Muro de WOs"** que enlaza a **`/dashboard/production-plan`** (Carril 2). Es un
callejón sin salida respecto al `Plan` recién creado: ese muro lee `SfWorkOrder`,
**no** muestra el `Plan`, y su terminal de piso (`/operator-terminal`) tampoco
consume `Plan`. El planeador queda sin ruta visible al piso que sí ejecuta su plan
(`/dashboard/operador`).

---

## Evidencia (verificada en código)

### Carril 1 está conectado de punta a punta

- **Frontend crea `Plan`:** `apps/web/src/app/dashboard/planning/page.tsx`
  - `useApi<Plan[]>('/plans')` (línea 100), `useApi<Intelligence>('/plans/intelligence')` (línea 101).
  - CTA "Nuevo plan" (línea 241) → `POST /plans`; "Publicar" → `POST /pick-lists { planId }` (genera Kit + PickList).
- **Backend del piso consume `Plan`:** `apps/api/src/modules/mes-execution/mes-execution.service.ts`
  - `import { Plan } from '../plans/entities/plan.entity';` (línea 20).
  - `resolvePlan(dto)` (línea 1048) resuelve por `planId`/`workOrder`; crea `WorkOrderExecution` con FK `planId` (líneas 104, 134) y explota ruteo + materiales en pasos.
- **UI de piso que sí ve esas ejecuciones:** `apps/web/src/app/dashboard/operador/page.tsx`
  - `useApi('/mes/executions?status=open')` (línea 194), `/mes/board` (línea 197), `POST /mes/executions` (línea 366).

➡️ Cadena completa: **`/dashboard/planning` → `POST /plans` → `Plan` → `mes-execution (planId)` → `/dashboard/operador (/mes/*)`**.

### Carril 2 es un silo separado (su propio mini end-to-end, sin tocar el `Plan`)

- **Entidad:** `apps/api/src/modules/production-plan/entities/sf-work-order.entity.ts` → `@Entity('sf_work_orders')` (línea 21), `class SfWorkOrder extends TenantBaseEntity` (línea 24).
- **Piso del Carril 2:** `apps/api/src/modules/operator-terminal/operator-terminal.service.ts`
  - `import { ProductionPlanService } from '../production-plan/production-plan.service';` (línea 20) y `import { SfWorkOrder } …` (línea 21).
- **UI:** `apps/web/src/app/dashboard/operator-terminal/page.tsx` → `useApi<WO[]>('/production-plan')` (línea 78).

### El puente que NO existe

- `plans` **no** referencia ni crea `SfWorkOrder`; `production-plan` **no**
  referencia ni crea `Plan`. `mes-execution` acepta `planId`/`workOrder`, nunca un
  `sfWorkOrderId`. Los dos carriles no comparten entidad ni sincronización.
- Esto concuerda con `DECISIONS.md` §12 (la suite `sf_` se acopló por servicios y
  referencias denormalizadas, como track nuevo de piso) — quedó **en paralelo** al
  carril `plans`/`mes` original, no integrado con él.

---

## El CTA exacto a cambiar (no aplicado)

**Archivo:** `apps/web/src/app/dashboard/planning/page.tsx` — **líneas 230–232**.

Código actual:

```tsx
<Link href="/dashboard/production-plan" className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-800 transition-colors">
  <Megaphone className="w-4 h-4" /> Muro de WOs
</Link>
```

**Cambio mínimo y suficiente (recomendado):** apuntar el CTA al piso que sí
consume el `Plan` (Carril 1):

```tsx
<Link href="/dashboard/operador" className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-800 transition-colors">
  <Factory className="w-4 h-4" /> Piso (MES)
</Link>
```

Notas de implementación (cuando decidas hacerlo):
- Lo **funcional** es solo el `href`: `/dashboard/production-plan` → `/dashboard/operador`.
- La etiqueta/ícono son cosméticos. Si cambias `Megaphone` por `Factory`, **importa
  `Factory`** desde `lucide-react` en ese archivo (hoy no está importado); o deja
  `Megaphone` y solo cambia el texto a algo como "Piso (MES)".

---

## Recomendación

1. **Estandariza el flujo del planeador sobre el Carril 1** (`plans` + `mes-execution`):
   es el único que arrastra Kit/PickList, explosión de ruteo, backflush por paso y
   genealogía — el verdadero "punta a punta" al piso.
2. **Re-apunta el CTA** "Muro de WOs" como arriba para que `/dashboard/planning`
   lleve a `/dashboard/operador`.
3. **Decide el rol del Carril 2** (`production-plan`/`operator-terminal`). Opciones,
   en orden de menor a mayor esfuerzo (tu decisión de producto):
   - **(a) Capa de supervisión read-only:** dejar el muro de WOs como tablero de
     secuenciación/autorización, pero **derivado** del Carril 1 (que lea/proyecte
     `Plan`/`mes` en lugar de `SfWorkOrder` propio).
   - **(b) Integrar:** crear el puente `Plan ↔ SfWorkOrder` (publicar un `Plan`
     materializa/actualiza su `SfWorkOrder`) para que ambos muros vean lo mismo.
   - **(c) Deprecar:** retirar el Carril 2 si no aporta sobre `mes-execution`.

> No avanzo ninguna de (a)/(b)/(c) ni toco el CTA: es decisión de producto. Este
> documento deja lista la evidencia y el cambio exacto para cuando la tomes.
