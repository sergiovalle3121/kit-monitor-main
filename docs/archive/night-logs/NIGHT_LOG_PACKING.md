# NIGHT_LOG — EMPAQUE (EMS Shipping Suite · Fase 2a)

Segunda fase de la suite de embarques EMS. Rama `claude/bold-mccarthy-l97puw`.
**Unidades de manejo (tarima/caja) + SSCC (GS1) + etiqueta ZPL.** 100% aditivo:
módulo nuevo `packing` (referencia embarques por id, como genealogy). No toca
outbound/traffic/legacy.

---

## ▶ RETOMAR AQUÍ

- **Entregado y en verde (Fase 2a):**
  - Backend `packing`: `HandlingUnit` (tarima/caja/bulto) con **SSCC GS1** (18 díg.,
    check mod-10) + **etiqueta ZPL GS1-128** (AI 00). CRUD + soft-delete, contenido
    escaneable, label en ZPL crudo y JSON. Serial del SSCC vía numbering (`SSCC`),
    prefijo de compañía vía `GS1_COMPANY_PREFIX` (placeholder marcado honestamente).
  - Frontend `dashboard/packing`: crear/editar unidades, editor de contenido,
    badge "SSCC placeholder", y modal de etiqueta con ZPL + descarga `.zpl`.
- **Siguiente (Fase 2b):** **carga verificada por escaneo** (SSCC↔ASN) como
  poka-yoke duro: escanear unidades en el andén contra lo planeado y **bloquear el
  despacho** si no cuadra. Luego: anidar caja→tarima en UI, ASN a detalle/EDI 856,
  documentos (factura/packing/BOL/Carta Porte), cablear serial-scan→genealogy.

---

## Backend (apps/api/src/modules/packing)

- **`packing.sscc.ts`** (puro + spec): `buildSscc`, `ssccCheckDigit` (GS1 mod-10),
  `isValidSscc`, `normalizePrefix` (6–10 díg. y no todo-ceros = real; si no,
  placeholder). El SSCC es estructuralmente válido aun con placeholder.
- **`packing.zpl.ts`** (puro + spec): `ssccLabelZpl` → ZPL II 4"x6" @203dpi con
  GS1-128 (subset C + FNC1 + AI 00 + 18 díg.) + humano `(00) …` + ship-to/from/contenido.
- **`HandlingUnit`** (`packing_handling_units`, `TenantBaseEntity`): shipmentId/folio
  (denormalizado), sscc, ssccPlaceholder, type, parentId (anidado), status
  (OPEN/PACKED/LOADED), peso/dimensiones, **contents** (`simple-json`: portable
  SQLite+PG), ship-to/from/po, notes.
- **`packing.service.ts`**: tenant-scoped; SSCC vía `numbering.allocate('SSCC')` +
  `buildSscc`; CRUD, `regenerateSscc`, `label`.
- **`packing.controller.ts`** (`/packing`): CRUD + `regenerate-sscc` + `label`
  (JSON) + `label.zpl` (text/plain). Permisos `logistics:read`/`write`.
- **numbering.defaults**: `SSCC` (pattern `{SEQ}`, padding 9, NEVER). **app.module**:
  `PackingModule`. **Migración** aditiva `20260616150000-CreatePacking`.

## Frontend (apps/web/src/app/dashboard/packing — solo archivos nuevos)

- `page.tsx` autocontenido: lista de unidades (SSCC mono, tipo, estatus, contenido,
  placeholder), filtro por embarque, alta/edición con editor de líneas de contenido,
  y modal de etiqueta (ZPL + descarga `.zpl`, nota de Zebra/labelary).

## Puertas

1. API `npm run build` ✅
2. API `npm test` → **83 suites / 554 tests** ✅ (incluye SSCC y ZPL puros).
3. Web `tsc` ✅ · `eslint` ✅ · `next build` ✅ (`/dashboard/packing` prerenderizada).
4. Smoke de Postgres: en CI (tabla `packing_*` aditiva, tipos estándar + `text`).

## Tripwires / honestidad

- ⛔ Aditivo: módulo + tabla nuevos; cero cambios destructivos.
- 🛑 **SSCC con prefijo placeholder** se marca como tal (no se finge un prefijo GS1
  real); configurar `GS1_COMPANY_PREFIX` lo vuelve real.
- 🛑 La etiqueta es ZPL (texto) — imprime en Zebra; no se simula impresión.
- 🛑 Carga verificada por escaneo y documentos/ASN-detalle = Fase 2b+.
