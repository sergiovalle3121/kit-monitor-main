# AXOS OS — Decisiones de Arquitectura y Supuestos

Registro de decisiones tomadas durante el build autónomo (ADR ligero). Ante
ambigüedad se elige la opción más estándar (SAP / ISA-95 / convenciones del
repo), se registra aquí y se continúa.

---

## 1. Estrategia de ramas y despliegue (rieles de seguridad)

**Decisión:** Todo el desarrollo de esta sesión se realiza y se pushea en la
rama `claude/pensive-wright-cbkuE`. **No se hace auto-merge a `main`.**

**Motivo:** El entorno de ejecución indica explícitamente desarrollar en la rama
designada y no mergear a `main` ni abrir PRs sin permiso del usuario. Además,
cada merge a `main` despliega a producción en Railway corriendo migraciones en
vivo; un auto-merge no supervisado de decenas de módulos es de alto riesgo y
contradice el propio espíritu de los "rieles de seguridad" del brief (proteger
producción). El trabajo queda listo en la rama para revisión y merge por el
equipo; se puede abrir PR cuando se solicite explícitamente.

**ADENDA (2026-06-07):** el usuario otorgó autorización explícita y duradera para
**crear PR y mergear a `main` automáticamente por cada ítem que quede en verde**,
sin pedir confirmación entre ítems ("modo nocturno continuo"). A partir de aquí
el flujo por ítem es: rebanada vertical → puertas de calidad (build+test+lint
verdes, migración aditiva) → commit → push → PR → **merge (squash)** → siguiente.
Los rieles de seguridad siguen vigentes: nunca merge en rojo, solo migraciones
aditivas, jamás `migrate:run`/SQL contra prod. Si el entorno impidiera mergear,
se deja el PR abierto y se anota en `NIGHT_LOG`.

## 2. Migraciones: solo aditivas

**Decisión:** Solo se crean tablas nuevas, columnas NULLABLE o con default, e
índices. Prohibido DROP, rename con datos, narrowing de tipo, o NOT NULL sin
default en tablas con datos.

**Nota sobre `orm.options.ts`:** En producción (con `DATABASE_URL`), el repo usa
`synchronize: true` por defecto (bootstrap de esquema en Railway). Esto significa
que el esquema se materializa desde las entidades, no necesariamente desde las
migraciones. **No se toca esa lógica.** Como consecuencia, la disciplina
aditiva-only es doblemente importante: cualquier cambio de entidad se aplica solo
si es aditivo. Las entidades nuevas crean tablas nuevas; las columnas nuevas son
nullable/con default. No se ejecuta `migration:run` ni SQL contra ninguna base
remota.

## 3. Numeración de folios (T2)

**Decisión:** Servicio central `DocumentNumberingService` con una tabla
`document_sequences` (scoped por `tenant_id` + `plant_id` + tipo de documento).
Formato configurable con tokens (`{PREFIX}`, `{YYYY}`, `{YY}`, `{MM}`, `{SEQ}`),
relleno con ceros configurable, y política de reinicio (nunca / anual / mensual).
Incremento atómico vía `UPDATE ... RETURNING` (Postgres) con fallback
transaccional para SQLite (dev). Build-once / use-everywhere: cualquier módulo
(WO, PO, NCR, ASN, etc.) pide su folio a este servicio.

**Motivo:** El brief lo prioriza en Fase 0 (P0.8 / T2). Hoy la numeración es
ad-hoc por módulo; centralizarla evita colisiones y la hace configurable por
planta, como en SAP (rangos de números por sociedad/planta).

## 4. Mejora Continua / OpEx (Kaizen) — módulo nuevo

**Decisión:** módulo autocontenido `improvement` con entidad
`ImprovementInitiative`, máquina de estados pura
(DRAFT→IN_PROGRESS→IMPLEMENTED→VERIFIED→CLOSED + rework + CANCELLED) y captura de
ahorros estimado/realizado. Folios vía el servicio central de numeración
(`IMPROVEMENT` → `CI-…`).

**Supuestos:**
- **RBAC:** la captura de ideas (crear/editar/transicionar) queda abierta a
  cualquier usuario **autenticado** — un sistema de Kaizen/ideas es participativo
  por diseño. No se inventaron permisos que no existen en el seed; admin omite
  scope. Endurecer con permisos finos (p.ej. `OPEX_VERIFY` para VERIFIED/CLOSED)
  queda como mejora futura cuando exista el catálogo de permisos.
