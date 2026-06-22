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

## 17. CIDE — IA propia self-hosted (reemplaza Anthropic Claude + agente DeepSeek)

**Contexto.** El asistente de la app ("Axos Copilot") dependía de **Anthropic
Claude** por API: una llave de plataforma (`ANTHROPIC_API_KEY`) y/o una llave
**BYO** por organización (la cuenta Claude del dueño), facturadas por token. En
paralelo existía un **agente DeepSeek** de desarrollo (GitHub Action
`/deepseek` → PR) que llamaba a la API de DeepSeek. Objetivo del salto: que Axos
OS tenga su **propia IA**, llamada **CIDE** (Cognitive Intelligence & Decision
Engine), sobre un modelo **open-source** que corre en infraestructura propia, sin
proveedor externo y con control total del dato.

**Decisión.**
- **Proveedor desacoplado y self-hosted.** Nuevo `cide-provider.ts`: cliente
  **compatible-OpenAI** basado en `fetch` nativo (sin dependencias nuevas) que
  habla con un motor de inferencia que el operador controla (Ollama por defecto;
  vLLM/llama.cpp/TGI intercambiables). Cambiar de motor = cambiar
  `CIDE_BASE_URL`; **cero cambios de código**.
- **Modelos open-source permisivos.** Catálogo en `ai-pricing.ts` = **Qwen2.5**
  (`7b`/`14b`/`32b`) y **Mistral 7B**, todos **Apache-2.0** (cumple
  THIRD_PARTY_NOTICES). Default `qwen2.5:7b` (corre en CPU). Costo por token =
  **$0** (cómputo propio); el "presupuesto mensual" pasa a ser **guardia de
  capacidad**, no de gasto.
- **Se elimina la dependencia de cuentas personales.** Fuera el SDK
  `@anthropic-ai/sdk`, la llave BYO (UI + cifrado `ai-crypto.ts`) y
  `ANTHROPIC_API_KEY`. Las columnas `byo*` de `ai_tenant_config` se **conservan
  sin usar** (regla aditiva §2; no se hace DROP).
- **Se elimina el agente DeepSeek.** Borrados `.github/workflows/deepseek-agent.yml`,
  `.github/scripts/deepseek_agent.py` y `requirements.txt`. El secret
  `DEEPSEEK_API_KEY` queda obsoleto (puede retirarse de GitHub).
- **Semilla analítica (tipo Palantir/MicroStrategy).** CIDE deja de ser solo
  lookup: nuevas herramientas read-only sobre el **Event Ledger** —
  `operations_pulse` (agregación de actividad por dominio/acción/línea en una
  ventana) y `ledger_trace` (trazabilidad cuna-a-tumba por WO o entidad)— vía el
  nuevo `EventLedgerService.summarizeActivity()`. Todo sigue filtrado por RBAC.
- **Infra incluida.** `infra/cide/docker-compose.yml` levanta Ollama
  (compatible-OpenAI en `:11434/v1`); los **pesos se descargan en el deploy**, no
  se commitean a git.

**Variables nuevas:** `CIDE_BASE_URL` (default `http://localhost:11434/v1`),
`CIDE_API_KEY` (opcional). Se retiran `ANTHROPIC_API_KEY` y `AI_KEY_SECRET`.

**Verificación:** build API ✓, build web ✓, lint web ✓, **668/668** pruebas
unitarias del API ✓.

**Pendiente (fases siguientes del salto):** capa semántica/ontología y catálogo
de métricas versionadas sobre el ledger; analítica conversacional con
tablas/gráficas y narrativa; workbench exploratorio; *what-if* / simulación
ligados a `decision-intelligence` + `autopilot`.

## 18. Capa semántica — catálogo de métricas versionadas + ontología (Fase 2 CIDE)

**Contexto.** Para el salto a software de análisis de decisiones (estilo
Palantir/MicroStrategy) falta una **capa semántica**: una sola fuente de verdad
de *qué* se mide y *qué objetos* tiene el negocio, que la UI y CIDE compartan
(evita métricas inconsistentes entre pantallas).

**Decisión.** Nuevo módulo `semantic` (aditivo), con tres entidades prefijadas
`sem_` (sin FKs, tipos portables) para no chocar con el smoke de bootstrap (§8):
- `sem_metric_definition` — **catálogo de métricas versionado** (key, nombre,
  unidad, dominio, grain, fórmula, `direction`, `version`, `resolver`). Editar
  una definición **incrementa la versión** (auditoría de *metric drift*).
