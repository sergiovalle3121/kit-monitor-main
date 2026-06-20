# AXOS OS — Night Log · SEED / PURGA LEGAL (dominio público)

Bitácora de la sesión de **datos** (no esquema): purgar datos de cliente real
filtrados y enriquecer el seed de dominio público. Rama
`claude/magical-bohr-dctcnn`. Trabajo **SUPERVISADO** — borrar datos de prod es
sensible; todo en 2 pasos (DRY-RUN → `--apply`) y nunca se borra sin OK explícito.

---

## ▶ RETOMAR AQUÍ (handoff)

- **FASE 1 (purga legal) — COMPLETA y validada.** Auditoría + purga
  (borra/anonimiza) + guard endurecido. Validada `--apply` end-to-end en el
  Postgres efímero desechable (11 borradas + 1 anonimizada → 0). **La purga contra
  PROD la corre el owner** (este entorno no tiene `DATABASE_URL` de prod).
- **FASE 2 (enriquecer seed) — EN CURSO.**
  - **2a ✅ DONE**: 91 partes (con AVL fabricante+MPN ficticio), 12 proveedores, 105
    precios de proveedor. Idempotente; legal-lock post-seed verde.
  - **2b ✅ DONE**: 8 modelos (4 nuevos con BOM MULTINIVEL real: ensamble final→PCBA→
    sub-módulo, 3 niveles en AX-MOTOR-500), 5 sub-ensambles (PCBAs + etapa de
    potencia) registrados como materiales con costo = rollup. Golden path 28/28.
  - **2c (siguiente)**: WOs (sf_work_orders) en varios estados + historia
    (avances/holds/downtime) para que planeación/operador/almacén tengan qué mostrar.

---

## 2026-06-20 — FASE 1: Purga de datos prohibidos (auditoría + purga + guard)

> Objetivo legal: la app SÓLO puede contener datos ficticios del universo AXOS.
> Hay (en prod) datos de cliente real filtrados — partes con prefijo `OP-` (cliente
> "Optics") y nombres de empresas reales — en requisiciones, órdenes, BOMs, etc.
> Deben salir. Se **reusa el detector que YA existe** (`findForbiddenReason` /
> `isForbiddenValue` del guard, con `FORBIDDEN_PREFIXES` + `REAL_COMPANY_BLACKLIST`).

### Decisión de diseño — escáner **metadata-driven** (motor compartido)
El purge histórico (`seed-purge-clients.ts`) sólo cubría ~11 tablas del núcleo
(materials, models, BOMs, plans, kits, inventario, enterprise). El brief pide cubrir
**TODAS** (requisiciones, POs, embarques, RMA, CRM, genealogía, sf_*, ERP…). En vez
de enumerar a mano ~50 tablas y sus columnas (frágil — el repo mezcla camelCase y
snake_case según el módulo), el nuevo motor recorre `dataSource.entityMetadatas` y
**auto-descubre** cada columna de texto / arreglo / JSON, aplicando el detector legal
existente. Cubre por construcción cualquier tabla con campos de
parte/modelo/cliente/programa/proveedor, sin hardcodear nombres.

### [Paso 1] Auditoría DRY-RUN — `seed/seed-audit-forbidden.ts` + `seed/forbidden-scan.ts`
- **`forbidden-scan.ts`** (motor compartido, SÓLO LECTURA): `scanForbidden(ds)` recorre
  todas las entidades reales (omite vistas/junctions), clasifica columnas
  (texto/`simple-array`/`json|jsonb|simple-json`), y marca cada fila cuyo valor da
  `findForbiddenReason ≠ null`. Devuelve hallazgos por tabla (conteo + ejemplos +
  PK + campo + motivo), totales y desglose por motivo. `formatScanReport()` arma el
  reporte legible. `DEFAULT_SKIP_COLUMNS` excluye texto libre fuera de alcance (chat,
  payloads de auditoría) — configurable.
- **`seed-audit-forbidden.ts`** (CLI, `npm run seed:audit-forbidden`): arranca el
  contexto, escanea y **reporta por tabla**. Flags: `--strict` (exit 1 si hay
  hallazgos, útil en CI) y `--json`. **Nunca borra ni modifica.**
- **Reporte de demostración** (Postgres efímero: seed demo limpio + 12 filas
  prohibidas inyectadas a mano simulando la fuga real):

  ```
  Tablas con datos prohibidos: 12   ·   Filas afectadas: 12
  ▶ plans                      model="OP-DEVICE-900"            → prefijo OP-
  ▶ material_master            description="…para … Optics"     → empresa "optics"
  ▶ bom_components             componentNumber="OP-COMP-001"    → prefijo OP-
  ▶ bom_headers                description="BOM para … Motorola"→ empresa "motorola"
  ▶ purchase_orders            folio="OP-PO-0001" (+supplier)   → prefijo OP-
  ▶ outbound_shipments         folio="OP-SHP-0001" (+customer)  → prefijo OP-
  ▶ inbound_receipts           folio="OP-RCV-0001" (+2 campos)  → prefijo OP-
  ▶ crm_opportunities          folio="OP-OPP-0001" (+customer)  → prefijo OP-
  ▶ rma_cases                  folio="OP-RMA-0001" (+customer)  → prefijo OP-
  ▶ inventory_movements        reason="…material Optics"        → empresa "optics"
  ▶ pm_product_models          customer="Optics"                → empresa "optics"
  ▶ erp_purchase_requisitions  prNumber="OP-PR-0077" (+part)    → prefijo OP-
  Desglose: 10× OP-  ·  5× optics  ·  2× motorola  ·  1× cisco  ·  1× nvidia
  Resumen: 146 tablas revisadas · 424 filas leídas · 12 prohibidas · 0 errores.
  ```
  (En PROD los conteos serán mayores; el formato es idéntico.)

