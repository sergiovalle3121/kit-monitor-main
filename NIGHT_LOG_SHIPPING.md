# NIGHT_LOG — SHIPPING (Embarques)

Carril **frontend**. Rama `claude/bold-mccarthy-l97puw`. Pantalla nueva de embarques
operable sobre el módulo `shipping` real (9 endpoints). **100% aditivo en web**:
sólo se creó `apps/web/src/app/dashboard/shipping/**` (la página NO existía). Cero
backend nuevo, cero mock, cero cambios a nav / componentes compartidos / otras
páginas.

> Gate por ítem (apps/web): `tsc --noEmit` + `eslint` + `next build` — **las tres en verde**.

---

## ▶ RETOMAR AQUÍ

- **Entregado y en verde:** pantalla `dashboard/shipping` completa — lista con
  filtros + chips de estado con conteo + KPIs derivados, alta de embarque, drawer
  de detalle (material, listas de empaque, manifiesto, línea de tiempo) y la
  **máquina de estados** cableada a los endpoints reales (surtir → cargar →
  despachar → cerrar), más reporte de discrepancia. Panel de **Etiquetas/ASN en
  estado honesto** (deshabilitado + nota: requiere backend nuevo).
- **Siguiente hueco de MI área (sin salir del carril web):**
  1. Cuando exista `GET /shipping/kpis`, sustituir los KPIs derivados en cliente
     (`deriveKpis`) por la fuente del backend.
  2. Cuando el backend exponga impresión de **etiqueta** y **ASN (EDI 856)**,
     reemplazar el panel honesto `LabelsAsnPanel` por acciones reales.
  3. Edición del manifiesto sin avanzar de estado (hoy el manifiesto se captura al
     **iniciar carga**; no hay PATCH genérico de campos del embarque en el backend).

---

## Endpoints reusados (GREP de `shipping.controller.ts` — sin inventar rutas)

Módulo `@Controller('shipping')`, `@UseGuards(JwtAuthGuard, PermissionsGuard)`:

| Método | Ruta | Permiso (backend) | Uso en la UI |
|---|---|---|---|
| GET | `/shipping` | `materials:read` | Lista (sin ítems). |
| GET | `/shipping/:id` | `materials:read` | Detalle (drawer): `{...shipment, items, packingLists}`. |
| POST | `/shipping` | `materials:write` | Crear embarque → `planning`. |
| POST | `/shipping/:id/items` | `materials:write` | Surtir material (auto → `staged`); el backend valida elegibilidad (PT liberado/OQC en WH-FG). |
| POST | `/shipping/:id/packing-list` | `materials:write` | Generar lista de empaque (`{ actor }`). |
| PATCH | `/shipping/:id/start-loading` | `SHIPPING_WRITE` | Manifiesto → `loading` + `loadingStartedAt`. |
| PATCH | `/shipping/:id/dispatch` | `DISPATCH` | Despachar `{ actor }`; backend **exige** `status='loading'`. |
| PATCH | `/shipping/:id/close` | `SHIPPING_WRITE` | Cerrar → `closed`. |
| POST | `/shipping/:id/discrepancy` | `materials:write` | Abre excepción operacional `{ type, detail, actor }` (no cambia estado). |

**Lectura auxiliar (mejora progresiva, no del módulo):**
`GET /inventory/positions?warehouseId=WH-FG` (sin `@RequirePermissions`) → para
sugerir partes elegibles al surtir. Si falla/está vacío, el campo queda como texto
libre y el backend valida. `available` no se serializa → se calcula `onHand − allocated`.

---

## Máquina de estados (espejo del servicio real)

`planning → staged → loading → dispatched → closed`. Cada salto es un endpoint
distinto (no un `/transition` único como en mantenimiento):

- `planning → staged` vía **POST `:id/items`** (surtir; el servicio promueve solo).
- `staged → loading` vía **PATCH `:id/start-loading`** (manifiesto).
- `loading → dispatched` vía **PATCH `:id/dispatch`** (el backend rechaza si no
  está en `loading` y abre una excepción — la UI sólo ofrece despachar desde `loading`).
- `dispatched → closed` vía **PATCH `:id/close`**.
- `closed` es **terminal**: no hay endpoint de reabrir/cancelar → no se inventa botón.