- `sem_ontology_object` — **object types** de la ontología (WorkOrder, Material,
  Supplier, BOM, QualityHold, Customer, LedgerEvent) mapeados a su `sourceEntity`.
- `sem_ontology_link` — **link types** (p. ej. WorkOrder —consume→ Material).

`SemanticService` siembra un baseline **idempotente por tenant** en el primer
acceso (sin migración/seed manual) y resuelve **valores en vivo** vía un registro
de *resolvers* que delega en servicios ya existentes (inventoryValuation, holds de
calidad, SOs, proveedores, corridas MRP, pulso del ledger), **filtrado por RBAC**
(cada métrica declara su permiso; admin lo omite).

- **Visible en la app:** nueva pantalla `/dashboard/intelligence` ("Centro de
  Inteligencia") enlazada en el hub (sección *Control e inteligencia*): tarjetas
  de métricas con valor en vivo + ontología (objetos y relaciones).
- **CIDE conectado:** nuevas herramientas read-only `list_metrics` y
  `metric_value` para que la IA responda con las mismas métricas gobernadas.
- **Endpoints** (`/api/semantic`, JWT): `GET /catalog`, `GET /values`,
  `GET /metrics/:key/value`, `POST /metrics` (admin, upsert).

**Verificación:** build API ✓, build web ✓, lint web ✓, **668/668** tests ✓. El
smoke de bootstrap (Postgres efímero) materializa las tablas `sem_*` en CI.

**Pendiente (Fase 3+):** analítica conversacional con tablas/gráficas y narrativa
generada; *drill-down* por objeto; *what-if*/simulación ligados a
`decision-intelligence` + `autopilot`; editor de ontología en la UI.

## 19. Analítica conversacional + dashboard visual (Fase 3 CIDE)

**Contexto.** Con la capa semántica (§18) ya había métricas y ontología, pero CIDE
solo devolvía texto y el Centro de Inteligencia no mostraba *evolución*. Para el
salto tipo Palantir/MicroStrategy faltaba **analítica en el tiempo, visual y
narrada**, compartida entre la UI y la IA.

**Decisión.** Nuevo módulo `analytics` (aditivo, read-only, **sin entidades
nuevas** — compone datos existentes):
- `EventLedgerService.dailyActivity()` — serie diaria de eventos (buckets
  zero-padded; agregación en JS para ser portable sqlite/PG).
- `AnalyticsService` — `ledgerTrend` (serie + variación semana-contra-semana +
  **narrativa determinista**, no-LLM, para que UI y chat lean igual) y
  `domainBreakdown` (actividad por dominio + narrativa). Endpoints
  `/api/analytics/ledger-trend` y `/api/analytics/domain-breakdown` (JWT,
  agregado → cualquier usuario).
- **CIDE conectado:** nueva herramienta read-only `analyze_trend` para responder
  preguntas de evolución ("¿subió o bajó…?") con datos reales y narrarlos.
- **Visible en la app:** el Centro de Inteligencia (`/dashboard/intelligence`)
  gana una sección **"Pulso operacional"** con narrativa + **gráficas Recharts**
  (área de tendencia diaria + barras por dominio). Tooltip propio en Tailwind
  para legibilidad en modo oscuro (lección §"recharts dark").

**Verificación:** build API ✓, build web ✓, lint web (0 errores) ✓, **697/697**
tests ✓. Sin tablas nuevas → el smoke de bootstrap no cambia de superficie.

**Pendiente (Fase 4):** *drill-down* navegable por objeto de la ontología;
*what-if*/simulación ligados a `decision-intelligence` + `autopilot`; narrativa
generada por CIDE embebida como tarjetas en el chat; editor de métricas/ontología
en la UI.

## 20. Drill-down por objeto + simulador what-if (Fase 4 CIDE)

**Contexto.** La ontología (§18) definía objetos pero no eran explorables, y la
analítica (§19) no permitía *proyectar* ni preguntar "¿qué pasaría si…?". Faltaba
el explorador centrado-en-objeto (estilo Palantir) y la simulación de decisiones.

**Decisión.** Se extiende el módulo `analytics` (sin entidades nuevas):
- **Drill-down (`objectInsight`)** — dado un objeto de la ontología, compone su
  actividad real (pulso + tendencia de su dominio vía el ledger), sus métricas
  relacionadas (valores **RBAC-gated**), sus vínculos (grafo) y una muestra de
  entidades recientes del ledger. `SemanticService` gana `getObject`, `linksFor`
  y `metricsForDomain`.
- **What-if (`project`)** — ajuste lineal por mínimos cuadrados sobre la actividad
  diaria reciente, proyectada a un horizonte con una **palanca hipotética**
  (`adjustmentPct`). Honesto y transparente: el usuario controla la palanca y se
  muestra la matemática; reutilizable para cualquier serie diaria futura.
- **Endpoints:** `GET /api/analytics/object/:key` y `GET /api/analytics/project`.
- **CIDE conectado:** herramientas `object_insight` y `simulate_projection` (la IA
  ya razona escenarios y explora objetos con datos reales).
- **Visible en la app:** nueva ruta navegable `/dashboard/intelligence/object/[key]`
  (pulso, tendencia, **simulador what-if** con slider + gráfica histórico/proyección,
  métricas relacionadas, relaciones navegables y entidades). Las tarjetas de objeto
  del Centro de Inteligencia ahora enlazan al drill-down.

**Nota de acoplamiento.** El what-if se basó en la serie real del Event Ledger (no
en `decision-intelligence`/`autopilot`) para entregar una simulación honesta y
autocontenida sin tocar esos módulos; integrarlos (Monte Carlo, propuestas
correctivas) queda para una iteración siguiente.

**Verificación:** build API ✓, build web ✓, lint web (0 errores) ✓, **697/697**
tests ✓. Sin tablas nuevas → el smoke de bootstrap no cambia de superficie.

**Pendiente (Fase 5):** integrar el what-if con Monte Carlo de
`decision-intelligence` + propuestas de `autopilot`; tarjetas de análisis con
mini-gráficas embebidas en el chat de CIDE; editor de métricas/ontología en la UI.

## 21. Tarjetas de análisis en el chat de CIDE (Fase 5)

**Contexto.** CIDE respondía solo texto; las herramientas analíticas (Fases 2–4)
devuelven datos estructurados que quedaban "planos" en el chat. Para un asistente
de análisis de datos faltaba **mostrar el dato** (KPI, sparkline, barras) inline.

**Decisión.** Construcción de tarjetas **server-side y determinista** — el modelo
elige las herramientas, pero la *tarjeta* se arma del **resultado real** de la
herramienta, no de texto del modelo (cero alucinación de cifras):
- `ai-cards.ts` — `buildCard(tool, out)` mapea salidas a una unión tipada
  `CideCard` (`metric` | `line` | `bars`): `analyze_trend`/`object_insight` →
  sparkline; `simulate_projection` → histórico + proyección punteada;
  `metric_value`/`inventory_valuation` → KPI; `operations_pulse` → barras por
  dominio. `collectCards` dedupe + tope (3).
- `ai.service` captura las salidas de las tools en `runCide` **y** `runMock`
  (así las tarjetas también se ven en modo demo, sin motor) y las devuelve en la
  respuesta del chat (`cards`). Efímeras: solo del turno en vivo, no se persisten.
- **Frontend (`Cide.tsx`):** render de tarjetas bajo la respuesta, con
  **sparklines en SVG inline** y barras en CSS — **sin meter una librería de
  charts al bundle global** del widget (que está montado en todo el dashboard).

**Verificación:** build API ✓, build web ✓, lint web (0 errores) ✓, **697/697**
tests ✓. Sin entidades nuevas; el smoke no cambia de superficie.

**Pendiente (Fase 6):** integrar el what-if con el Monte Carlo de
`decision-intelligence` + propuestas de `autopilot`; editor de métricas/ontología
en la UI; persistir tarjetas en el historial de conversación.

## 22. What-if Monte Carlo + acciones de Autopilot/Decision-Intelligence (Fase 6)

**Contexto.** El what-if (§20) era una proyección lineal de un solo trazo, sin
incertidumbre, y el Centro de Inteligencia no surfaceaba las **acciones** que el
sistema ya recomienda (`autopilot`) ni los **escenarios** de planeación
(`decision-intelligence`).

**Decisión.**
- **Monte Carlo en el what-if.** `AnalyticsService.project` ahora corre una
  simulación autocontenida (300 paths) por **bootstrap de los deltas diarios** de
  la serie real → bandas **P10/P50/P90** por día de horizonte; la palanca (`adj`)
  desplaza el *drift* y el ruido histórico se preserva. *Por qué propio y no el
  `MonteCarloService` de decision-intelligence:* ese MC es específico de un
  `PlanScenario` (necesita `scenarioId` + entidades); para la serie de actividad
  se usa el mismo método estadístico (resampleo + percentiles) sin acoplar.
- **Integración por lectura de los módulos de decisión existentes.** CIDE gana
  `autopilot_proposals` (acciones correctivas de `AutopilotService.listProposals`)
  y `decision_scenarios` (`DecisionIntelligenceService.listPlanScenarios`). Nueva
  tarjeta de chat tipo `actions` (lista priorizada por severidad).
- **Visible en la app:**
  - El simulador what-if del objeto grafica la **banda P10–P90** + **P50** (Monte
    Carlo) además del histórico, con leyenda y nº de simulaciones.
  - El Centro de Inteligencia añade **"Acciones sugeridas"** leyendo
    `GET /api/autopilot/proposals?status=pending` (tarjetas con severidad).

**Verificación:** build API ✓, build web ✓, lint web (0 errores) ✓, **697/697**
tests ✓. Sin entidades nuevas; el smoke no cambia de superficie.

**Pendiente (Fase 7):** ejecutar propuestas de autopilot desde el Centro de
Inteligencia (acción, no solo lectura); editor de métricas/ontología en la UI;
persistir tarjetas en el historial; conectar el what-if a `runStressTest` cuando
exista un PlanScenario asociado.
## 23. Kit "Workspace Industrial" (primitivos de UI) + Legal de referencia

**Contexto.** Conviven módulos profundos (operador, planning, quality/holds) y
módulos austeros que se sienten como "un + y unos campos". Causa estructural: no
había primitivos de UI compartidos para datos — `components/ui/` solo tenía
`ConfirmDialog`, `HoverArrow`, `IconTile`, `PageHeader`, `AuroraBackground`. Cada
página profunda rodó su propia tabla/filtros/KPIs a mano (p.ej. `quality.ui` con
`Empty/Field/Kpi/Modal`). Resultado: duplicación + austeridad.

**Decisión.** Construir **una vez** un kit reutilizable en
`apps/web/src/components/workspace/` y aplicarlo a Legal como implementación de
referencia, **sin tocar backend** (solo se consume lo que `/legal` ya expone):

- **Primitivos genéricos** (no acoplados a Legal): `EmptyState`, `DataTable<T>`,
  `FilterBar`, `DetailDrawer` (+ `DrawerSection`/`DrawerField`), `ExportButton<T>`,
  `StatCard`/`KpiRow`, `Toolbar`. Reutilizan `IconTile`/`PageHeader`/`ConfirmDialog`
  existentes; estilo con el token `glass`, lucide, acento, dark mode.
- **DataTable** sobre **`@tanstack/react-table`** (headless, MIT — ver
  `THIRD_PARTY_NOTICES.md`): orden, filtro por columna, búsqueda global
  (controlable desde el Toolbar), paginación, selección múltiple + barra en lote,
  visibilidad de columnas, densidad y skeleton. El estilo es propio.
- **Legal** (`/dashboard/legal`) reescrito como composición del kit: `KpiRow`
  (4 KPIs ya calculados), `Toolbar` con búsqueda + `FilterBar` (tipo/estado/rango
  de vencimiento) + `ExportButton` (CSV/XLSX, respeta filtros) + "Nuevo contrato"
  (en drawer, no inline), `DataTable<Contract>` con columna calculada de
  "días para vencer" (ámbar <30d, rojo vencidos) y `DetailDrawer` con línea de
  tiempo de estado + transiciones existentes (`/legal/contracts/:id/transition`)
  bajo `ConfirmDialog`.

**Backend intacto.** Cero endpoints/entidad/esquema/migración nuevos. Documentos
vinculados y alertas-que-disparan = follow-up (requieren backend).

**Corrección de premisa (verificada en código).** El brief asumía que Legal "no
está en el hub". **Sí lo está** desde el PR #361. Además, al hacer rebase/merge
con `main`, el catálogo `AREAS` **ya fue extraído** a `apps/web/src/lib/dashboardAreas.ts`
por el PR de wayfinding (#379) — `dashboard/page.tsx` ahora lo importa. Por tanto
**no se duplica** la entrada: el ajuste (añadir `plant_manager` a `["finance","hr"]`)
se aplica en `dashboardAreas.ts`. Admin/owner ya la ven vía `seesAllAreas`, sin
permisos nuevos.

**Aditivo.** El kit no obliga a migrar las páginas que ya rodaron su tabla; un
segundo módulo puede consumir los primitivos sin cambios.

<!-- Nuevas decisiones se agregan al final con número incremental -->