- **Dinero:** se modela como `float` (double precision) por portabilidad
  SQLite/PG y porque son montos de ahorro para reporting, no asientos contables.
  Si se requiere precisión contable, migrar a `decimal` con manejo string.

## 5. Wiring global de seguridad (SecurityModule) — HOTFIX de producción

**Síntoma:** prod caía al arrancar con `Nest can't resolve dependencies of the
PermissionsGuard (Reflector, ?). AuditService ... NumberingModule`.

**Causa raíz:** `PermissionsGuard` (usado como class-ref en `@UseGuards` en TODOS
los controllers) inyecta `AuditService`, que solo lo exporta `GovernanceModule`.
Los módulos existentes funcionaban porque importan `GovernanceModule`; los módulos
nuevos (numbering/improvement/ehs) no, así que Nest no podía construir el guard en
su contexto. `tsc` y los unit tests NO lo detectan; solo aparece al inicializar.

**Arreglo sistémico:** `src/common/security/security.module.ts` — `@Global()` que
PROVEE y EXPORTA `PermissionsGuard` y re-exporta `GovernanceModule` (para que
`AuditService` sea resoluble globalmente). Importado UNA vez en `AppModule`.
Resultado: cualquier controller, en cualquier módulo, puede usar
`@UseGuards(PermissionsGuard)` sin importar nada extra. Ya no se repite el fallo.

## 6. Puerta de calidad nueva: smoke de bootstrap (compilado, contra Postgres)

**Decisión:** antes de CADA merge: `build` + `unit tests` + **smoke de bootstrap**
verdes. El smoke vive en `apps/api/scripts/bootstrap-smoke.js`
(`npm run smoke:bootstrap`): hace `NestFactory.create(AppModule)` + `app.init()`
sobre el **dist compilado** contra una base **Postgres**, resolviendo proveedores
y guards de ruta — justo donde aparece este tipo de fallo de DI.

**Por qué compilado + Postgres y no un test Jest:** la app usa tipos de columna
solo-Postgres (`jsonb`, `enum`) y metadata de tipos por decorador; `ts-jest`
(con `isolatedModules`) NO emite la metadata igual que `nest build` (tsc), así que
un boot bajo Jest da fallos falsos (p.ej. `MaterialRequest.status` → "Object") y
ni siquiera llega a instanciar los guards. Correr el `dist/` real contra Postgres
refleja producción con fidelidad. (Pendiente de hygiene futura: portar `jsonb`/
`enum` hardcodeados a los helpers `JSON_COLUMN_TYPE`/un `ENUM_COLUMN_TYPE` para
que el path sqlite documentado funcione; es no-op en Postgres.)

## 7. Mantenimiento / TPM (CMMS) — módulo nuevo

**Decisión:** módulo `maintenance` con entidades `Asset` y `MaintenanceOrder`
(máquina de estados OPEN→IN_PROGRESS→COMPLETED + CANCELLED, folio MO- vía
numeración), KPIs CMMS (abiertas, vencidas, %PM, MTTR, downtime). RBAC: igual que
las otras áreas operativas nuevas, abierto a autenticados (admin omite scope).

## 8. Colisión de nombres de tabla con módulos legacy (lección del gate)

**Hallazgo:** el módulo nuevo `outbound` definía `@Entity('shipments')`, que choca
con la tabla `shipments` (PK integer) del módulo legacy `shipping` y su FK
`shipment_items.shipment_id`. El **smoke de bootstrap lo atrapó** (synchronize
falló: "incompatible types integer and uuid"); `tsc` y los unit tests (sqlite con
solo la entidad nueva) NO lo ven.

**Decisión / regla:** al crear módulos aditivos, **prefijar el nombre de tabla**
para no colisionar con tablas existentes (aquí `outbound_shipments`). Antes de
mergear, el smoke de bootstrap contra Postgres (que carga TODAS las entidades) es
la única puerta que detecta colisiones de tabla/índice y FKs incompatibles entre
módulos. Reforzado: el gate de bootstrap es obligatorio.

## 9. Por qué se "revirtieron" los fixes de seguridad (JWT + synchronize)

