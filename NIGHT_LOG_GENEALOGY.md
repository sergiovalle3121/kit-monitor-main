# NIGHT_LOG — GENEALOGY (Carril B2)

Módulo nuevo `genealogy`. Prefijo de tablas: `sf_`. Rama `claude/pensive-darwin-2z9jbm`.
Trazabilidad cuna-a-tumba grado automotriz. 100% aditivo (tablas nuevas + lógica
de derivación). No se tocó ninguna entidad/columna/endpoint existente.

---

## ▶ RETOMAR AQUÍ

- **Entregado y en verde (rebanada 1):** módulo `genealogy` completo — AS-BUILT por
  serie + WHERE-USED inverso (series **y embarques**) + índice aditivo
  `sf_genealogy_index` + tabla de embarques `sf_genealogy_shipment` + hooks de
  captura idempotentes + specs. Las 3 puertas backend en verde (build, 413 tests,
  **smoke de bootstrap contra Postgres**). No se tocó web (gate web N/A).
- **Siguiente hueco de MI área (deepening, sin salir del carril):**
  1. **Puente de lote desde el MES** (`mes_execution_events.lot` + `serial` ⋈
     `mes_execution_step_materials.part_number`): es la única fuente *viva* con
     lote. **OJO tenant:** las entidades MES NO tienen `tenant_id` (mundo legacy
     `DEFAULT_TENANT`). Unirlas al read path tenant-scoped es **delicado** (riesgo
     de fuga cross-tenant cuando se pueble multi-tenant). Plan tenant-safe:
     endpoint de backfill que lee MES y escribe links al índice **estampando el
     tenant del contexto** (vía `recordLink`), corrido por quien sabe que esos
     eventos MES son suyos. Mientras tanto el hook `recordLink` ya es la vía
     limpia para meter lote/reel a la genealogía. **Marcado para coordinación.**
  2. **Árbol multinivel (sub-ensambles):** la entidad ya tiene `parent_serial`;
     falta recursión en `asBuiltBySerial` (cuando una serie hija se consume en el
     padre, anidar su propio as-built). Necesita un campo `component_serial`
     limpio antes de recursar — no improvisado esta noche.
  3. **Cablear el terminal de operador → `recordLink`** cuando se escanee reel/lote
     al confirmar. Eso **toca `operator-terminal`** (otro módulo) → coordinar /
     supervisión; NO hacerlo en solitario (regla "solo tu módulo").

---

## El hueco que cierra esta rebanada (lo que anotó Materiales)

Hoy `floor-quality.whereUsed(part, serial?)` **exige `part`**: va part→series, pero
**no existe el inverso por serie** (dado un serial, ¿qué se consumió?). Además el
ledger de piso `sf_consumption_events` captura serie+NP+estación+operador+timestamp
pero **NO el lote/reel** del material consumido (lo confirmé leyendo la entidad y el
`OperatorTerminalService.confirm`). Tocar esa tabla para agregarle `lot`/`reel`
sería **modificar una entidad existente** → PROHIBIDO esta noche (tripwire). 

**Solución aditiva (sin tocar fuentes):** un índice nuevo `sf_genealogy_index` que
SÍ lleva lote/reel, poblado por evento vía el hook `recordLink` (la vía que el
terminal *puede* llamar al escanear un reel, cableada después como el stub SAP), y
un read path que **deriva en vivo** del `sf_consumption_events` (esqueleto:
NP/estación/operador/hora) y lo **enriquece** con el índice (lote/reel). Honesto:
cuando no hay lote capturado, el as-built marca `lotCaptureGap: true` y aun así
entrega la genealogía de NP/estación/operador/hora.

---

## Decisiones de diseño