### [Paso 2] Purga FK-safe detrás de `--apply` — `seed/seed-purge-clients.ts` (reescrito)
- **DRY-RUN por defecto** (igual que antes); borra de verdad SÓLO con `--apply`
  (alias retro-compatible: `PURGE_CONFIRM=true`). Detección por el **motor compartido**
  (un solo detector).
- Borrado en tres planos respetando FKs:
  1. **Cascada CURADA del núcleo** (FKs reales): plan→kit→materiales/dependientes,
     header→componentes (cascade), modelos, inventario (movs/posiciones→material),
     programas→clientes.
  2. **Barrido COMPRENSIVO** del resto (POs, requisiciones, embarques, RMA, CRM…) con
     **pasadas de reintento** por si hubiera FKs.
  3. **ANONIMIZACIÓN de respaldo** (`scrubForbidden`): si una fila NO se puede borrar
     porque un dato **legítimo** la referencia por FK (p. ej. un material cuya
     `description` menciona un cliente real, pero con posiciones de inventario
     válidas), se **scrubea el texto prohibido en sitio** (empresa real→`[REDACTED]`;
     identificador con prefijo→`[REDACTED]`), conservando la fila y la integridad. La
     PK nunca se toca. Opt-out: `NO_ANONYMIZE=true`. Garantiza que el texto de cliente
     real **siempre** desaparezca.
  4. **Verificación post-purga**: re-escanea y confirma **0 restantes**; lo único que
     se reporta como "pendiente manual" es lo que de verdad siga prohibido.
- **Validado `--apply` end-to-end en el Postgres efímero desechable** (con OK del
  owner; NO es prod — este entorno no tiene `DATABASE_URL` de prod): de 12 filas
  inyectadas → **11 borradas + 1 anonimizada** (`material_master RES-1K-0402` quedó
  como `"Resistencia para programa [REDACTED]"`, con su inventario intacto) →
  **post-purga 0** → 2ª corrida **idempotente** ("Nada que purgar"). Hallazgo clave:
  el caso FK-bloqueado real (texto contaminado en fila legítima) lo resolvió la
  anonimización, no el borrado — por eso se validó en local antes de prod.

### [Paso 3] Endurecer el guard — rechazo ruidoso en arranque/seed
- `forbidden-scan.ts` → `assertDatabasePublicDomain(ds)`: **LANZA** con resumen si hay
  cualquier fila prohibida.
- **Seed** (`seed-demo.ts`): tras sembrar, corre la aserción → un seed **nunca** puede
  dejar datos prohibidos (escape: `SKIP_PUBLIC_DOMAIN_ASSERT=true`). Verificado: el
  seed demo limpio imprime "Candado dominio público (post-seed): base limpia ✔".
- **Arranque** (`main.ts`): chequeo **opt-in** `checkPublicDomainAtStartup` — sólo con
  `CHECK_PUBLIC_DOMAIN=true` (escanear toda la base en cada boot es caro). Reporta
  ruidosamente; aborta el arranque sólo con `STRICT_PUBLIC_DOMAIN=true`. **Default =
  no-op** para no arriesgar la disponibilidad de prod (ver DECISIONS §10).

### Puertas de calidad (todas verdes)
- **Build** API (`npm run build` / nest build) ✔
- **Unit tests**: 84 suites / **561 tests** ✔ (nuevo `forbidden-scan.spec.ts`: sqlite en
  memoria, prueba detección en texto/JSON/arreglo, `scanJson`/`skipColumns`, y que la
  aserción lanza/no-lanza).
- **Bootstrap smoke** (Postgres efímero) ✔
- Migraciones: **ninguna** (esto es de DATOS, no de esquema; cero cambios de entidad).

### Archivos
- NUEVO `apps/api/src/seed/forbidden-scan.ts` (motor compartido)
- NUEVO `apps/api/src/seed/seed-audit-forbidden.ts` (CLI auditoría, paso 1)
- NUEVO `apps/api/src/seed/forbidden-scan.spec.ts` (spec)
- REESCRITO `apps/api/src/seed/seed-purge-clients.ts` (paso 2, comprensivo + `--apply`)
- `apps/api/src/seed/seed-demo.ts` (aserción post-seed, paso 3)
- `apps/api/src/main.ts` (chequeo opt-in de arranque, paso 3)
- `apps/api/package.json` (script `seed:audit-forbidden`)

### Cómo lo corre el owner (contra PROD, supervisado)
```
# 1) Reporte (no borra):
DATABASE_URL=<prod> npm run seed:audit-forbidden
# 2) Preview de la purga (no borra):
DATABASE_URL=<prod> npm run seed:purge-clients
# 3) SÓLO tras revisar el reporte y dar OK — borra de verdad:
DATABASE_URL=<prod> npm run seed:purge-clients -- --apply
```

### PENDIENTE
- **OK del owner** para `--apply` contra prod.
- **FASE 2 — enriquecer `seed-constants.ts`** (tras la purga): catálogo ficticio rico
  (6–10 modelos, BOMs multinivel, 60–100 partes con AVL, WOs en varios estados +
  historia, proveedores + precios), todo validado por `validateDemoCatalog()`. **No
  iniciada** (espera OK).

### Notas
- `pg` emite un `DeprecationWarning` cosmético ("client already executing a query")
  durante el escaneo; 0 errores de lectura y conteos correctos — benigno.