**Investigación:** el commit `9a1c69f` ("fix(security): no prod synchronize + remove
insecure JWT_SECRET fallback") **NO es ancestro de `main`**. Vive solo en la rama
`origin/claude/security-hardening`, que divergió de `main` en `df1ab24` y **nunca
se mergeó**. No fue un merge posterior que los pisó: simplemente esa rama de
hardening quedó abandonada/superada por otra línea de trabajo que se volvió `main`,
así que los fixes jamás aterventeon en la historia de `main` (el helper
`common/config/jwt-secret.ts` tampoco existía en `main`).

**Acción:** se re-aplican los fixes directamente sobre `main` (esta sesión), con
**blindaje de tests** para que una reversión silenciosa vuelva a fallar el gate.

## 10. JWT_SECRET sin fallback inseguro (re-aplicado + blindado)

**Decisión:** `common/config/jwt-secret.ts` → `getJwtSecret()`: devuelve
`JWT_SECRET` si existe y ≥16 chars; en dev/test devuelve un default explícito.
Usado en `auth.module.ts` y `strategies/jwt.strategy.ts` (se eliminó
`|| 'secretKey'`). **Blindaje:** `jwt-secret.spec.ts` escanea ambos archivos y
**falla** si reaparece cualquier patrón `JWT_SECRET || '...'`.

**ADENDA (revisión por incidente de prod):** la versión inicial **lanzaba Error**
en prod si faltaba el secreto ("que NO arranque"). En Railway `JWT_SECRET` nunca
estuvo seteado (prod corría con el fallback inseguro `'secretKey'`), así que el
guard tumbó prod en loop. Por decisión del usuario (disponibilidad > hard-fail) se
cambió a **arranque resiliente**: si falta/≤16 en prod, genera un secreto
**ALEATORIO una vez por proceso** + WARNING fuerte, en vez de crashear. Sigue
siendo seguro (aleatorio, NO es un literal hardcodeado; el test de blindaje sigue
válido) pero **rota en cada reinicio** (invalida sesiones) → conviene setear un
`JWT_SECRET` fijo en Railway para auth estable. El secreto generado se **cachea
por proceso** para que firmar (JwtModule) y verificar (JwtStrategy) usen el mismo.

## 11. Multi-tenencia real — `TenantScopedRepository` (P2)

**Decisión:** `common/tenant/tenant-scoped.repository.ts` — un `Repository` de
TypeORM que **inyecta automáticamente `WHERE tenant_id = <tenant del contexto>`**
en `find/findOne/findBy/findOneBy/count/findAndCount/exists`, leyendo el tenant de
`TenantContextService` (que viene del **JWT**, nunca del body). El aislamiento de
lecturas deja de depender de que cada servicio recuerde filtrar.

**Seguridad/compatibilidad (por qué es aditivo):**
- Si NO hay tenant en contexto (seed/sistema) o la entidad no tiene columna
  `tenant_id`, **no** agrega filtro → los flujos existentes (single-tenant/admin)
  no cambian. La adopción por módulo es incremental y segura.
- Arrays OR de `where` se scopean en cada rama (sin fuga).
- **Limitación:** los reads por `createQueryBuilder` NO pasan por estos métodos;
  para esos sigue el helper `withTenantScope()`. (Por eso `getOne(id)` que usa
  `findOne` queda protegido al adoptar el repo, pero los `list()` con QueryBuilder
  ya scopean manualmente.)

**Blindaje:** `tenant-scoped.repository.spec.ts` — test anti-fuga obligatorio en
el gate (2 tenants, mismo repo, 0 datos cruzados; findOne no alcanza a otro
tenant; sin contexto no filtra; entidad sin tenant_id no se filtra).

**Wiring NestJS:** `provideTenantScopedRepository(Entity)` +
`@Inject(getTenantRepositoryToken(Entity))`. Adopción por módulo en commits
gateados aparte (empezando por los sensibles).

## 12. Suite de Piso de Producción (Shop Floor) — bloques A–F + L

**Contexto:** el brief "edición Jabil" pide flujos reales de piso (disposición de
líneas, ejecución del operador, surtido/e-kanban, calidad/MRB, torre de línea) que
unifiquen áreas sobre el MISMO plan/WO/material/serie.

**Decisión — módulos nuevos, 100% aditivos, tablas PREFIJADAS `sf_`:**
- `line-engineering` (A): `sf_line_stations`, `sf_model_lines`.
- `production-plan` (B): `sf_work_orders` (reusa folio central `WORK_ORDER`).
- `material-staging` (C): `sf_staging`, `sf_replenish_calls`.
- `operator-terminal` (D): `sf_consumption_events` (idempotente), `sf_floor_events`.
- `floor-quality` (F): `sf_quality_holds` (reusa folio `NCR`).
- `line-control-tower` (L): sin tablas (agregador read-only).

**Acoplamiento por servicios, no por tablas (sin tocar legacy):** los módulos se
integran inyectando los servicios exportados (C→A,B; D→A,B,C,F,people; F→B; L→B,C,D,F).
Grafo sin ciclos. Las referencias a modelo/línea/WO/parte son **denormalizadas**
(strings/UUID) como el resto del repo (outbound/procurement). NO se modificó ningún
módulo, entidad, endpoint ni página existente — solo se extendió (RBAC, positions,
hub, Cmd-K de forma aditiva).

**Decisiones de dominio:**
- **Consumo configurable por WO:** `consumptionMode` BY_UNIT (1 Enter = 1 pza) vs
  BY_QTY_FACTOR (cantidad terminada × factor de uso). Backflush = unidades × factor.
- **Serie configurable por WO:** `serialControl` NONE (solo cantidad/lote) vs
  BY_UNIT (genealogía; exige serial al confirmar).
- **"Acceso":** el supervisor autoriza operadores a una WO (`authorizedOperators`);
  lista vacía = abierto a operadores certificados.
- **Skill gate pragmático:** una estación CON personas certificadas (people) solo
  corre con un operador certificado; una estación SIN certificaciones configuradas
  queda **no-gated** (el sistema es usable antes de poblar la matriz de skills).
- **FAI opt-in por WO** (`faiRequired`): el gate de primera pieza solo bloquea si la
  WO lo exige, para no bloquear el flujo del operador por defecto.
- **Hold bloquea consumo:** crear un hold sobre una WO baja `qualityClear=false`
  (el terminal del operador lo respeta y bloquea); cerrar el último hold libera.
- **SAP STUB:** `SapAdapter.postGoodsIssue261` es un stub idempotente (outbox
  `outboxStatus`); AXOS funciona standalone. El gancho está listo para implementar.
- **Idempotencia del backflush:** `sf_consumption_events.idempotency_key` único →
  un doble-tap/reintento no doble-cuenta.

**RBAC (PRE-2):** `auth/rbac.ts` es la ÚNICA fuente; se extendió aditivamente con
roles de piso (operator, materialist, industrial_engineer, mrb_member,
cycle_count_analyst, maintenance_tech, plant_manager) y permisos nuevos
(production:execute/authorize, planning:publish, materials:stage,
quality:hold/report/disposition, inventory:reconcile, maintenance:write). El
roles-seeder DB se alineó aditivamente (no es fuente de verdad). `rbac.spec.ts`
blinda las reglas (operator NO publica/autoriza; solo quality/mrb disponen; solo
quality pone hold).

## 13. Red de seguridad automática — CI en GitHub Actions (blindaje de prod)

**Síntoma/riesgo:** el único workflow era el agente DeepSeek. **No existía CI** que
corriera las puertas de calidad en cada PR. Las "4 puertas" (build/test/lint/smoke)
dependían 100% de ejecutarlas a mano, y **cada merge a `main` despliega a prod** —
nada impedía un merge en rojo.

**Decisión:** `.github/workflows/ci.yml` corre en **PR a `main`** y **push a `main`**.
Job único (instala una vez con `npm ci`, Node 20, `concurrency: cancel-in-progress`):

- **Puertas BLOQUEANTES** (verificadas en verde al crearlas):
  1. **Build API** (`apps/api`, `npm run build` = nest build/tsc).
  2. **Unit tests API** (`npm test` — 56 suites / 305 tests).
  3. **Lint web** (`apps/web` — 0 errores; solo warnings).
  4. **Build web** (`next build` — incluye typecheck).
  5. **Smoke de bootstrap** (`npm run smoke:bootstrap`) contra un **Postgres 16**
     levantado como *service container*. Es la puerta que materializa TODO el
     esquema (synchronize) y atrapa colisiones de tabla/FK/DI antes del merge —
     justo el riesgo que vuelve peligroso a `synchronize: true` (§14).

- **NO bloqueante:** **Lint API** (`continue-on-error: true`). Hoy arrastra ~2.9k
  hallazgos de formato (prettier, ~2.9k auto-corregibles + ~23 reales)
  **preexistentes**. Se reporta como señal pero no tumba el merge, para no mezclar
  un commit de formato masivo con el blindaje. **Deuda separada:** correr
  `npm run format` (prettier --write) + arreglar los ~23 reales, y luego quitar el
  `continue-on-error` para volverlo bloqueante.

**Nota Node:** Next 16 exige Node ≥ 20.9 (el README aún dice "18+", desactualizado).
El CI fija Node 20.

## 14. Tooling de migraciones arreglado + runbook del corte de `synchronize` (SUPERVISADO)

**Bug encontrado y arreglado (aditivo, bajo riesgo):** el script `typeorm` apuntaba a
`./node_modules/typeorm/cli.js`, que **no existe en este monorepo** — con npm
workspaces `typeorm` está *hoisted* a la raíz, así que `migration:generate` y
`migration:run` estaban **rotos** (`Cannot find module './cli.js'`). Cambiado a
`typeorm-ts-node-commonjs -d src/typeorm-cli.datasource.ts` (resuelve vía el `.bin`
hoisted; la API no usa path-aliases, así que no hace falta `tsconfig-paths`).
**Verificado:** ambos comandos ahora cargan y ejecutan.

**Hallazgo crítico (verificado, explica por qué sigue `synchronize: true`):**
`migration:run` contra una BD **fresca** FALLA en la 1ª migración
(`KitPlanSchemaUpdate20260401193000`: `ALTER TABLE "kits" ADD COLUMN …` →
`relation "kits" does not exist`). Las 43 migraciones son **parches incrementales**
sobre el esquema que `synchronize` materializa — **no construyen el esquema desde
cero**. ⇒ **NO se puede flipear `SYNCHRONIZE=false` y correr migraciones tal cual**;
fallaría al arranque. Además los timestamps mezclan formatos (epoch-ms `1713…` vs
`YYYYMMDDHHMMSS` `2026…`), lo que complica el orden de un baseline.

**Runbook del corte (REQUIERE DEPLOY SUPERVISADO POR SERGIO — no autónomo):**
1. **Congelar entidades** y generar baseline del esquema completo:
   `DATABASE_URL=<pg vacío> npm run migration:generate -- src/migrations/Baseline`.
2. **Ordenarlo primero** (timestamp menor que TODAS, p.ej. `0000000000000-Baseline`)
   y hacerlo **idempotente** (guard `if (await queryRunner.hasTable('users')) return;`
   al inicio del `up()`, estilo del repo) → en prod (esquema ya materializado) es
   no-op; en BD fresca crea las ~137 tablas y las 43 posteriores se auto-skipean.
3. **Reconciliar las 43 existentes**: confirmar que sus `hasTable`/`ADD COLUMN IF NOT
   EXISTS` las hacen no-op cuando el baseline ya creó todo (squash opcional a futuro).
4. **Probar en staging**: (a) BD fresca → `migration:run` construye todo; (b) copia
   restaurada de prod → `migration:run` es no-op y solo registra (bookmark).
5. **Corte en prod (supervisado):** desplegar con `SYNCHRONIZE=false` (+ `migrationsRun`
   ya corre con `isProd`); al arrancar, baseline+43 se registran sin alterar el esquema
   vivo; de ahí en adelante el esquema cambia **solo** por migraciones revisadas.

**Mitigación ya activa:** el **smoke de CI** (§13) corre `synchronize` sobre un PG
efímero en cada PR; atrapa el síntoma que más ha tumbado prod (colisiones de
esquema/DI al arranque) **antes** del merge, aunque el flip definitivo siga pendiente.

## 15. Núcleo ERP de manufactura — MM/BOM/Routing nuevos en paralelo (aditivo)

**Contexto:** el brief pide construir el núcleo que compita con SAP — Maestro de
Materiales + BOM multinivel + Routing — siendo **aditivo estricto**: tablas nuevas
prefijadas (`mm_`, `bom_`, `rt_`), sin tocar columnas de `bom_headers`,
`bom_components` ni `pm_product_models`, y **sin migrar/deprecar** lo viejo (el corte
lo hace Sergio, supervisado).

**Hallazgo (GREP previo):** YA existe `material_master` (módulo inventory) pero es
mínimo e inadecuado para EMS: **PK global `partNumber`** (varchar), **sin `tenant_id`**,
sin tipo de item / make-buy / AVL / alternantes / peso / ciclo de vida. Convertirlo
(agregar tenant a la PK, narrowing) sería un cambio **destructivo** prohibido por §2.

**Decisión:** se construye un **maestro NUEVO** `mm_material` (+ `mm_avl`,
`mm_material_alt`), tenant-scoped y rico (estilo SAP), como **fuente única de partes**
del BOM multinivel y el routing nuevos. El `material_master` legacy y el BOM plano
**siguen vivos en paralelo**. Es exactamente el precedente de `pm_product_models`
(maestro canónico que convive con los `model` de texto libre) — patrón ya probado en
este repo. Cuando Sergio decida el corte, se mapea/migra del legacy al nuevo bajo
supervisión.

**Forma:** entidades extienden `TenantBaseEntity` (UUID, `tenant_id`/`plant_id`,
`created_*`), tablas prefijadas, `DATE_COLUMN_TYPE` + `simple-json` (portable
sqlite/PG), folios vía `DocumentNumberingService` (docType `MATERIAL` → `MAT-#####`),
repos `provideTenantScopedRepository`, eventos al Event Ledger, máquina de estados
pura + spec. Migración aditiva idempotente (`hasTable`). Puerta obligatoria: smoke de
bootstrap contra Postgres (atrapa colisiones de tabla/FK/DI).

## 16. Suite de RH / Capital Humano — módulo nuevo (aditivo) + people analytics

**Contexto:** la pantalla `/dashboard/rh` solo contaba **usuarios del sistema**
(`governance/users`) y enlazaba a accesos/aprobaciones/organización. No existía el
trabajo real de un analista/generalista de RH (plantilla, rotación, ausentismo,
reclutamiento, desempeño) ni el cruce de datos de personas con la operación. El
módulo `people` existente cubre solo skills/certificaciones; `ehs`, seguridad.

**Hallazgo (hueco de fondo):** **no existía un "colaborador" como entidad** — RH
contaba cuentas de `user`, no personas con puesto/turno/centro de costo/antigüedad/
directo-indirecto. Sin ese maestro, ninguna métrica de RH es construible.

**Decisión — módulo nuevo `hr` (Capital Humano), 100% aditivo, tablas `hr_`:**
- `hr_employees` (backbone — el maestro de personal, análogo a cómo `mm_material`
  es el backbone de materiales; precedente §15). `hr_requisitions` + `hr_candidates`
  (adquisición de talento / ATS), `hr_performance_reviews` (9-box), `hr_absences`
  (asistencia). Todo denormalizado (sin FKs a users/org) como el resto del repo.
- **Por qué un maestro NUEVO y no reusar `users`:** un `user` es una credencial de
  acceso (RBAC), no una persona de nómina; mezclarlos acoplaría auth con RH y
  obligaría a narrowing destructivo (prohibido §2). Conviven en paralelo, igual
  que `pm_product_models`/`mm_material` conviven con sus equivalentes legacy.

**People analytics (el "Palantir" de RH):** la matemática vive en un módulo PURO
y testeado (`hr-analytics.ts` + spec): rotación anualizada, **rotación temprana
<90d** (la métrica cara en EMS), ausentismo, antigüedad, tramo de control, 9-box,
**flight-risk** explicable por colaborador y el cruce inter-dominio **STAFFING-RISK**
por área/turno (fusiona brecha de vacantes + rotación + ausentismo + cobertura de
skills de `PeopleService` → ¿habrá gente certificada para correr el plan?). Las
máquinas de estado (requisición/candidato/evaluación) también son puras + spec
(patrón `cert-status`/`incident-state`).

**Acoplamiento por servicios, no por tablas:** `HrModule` importa `PeopleModule` e
inyecta `PeopleService` (cobertura de skills por área) de forma `@Optional()`;
consume numeración central (`EMPLOYEE`→EMP-, `HR_REQUISITION`→VAC-,
`PERFORMANCE_REVIEW`→EVAL-) y Event Ledger (dominio SYSTEM). RBAC igual que
people/ehs: autenticado captura/lee, admin omite scope (RH es participativo).

**Frontend:** `/dashboard/rh` pasa a hub con KPIs reales (headcount/rotación/
ausentismo/vacantes) + 4 herramientas nuevas: Plantilla, Analítica de fuerza
laboral (cockpit), Reclutamiento (pipeline) y Desempeño/9-box. Registradas en
Cmd-K y el departamento "Personas y SST" habilitado en el alta de usuarios.

**Puertas verificadas:** API build + 691 unit tests (incl. 23 nuevos) + web build +
web lint (0 errores) + **smoke de bootstrap contra Postgres** (5 tablas `hr_`
materializadas sin colisión, DI/guards OK) + seed demo end-to-end (71 registros,
candado de dominio público limpio) + ejercicio de los 7 endpoints de analítica.

<!-- Nuevas decisiones se agregan al final con número incremental -->