- **Dos tablas aditivas prefijadas `sf_`:**
  - `sf_genealogy_index` — un eslabón = "la serie X consumió `qty` de NP P, lote/
    reel L/R, en `station` por `operator` a `consumed_at`". Idempotente
    (`idempotency_key` único). Extiende `TenantBaseEntity` (tenant-scoped).
  - `sf_genealogy_shipment` — serie → embarque (denormalizado: folio/ASN/cliente/
    destino) para el camino del recall. Idempotente. Tenant-scoped.
- **Sin tocar legacy:** se acopla **leyendo** `SfConsumptionEvent` (entidad), nunca
  su servicio ni su esquema. Referencias denormalizadas (strings/UUID), como el
  resto del piso (DECISIONS §12).
- **Anti doble-conteo:** un link del índice con `source_event_id` **supersede** al
  evento vivo correspondiente (match `sourceEventId::part`), así enriquecer un
  consumo con su lote no lo cuenta dos veces.
- **Filtro lote/reel excluye el ledger vivo** (no tiene esos campos) → resultados
  honestos: where-used-by-lot sólo resuelve sobre genealogía con lote capturado
  (índice / hook), que es justo lo que la red de captura debe poblar.
- **Tenant scope:** repos tenant-scoped + `applyScope` manual en los QueryBuilder
  (igual que floor-quality / operator-terminal). Spec anti-fuga incluido.
- **RBAC:** se agregó **aditivamente** el permiso `production:report` en `rbac.ts`
  (no existía; sí existía `quality:report`) a operator / production_supervisor /
  quality_engineer / plant_manager / planner, con blindaje en `rbac.spec.ts`. Es
  TS puro (no esquema) y sigue el precedente PRE-2. Admin lo hereda por la unión.

## Endpoints (`/genealogy`) — `@UseGuards(JwtAuthGuard, PermissionsGuard)`

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| GET | `as-built/by-serial/:serial` | `production:report` | Árbol AS-BUILT por serie (NP→lote/reel, operador/estación/hora). |
| GET | `where-used/by-lot?lot=&reel=&part=` | `quality:report` | Recall inverso: series **y embarques** que contienen un lote/reel. |
| GET | `links?serial=&part=&lot=` | `production:report` | Inspección del índice. |
| GET | `kpis` | `quality:report` | Cobertura: series/lotes/reels/embarques indexados. |
| POST | `links` | `production:report` | Registra un eslabón (hook aditivo, idempotente). |
| POST | `shipment-links` | `quality:report` | Liga serie→embarque (idempotente). |

## Archivos

- `apps/api/src/modules/genealogy/` — entities (2) · dto · `genealogy.derivation.ts`
  (lógica pura + spec) · service (+ spec integración) · controller · module.
- `apps/api/src/migrations/20260616000000-CreateGenealogy.ts` — aditiva, idempotente
  (`hasTable` guards), ambas tablas + índices.
- `apps/api/src/app.module.ts` — 1 import + 1 entrada (conflicto = aditivo).
- `apps/api/src/modules/auth/rbac.ts` + `rbac.spec.ts` — `production:report` aditivo.

## Puertas (obligatorias) — todas verdes

1. `npm run build` (API) ✅
2. `npm test` → **67 suites / 413 tests** ✅ (incluye 22 nuevos: derivación pura +
   integración sqlite + blindaje RBAC).
3. `npm run smoke:bootstrap` contra Postgres 16 efímero ✅ (esquema materializado
   limpio; ambas tablas `sf_genealogy_*` creadas con índices, sin colisión).
4. Web lint/tsc — N/A (no se tocó web).

## Tripwires respetados

- ⛔ NO se modificó/renombró/borró ninguna entidad ni columna existente.
- ⛔ NO se agregó columna a `sf_consumption_events` (cerrar el lote por ahí habría
  sido tocar esquema existente) — se resolvió con tabla nueva + hook.
- 🛑 El puente MES y el cableado del terminal de operador (tocan otros módulos /
  semántica cross-tenant) quedan **anotados para coordinación/supervisión**, no
  improvisados.
