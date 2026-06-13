# NIGHT_LOG_TESTS — Bitácora de pruebas (Carril S6)

Bitácora dedicada al endurecimiento de la suite de `apps/api` y la cobertura.
**NO** se escribe en `NIGHT_LOG.md`. Solo se tocan archivos `apps/api/**/*.spec.ts`.

---

## ▶ RETOMAR AQUÍ (handoff)

- **Rama:** `claude/kind-ramanujan-khzgco` (se hizo `git merge origin/main` una vez
  para heredar el workflow de CI `#266`; mergeado limpio).
- **Estado de la suite:** **VERDE — 65 suites / 399 tests** (`npm test`). Antes de
  la sesión: 56 suites / 305 tests. +9 specs nuevos, +94 tests, 0 rojos, 0 skips.
- **Puertas de CI (ci.yml):** mis cambios son **solo `*.spec.ts`**; `tsconfig.build.json`
  excluye `**/*spec.ts`, así que build/web/smoke no se ven afectados. Solo influyo en
  el step de unit tests, que queda verde.
- **Siguiente (si se desea profundizar, opcional):** ver "Backlog de cobertura" abajo
  (métodos con `QueryRunner` en quality/inventory; controllers; servicios `tcode`/
  `roles-seeder` de auth, que son grandes).

---

## Sesión 2026-06-13 — Carril S6 (suite verde + cobertura)

### 1. Triaje de specs en rojo / `.skip`

- **La suite ya estaba 100% verde** al iniciar (56 suites / 305 tests, 0 fallos).
- **No hay tests saltados ni enfocados:** búsqueda de `xit`/`xdescribe`/`fit`/
  `fdescribe`/`it.skip`/`describe.skip`/`it.only`/`.todo` → **0 coincidencias reales**
  (el único match textual `fit:` en `messaging.service.ts:401` es una propiedad de
  objeto `{ fit: 'inside' }`, no un `fit()` de Jest).
- **Conclusión:** no hubo specs en rojo que arreglar ni código a corregir; **no se
  borró ningún test** ni se necesitó helper puro nuevo. El trabajo fue **aditivo**:
  agregar cobertura a los 5 módulos críticos.

### 2. Cobertura — antes / después (`npm run test:cov`)

**Global:**

| Métrica     | Antes  | Después | Δ      |
|-------------|--------|---------|--------|
| Statements  | 25.02% | 29.76%  | +4.74  |
| Branches    | 22.30% | 26.99%  | +4.69  |
| Functions   | 18.20% | 21.59%  | +3.39  |
| Lines       | 25.29% | 30.11%  | +4.82  |

**Los 5 módulos críticos (statements / lines / functions):**

| Módulo        | Antes (stmts) | Después (stmts) | Lines (desp.) | Fns (desp.) |
|---------------|---------------|-----------------|---------------|-------------|
| auth          | 11.7%         | **35.9%**       | 34.2%         | 17.3%       |
| inventory     | 16.3%         | **63.6%**       | 65.0%         | 33.3%       |
| plans         | 12.3%         | **44.8%**       | 45.5%         | 40.0%       |
| quality       | 10.6%         | **68.3%**       | 69.0%         | 39.6%       |
| event-ledger  | 58.6%         | **87.1%**       | 88.7%         | 87.5%       |

### 3. Specs añadidos (solo `*.spec.ts`, sin tocar entidades/migraciones/app.module)

- **auth** (`auth.service.spec.ts` +19, `services/authorization.service.spec.ts` +19):
  AuthService (validateUser con todas las ramas: credenciales, cuenta inactiva,
  override del owner, ciclo pending/rejected; login con shape del JWT; register y
  syncUser con derivación rol→permisos y normalización; approve/reject/list*).
  AuthorizationService (union/dedup de permisos, guardas 404, idempotencia de
  asignaciones rol-permiso/rol-usuario).
- **inventory** (`inventory.service.spec.ts` +8, `warehouse.service.spec.ts` +7,
  `replenishment.service.spec.ts` +5): `recordTransaction` (material 404+rollback,
  candado de stock insuficiente=excepción HIGH, candado de estado no-available=
  CRITICAL, RECEIVE y TRANSFER felices) y `ensureMaterial`; ciclo de tareas de
  almacén (folio, candados start/complete, short-pick); análisis de reabasto
  (OUT_OF_STOCK/BELOW_MIN/ninguna + auto-tarea).
- **plans** (`plans.service.spec.ts` +8): inteligencia de programación (carga por
  línea + umbrales + división por capacidad 0 + backlog + riesgos critical),
  serialización/404 de findOne, generación de folio de WO, candados de borrado.
- **quality** (`quality.service.spec.ts` +22): checkIsHeld (niveles), motor de CAPA,
  dispositions (propose/approve), transfers de cuarentena (candado de estado +
  movimiento físico + sello quarantine), IQC (PASS libera stock; CONDITIONAL no-op),
  y **createHold/releaseHold** con QueryRunner simulado (bloqueo/liberación de
  posiciones + rollback ante fallo de persistencia).
- **event-ledger** (`event-ledger.service.spec.ts` +4, `event-ledger.controller.spec.ts`
  +2): alta de eventos con defaults de blobs JSON, getEventsByReference (filtro +
  orden DESC), rethrow ante fallo; controller (normaliza tipo a MAYÚSCULAS, delega WO).

### 4. Decisiones de enfoque (por qué mock-first y no SQLite en memoria en todos)

- **event-ledger** usa SQLite en memoria (patrón del repo): su entidad usa el helper
  `JSON_COLUMN_TYPE` (→ `simple-json` en tests, donde no hay `DATABASE_URL`), así que
  sincroniza limpio. `getEventsByWorkOrder` usa el operador JSON `->>` de Postgres
  (no portable a SQLite) → se cubre vía el controller con servicio simulado.
- **plans** y **quality (final-inspection)** **hardcodean `type: 'jsonb'`** en sus
  entidades (deuda de higiene §6 de `DECISIONS.md`), que **rompe el `synchronize` de
  SQLite**. → se testean con **repos simulados** (sin DataSource).
- **inventory** no usa SQLite porque `InventoryPosition` arrastra todo el grafo de
  `enterprise-campus` (`EnterpriseWarehouse`→`EnterpriseBuilding`→programas…) y un
  patrón de columna dual `part_number`; verificado con un spike que falla el
  `synchronize`. `recordTransaction` se cubre **simulando el `QueryRunner`**.
- **Nota ts-jest:** correr un spec **recién creado de forma aislada** puede caer a
  babel-jest por una carrera de warmup (falso "Missing semicolon" en anotaciones de
  tipo). **No afecta `npm test`** (todo corre junto) ni a CI; se valida corriendo en
  grupo.

### 5. Backlog de cobertura (opcional, mismo carril)

- Métodos con `QueryRunner` aún sin test: `quality.executeDisposition/
  recordFinalInspection` (simular runner como en inventory; createHold/releaseHold
  ya cubiertos).
- Controllers de auth/inventory/plans/quality (delegación + guards).
- `auth/services/tcode.service.ts` (1299 líneas) y `roles-seeder.service.ts` — grandes;
  alto potencial de cobertura con tests dirigidos.