Generar lista de empaque y reportar discrepancia **no** cambian el estado (igual
que en el backend). La fila de la lista muestra sólo la **acción primaria de avance**
según el estado; el drawer expone el set completo (preparar · avanzar · discrepancia).

---

## Decisiones de diseño

- **Estructura co-localizada** (estilo del módulo `maintenance`, el más reciente):
  `page.tsx` (shell + datos + filtros) · `shipping.types.ts` (espejo de entidades)
  · `shipping.utils.ts` (paleta, máquina de estados, KPIs, fechas — puro) ·
  `shipping.ui.tsx` (átomos presentacionales) · `shipping.actions.tsx` (widgets que
  pegan a la API) · `shipping.detail.tsx` (drawer). Reusa `glass`, `useApi`,
  `apiFetch`, `useToast`, `useAuth` existentes.
- **KPIs derivados en cliente** (en operación / surtidos / en tránsito / con cita
  vencida): **no existe** `GET /shipping/kpis`. Marcado para sustituir si se crea.
- **Detalle por fetch dedicado:** `GET /shipping` no trae `items`/`packingLists`;
  el drawer hace `GET /shipping/:id` (SWR con key condicional). Tras cada mutación
  se refrescan lista **y** detalle.
- **Permisos:** gate de página por la lectura (`forbidden` → "Sin acceso"). Las
  escrituras **se intentan y reportan el 403/400 por toast** (patrón de la casa en
  outbound/maintenance). Es lo honesto aquí porque dos endpoints usan permisos
  *string* sin `recurso:acción` (`SHIPPING_WRITE`, `DISPATCH`) que el front no puede
  evaluar limpio; la verdad la pone el backend.
- **`actor`:** los endpoints de despacho/lista/discrepancia piden `actor` en el body
  → se manda `user.email` (fallback `'Shipping Agent'`).
- **Surtido operable, no a ciegas:** el modal de surtir lee inventario de PT
  liberado y ofrece un `datalist` de partes elegibles con disponible; avisa (sin
  bloquear) si pides más de lo liberado, porque el backend lo rechazará y abrirá
  excepción. Honesto sobre la regla de elegibilidad (OQC).

## Lo que requiere backend nuevo → estado honesto (no simulado)

- **Etiqueta de embarque** y **ASN / EDI 856**: el módulo `shipping` no expone esos
  endpoints. `LabelsAsnPanel` los muestra **deshabilitados** con nota explícita
  ("requiere backend nuevo"). El `trackingNumber` SÍ es real (se captura en el
  manifiesto) y se muestra cuando existe.

## Archivos (sólo `apps/web/src/app/dashboard/shipping/`)

- `page.tsx` — shell: header, KPIs, buscador, chips de estado, lista, modal de alta, drawer.
- `shipping.types.ts` — tipos espejo de `shipment`/`shipment-item`/`packing-list` + DTOs.
- `shipping.utils.ts` — paleta, `STATUS_META`, máquina de estados, `deriveKpis`, fechas (puro).
- `shipping.ui.tsx` — átomos: `Kpi`, `Field`, `Empty`, `Modal`, `Pill`, `StatusPill`, `StatusChip`, `DetailRow`, inputs `.shp-input`.
- `shipping.actions.tsx` — `CreateShipmentModal`, `AddItemButton`, `GeneratePackingListButton`, `StartLoadingButton`, `DispatchButton`, `CloseButton`, `ReportDiscrepancyButton`, `RowActions`.
- `shipping.detail.tsx` — `ShipmentDrawer` + `LabelsAsnPanel` (honesto).

## Puertas (obligatorias) — todas verdes

1. `npx tsc --noEmit` ✅
2. `npx eslint src/app/dashboard/shipping` ✅ (0 errores, 0 warnings)
3. `npm run build` (`next build`) ✅ — `/dashboard/shipping` prerenderizada (○).

## Tripwires respetados

- ⛔ Sólo archivos nuevos bajo `dashboard/shipping/**`. No se tocó nav
  (`dashboard/page.tsx`), componentes compartidos, ni otras páginas/back.
- ⛔ Cero backend nuevo, cero migraciones, cero mock. Sólo endpoints reales.
- 🛑 Etiquetas/ASN (sin endpoint) quedan en estado honesto + nota, no simuladas.
