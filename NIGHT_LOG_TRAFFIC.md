# NIGHT_LOG — TRÁFICO (EMS Shipping Suite · Fase 1)

Primera fase de la **suite de embarques EMS** para competir con ShippersNet.
Rama `claude/bold-mccarthy-l97puw`. Decisión de arranque (con el dueño):
**spine `outbound`** · documentos **dual** (cliente/export + Carta Porte, fases
siguientes) · etiquetas **ZPL** (fase siguiente) · **Maestros primero** (esta fase).

100% aditivo: módulo nuevo `traffic` + columnas nullable en `outbound_shipments`.
No se tocó el módulo legacy `shipping`.

---

## ▶ RETOMAR AQUÍ

- **Entregado y en verde (Fase 1 — Maestros + asignación):**
  - Backend `traffic`: 4 maestros multi-tenant (`traffic_carriers`,
    `traffic_vehicles`, `traffic_drivers`, `traffic_docks`) con CRUD + soft-delete,
    únicos por scope, RBAC `logistics:read`/`logistics:write`.
  - **Asignación de transporte** sobre el spine `outbound`: `POST
    /outbound/shipments/:id/assign-transport` + `release-transport`, con el
    **poka-yoke** (no deja asignar unidad/chofer/andén inactivo, en mantenimiento,
    de recibo o ya ocupado por otro embarque; libera/ocupa estatus al asignar).
  - Frontend `dashboard/traffic`: 5 pestañas (Transportistas, Unidades, Choferes,
    Andenes, Asignación).
- **Siguiente (Fase 2 — propuesta):** unidades de manejo (tarima/caja/**SSCC**) +
  **etiquetas ZPL** + carga verificada por escaneo (SSCC↔ASN). Luego: ASN a detalle
  / EDI 856, documentos (factura/packing/BOL/Carta Porte), y cablear el serial-scan
  del pack-out a `genealogy`.
- **Pendiente de cablear UI:** surfacing de la asignación dentro del detalle del
  embarque en `dashboard/outbound` (hoy vive en la pestaña Asignación de tráfico).

---

## Backend (apps/api/src/modules/traffic + outbound)

- **Entidades** (`TenantBaseEntity`, tablas `traffic_*`):
  - `Carrier` — code·name·scac·taxId·mode(GROUND/OCEAN/AIR/PARCEL/COURIER)·contacto·status.
  - `Vehicle` — plate·type(DRY_VAN/REEFER/FLATBED/CONTAINER_20/40/BOX_TRUCK/VAN/OTHER)·
    económico·carrierId/Name·capacidad(kg/m³)·vin·status(available/assigned/maintenance/inactive).
  - `Driver` — name·licencia·tipo·tel·idDocument(INE)·carrierId/Name·status(available/assigned/inactive).
  - `LoadingDock` — code·name·building·type(shipping/receiving/both)·status(available/occupied/maintenance/inactive).
- **`traffic.rules.ts`** (puro + spec): vocabularios + poka-yoke de asignabilidad
  (`checkCarrier/Vehicle/Driver/DockAssignable`). Espejo de la verdad del backend.
- **`traffic.service.ts`**: CRUD tenant-scoped (manual `applyScope`, código/placa
  únicos por scope) + finders/`setStatus` que usa outbound al asignar.
- **`outbound`** (spine): +10 columnas nullable de asignación
  (`carrier_id`, `vehicle_id/plate/type`, `driver_id/name`, `dock_id/code`,
  `transport_assigned_at/by`) + `assignTransport`/`releaseTransport` en el servicio
  (inyecta `TrafficService`) + 2 endpoints (`logistics:write`).
- **Migración aditiva** `20260616140000-CreateTraffic.ts` (idempotente:
  `hasTable`/`hasColumn`; crea 4 tablas + ALTER de `outbound_shipments`).
- **RBAC**: `logistics:read` en `READ_ALL`; `logistics:write` en `plant_manager` y
  `warehouse_operator`. Admin/owner heredan vía `ALL_PERMISSIONS`.

## Frontend (apps/web/src/app/dashboard/traffic — sólo archivos nuevos)

- `page.tsx` (shell + tabs + datos), `traffic.types.ts`, `traffic.utils.ts`,
  `traffic.ui.tsx`, `traffic.actions.tsx` (modales create/edit + delete + asignar/
  liberar), `traffic.masters.tsx` (las 5 vistas).
- La pestaña **Asignación** lista embarques `outbound` y abre el modal de
  asignación (sólo ofrece piezas asignables; el backend revalida el poka-yoke).

## Puertas

1. API `npm run build` ✅
2. API `npm test` → **81 suites / 543 tests** ✅ (incluye `traffic.rules.spec` +
   asignación/poka-yoke en `outbound.service.spec`).
3. Web `tsc --noEmit` ✅ · `eslint` (traffic) ✅ · `next build` ✅
   (`/dashboard/traffic` prerenderizada).
4. **Smoke de Postgres**: corre en CI (no hay daemon Docker local). Entidades
   colisión-safe (tablas/índices `traffic_*` únicos, columnas aditivas, tipos
   estándar); ya materializan en sqlite vía el spec de outbound.

## Tripwires respetados

- ⛔ Aditivo: módulo nuevo + columnas nullable; cero cambios destructivos, cero al
  legacy `shipping`.
- ⛔ Multi-tenant: `TenantBaseEntity` + `applyScope` en todas las lecturas.
- 🛑 Etiquetas/ASN/documentos/SSCC = fases siguientes (no simuladas aquí).
