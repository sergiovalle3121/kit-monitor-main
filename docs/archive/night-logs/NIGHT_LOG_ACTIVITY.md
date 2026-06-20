# NIGHT_LOG — ACTIVITY (Carril visor del Event Ledger)

Bitácora del carril ACTIVITY. **Solo frontend**, SOLO una página nueva bajo
`apps/web/src/app/dashboard/activity/**` + sus componentes. Objetivo: un visor de
la **bitácora inmutable** (Event Ledger) que haga que la app se sienta auditable y
confiable — timeline de eventos del piso con filtros por dominio/entidad/fecha, e
**historial por entidad** ("¿qué le pasó a esta WO / serial / NCR?").

> Rama: `claude/admiring-cray-8zputw`. Puertas: `tsc --noEmit` + `eslint` de lo
> tocado + `next build` en verde antes de commitear. Disciplina de carril: **no se
> tocó `apps/api` ni la navegación global** (dock/hub) — todo vive bajo
> `dashboard/activity/**`.

## Estado al empezar (auditoría del módulo `event-ledger` en main)

GREP del módulo (`apps/api/src/modules/event-ledger/**` + el interceptor global):

- **Entidad `LedgerEvent`** rica y bien indexada: `timestamp`, `actorId/Name`,
  `domain` (enum de 7: MATERIALS, PLANNING, PRODUCTION, ENGINEERING, QUALITY,
  SHIPPING, SYSTEM), `action` (p.ej. `KIT_CREATED`), `referenceType`/`referenceId`,
  columnas de contexto industrial indexadas (`plant`, `warehouse`, `line`, `shift`,
  `customer`, `program`, `model`, `workOrder`) y tres blobs JSON: `context`
  (revision/lot/serial…), `transaction` (quantity/from/to/unit) y `metadata`
  (reasonCode/Desc, **beforeState/afterState**, httpMethod/path/durationMs…).
- **Se llena solo**: `EventLedgerInterceptor` (APP_INTERCEPTOR global) registra cada
  mutación (POST/PATCH/PUT/DELETE) de los dominios mapeados, capturando before/after
  del body. O sea: la bitácora ya se está escribiendo en cada operación del piso.
- **Lectura expuesta hoy — solo DOS endpoints** (`@Controller('ledger')`, prefijo
  global `/api`):
  - `GET /ledger/reference/:type/:id` → eventos de una entidad (orden DESC).
  - `GET /ledger/work-order/:wo` → eventos cuya `context.workOrder` coincide.
  - **No existe** un endpoint de **listado/timeline global** con filtros.
- **El frontend no consumía el Event Ledger** en absoluto (los "ledger" que aparecen
  en otras páginas son ledgers de movimientos de inventario, otra cosa). Ruta
  `dashboard/activity` (ni `history`) no existía.

Convenciones del front que se reusan tal cual: `useApi` (SWR, devuelve
`forbidden`/`error` con `ApiError.status`), `PageHeader`+`IconTile` (color por
dominio), `glass`, paleta inline + `<style jsx global>` para inputs.

---

## Lo construido — `/dashboard/activity`

Una pantalla con **dos lentes** sobre la misma fuente de verdad, conmutables con un
toggle (mismo patrón de píldora glass que el resto del dashboard):

### Lente 1 — Línea de tiempo (feed global) — `components/TimelineView.tsx`
- **Filtros por dominio** (chips multi-selección, cada uno con su color de sistema),
  **por entidad** (`<select>` poblado con los `referenceType` presentes en los datos),
  **por fecha** (presets Hoy / 7 días / 30 días / Todo **+** rango personalizado con
  dos `<input type=date>`) y **búsqueda libre** (acción, WO, serial, actor, modelo,
  motivo…).
- **KPIs honestos** del conjunto filtrado: eventos, dominios, entidades, actores.
- **Timeline agrupado por día** ("Hoy"/"Ayer"/fecha larga) con riel vertical y nodos.
- **Filtrado 100% client-side** sobre la lista cargada: responde al instante (sin
  re-fetch por tecla) y funciona contra **cualquier** endpoint de listado, incluso
  uno que aún no filtre del lado servidor.

### Lente 2 — Historial por entidad — `components/EntityHistoryView.tsx`
- Buscador tipo + identificador (con atajos: WORK_ORDER, NCR, SERIAL, KIT, SHIPMENT,
  SUPPLIER…). **Corre contra los endpoints reales** y **funciona hoy**:
  - `WORK_ORDER` → `GET /ledger/work-order/:wo` (la WO se etiqueta en `context`).
  - cualquier otro tipo → `GET /ledger/reference/:type/:id`.
- Cabecera de la entidad con resumen de su línea de vida (nº de eventos, actores
  distintos, "desde …") + el mismo timeline (ocultando el chip de referencia, que
  aquí ES el contexto). Es la mitad que hace la app **rastreable**.

### Pieza compartida — `components/EventCard.tsx` (+ `EventTimeline.tsx`, `types.ts`)
- Tarjeta de evento idéntica en ambas lentes. Colapsada: ícono+color de dominio,
  acción **humanizada** (`KIT_CREATED` → "Kit creado") conservando el **código crudo**
  como insignia mono, actor, hora absoluta + relativa, y chips de contexto industrial
  (WO/serial/lote/modelo/línea/planta/cantidad…). Expandida (detalle de auditoría):
  **transacción**, **diff antes→después** (tabla compacta de claves cambiadas),
  **origen** (método/ruta/duración), **id inmutable** del evento y **Copiar JSON**.
- `types.ts` espeja la entidad de backend + helpers puros (humanización, formato de
  fecha/relativo `es-MX`, diff de estados, chips de contexto, texto buscable) y el
  mapa color/ícono por dominio (incluye SHIPPING y SYSTEM, que no existen como
  `DomainKey` del sistema de diseño — definidos localmente para no editar el módulo
  global de diseño, disciplina de carril).
- Navegación cruzada: clic en el chip de referencia de un evento del feed → salta al
  **historial de esa entidad** (la página coordina el estado entre lentes).

---

## Decisiones honestas

- **El feed global necesita backend** que no existe aún. La lente de timeline pide la
  forma REST natural `GET /ledger?limit=…` (con `shouldRetryOnError:false`). Mientras
  ese listado no exista, el `useApi` recibe 404 y la UI lo dice **con claridad**
  ("Feed global pendiente de backend"), apuntando al Historial por entidad —que sí es
  real— y con botón Reintentar. **No se inventan datos.** En cuanto el backend exponga
  el listado, el feed **se enciende solo** (el filtrado client-side ya está listo).
- **El historial por entidad es real hoy**: usa los dos endpoints existentes. Esa es
  la mitad funcional inmediata; el feed es la mitad forward-compatible.
- **Sin tocar backend ni navegación**: respeta el enunciado ("SOLO `dashboard/activity/**`
  + componentes"). La página es alcanzable por URL directa `/dashboard/activity`.

## REQUIERE BACKEND (anotado, NO inventado)

1. **`GET /ledger`** — listado/timeline global del ledger, idealmente con filtros
   server-side (`domain`, `referenceType`, `from`, `to`, `actor`, `q`, `limit`/cursor)
   y paginación para escalar. Es lo único que falta para que el feed global respire.
2. **Búsqueda por `serial`** como entidad de primera clase: hoy el serial vive en
   `context.serial`, no siempre como `referenceType`. `reference/SERIAL/:id` devolverá
   vacío salvo que el backend registre eventos con ese `referenceType` (o exponga un
   `GET /ledger/serial/:sn` análogo al de work-order).

## Pendiente de OTRO carril (fuera de alcance, a propósito)

- **Registro en navegación** (dock/hub/paleta de búsqueda): editar esos archivos
  está fuera del carril ACTIVITY y chocaría con carriles paralelos. Cuando se integre,
  basta apuntar a `/dashboard/activity` (dominio sugerido: `erp`, ícono `ScrollText`).

---

## Puertas
- `tsc --noEmit`: **0 errores** (proyecto completo, no solo el carril).
- `eslint src/app/dashboard/activity`: **0 errores, 0 warnings**.
- `next build`: **OK** — ruta `○ /dashboard/activity` prerenderizada sin incidencias.

## Archivos del carril
```
apps/web/src/app/dashboard/activity/
  page.tsx                       # orquesta las dos lentes + estado compartido
  components/
    types.ts                     # tipos espejo + meta de dominio + helpers puros
    EventCard.tsx                # tarjeta de evento (colapsa/expande, diff, copiar)
    EventTimeline.tsx            # agrupación por día + riel vertical (reusable)
    TimelineView.tsx             # feed global: filtros + KPIs + fetch GET /ledger
    EntityHistoryView.tsx        # historial por entidad (endpoints reales)
NIGHT_LOG_ACTIVITY.md            # esta bitácora
```
