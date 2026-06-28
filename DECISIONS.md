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

## 24. Bucle de acción: ejecutar/descartar propuestas + fix RBAC (Fase 7)

**Contexto.** Hasta §22 todo el stack de CIDE/Inteligencia era **read-only**: el
sistema recomendaba acciones (`autopilot`) pero no se podía **actuar** sobre
ellas desde el Centro de Inteligencia. Cerrar el bucle detectar→recomendar→actuar
es el corazón de una plataforma de decisiones.

**Decisión.**
- **Acción humana, con confirmación, gateada a admin.** Se añade
  `AutopilotService.dismissProposal` (triage: cierra la recomendación sin cambio
  operativo; guard de idempotencia: solo `pending`) y la ruta
  `POST /api/autopilot/proposals/:id/dismiss` (igual que `execute`, ambas con
  `@RequirePermissions('ADMIN_ACCESS')`). El Centro de Inteligencia gana botones
  **Ejecutar** (con diálogo de confirmación, porque aplica un cambio operativo
  real) y **Descartar** en cada tarjeta de "Acciones sugeridas".
- **CIDE sigue estrictamente read-only.** La ejecución es **acción humana en la
  UI**, nunca de la IA — riel de seguridad deliberado (la IA observa y recomienda;
  el humano decide y ejecuta).
- **Fix de RBAC (deuda de §22).** El tool `autopilot_proposals` de CIDE quedó con
  `requiredPermission: null`, exponiendo a cualquier usuario datos que el endpoint
  `/api/autopilot/proposals` gatea a `ADMIN_ACCESS`. Se corrige a `ADMIN_ACCESS`
  para alinear la IA con el endpoint.

**Verificación:** build API ✓, build web ✓, lint web (0 errores) ✓, **697/697**
tests ✓. Sin entidades nuevas (reusa `executedAt/executedBy` como sello de
resolución); el smoke no cambia de superficie.

**Pendiente (Fase 8):** editor de métricas/ontología en la UI; persistir tarjetas
en el historial; conectar el what-if a `runStressTest` con un PlanScenario.

## 25. Editor del catálogo semántico — self-serve (Fase 8)

**Contexto.** Métricas y ontología (§18) solo se podían crear/editar en código
(seed). Para una plataforma de análisis self-serve (estilo MicroStrategy) un admin
debe poder **definir KPIs y objetos del negocio desde la UI**, sin deploy.

**Decisión.** Editor aditivo sobre la capa semántica existente:
- **Backend.** Ya existía `POST /api/semantic/metrics` (upsert de métrica). Se
  añade `SemanticService.upsertObject` + `POST /api/semantic/objects` (ambos
  **admin-only**). Se factoriza `assertAdmin` en el controlador. El upsert de
  objeto sanea `properties` (filtra/normaliza). **Sin entidades nuevas.**
- **Boundary deliberado.** El editor define **qué significa** una métrica
  (nombre, unidad, dominio, grain, fórmula, dirección), **no su `resolver`**: el
  cableado a un cálculo en vivo sigue en código (registro de resolvers). Así un
  admin no puede "inventar" un valor en vivo inexistente; las métricas creadas en
  UI quedan como *definición* hasta que ingeniería cablee su resolver.
- **Frontend.** Nueva ruta admin `/dashboard/intelligence/editor`: tablas de
  métricas y objetos con alta/edición en panel (la `key` es inmutable al editar),
  con toasts. El Centro de Inteligencia muestra un botón **"Editar catálogo"**
  solo a admins.

**Nota de entorno.** El build del web falló al inicio por una **dependencia nueva
en `main`** (`@tanstack/react-table`, del PR "Workspace Industrial") ausente en
`node_modules`; se resolvió con `npm install`. No fue código de esta fase.

**Verificación:** build API ✓, build web ✓, lint web (0 errores) ✓, **704/704**
tests ✓. El smoke no cambia de superficie (sin tablas nuevas).

**Pendiente (Fase 9):** edición de relaciones (links) de la ontología en la UI;
persistir tarjetas del chat en el historial; permitir asociar un `resolver`
existente a una métrica desde la UI (lista cerrada).

## 26. Office/Sheets — motor de fórmulas robusto + fidelidad .xlsx (Fase 1)

**Contexto.** El editor de hoja de cálculo (`SheetEditor.tsx`) usa
`@fortune-sheet/react` (rejilla, MIT) + `xlsx`/SheetJS (I/O, Apache-2.0) y persiste
JSON en `office_documents`. El gap de «no se siente Excel» estaba en (a) la
correctitud del motor de fórmulas y (b) la fidelidad del round-trip .xlsx.

**Verificación obligatoria (corrida contra el motor REAL, no de memoria):**
- **V1 — cobertura de funciones.** La rejilla evalúa cada celda con
  `@fortune-sheet/formula-parser@0.2.13`, que delega las funciones con nombre en
  `@formulajs/formulajs@2.9.3` (451 funciones registradas). Auditando el motor real
  (`formulaEngine.spec.ts`) salieron **dos huecos que duelen**: (1) el parser **no
  tokeniza `TRUE`/`FALSE` sueltos** → `VLOOKUP(...;FALSE)`, `IF(TRUE;…)`,
  `AND/OR/NOT(...)` fallan con `#NAME?` (sólo valían `TRUE()`/`FALSE()`); y (2)
  faltan/rotas `XLOOKUP`, `TEXTJOIN`, `MAXIFS`/`MINIFS` y `TEXT(valor;formato)`
  (lanza error). Además, `IFERROR` de formulajs **no atrapaba** los errores
  aritméticos del parser (`1/0` → cadena `'DIV/0'`, no objeto error), rompiendo el
  patrón EMS `=SI.ERROR(a/b;0)`.
- **V2 — salud de mantenimiento de @fortune-sheet.** `@fortune-sheet/react` está en
  **1.0.4** (última publicación ~nov-2024; ≈18 meses sin release a jun-2026). Snyk
  reporta salud 90 % y **sin CVEs**; el motor `formula-parser` sigue clavado en
  `formulajs` 2.9.3 (la 3.x ya trae XLOOKUP/TEXTJOIN/MAXIFS, pero el parser no las
  expone). **Veredicto:** estancado pero **no abandonado** y **no pelea** con la
  fidelidad .xlsx (SheetJS hace el I/O por su cuenta). → **No se cambia de librería
  en esta fase** (la alternativa, Univer Sheets OSS core, tiene xlsx/print de pago).
  Riesgo anotado aquí para que el owner decida un swap futuro con datos.
- **V3 — round-trip .xlsx hoy.** `lib/office/xlsx.ts` ya mapeaba en ambos sentidos
  valores tipados, **fórmulas** (`f`), **formato de número** (`z`), **combinaciones**
  y **anchos de columna**. Faltaban **nombres definidos**, **altos de fila** y tests
  de **varias hojas con referencias entre hojas**.

**Decisión (Fase 1 — sólo `apps/web`, aditivo, sin tocar esquema ni docs/slides):**
1. **Funciones registradas, sin reinventar el motor ni vendorizar.** El core importa
   el `Parser` de `@fortune-sheet/formula-parser` como módulo **externo** (copia única
   hoisteada). `components/office/sheets/formulaEngine.ts` parchea **una sola vez** el
   `Parser.prototype` con los puntos de extensión propios de la librería:
   - `parse` → normaliza `TRUE`/`FALSE` sueltos a `TRUE()`/`FALSE()` **fuera** de
     literales de texto (toda fórmula —tecleada, cargada o importada— se beneficia).
   - `getFunction` → resuelve `XLOOKUP`, `XMATCH`, `TEXTJOIN`, `MAXIFS`, `MINIFS`,
     `TEXT` (este último vía el `formatNumber` ya probado) y unifica el manejo de
     errores (`IFERROR`/`IFNA`/`ISERROR`/`ISERR`/`ISNA` atrapan tanto los objetos
     `Error` de formulajs como las cadenas crudas del parser), cayendo al built-in si
     no es nuestra. Parche idempotente y defensivo; se instala desde `SheetEditor`.
2. **Round-trip .xlsx más fiel.** `xlsx.ts` ahora preserva **nombres definidos**
   (`Workbook.Names` ↔ `NamedRange[]`, ref absoluta y entrecomillado de hoja) y
   **altos de fila** (`config.rowlen` ↔ `ws['!rows']`), además de lo previo.
   `exportSheets`/`importSheets` enhebran los nombres; `SheetActions` los pasa al
   exportar y los conserva al importar.
3. **No romper hojas guardadas.** Todo es aditivo: el shape de contenido
   (`{sheets,charts,names,pivots}`) no cambia y `sheetsOf`/`namesOf` siguen aceptando
   el array legacy. Las fórmulas que ya valían siguen igual; sólo se **añaden**
   capacidades.

**Verificación:** suite de specs de hoja **16/16** verde (incl. la nueva auditoría
`formulaEngine.spec.ts` —67 aserciones: búsqueda, condicionales, texto, fecha,
financieras, referencias **entre hojas** y errores— y el round-trip ampliado en
`xlsx.spec.ts` —multi-hoja, fórmula entre hojas y nombres definidos). `lint web`
0 errores; `build web` verde. Sin entidades nuevas; el smoke no cambia de superficie.

**Roadmap (PRs aparte):** F2 interacciones Excel (autofill, inmovilizar, formato
condicional, validación con listas); F3 pivotes/charts más profundos; F4 hojas
ligadas en vivo (BOM desde maestro de materiales, validación desde AVL).

## 27. Editor de relaciones de la ontología (Fase 9 CIDE)

**Contexto.** El editor self-serve (§25, Fase 8) cubría **métricas** y **objetos**
pero no las **relaciones** (links) — el tercer primitivo de la ontología, lo que
convierte un catálogo de objetos en un **grafo** (estilo Palantir).

**Decisión.** Cierre del CRUD de ontología desde la UI, aditivo y admin-only:
- **Backend.** `SemanticService.upsertLink` + `POST /api/semantic/links`
  (admin, vía `assertAdmin`). `UpsertLinkDto` valida `cardinality` contra la lista
  cerrada (`one_to_one`/`one_to_many`/`many_to_one`/`many_to_many`). **Sin
  entidades nuevas** (la tabla `sem_ontology_link` ya existía de §18).
- **Frontend.** El editor (`/dashboard/intelligence/editor`) gana la sección
  **"Relaciones"**: alta/edición en el mismo panel, con **selects de objeto
  origen/destino poblados desde los objetos existentes** (los links solo apuntan a
  objetos reales), cardinalidad, verbo y descripción. La `key` es inmutable al
  editar.

Con esto, un admin gestiona los **tres** primitivos semánticos (métricas, objetos,
relaciones) sin tocar código; CIDE y los tableros consumen el grafo resultante.

**Verificación:** build API ✓, build web ✓, lint web (0 errores) ✓, **704/704**
tests ✓. El smoke no cambia de superficie.

**Nota de entorno.** `main` añadió dependencias nuevas (`web-push`, PWA); se
sincronizó con `npm install` antes del build del web.

**Pendiente (Fase 10):** persistir tarjetas del chat en el historial; snapshots
de métricas para tendencia de KPIs (no solo del ledger); borrado lógico de
métricas/objetos/links desde la UI.

## 28. Snapshots de métricas — tendencia de KPIs (Fase 10 CIDE)

**Contexto.** Las métricas mostraban solo su valor **actual**. Para análisis de
decisiones hace falta saber si un KPI **mejora o empeora** — es decir, su serie
temporal, no un número suelto.

**Decisión.** Substrato de snapshots, aditivo:
- **Entidad** `sem_metric_snapshot` (prefijada, sin FK, `value` como `float`
  portable — patrón probado §4): un punto por `tenant+metric+day`.
- **Captura idempotente.** `SemanticService.captureSnapshots` resuelve cada
  métrica con resolver como **actor sistema** (captura todo) y guarda un punto/día
  si no existe. Un **@Cron diario** (2 AM) la dispara para el tenant por defecto.
  En la primera lectura, si no hay snapshots se hace un *lazy-seed* (un punto)
  para que la UI no salga vacía en un deploy nuevo.
- **Lectura RBAC-gated.** `metricHistoryBatch` devuelve el historial **solo de las
  métricas que el usuario puede ver** (gate por el permiso del resolver, igual que
  el valor en vivo) — una sola consulta de snapshots. Endpoint
  `GET /api/semantic/history?days=30`.
- **Frontend.** Cada tarjeta de métrica del Centro de Inteligencia muestra un
  **sparkline** (SVG inline, verde si sube / rojo si baja) cuando hay ≥2 puntos.

**Nota.** El multi-tenant del cron se limita al tenant por defecto (el snapshot
por-tenant queda como mejora futura). La tendencia real se construye con los días;
el deploy arranca con 1 punto (lazy-seed).

**Verificación:** build API ✓, build web ✓, lint web (0 errores) ✓, **704/704**
tests ✓. La entidad nueva (`float`, prefijada, sin FK) la materializa el smoke de
bootstrap en CI.

**Pendiente (Fase 11):** snapshots por tenant; alertas cuando un KPI cruza un
umbral/dirección adversa; persistir tarjetas del chat; borrado lógico en el editor.

## 29. Office/Sheets — funciones modernas de Excel 365 (Fase 2: matrices dinámicas + texto)

**Contexto.** §26 (Fase 1) blindó el motor (booleanos sueltos, `XLOOKUP`/`TEXTJOIN`/
`MAXIFS`/`MINIFS`/`TEXT`, errores unificados). El siguiente hueco visible frente a Excel
365 son las **funciones modernas**: `@formulajs/formulajs@2.9.3` NO trae
`SORT`/`SORTBY`/`FILTER`/`SEQUENCE`/`TAKE`/`DROP`/`TEXTBEFORE`/`TEXTAFTER`/`TEXTSPLIT`
(y su `UNIQUE`/`TRANSPOSE` no son fieles).

**Verificación (contra el motor REAL, no de memoria):**
- El parser **resuelve nuestra versión antes** que el built-in (el parche de `getFunction`
  cae a `CUSTOM_FUNCTIONS` cuando `getFunction` nativo devuelve `undefined`, que es el caso
  de TODAS estas — incluidas `UNIQUE`/`TRANSPOSE`, que viven en `evaluateByOperator`). Así
  ganan nuestras versiones fieles a Excel.
- Un rango llega a la función como **matriz 2D** (filas × columnas) y las matrices que
  devolvemos **componen** con `SUM`/`COUNT`/`INDEX`/`TEXTJOIN` (probado en el motor real).
- **Límite documentado:** el parser **no hace broadcasting** de operadores sobre rangos
  (`A1:A10>5` colapsa a escalar), por eso `FILTER` recibe una **máscara ya evaluada**
  (rango de 1/0 o V/F), no una comparación de rango. El **spilling** a celdas vecinas es
  fase aparte (las funciones ya devuelven 2D listo para derramar).

**Decisión (Fase 2 — sólo `apps/web`, aditiva, sin tocar esquema):** nuevo módulo
`components/office/sheets/modernFunctions.ts` con 13 funciones (matrices dinámicas:
`UNIQUE`, `SORT`, `SORTBY`, `FILTER`, `SEQUENCE`, `TAKE`, `DROP`, `TRANSPOSE`; texto:
`TEXTBEFORE`, `TEXTAFTER`, `TEXTSPLIT`, `ARRAYTOTEXT`, `VALUETOTEXT`), mezcladas en
`CUSTOM_FUNCTIONS` (formulaEngine) — un único punto de parche del `Parser` compartido. El
asistente de funciones (`SheetFunctionWizard`) gana la categoría **«Matrices dinámicas»** y
las nuevas de texto, para descubrirlas.

**Verificación:** nueva suite `modernFunctions.spec.ts` (**50 aserciones**: semántica pura
+ integración por el motor real — `SUM(FILTER…)`, `COUNT(UNIQUE…)`, `INDEX(SORT…)`,
`TEXTJOIN(…,UNIQUE…)`, aritmética sobre array-fn). Las **17 suites** de hoja siguen verdes,
`formulaEngine.spec` **67/67**. `lint web` 0 errores; `build web` ✓.

**Roadmap:** F3 **spilling** real (la celda con `=UNIQUE(…)` derrama el rango `#` a las
vecinas); luego `LET`/`LAMBDA` (preprocesado de cadena) y broadcasting de operadores.

## 30. Office/Sheets — apilar/remodelar matrices + REGEX (Fase 3)

**Contexto.** §29 (Fase 2) trajo las matrices dinámicas de filtro/orden y el texto
moderno. Faltaban dos familias muy presentes en Excel 365: **apilar/remodelar** matrices
(`VSTACK`/`HSTACK`/`TOCOL`/`TOROW`/`CHOOSEROWS`/`CHOOSECOLS`/`EXPAND`/`WRAPROWS`/`WRAPCOLS`)
y las **expresiones regulares** (`REGEXTEST`/`REGEXEXTRACT`/`REGEXREPLACE`, añadidas por
Microsoft en 2024) — ninguna en `@formulajs/formulajs`.

**Decisión (Fase 3 — sólo `apps/web`, aditiva):** se amplía `modernFunctions.ts` con esas
12 funciones (mismo mecanismo: registradas en `CUSTOM_FUNCTIONS`, ganan al built-in). Las de
apilado rellenan huecos con `#N/A` como Excel; `TOCOL`/`TOROW` soportan `ignorar`
(vacíos/errores) y barrido por columnas; las REGEX mapean el patrón a `RegExp` de JS
(flag unicode; `i` para «sin mayúsculas»; `$1` en el reemplazo) y degradan a literal escapado
si el patrón es inválido. El asistente gana las nuevas en «Matrices dinámicas» y una
categoría **«Texto avanzado (Regex)»**.

**Verificación:** `modernFunctions.spec.ts` ampliado a **80 aserciones** (incl. integración
por el motor real: `SUM(VSTACK…)`, `COUNTA(TOCOL…)`, `INDEX(CHOOSEROWS…)`, `REGEXEXTRACT`,
`REGEXREPLACE`). 17/17 suites de hoja verdes; `lint web` 0 errores; `build web` ✓.

**Roadmap:** F4 **spilling** real (derramar el rango `#` a celdas vecinas) — lo que vuelve
estas matrices usables sueltas en una celda, no sólo anidadas.

## 31. Office/Sheets — `LET` por preprocesado de cadena (Fase 4)

**Contexto.** `LET(nombre1; valor1; …; cálculo)` es de las funciones estrella de Excel 365
(nombra subexpresiones: legibilidad + sin recálculo). NO puede ser una función registrada
porque el parser evalúa cada argumento ANTES de llamar a la función: `LET(x; 5; x+1)`
intentaría evaluar `x+1` con `x` indefinido.

**Decisión (Fase 4 — sólo `apps/web`, aditiva):** se implementa como **preprocesado de
cadena** (misma técnica que la normalización de booleanos de §26): el nuevo `letExpand.ts`
sustituye cada nombre por su expresión-valor —entre paréntesis— en los valores posteriores y
en el cálculo, de izquierda a derecha. Se engancha en el parche de `parse`:
`normalizeFormula(expandLet(expr))`, así el parser sólo ve la expresión ya resuelta. Robusto:
respeta literales de texto, sólo sustituye identificadores COMPLETOS (no `xy` por `x`), no
toca usos `nombre(` y soporta **`LET` anidado**; defensivo (sintaxis inválida → intacta).

**Verificación:** nueva suite `letExpand.spec.ts` (**16 aserciones**: expansión pura +
evaluación por el motor real — nombres encadenados, anidamiento, `LET` con `UNIQUE`, texto sin
tocar, media `s/COUNT`). 18/18 suites de hoja verdes; `lint web` 0 errores; `build web` ✓.

**Roadmap:** F5 **spilling** real del rango `#`; luego `LAMBDA`/`MAP`/`REDUCE` (requieren
pasar funciones como valor — diseño aparte).

## 32. Office/Docs — fidelidad del export .docx (imágenes + tablas + interlineado)

**Contexto.** El export a Word (`lib/office/docx.ts`, TipTap JSON → librería `docx`) ya cubría
párrafos, estilos de texto, listas, encabezados/pie, notas al pie reales, TOC y bibliografía,
PERO **perdía las imágenes** (no había mapeo del nodo `image`), las tablas salían sin
**sombreado de celda / anchos / combinaciones / encabezado**, y no se exportaba el
**interlineado**. Tres huecos visibles frente a Word.

**Decisión (sólo `apps/web`, aditiva):**
1. **Imágenes.** Nuevos helpers PUROS (`parseDataUrl`, `imageSize`, `targetWidth`,
   `base64ToBytes`) decodifican los `data:` URLs y **leen las dimensiones naturales de la
   cabecera del binario** (PNG/JPEG/GIF/BMP, sin librerías) para no deformar la imagen; el nodo
   `image` se mapea a `ImageRun` (ancho desde `"50%"/"300px"`, alto por proporción).
2. **Tablas «tipo Word».** `tableToEl` ahora aplica **sombreado** de celda
   (`backgroundColor`, y gris claro en encabezados), **anchos** de columna (`colwidth` px→twips),
   **combinaciones** (`colspan`/`rowspan`), **alineación vertical**, **bordes** finos y
   **encabezados en negrita**.
3. **Interlineado.** `lineHeight` (múltiplo) → `spacing.line` en 240avos con `lineRule auto`.
4. **Testabilidad.** El armado se extrae a `buildDocx(docx, json, title)` **pura** (recibe el
   módulo `docx`, sin DOM); `exportDocx` la envuelve con `Packer` + descarga.

**Verificación:** nueva suite `lib/office/docx.spec.ts` (**16 aserciones**) que EMPAQUETA el
.docx a un Buffer real (`Packer.toBuffer`), lo descomprime con JSZip e inspecciona
`word/document.xml` + `word/media/`: confirma imagen embebida (`<w:drawing>`), sombreados
`#FF0000`/`#00FF00`, bordes, negrita de cabecera e interlineado `w:line="360"`. `lint web`
0 errores; `build web` ✓.

**Roadmap:** import .docx más fiel (mapa de estilos de mammoth); numeración nativa de listas
de Word; sangrías de tabla.

## 33. Office/Docs — numeración NATIVA de Word para listas ordenadas

**Contexto.** §32 dejó las listas ordenadas exportándose como **texto literal** («1. », «2. »):
se ven bien pero en Word NO son una lista editable (no renumeran al insertar/borrar, no
continúan). Las viñetas ya usaban numeración nativa (`bullet`); faltaba hacerlo con las
ordenadas.

**Decisión (sólo `apps/web`, aditiva):** cada **árbol** de lista ordenada registra una
definición de numeración propia (`newOrderedRef` → reinicia en 1) con 9 niveles decimales;
los párrafos la referencian con `numbering: { reference, level }`. El esquema **legal**
(`doc-mlist`) usa la ruta completa por nivel (`%1.%2.%3` → «1.1.1»); el normal, `%n.` por
nivel. Una ordenada anidada bajo otra ordenada **comparte** la referencia (jerarquía); bajo
viñetas abre la suya. Las definiciones se pasan al `Document` como `numbering.config`.

**Verificación:** `docx.spec.ts` ampliado a **21 aserciones** — el .docx empaquetado ahora
incluye `word/numbering.xml`, los párrafos llevan `<w:numPr>` con `<w:numId>` + `<w:ilvl>`, y
**ya no** aparece el prefijo «1. » como texto. `lint web` 0 errores; `build web` ✓.

**Roadmap:** import .docx más fiel (style map de mammoth, imágenes embebidas); sangrías de
tabla; estilos de carácter nombrados.

## 34. Office/Sheets — formato de número fiel a Excel (literales, secciones, relleno, escalado)

**Contexto.** `formatNumber` (usado en la visualización de celdas, `TEXT()` y
`applyNumberFormat`) era un «subconjunto práctico» que **ignoraba el texto literal** del código
(`0" kg"` salía «5», no «5 kg»), no hacía **relleno de ceros** (`00000`), no soportaba las
**4 secciones** (`positivo;negativo;cero;texto`) salvo por una heurística contable, ni el
**escalado por miles** (coma final), y se confundía con **etiquetas** `[Red]`/`[$€-409]`.

**Decisión (sólo `apps/web`, aditiva — reescritura del núcleo con tokenizador):**
- **Secciones.** Se elige la sección por signo/cero (texto = 4ª con `@`); cada una se procesa
  por separado tras **quitar etiquetas** de color/condición y extraer el símbolo de `[$X-…]`.
- **Tokenizador de sección.** Recorre el patrón intercalando **literales** (texto
  entrecomillado, `\x`, paréntesis, símbolos) con el número: la primera tirada de marcadores
  `#0?` se sustituye por el valor; `$`→símbolo de moneda; `%` escala ×100.
- **Número.** Relleno de ceros a la izquierda (`minInt`), agrupación de miles, decimales, y
  **escalado** por cada coma final (÷1000), además de porcentaje/científico/fracción/fecha.

**Verificación:** las **27 aserciones previas** de `numfmt.spec.ts` siguen verdes (cero
regresión) + **13 nuevas** (literales, relleno, secciones, `[color]`/`[$moneda]`, escalado
×1000/×millón) → **40**; `formulaEngine.spec` 67/67 (`TEXT`), 18/18 suites de hoja verdes;
`lint web` 0 errores; `build web` ✓.

## 35. Office/Sheets — fechas: día de la semana + reloj de 12 horas (AM/PM)

**Contexto.** `formatDate` resolvía año/mes/día/hora/minuto/segundo, pero `ddd`/`dddd`
devolvían el **día del mes** (no el de la semana) y no existía el **reloj de 12 horas**
(`AM/PM`/`A/P`) — ambos muy comunes en Excel.

**Decisión (sólo `apps/web`, aditiva):** `dddd`→día de la semana completo (`jueves`),
`ddd`→abreviado (`jue`) con tablas `WEEKDAYS_ES`/`WEEKDAYS_FULL`; si el código trae
`AM/PM`/`A/P`, la `h` cuenta 1–12 (medianoche y mediodía = 12) y el marcador se sustituye por
`AM`/`PM` (o `A`/`P`), respetando mayúsc./minúsc. El tokenizador reconoce `AM/PM` como una
unidad antes de partir por letras.

**Verificación:** `numfmt.spec.ts` ampliado a **47 aserciones** (+7: `dddd`/`ddd`, 12h PM/AM,
minúscula, medianoche/mediodía, 24h intacto). 18/18 suites de hoja verdes; `lint web`
0 errores; `build web` ✓.

## 36. Office/Sheets — «Derramar matriz» (spill de fórmulas dinámicas a celdas)

**Contexto.** §29–31 añadieron las funciones de matriz (UNIQUE/SORT/FILTER/SEQUENCE/…), pero
componían sólo anidadas: la rejilla (Fortune-Sheet) **no derrama** sola el resultado a las
celdas contiguas (el «spill range #» de Excel 365). El motor además **no intercepta** la
evaluación en vivo de la celda, así que el spilling reactivo iría contra el runtime de la
rejilla (no verificable sin navegador → riesgo en prod).

**Decisión (sólo `apps/web`, aditiva — operación de UN paso, como «transponer»/«dinámica»):**
nuevo `components/office/sheets/arraySpill.ts`. `applySpill(sheet, ancla)` evalúa la fórmula de
la celda ancla con el **mismo motor parcheado** (un `Parser` con resolutores `callCellValue`/
`callRangeValue` que leen los valores YA calculados de `celldata`) y ESCRIBE el bloque
resultante: el ancla conserva su fórmula (valor = esquina) y las vecinas reciben valores
estáticos marcados (`spillFrom`). Detecta **#SPILL!** si el destino está ocupado y **limpia el
derrame anterior** al re-derramar. Botón en la cinta (Insertar → «Matrices dinámicas →
Derramar matriz (#)»). Es **PURA** sobre el objeto de hoja → 100 % probada sin navegador.

**Verificación:** nueva suite `arraySpill.spec.ts` (**15 aserciones**: `evalOverSheet`,
derrame de `SORT`/`UNIQUE`/`SEQUENCE` 2×3, conservación de la fórmula del ancla, **#SPILL!**
sin sobrescribir, limpieza al re-derramar, error sin fórmula). 19/19 suites de hoja verdes;
`lint web` 0 errores; `build web` ✓.

**Nota.** Es un derrame de UN paso (no reactivo): al cambiar el origen, se vuelve a pulsar
«Derramar». El spilling en vivo queda como mejora futura (requiere QA interactivo de la rejilla).

## 37. Office/Docs — round-trip .docx (import con style map + test de ida y vuelta)

**Contexto.** §32–33 hicieron fiel el EXPORT a Word; el IMPORT (`importDocx`) era `mammoth`
con opciones por defecto (perdía el mapeo de estilos con NOMBRE de Word —Título/Subtítulo/Cita—
que se aplanaban a párrafo) y no tenía test automatizado (sólo la página interactiva
`/dev/pptx-roundtrip`… para slides). El import de slides usa `DOMParser`/`fabric`
(sólo-navegador) y no es testeable headless, pero el de Word SÍ: `mammoth` corre en Node.

**Decisión (sólo `apps/web`, aditiva):**
1. **Style map.** `importDocx` aplica un `DOCX_STYLE_MAP` que mapea estilos nombrados de Word
   (Title/Título, Subtitle/Subtítulo, Quote/Cita, Intense Quote, Caption, Strong, Emphasis) a
   HTML semántico que TipTap entiende.
2. **Núcleo testeable.** Se extrae `importDocxBuffer(arrayBuffer)` (mammoth → HTML), que detecta
   entorno (`{ arrayBuffer }` en navegador, `{ buffer }` en Node/SSR); `importDocx(file)` la
   envuelve.

**Verificación:** nueva suite `docxRoundtrip.spec.ts` (**8 aserciones**) que empaqueta un .docx
real con `buildDocx` + `Packer.toBuffer` y lo **re-importa** con `importDocxBuffer`: confirma que
sobreviven títulos (h1/h2), negrita/cursiva, el **texto** de las listas, la **tabla** con sus
celdas y —de extremo a extremo— la **imagen embebida** (data URL), validando también el export de
imágenes de §32. `docx.spec` 21/21; `lint web` 0 errores; `build web` ✓.

**Nota.** La librería `docx` numera las listas de un modo que mammoth aplana a párrafos (sin
pérdida de TEXTO); la estructura `ul/ol` del export ya se verifica en `docx.spec` vía `<w:numPr>`.

## 38. Office/Slides — test del export .pptx + arreglo de hipervínculos rotos

**Contexto.** El export a PowerPoint (`lib/office/pptx.ts`, Fabric → PptxGenJS) mapeaba cada
objeto a una forma/imagen/tabla/gráfico NATIVO, pero **no tenía test automatizado**. Auditando
el .pptx generado salió un **bug real**: el hipervínculo de un cuadro de texto salía como
`r:id="rIdundefined"` —sin relación en `slideN.xml.rels`— es decir, un **enlace roto** en
PowerPoint. PptxGenJS sólo crea la relación `r:id` del enlace a nivel de **run** de texto, no
en las opciones del shape.

**Decisión (sólo `apps/web`, aditiva):**
1. **Arreglo.** El hipervínculo se mueve a cada tirada de texto (`textParagraphs(o, link)` →
   `options.hyperlink`), no a las opciones de `addText`. Ahora genera una relación válida.
2. **Cobertura.** Nueva suite `pptx.spec.ts` que arma el .pptx con `pptxArrayBuffer`, lo
   descomprime con JSZip e inspecciona los XML.

**Verificación:** `pptx.spec.ts` (**19 aserciones**): 2 diapositivas; texto en negrita;
**viñetas** nativas (`a:buChar`); **hipervínculo con relación válida** (no `rIdundefined`);
formas preset (`star5`, `ellipse`); **tabla** nativa (`a:tbl`) con encabezados; **gráfico**
nativo (`graphicFrame` + `c:barChart` con la serie); pie y numeración; **imagen** embebida en
`ppt/media/`; y **notas del orador**. `lint web` 0 errores; `build web` ✓.

## 39. Office/Sheets — «Buscar objetivo» (Goal Seek / análisis de hipótesis)

**Contexto.** El análisis de hipótesis de Excel («Buscar objetivo») —encontrar el valor de una
celda que hace que una fórmula alcance un objetivo— no existía. Es una de las funciones más
reconocibles de Excel y, al ser numérica, es 100 % verificable sin navegador.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/goalSeek.ts`. `goalSeek(sheet,
fórmula, objetivo, variable)` reutiliza `evalOverSheet` (§36) para evaluar la fórmula con
valores de prueba de la variable y resuelve `f(x)=objetivo` con el **método de la secante**
(reinicios + recentrado si diverge). Es PURO sobre una COPIA de la hoja hasta tener solución.
UI: diálogo `SheetGoalSeek` (3 casillas estilo Excel) en la cinta (Datos → «Análisis de
hipótesis → Buscar objetivo»), que escribe el valor hallado y reporta iteraciones.

**Límite (documentado):** recalcula SOLO la fórmula objetivo; si ésta depende de la variable a
través de OTRAS celdas con fórmula, esas no se recalculan. Funciona cuando la fórmula depende de
la variable directamente o vía celdas de valor (el caso habitual).

**Verificación:** nueva suite `goalSeek.spec.ts` (**13 aserciones**: lineal → 22.5; cuadrática
→ |4|; interés compuesto → 1000; con celda de valor → 25; ya-en-objetivo 0 iteraciones; errores).
`lint web` 0 errores; `build web` ✓.

## 40. Office/Docs — Combinar correspondencia (Mail Merge)

**Contexto.** «Combinar correspondencia» (plantilla + tabla de datos → un documento por
registro) es una función emblemática de Word que faltaba. La transformación es PURA sobre el
JSON de TipTap, así que se verifica entera sin navegador.

**Decisión (sólo `apps/web`, aditiva):** `components/office/docs/mailMerge.ts` con
`parseDelimited` (CSV/TSV con comillas y comillas escapadas, autodetección de delimitador),
`findMergeFields` (campos `{{campo}}` únicos en orden), `mergeDoc` (sustituye campos en una
COPIA, sin mutar la plantilla; campo ausente conserva el marcador) y `mailMergeDocs` (combina
todos los registros con saltos de página). UI: diálogo `DocMailMerge` en la cinta (Insertar →
«Correspondencia») para insertar campos, pegar los datos y **descargar el .docx combinado**
(reutiliza `exportDocx`).

**Verificación:** nueva suite `mailMerge.spec.ts` (**16 aserciones**: CSV con comas
entrecomilladas, TSV, comillas escapadas; campos únicos; sustitución múltiple/repetida sin
mutar; combinado de 2 registros con salto de página; sin marcadores residuales). `lint web`
0 errores; `build web` ✓.

## 41. Office/Sheets — «Tabla de datos» (Data Table, análisis de hipótesis)

**Contexto.** Completa el trío de análisis de hipótesis de Excel junto a «Buscar objetivo»
(§39): evaluar una fórmula para muchos valores de una (o dos) celdas de entrada.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/dataTable.ts` con
`dataTable1` (una variable → vector de resultados) y `dataTable2` (dos variables → matriz),
reutilizando `evalOverSheet` (§36) sobre una COPIA de la hoja (no muta la original). UI:
diálogo `SheetDataTable` (modo 1/2 variables; valores por rango `E1:E10` o lista `1,2,3`) en la
cinta (Datos → «Análisis de hipótesis → Tabla de datos»), que escribe la rejilla de resultados
(con cabeceras) en una **hoja nueva** «Tabla de datos N» (mismo patrón que las dinámicas).

**Verificación:** nueva suite `dataTable.spec.ts` (**9 aserciones**: cuadrados y porcentajes de
una variable; suma y tabla de multiplicar de dos variables; no muta la hoja; errores). `lint
web` 0 errores; `build web` ✓.

## 42. Office/Sheets — Autosuma (Σ) con SUM/AVERAGE/COUNT/MAX/MIN

**Contexto.** La «Autosuma» (Σ) es uno de los botones más usados de Excel y faltaba; el asistente
de funciones existía, pero no el atajo de un clic para agregar el rango seleccionado.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/autoSum.ts` con `autoSumPlan`
(puro): según el rango propone la fórmula y la celda destino — **fila** (varias columnas) →
resultado a la **derecha**; **columna/bloque** → **debajo** de la primera columna. La cinta
(Fórmulas → «Autosuma») ofrece un menú SUM/AVERAGE/COUNT/MAX/MIN que escribe `=FN(rango)` en la
celda contigua vía `setCellValue` (con respaldo al portapapeles).

**Verificación:** nueva suite `autoSum.spec.ts` (**10 aserciones**: columna→debajo, fila→derecha,
bloque, cruces de letra de columna Z/AA, rango inválido). `lint web` 0 errores; `build web` ✓.

## 43. Office/Docs — citas con borde y llamadas (callouts) con recuadro de color en .docx

**Contexto.** Al exportar a Word, las **citas** (`blockquote`) salían sólo con sangría y las
**llamadas** (`callout`, con `tone` neutral/info/success/warning/danger) se **aplanaban** a
párrafos sueltos, perdiendo su caja de color.

**Decisión (sólo `apps/web`, aditiva):** `blockToEls` da a la cita un **borde izquierdo** gris
(estilo Word) con su sangría; y a la llamada un **recuadro**: sombreado + borde del color del
tono en cada párrafo (borde superior/inferior sólo en el primero/último para cerrar la caja),
con una paleta tono→color (info `#EFF6FF`/`#3B82F6`, success, warning, danger…).

**Verificación:** `docx.spec.ts` ampliado a **24 aserciones** (+3: `<w:pBdr>` de cita/llamada,
sombreado `#EFF6FF` de la llamada «info», textos presentes). Round-trip 8/8; `lint web`
0 errores; `build web` ✓.

## 44. Office/Sheets — Administrador de escenarios (completa el análisis de hipótesis)

**Contexto.** Cierra el trío de análisis de hipótesis de Excel (Escenarios + Buscar objetivo §39
+ Tabla de datos §41): guardar conjuntos con nombre de valores de entrada y compararlos.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/scenarios.ts` con `parseChanges`
(«A1=100, B2=-5» → cambios), `applyScenario` (escribe los valores) y `scenarioSummary` (para cada
celda de resultado, su valor bajo cada escenario, recalculando la fórmula con `evalOverSheet` §36;
puro sobre COPIAS). Los escenarios se **persisten** en el contenido (`scenariosRef`, hilado en
`emit` junto a sheets/charts/names/pivots). UI: diálogo `SheetScenarios` (lista con aplicar/borrar,
alta con nombre + cambios, e **informe de resumen** en una hoja nueva) en la cinta (Datos →
«Análisis de hipótesis → Administrador de escenarios»).

**Verificación:** nueva suite `scenarios.spec.ts` (**9 aserciones**: parseo tolerante, aplicar,
resumen con recálculo de suma/producto bajo 2 escenarios, sin mutar la hoja base). `lint web`
0 errores; `build web` ✓.

## 45. Office/Sheets — Solver (optimización multivariable con restricciones)

**Contexto.** El «Solver» de Excel —maximizar/minimizar/fijar una celda objetivo cambiando
VARIAS celdas a la vez, con límites— es la pieza de optimización que faltaba. Va más allá de
«Buscar objetivo» §39 (una variable).

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/solver.ts`. `solve(sheet,
objetivo, meta, valor, variables)` reutiliza `evalOverSheet` (§36) y minimiza el coste
(`-f` para máx, `(f-objetivo)²` para valor, `f` para mín) con **Nelder–Mead** (símplex, sin
derivadas, doble arranque) + un **pulido por descenso de coordenadas** con paso que se reduce
(afina cimas/valles planos). Límites por **recorte** (clamp). Puro sobre una COPIA. UI: diálogo
`SheetSolver` (objetivo, Máx/Mín/Valor, variables `A1, C1`, restricciones `A1>=0, A1<=100`) en
la cinta (Datos → «Análisis de hipótesis → Solver»). Cierra el menú de Análisis de hipótesis.

**Límite (documentado):** recalcula sólo la fórmula objetivo (como §39); óptimo local de un
método sin derivadas (con doble arranque + pulido para robustez).

**Verificación:** nueva suite `solver.spec.ts` (**14 aserciones**: mínimo de paraboloide 2D →
(3,5) obj 0; máximo de parábola → 2 obj 10; valor objetivo 100 multivariable; **restricción**
con recorte a 5; errores). `lint web` 0 errores; `build web` ✓.

## 46. Office/Docs — control de cambios → revisiones reales de Word en .docx

**Contexto.** El editor tiene control de cambios (marcas `insertion`/`deletion` con `author`/
`date`), pero el export a Word las pintaba como **texto coloreado/tachado** — no como revisiones
de verdad, así que en Word no se podían **aceptar/rechazar** desde el panel «Revisar».

**Decisión (sólo `apps/web`, aditiva):** `runOpts` detecta las marcas `insertion`/`deletion` y
`inlineRuns` genera `InsertedTextRun`/`DeletedTextRun` de la librería `docx` (revisiones reales
`<w:ins>`/`<w:del>` con `author`/`date` y `<w:delText>`), con un `revId` incremental. La
librería ya exporta estos runs nativamente.

**Verificación:** `docx.spec.ts` ampliado a **27 aserciones** (+3: `<w:ins w:author="Ana">`,
`<w:del w:author="Luis">`, `<w:delText>`). Round-trip 8/8; `lint web` 0 errores; `build web` ✓.

## 47. Office/Docs — comentarios → comentarios reales de Word en .docx

**Contexto.** Los comentarios del editor (marca `comment` con `commentId`/`author`/`text`/
`replies`, hilo dentro del JSON) no se exportaban a Word; se perdían al descargar el .docx.

**Decisión (sólo `apps/web`, aditiva):** `inlineRuns` **agrupa** los runs contiguos con el mismo
`commentId` en un único rango (`CommentRangeStart`…`CommentRangeEnd` + `CommentReference`) —
necesario para que el OOXML sea válido (un comentario = un rango)— y registra la definición del
hilo una sola vez (`commentDefs`): el texto del comentario + cada **respuesta** como párrafo.
Las definiciones se pasan al `Document` como `comments.children`. Mapea `commentId` (string) a un
id numérico estable.

**Verificación:** `docx.spec.ts` ampliado a **32 aserciones** (+5: `word/comments.xml`,
`<w:commentRangeStart/End>`, `<w:commentReference>`, autor «Marta» con su texto, y la respuesta
del hilo). Round-trip 8/8; `lint web` 0 errores; `build web` ✓.

## 48. Office/Sheets — Consolidar datos (Data → Consolidate)

**Contexto.** «Consolidar» (combinar varios rangos —de distintas hojas— en una tabla agregada)
es una herramienta de la pestaña Datos de Excel que faltaba.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/consolidate.ts` con
`consolidateByPosition` (rangos de la misma forma → agregado celda a celda) y
`consolidateByCategory` (alinea por **etiquetas** de fila + **cabeceras** de columna, uniendo
las que difieren), con SUM/AVERAGE/COUNT/MAX/MIN. UI: diálogo `SheetConsolidate` (modo, función,
rangos uno por línea, admite **`Hoja2!A1:C4`** entre hojas) en la cinta (Datos → «Consolidar»);
el resultado se escribe en una hoja nueva «Consolidado N». La lectura de rangos resuelve hojas
por nombre.

**Verificación:** nueva suite `consolidate.spec.ts` (**9 aserciones**: por posición
suma/promedio/máx y formas distintas; por categoría alineando etiquetas —Luis suma Q1 de dos
tablas, columnas/filas exclusivas con huecos— y promedio). `lint web` 0 errores; `build web` ✓.

## 49. Office/Docs — tabla de contenido como campo TOC real de Word

**Contexto.** El nodo `toc` se exportaba a Word como **texto estático** (lista de títulos sin
números de página ni enlaces). Word tiene un campo TOC nativo que se **actualiza** con los
títulos y SUS PÁGINAS y es **clicable**.

**Decisión (sólo `apps/web`, aditiva):** el `case 'toc'` genera un `TableOfContents` real de la
librería `docx` (`{ hyperlink: true, headingStyleRange: '1-5' }`) — Word lo rellena con los
párrafos con estilo de título y sus números de página. Fallback defensivo al texto estático si
la API faltara.

**Verificación:** `docx.spec.ts` ampliado a **33 aserciones** (+1: el cuerpo lleva el campo
`TOC` real —`<w:instrText>… TOC …</w:instrText>`—). Round-trip 8/8; `lint web` 0 errores;
`build web` ✓.

## 50. Office/Sheets — referencias estructuradas de tabla (`Tabla[Columna]`)

**Contexto.** Las referencias estructuradas (`=SUM(Ventas[Importe])`) son una función emblemática
de Excel que faltaba; la fórmula apunta a una **tabla con nombre** por el nombre de su columna en
vez de por coordenadas, y se mantiene aunque la tabla crezca.

**Decisión (sólo `apps/web`, aditiva):** como `LET` (§31), se resuelven por **preprocesado de
cadena**. `components/office/sheets/tableRefs.ts` expone `expandStructuredRefs(formula, tablas)`
(sustituye `Nombre[…]` por su rango A1 calificado con la hoja) y un **registro global**
(`setTableRegistry`). Soporta `T[Col]`, `T[]`/`T[#Datos]`, `T[#Encabezados]`, `T[#Todo]` y la
forma con dobles corchetes. Se engancha en el parche de `parse`:
`normalizeFormula(expandLet(expandStructuredRefs(expr)))`. `SheetEditor` mantiene el registro:
al **dar formato como tabla** (con encabezado) se crea una tabla con nombre `TablaN` (rango +
cabeceras leídas de la fila superior), persistida en el contenido (`tables`, hilado en `emit`) y
publicada con `rebuildTableRegistry` al montar y al crearla.

**Verificación:** nueva suite `tableRefs.spec.ts` (**13 aserciones**: expansión pura —columna,
`#Encabezados`, `#Todo`, `[]`, dobles corchetes, respeto de comillas/identificadores— y motor
REAL: `SUM(Ventas[Importe])`=600, `AVERAGE`, `SUMIF` con dos columnas de tabla, `MAX`). 26 suites
de hoja verdes; `lint web` 0 errores; `build web` ✓.

## 51. Office/Sheets — familia LAMBDA (funciones anónimas y de orden superior)

**Contexto.** `LAMBDA` y sus ayudantes (`MAP`, `REDUCE`, `SCAN`, `BYROW`, `BYCOL`, `MAKEARRAY`)
son la pieza más potente —y enteramente ausente— de Excel 365: permiten funciones anónimas y
programación funcional sobre matrices sin macros. El parser de Fortune-Sheet (a) no entiende la
sintaxis de invocación `LAMBDA(…)(…)` y (b) evalúa cada argumento ANTES de llamar a la función,
así que el cuerpo `x*2` falla con `#NAME?` (la `x` no existe aún) y las ayudantes no pueden recibir
una lambda «en crudo».

**Decisión (sólo `apps/web`, aditiva):** dos tiempos, como `LET` (§31) y las referencias
estructuradas (§50). `components/office/sheets/lambdaExpand.ts`:

1. **Preprocesado** `expandLambda(formula)` (en el parche de `parse`, antes que LET):
   - **Invocación directa** `LAMBDA(p…; cuerpo)(args…)` → sustitución en línea del cuerpo
     (queda una expresión normal que el MISMO parser evalúa; **los refs externos siguen vivos**).
   - **Lambda como argumento** de una orden-superior → se codifica como un literal de texto seguro
     `"§LMB§<encodeURIComponent(JSON)>"` (sin comillas internas → el parser lo pasa como un
     parámetro más).
2. **Funciones de orden superior** (`LAMBDA_FUNCTIONS`, fusionadas en `CUSTOM_FUNCTIONS`): reciben
   la matriz ya evaluada + la lambda codificada; decodifican el cuerpo y lo evalúan con un
   **sub-parser** (`new Parser()`, prototipo ya parcheado) sobre una **rejilla sintética** donde
   cada parámetro se enlaza a una celda/rango (`A1`, `A2`, `A1:C1`…). Así el cuerpo usa el
   parámetro como escalar (`x*2`) o como vector (`SUM(fila)`) con fidelidad. Devuelven matrices 2D
   que componen con `SUM`/`INDEX` (y el «spilling» §38 las derrama).

Cadena de `parse` resultante:
`normalizeFormula(expandLet(expandLambda(expandStructuredRefs(expr))))`.

**Límite (documentado):** el cuerpo de una orden-superior sólo ve sus parámetros (no refs externos
a la hoja; pásalos como argumentos). La invocación directa SÍ conserva los refs externos. La
lambda con nombre (`LET(f; LAMBDA(…); f(2))`) queda fuera de alcance.

**Verificación:** nueva suite `lambdaExpand.spec.ts` (**28 aserciones**: expansión pura de la
invocación directa y de la codificación; motor REAL — `LAMBDA(x,x+1)(5)`=6, `MAP`+`SUM`=30,
`MAP` de dos matrices=66, `REDUCE` suma/producto, `SCAN`, `BYROW`/`BYCOL` con `SUM`/`MAX`,
`MAKEARRAY` tabla de multiplicar). Sin regresiones: 27 suites de hoja + 3 de I/O Office verdes;
`lint web` 0 errores; `build web` ✓. UI: nueva categoría «Lambda y orden superior» en el asistente
de funciones.

## 52. Office/Sheets — constantes de matriz `{1,2,3}`

**Contexto.** Las constantes de matriz en línea (`=SUM({1,2,3})`, `=MATCH(7,{1,3,5,7,9},0)`,
`={"Lun","Mar","Mié"}`) son sintaxis básica de Excel que el parser de Fortune-Sheet no entiende:
las llaves revientan con `#ERROR!` antes de evaluar.

**Decisión (sólo `apps/web`, aditiva):** como en Excel una constante de matriz SÓLO contiene
**constantes** (números, texto, lógicos — nunca refs ni fórmulas), se resuelven por **preprocesado
de cadena** (igual técnica que `LET` §31 y la familia LAMBDA §51).
`components/office/sheets/arrayConst.ts` expone `expandArrayConst(formula)`, que parsea cada `{…}`
(fuera de comillas; `,` separa columnas y `;` filas) a una matriz 2D de valores y la sustituye por
`ARRCONST("§ARR§<encodeURIComponent(JSON)>")` —función registrada que devuelve esa matriz 2D—. Es
lo PRIMERO de la cadena de `parse`
(`…expandLambda(expandStructuredRefs(expandArrayConst(expr)))`), de modo que las constantes dentro
de `LET`/`LAMBDA` también se expanden. Componen con `SUM`/`COUNT`/`MAX`/`AVERAGE`/`INDEX`/`MATCH`/
`SUMPRODUCT`/`TEXTJOIN` y con la familia dinámica (`MAP`…); derraman con el «spilling» §38.

**Límite (documentado):** el motor sigue sin hacer «broadcasting» de un built-in sobre un vector de
índices (p. ej. `LARGE(rango,{1,2})` no devuelve dos resultados), igual que `FILTER` recibe la
máscara ya evaluada (§«modernFunctions»). La constante en sí se pasa correcta; quien debe iterar es
la función.

**Verificación:** nueva suite `arrayConst.spec.ts` (**21 aserciones**: expansión pura —fila,
columna, 2×2, texto, mezcla número/lógico/negativo, relleno rectangular, respeto de comillas— y
motor REAL: `SUM`/`COUNT`/`MAX`/`AVERAGE`/`INDEX`/`MATCH`/`SUMPRODUCT`/`TEXTJOIN` y `MAP` sobre
constantes). Sin regresiones: 28 suites de hoja + 3 de I/O Office verdes; `lint web` 0 errores;
`build web` ✓.

## 53. Office/Sheets — escalares ausentes/rotas en formulajs (ADDRESS, DOLLAR, FIXED, T, N, BASE, DECIMAL, TIMEVALUE)

**Contexto.** Auditando el motor REAL aparecieron varias funciones escalares comunes que
`@formulajs/formulajs@2.9.3` no trae o devuelve rotas: `ADDRESS`, `DOLLAR`, `FIXED`, `T`, `N`,
`BASE` (en minúsculas y sin relleno), `DECIMAL` (`#VALUE!`) y `TIMEVALUE` (`#VALUE!`).

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/scalarFunctions.ts` implementa
versiones fieles y las registra en `CUSTOM_FUNCTIONS`, que el parche de `getFunction` resuelve
ANTES del fallback a formulajs (`evaluateByOperator`) — misma técnica que `TEXT` (§«formulaEngine»).
Detalles de fidelidad: `DOLLAR` pone los negativos entre paréntesis y admite decimales negativos;
`FIXED` redondea «mitad lejos del cero» (como Excel) y opcionalmente quita los miles; `ADDRESS`
soporta los 4 modos de referencia absoluta/relativa, estilo R1C1 y prefijo de hoja; `BASE`/`DECIMAL`
cubren bases 2–36 en mayúsculas con validación; `TIMEVALUE` acepta `HH:MM[:SS]` con AM/PM.

**Sutileza del lexer (documentada):** el parser NO admite nombres de función de **una sola letra**
(`T(`, `N(`): los confunde con una referencia de columna y la fórmula revienta con `#ERROR!` ANTES
de resolver la función (nunca llega a `getFunction`). Se resuelve con un **alias por preprocesado**
(`aliasScalarFns`, primero en la cadena de `parse`): `T(`→`AXOST(`, `N(`→`AXOSN(` (5 letras → no son
columnas, máx. XFD), registradas bajo esos alias. Token completo y fuera de comillas, así
`TODAY(`/`COUNT(`/`MIN(`/`MAX(` no se tocan.

**Verificación:** nueva suite `scalarFunctions.spec.ts` (**33 aserciones** sobre el motor REAL:
los 4 modos de `ADDRESS` + R1C1 + hoja + columna de dos letras; `DOLLAR`/`FIXED` con negativos y
decimales negativos; `T`/`N` de texto/número/lógico/celda; `BASE`/`DECIMAL` con relleno, base 36 y
dígito inválido; `TIMEVALUE` mediodía/AM/medianoche/segundos; composición con `LEN`/`&`). Sin
regresiones: 29 suites de hoja + 3 de I/O Office verdes; `lint web` 0 errores; `build web` ✓.

## 54. Office/Sheets — estadísticas con nombre moderno (punto) + corrección de la normal

**Contexto.** Auditando el motor REAL, TODAS las funciones estadísticas con **nombre moderno con
punto** (Excel 2010+: `STDEV.S`, `VAR.P`, `NORM.DIST`, `RANK.EQ`, `QUARTILE.INC`, `BINOM.DIST`…)
devolvían `#NAME?`, mientras sus equivalentes legados (`STDEV`, `NORMDIST`…) sí funcionaban. Causa:
el fallback a formulajs (`evaluate-by-operator`) hace `symbol.split('.')` y busca un objeto ANIDADO
(`formulajs.NORM.S.DIST`) que no existe; formulajs sólo registra los nombres planos. Además
`NORMSDIST` estaba **roto**: devolvía la densidad (PDF), no la acumulada (CDF) — `NORMSDIST(0)`→0.3989
en vez de 0.5.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/statFunctions.ts` registra los
nombres con punto en `CUSTOM_FUNCTIONS` (que `getFunction` resuelve ANTES del fallback). La mayoría
**delegan** en la función legada de formulajs (misma firma, verificada con valores conocidos:
`STDEV.S`→`STDEV`, `VAR.P`→`VARP`, `RANK.EQ`→`RANK`, `BINOM.DIST`→`BINOMDIST`, `FORECAST.LINEAR`→
`FORECAST`…). La **familia normal** se implementa correcta (erf de Abramowitz-Stegun): `NORMSDIST`
(corregida a CDF), `NORM.S.DIST(z;acum)`, `NORM.DIST(x;μ;σ;acum)`. Y se añaden variantes que el
legado no trae: `QUARTILE.EXC`/`PERCENTILE.EXC` (interpolación exclusiva base `n+1`) y `RANK.AVG`
(promedio en empates).

**Nota de build:** `@formulajs/formulajs` no publica tipos; se añade
`sheets/formulajs.d.ts` (`declare module`) para que `next build` (tsc estricto) no falle por TS7016
(los specs con `npx tsx` no type-chequean, por eso sólo lo detecta el build).

**Verificación:** nueva suite `statFunctions.spec.ts` (**26 aserciones** sobre el motor REAL con
valores conocidos: `STDEV.S/P`, `VAR.S/P`, `MODE.SNGL`, `QUARTILE.INC/EXC`, `PERCENTILE.INC/EXC`,
`RANK.EQ/AVG`, la familia normal corregida —`NORMSDIST(0)`=0.5, `NORM.S.DIST` acum/densidad,
`NORM.S.INV(0.975)`≈1.96—, `BINOM.DIST`, `POISSON.DIST`, `FORECAST.LINEAR`, `CONFIDENCE.NORM`, y la
composición con `ROUND`). Sin regresiones: 30 suites de hoja + 3 de I/O Office verdes; `lint web` 0
errores; `build web` ✓.

## 55. Office/Sheets — funciones de base de datos (DSUM, DCOUNT, DGET…)

**Contexto.** La familia de funciones de base de datos de Excel (`DSUM`, `DCOUNT`, `DCOUNTA`,
`DAVERAGE`, `DMAX`, `DMIN`, `DPRODUCT`, `DGET`, `DSTDEV`, `DSTDEVP`, `DVAR`, `DVARP`) reventaba con
`#ERROR!` en formulajs 2.9.3. Es una familia coherente con UN solo algoritmo: agregar un campo de
un rango con encabezados sobre las filas que cumplen un rango de criterios (Y dentro de una fila, O
entre filas; admite operadores y comodines).

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/dbFunctions.ts` las implementa
como funciones personalizadas. Como el parser evalúa los argumentos antes de llamar, reciben `base`
y `criterios` como **matrices 2D** ya evaluadas (no necesitan acceso a la hoja). El criterio reutiliza
`matchesCriterion` (§«formulaEngine»: `>`, `<=`, `<>`, comodines `*`/`?`). El campo se resuelve por
nombre de encabezado o por índice 1-based. `DGET` devuelve `#VALUE!` si no hay coincidencias y
`#NUM!` si hay varias, como Excel; campo inexistente → `#VALUE!` (lo capta `IFERROR`).

**Verificación:** nueva suite `dbFunctions.spec.ts` (**19 aserciones** sobre el motor REAL con una
mini-base de 4 registros: criterio simple, combinado Y, operador `>150`, campo por índice, `DGET`
único/múltiple/vacío, `DVAR`/`DSTDEV`/`DVARP`, campo inexistente + `IFERROR`). Sin regresiones: 31
suites de hoja + 3 de I/O Office verdes; `lint web` 0 errores; `build web` ✓.

## 56. Office/Sheets — funciones matriciales (MMULT, MINVERSE, MDETERM, MUNIT) + SERIESSUM + ERROR.TYPE

**Contexto.** El álgebra matricial de Excel (`MMULT`, `MINVERSE`, `MDETERM`, `MUNIT`) faltaba en
formulajs 2.9.3 (`#NAME?`). Auditando aparecieron además `SERIESSUM` (rota, `#VALUE!`) y `ERROR.TYPE`
(nombre con punto → `#NAME?`, como las estadísticas §54).

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/matrixFunctions.ts`. Como el
parser evalúa los rangos a matrices 2D antes de llamar, son funciones personalizadas puras.
`MMULT`/`MINVERSE`/`MUNIT` DEVUELVEN matrices 2D que componen con `INDEX`/`SUM` y derraman con el
«spilling» (§38), igual que la familia dinámica. Álgebra con **eliminación gaussiana y pivoteo
parcial**: `MDETERM` (determinante; `#VALUE!` si no es cuadrada), `MINVERSE` (Gauss-Jordan; `#NUM!`
si es singular), `MMULT` (`#VALUE!` si las dimensiones no encajan). `SERIESSUM` = Σ coef_i·x^(n+i·m);
`ERROR.TYPE` mapea el error a 1–7 (o `#N/A` si no es error), reutilizando `errorCode`
(§«formulaEngine»).

**Verificación:** nueva suite `matrixFunctions.spec.ts` (**24 aserciones** sobre el motor REAL:
`MMULT` celda a celda + suma + dimensiones incompatibles; `MUNIT` diagonal; `MDETERM` 2×2/diagonal/
singular; `MINVERSE` celda a celda + `M·M⁻¹ = I` + singular `#NUM!`; `SERIESSUM` con paso 1 y 2;
`ERROR.TYPE` de `#N/A`/`#DIV/0!`/no-error + `IFERROR`). Sin regresiones: 32 suites de hoja + 3 de
I/O Office verdes; `lint web` 0 errores; `build web` ✓.

## 57. Office/Sheets — redondeo moderno (CEILING.MATH/FLOOR.MATH/…) + RANDARRAY + ENCODEURL

**Contexto.** Funciones matemáticas modernas ausentes en formulajs 2.9.3 (`#NAME?`): la familia de
**redondeo** con nombre nuevo (`CEILING.MATH`, `FLOOR.MATH`, `CEILING.PRECISE`, `FLOOR.PRECISE`,
`ISO.CEILING` — punto → objeto anidado inexistente, §54), la matriz dinámica `RANDARRAY` y
`ENCODEURL`.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/mathExtras.ts`. `CEILING.MATH`/
`FLOOR.MATH` respetan el argumento `modo` que controla la dirección de redondeo de los negativos
(hacia/desde el cero); las `*.PRECISE`/`ISO.CEILING` ignoran el signo de la cifra significativa y
van siempre hacia ±∞. `RANDARRAY([filas];[cols];[mín];[máx];[entero])` DEVUELVE una matriz 2D (que
compone con `SUM`/`ROWS`/`COLUMNS` y derrama, §38). `ENCODEURL` = `encodeURIComponent`.

**Verificación:** nueva suite `mathExtras.spec.ts` (**20 aserciones** sobre el motor REAL: redondeo
de positivos/negativos con `modo`, `*.PRECISE` hacia ±∞; `RANDARRAY` comprobando forma —`ROWS`/
`COLUMNS`— y cotas —`[mín,máx]`, entero, suma acotada—; `ENCODEURL`). Sin regresiones: 33 suites de
hoja + 3 de I/O Office verdes; `lint web` 0 errores; `build web` ✓.

## 58. Office/Sheets — fechas internacionales (WORKDAY.INTL / NETWORKDAYS.INTL)

**Contexto.** `WORKDAY.INTL` y `NETWORKDAYS.INTL` (ausentes en formulajs, `#NAME?`) generalizan a
`WORKDAY`/`NETWORKDAYS`: en vez del fin de semana fijo Sáb-Dom aceptan un **fin de semana
configurable** —código numérico (1–7, 11–17) o **máscara de 7 caracteres** `"0000011"` (Lun…Dom,
`1`=no laborable)— más una lista de festivos.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/dateIntl.ts`. Aritmética de días
en **UTC** (evita saltos por horario de verano), iterando día a día sobre el número de serie de
Excel. Devuelven objetos `Date` (como las funciones legadas), que la rejilla formatea. `weekendSet`
traduce el código/máscara a un conjunto de días `getUTCDay`; código inválido → `#NUM!`.
`NETWORKDAYS.INTL` cuenta inclusivo y conserva el signo si las fechas van al revés.

**Verificación:** nueva suite `dateIntl.spec.ts` (**12 aserciones** sobre el motor REAL: `+5`/`-3`
días, máscara de texto, festivo que se salta, código inválido `#NUM!`; recuento sólo-domingo,
con festivo, invertido con signo, mismo día). Sin regresiones: 34 suites de hoja + 3 de I/O Office
verdes; `lint web` 0 errores; `build web` ✓.

## 59. Office/Sheets — distribuciones χ²/F/t (colas e inversas) correctas

**Contexto.** Las distribuciones de contraste de hipótesis (χ², F, t de Student) de
`@formulajs/formulajs@2.9.3` son **numéricamente incorrectas**: `CHIINV(0.05,1)`→0.0039 (debería ser
3.841), `FINV`/`TINV` igual de mal, y los nombres modernos `CHISQ.DIST.RT`, `F.INV.RT`, `T.DIST.2T`…
ni existen (`#NAME?`). Es la base de las pruebas χ², ANOVA y t.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/distributions.ts` las implementa
**correctas** sobre dos funciones especiales (algoritmos de Numerical Recipes): la **gamma incompleta
regularizada** `P(a,x)` (serie + fracción continua) y la **beta incompleta regularizada** `Iₓ(a,b)`
(fracción continua de Lentz). Sobre ellas se construyen los CDF (χ² = `P(df/2, x/2)`; F = `I` con
`d1·x/(d1·x+d2)`; t con `I(df/2,½)`), sus colas derecha/dos-colas, y las **inversas por bisección**.
Se registran tanto los nombres modernos (`CHISQ.DIST[.RT]`, `CHISQ.INV[.RT]`, `F.DIST[.RT]`,
`F.INV[.RT]`, `T.DIST[.RT|.2T]`, `T.INV[.2T]`) como los **legados corregidos** (`CHIDIST`, `CHIINV`,
`FDIST`, `FINV`, `TINV`), que ganan al fallback roto de formulajs.

**Verificación:** nueva suite `distributions.spec.ts` (**19 aserciones** contra valores críticos
conocidos: χ²₀.₀₅,₁=3.841 y con 5 g.l.=11.07; F₀.₀₅,₃,₄=6.591; t₀.₀₂₅,₁₀=2.228 y t₀.₀₅,₁₀=1.812;
acumuladas; legados corregidos; `#NUM!` en dominios inválidos; composición con `ROUND`). Sin
regresiones: 35 suites de hoja + 3 de I/O Office verdes; `lint web` 0 errores; `build web` ✓.

## 60. Office/Sheets — distribuciones gamma/beta/hipergeométrica/binomial negativa

**Contexto.** Completa la familia estadística (§59) con las distribuciones que faltaban: nombres
modernos `GAMMA.DIST`/`GAMMA.INV`/`BETA.DIST`/`BETA.INV`/`GAMMALN.PRECISE` (`#NAME?` por el punto) y
las discretas `HYPGEOM.DIST`/`NEGBINOM.DIST` (ausentes), más `PERCENTRANK.EXC`. La `BETADIST` de
formulajs además estaba rota (`#VALUE!`).

**Decisión (sólo `apps/web`, aditiva):** se añaden a `distributions.ts`, reutilizando `P(a,x)` e
`Iₓ(a,b)` (§59). Gamma: CDF `P(α, x/β)`, PDF cerrada e inversa por bisección. Beta: CDF `Iₓ(α,β)`
con **escalado opcional `[A,B]`** (`y=(x−A)/(B−A)`) e inversa. Discretas con log-combinaciones
(`gammaln`) para evitar desbordes: hipergeométrica `C(K,k)·C(N−K,n−k)/C(N,n)` y binomial negativa
`C(f+s−1, s−1)·pˢ·(1−p)ᶠ`, ambas con su acumulada. `PERCENTRANK.EXC` da la posición exclusiva de
`x` dividida por `n+1`.

**Verificación:** `distributions.spec.ts` ampliada a **30 aserciones** (las 19 de χ²/F/t + 11 nuevas
contra valores conocidos: `GAMMA.DIST(10,9,2)`=0.06809, `BETA.DIST(0.4,2,3)`=0.5248 y con escalado,
`HYPGEOM.DIST(1,4,4,10)`=0.38095, `NEGBINOM.DIST(5,3,0.5)`=0.08203, `PERCENTRANK.EXC`=0.5). Sin
regresiones: 35 suites de hoja + 3 de I/O Office verdes; `lint web` 0 errores; `build web` ✓.

## 61. Office/Sheets — valores financieros con descuento (DISC, PRICEDISC, INTRATE…)

**Contexto.** Las funciones de valores con descuento (`DISC`, `PRICEDISC`, `YIELDDISC`, `INTRATE`,
`RECEIVED`, `ACCRINTM`) revientan en formulajs con fechas en texto (`#ERROR!`). Todas se reducen a
una **fracción de año** entre liquidación y vencimiento según la convención de cómputo (`basis`).

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/securities.ts` implementa una
`yearFrac(a, b, basis)` **fiel a Excel** para las 5 bases (0 = 30/360 NASD con sus reglas de fin de
febrero/día 31; 1 = real/real con promedio de longitud de año; 2 = real/360; 3 = real/365;
4 = 30/360 europeo) y sobre ella las seis funciones (p. ej. `DISC = (amort−precio)/amort / yf`,
`ACCRINTM = nominal·tasa·yf`). Fechas como texto/serie/Date; liquidación ≥ vencimiento → `#NUM!`.

**Verificación:** nueva suite `securities.spec.ts` (**12 aserciones** sobre el motor REAL con un
caso Ene 1→Jul 1 (yf=0.5): `DISC`=0.1, `PRICEDISC`=97.5, `YIELDDISC`/`INTRATE`=0.10526,
`RECEIVED`=97.436, `ACCRINTM`=25; bases act/365, act/360, europea; `#NUM!` + `IFERROR`; composición
con `ROUND`). Sin regresiones: 36 suites de hoja + 3 de I/O Office verdes; `lint web` 0 errores;
`build web` ✓.

## 62. Office/Sheets — bonos con cupón (PRICE, YIELD, DURATION, COUP*)

**Contexto.** Las funciones estrella de renta fija de Excel —`PRICE`, `YIELD`, `DURATION`,
`MDURATION` y el calendario de cupones (`COUPNCD`, `COUPPCD`, `COUPNUM`, `COUPDAYS`, `COUPDAYBS`,
`COUPDAYSNC`)— revientan en formulajs (`#ERROR!`). Son la base de la valoración de bonos.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/bonds.ts`. Genera el **calendario
de cupones** retrocediendo desde el vencimiento en pasos de `12/frecuencia` meses (conservando el
fin de mes) para hallar el cupón previo/siguiente y el número restante; `PRICE` usa la fórmula
estándar (con el caso especial de un único periodo), `YIELD` la **invierte por bisección**,
`DURATION` es la duración de Macaulay sobre los flujos descontados y `MDURATION` la modificada.
Cómputo de días por `basis` (30/360 NASD/europeo o real).

**Verificación (clave):** se contrastó contra los **ejemplos DOCUMENTADOS por Microsoft** y
coinciden exactamente: `PRICE(2008-02-15, 2017-11-15, 5.75%, 6.5%, 100, 2, 0)` = **94.63436**;
`YIELD(…, 95.04287, …)` = **0.065**; `DURATION(2008-01-01, 2016-01-01, 8%, 9%, 2, 1)` = **5.993775**;
`MDURATION` = 5.73567; `COUPNUM` = 4, `COUPDAYS` = 181, `COUPDAYBS` = 71, `COUPDAYSNC` = 110,
`COUPNCD` = 2007-05-15, `COUPPCD` = 2006-11-15. Suite `bonds.spec.ts` (**15 aserciones**: ejemplos de
Microsoft + coherencia PRICE↔YIELD, par cuando cupón=rendimiento, MDURATION<DURATION, `#NUM!`). Sin
regresiones: 37 suites de hoja + 3 de I/O Office verdes; `lint web` 0 errores; `build web` ✓.

## 63. Office/Sheets — contrastes estadísticos modernos (T.TEST, F.TEST…) + CONFIDENCE.T

**Contexto.** Cierra la modernización de nombres estadísticos: los contrastes con punto (`T.TEST`,
`F.TEST`, `CHISQ.TEST`, `Z.TEST`, `BINOM.INV`) y los alias de ingeniería `ERF.PRECISE`/`ERFC.PRECISE`
devolvían `#NAME?` (el fallback de formulajs busca un objeto anidado), aunque su versión LEGADA
existe y es correcta. `CONFIDENCE.T` (intervalo con la t de Student) faltaba por completo.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/statTests.ts` **delega** los
nombres con punto en el legado verificado (`T.TEST`→`TTEST`, `F.TEST`→`FTEST`, `CHISQ.TEST`→
`CHITEST`, `Z.TEST`→`ZTEST`, `BINOM.INV`→`CRITBINOM`, `ERF.PRECISE`→`ERF`, `ERFC.PRECISE`→`ERFC`) y
calcula `CONFIDENCE.T(α, σ, n) = T.INV.2T(α, n−1)·σ/√n` reutilizando la t de §59.

**Verificación:** nueva suite `statTests.spec.ts` (**12 aserciones** sobre el motor REAL:
`T.TEST`=0.22678, `F.TEST`=1.47059, `Z.TEST`=0.5, `BINOM.INV`=5, igualdad con el nombre legado;
`ERF.PRECISE`+`ERFC.PRECISE`=1; `CONFIDENCE.T(0.05,1,10)`≈0.7154 y > `CONFIDENCE.NORM`). Sin
regresiones: 38 suites de hoja + 3 de I/O Office verdes; `lint web` 0 errores; `build web` ✓.

## 64. Office/Sheets — correcciones de fidelidad (ROUND mitad-lejos-del-cero, SUBSTITUTE n-ésima)

**Contexto.** Una auditoría de **valores conocidos** sobre funciones MUY comunes destapó dos
divergencias de `@formulajs/formulajs@2.9.3` respecto a Excel:
- `ROUND` usa `Math.round` (mitad hacia +∞): `ROUND(-2.5, 0)` daba **-2** en vez de **-3**; y el
  error de coma flotante estropeaba `ROUND(1.005, 2)` y `ROUND(2.675, 2)`.
- `SUBSTITUTE(texto, viejo, nuevo, n)` con instancia sustituía la ocurrencia equivocada:
  `SUBSTITUTE("aaa","a","b",2)` daba **"aab"** en vez de **"aba"**.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/fidelityFixes.ts` registra
versiones fieles en `CUSTOM_FUNCTIONS` (ganan al fallback de formulajs). `ROUND` redondea «mitad
lejos del cero» con una corrección ε para el error de coma flotante; `SUBSTITUTE` recorre las
ocurrencias y sustituye exactamente la n-ésima.

**Verificación:** nueva suite `fidelityFixes.spec.ts` (**20 aserciones** sobre el motor REAL:
`ROUND` de positivos/negativos a la mitad, casos de coma flotante 1.005→1.01 y 2.675→2.68, decimales
negativos, composición con `SUM`; `SUBSTITUTE` de la 2ª/3ª/todas las ocurrencias, sin coincidencia,
instancia fuera de rango, composición con `LEN`). Sin regresiones: 39 suites de hoja + 3 de I/O
Office verdes; `lint web` 0 errores; `build web` ✓.

## 65. Office/Sheets — corrección de PERCENTILE/QUARTILE (interpolación inclusiva)

**Contexto.** Siguiendo la auditoría de fidelidad (§64), `PERCENTILE` de `@formulajs/formulajs@2.9.3`
**interpola mal**: `PERCENTILE({1,2,3,4}, 0.25)` daba **1.25** en vez de **1.75**, pese a que su
`QUARTILE` —que debería coincidir (`QUARTILE(·,1) ≡ PERCENTILE(·,0.25)`)— sí daba 1.75. Como
`PERCENTILE.INC` (§54) delegaba en ese `PERCENTILE`, también quedaba mal.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/percentileFix.ts` implementa el
percentil **inclusivo** de Excel (interpolación lineal sobre el rango 0-based `p·(n−1)`) y registra
`PERCENTILE`, `PERCENTILE.INC`, `QUARTILE`, `QUARTILE.INC` —se fusiona DESPUÉS de `STAT_FUNCTIONS`
para imponerse a la delegación— de modo que toda la familia inclusiva es coherente. Los exclusivos
(`PERCENTILE.EXC`/`QUARTILE.EXC`, §54) no se tocan.

**Verificación:** nueva suite `percentileFix.spec.ts` (**16 aserciones** sobre el motor REAL:
`PERCENTILE` 0.25/0.5/0.75/0.3 y sobre rango real, `#NUM!` fuera de `[0,1]`; `QUARTILE` Q0–Q4 con
`#NUM!` fuera de rango; coherencia `QUARTILE Q2 == MEDIAN` y `PERCENTILE 0.25 == QUARTILE Q1`). Sin
regresiones: 40 suites de hoja + 3 de I/O Office verdes; `lint web` 0 errores; `build web` ✓.

## 66. Office/Sheets — regresión lineal/exponencial (TREND, GROWTH, SLOPE, INTERCEPT, FORECAST)

**Contexto.** `TREND` y `GROWTH` (predicción por tendencia, muy usadas en previsión) están rotas en
`@formulajs/formulajs@2.9.3` (`#VALUE!`/`#REF!`), e `INTERCEPT` falla con vectores fila —p. ej.
constantes de matriz `{…}`— mientras `SLOPE` sí funciona (incoherencia).

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/regression.ts` implementa toda la
familia por mínimos cuadrados, de forma coherente para rangos y constantes de matriz, y la registra
DESPUÉS de las demás para imponerse. `TREND`/`GROWTH` DEVUELVEN una matriz 2D con la forma de
`nueva_x` (componen con `INDEX`/`SUM` y derraman, §38); `GROWTH` ajusta `ln(y)` linealmente; el
argumento `constante=FALSO` fuerza la recta/curva por el origen. `SLOPE`/`INTERCEPT`/`FORECAST`/
`FORECAST.LINEAR` comparten el mismo ajuste.

**Verificación:** nueva suite `regression.spec.ts` (**13 aserciones** sobre el motor REAL con la
recta `y=0.6x+2.2`: `SLOPE`=0.6, `INTERCEPT`=2.2 (y con constante fila, antes `#VALUE!`),
`FORECAST(6)`=5.8; `TREND` con `INDEX`/`SUM`, sin x, y por el origen; `GROWTH` exponencial=16 y
`#NUM!` con `y≤0`). Sin regresiones: 41 suites de hoja + 3 de I/O Office verdes; `lint web` 0
errores; `build web` ✓.

## 67. Office/Sheets — LOGEST (completa la familia de regresión)

**Contexto.** Tras añadir la regresión lineal (§66), faltaba `LOGEST` —los coeficientes de la
regresión **exponencial** `y = b·mˣ`— que en `@formulajs/formulajs@2.9.3` revienta (`#ERROR!`).
Es la pareja de `GROWTH` (predicción) igual que `LINEST` lo es de `TREND`.

**Decisión (sólo `apps/web`, aditiva):** se añade `LOGEST` a `regression.ts` reutilizando el mismo
ajuste por mínimos cuadrados sobre `ln(y)`: devuelve la matriz `{m, b}` con `m = e^pendiente` y
`b = e^intersección`. (`LINEST` ya funciona en formulajs, así que no se toca.)

**Verificación:** `regression.spec.ts` ampliada a **17 aserciones** (las 13 de la recta + 4 de
`LOGEST`: `{1,2,4,8}` → m=2, b=0.5; `{6,12,24}` con x → b=3; `#NUM!` con `y≤0`; coherente con
`GROWTH`). Sin regresiones: 41 suites de hoja + 3 de I/O Office verdes; `lint web` 0 errores;
`build web` ✓.

## 68. Office/Sheets — el asistente de funciones expone toda la biblioteca nueva

**Contexto.** Las ~18 fases anteriores añadieron 100+ funciones (financieras avanzadas, base de
datos, distribuciones, matrices, ingeniería, regresión…), pero el **asistente de funciones**
(`SheetFunctionWizard`) solo listaba las categorías iniciales: lo nuevo era invisible para el
usuario. En Excel el cuadro «Insertar función» es exhaustivo; esto cierra ese hueco de
descubribilidad.

**Decisión (sólo `apps/web`, aditiva):** se amplía `SheetFunctionWizard.tsx` de 116 a **190**
funciones: se completa «Financieras» (IPMT/PPMT/CUMIPMT/XNPV/XIRR, amortización SLN/DB/DDB/SYD,
EFFECT/NOMINAL, y los bonos PRICE/YIELD/DURATION/MDURATION/COUPNUM/DISC/ACCRINTM/DOLLARDE/DOLLARFR)
y se añaden tres categorías nuevas: «Base de datos» (DSUM/DCOUNT/DGET…), «Estadística avanzada»
(distribuciones NORM/T/CHISQ/F/GAMMA/BETA/BINOM/POISSON/HYPGEOM, CONFIDENCE.T, regresión TREND/
GROWTH/SLOPE/INTERCEPT/FORECAST/CORREL, percentiles y rangos modernos) e «Ingeniería y matrices»
(MMULT/MINVERSE/MDETERM/MUNIT, CONVERT, BASE/DECIMAL, conversiones DEC2HEX…, bits, complejos, GCD/
LCM, DELTA/GESTEP). Cada entrada lleva sintaxis y ayuda de argumentos en español, como las demás.

**Verificación:** sonda funcional sobre el motor REAL de una llamada representativa de **cada una de
las 50 familias añadidas** → todas operativas (sin `#NAME?`/`#ERROR!`), de modo que el asistente
nunca anuncia una función rota. `lint web` 0 errores; `build web` ✓.

## 69. Office/Sheets — difusión (broadcasting) de operadores sobre matrices

**Contexto.** La mayor limitación del motor, documentada desde §«modernFunctions»: el parser de
Fortune-Sheet evalúa los operadores binarios (`+ - * / ^ > < >= <= = <> &`) sólo con escalares, así
que `A1:A10>5` colapsaba a un escalar y los idiomas de matriz de Excel —`(rango>x)*1`,
`SUMPRODUCT((a>b)*c)`, `{1,2,3}+{10,20,30}`— fallaban. Por eso `FILTER` necesitaba la máscara ya
evaluada.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/broadcast.ts` **envuelve el
despachador de operadores por instancia** (`parser.parser.yy.evaluateByOperator`, fijado en el
constructor; `registerOperation` no se exporta). Si algún operando es una matriz 2D, el operador se
aplica elemento a elemento estilo Excel (escalar↔matriz se recicla; columna n×1 ⊗ fila 1×m → matriz
n×m) devolviendo una matriz 2D que compone con `SUM`/`SUMPRODUCT`/… y derrama (§38). Se engancha en
el parche de `parse` (`installBroadcast(this.parser.yy)`). Corrige además que los aritméticos de
formulajs no convertían los lógicos (`toNumber(true)=undefined`→`#VALUE!`): `VERDADERO→1`/`FALSO→0`
para `+ - * / ^`, lo que hace funcionar `(rango>x)*1`. El camino escalar sólo cambia por esa coerción
(que únicamente puede arreglar, nunca romper, pues antes daba error).

**Límite (documentado):** el **menos unario** (`-`/idioma `--(…)`) lo trata el gramático de forma
especial y no compone con matrices de forma fiable → úsese `(…)*1`.

**Verificación:** nueva suite `broadcast.spec.ts` (**19 aserciones** sobre el motor REAL:
`(A1:A5>2)*1`, `SUMPRODUCT((a>2)*B)`, doble condición, aritmética rango↔escalar y rango↔rango,
constantes de matriz, producto exterior columna×fila, `&` difundido, y que los escalares NO se
rompen + lógico·número). **Sin regresiones: las 46 suites de spec de Office verdes** (la prueba
clave, porque toca el camino de evaluación central); `lint web` 0 errores; `build web` ✓.

## 70. Office/Sheets — IF consciente de matrices (cierra las fórmulas matriciales)

**Contexto.** Tras la difusión de operadores (§69), `A1:A10>5` ya da una matriz de lógicos, pero el
idioma clásico de fórmula matricial `SUM(IF(rango>x; valores; otro))` seguía fallando: el `IF` de
formulajs es escalar y, con una condición-matriz, evalúa la matriz como un único «verdadero» y
devuelve la rama verdadera entera.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/arrayIf.ts` registra un `IF` que,
si la **condición es una matriz 2D**, selecciona elemento a elemento entre las ramas verdadera/falsa
(escalares —se reciclan— o matrices), devolviendo una matriz 2D que compone con `SUM`/`SUMPRODUCT`/…
y derrama (§38). Si la condición es **escalar**, delega en el MISMO `formulajs.IF` que ya usaba el
motor → comportamiento idéntico y **riesgo cero de regresión** (clave, porque `IF` es ubicua).

**Verificación:** nueva suite `arrayIf.spec.ts` (**15 aserciones**: IF escalar idéntico —verdadero/
falso, comparación, número, sin rama falsa, sobre celda—; e IF con condición-matriz —`SUM(IF(a>2,a))`
=12, devolver otra columna, cuenta condicional, elegir A o B por elemento, texto, doble condición,
con constantes de matriz). Sin regresiones: las 46 suites de spec de Office verdes; `lint web` 0
errores; `build web` ✓.

## 71. Office/Sheets — fidelidad de fecha/hora (HOUR/MINUTE/SECOND con texto; EDATE fin de mes)

**Contexto.** La auditoría de valores conocidos destapó dos bugs comunes de `@formulajs/formulajs`:
`HOUR`/`MINUTE`/`SECOND` revientan con una hora en **texto** (`HOUR("13:45:30")`→`#VALUE!`) aunque
Excel la parsea, y `EDATE` no **recorta al fin de mes**: `EDATE(31-ene, +1)` daba 2-mar en vez de
29-feb.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/dateTimeFix.ts` registra versiones
fieles en `CUSTOM_FUNCTIONS`. `HOUR`/`MINUTE`/`SECOND` aceptan texto (`HH:MM[:SS]` con AM/PM), número
de serie (fracción de día) y `Date`. `EDATE` suma meses y recorta el día al último del mes destino
(bisiestos correctos), devolviendo un `Date` como las demás funciones de fecha.

**Verificación:** nueva suite `dateTimeFix.spec.ts` (**18 aserciones**: `HOUR`/`MINUTE`/`SECOND` de
texto/AM/PM/medianoche/serie/`TIMEVALUE`, texto inválido → `#VALUE!`+`IFERROR`; `EDATE` 31-ene+1 en
año bisiesto y no, 31-mar−1, cruce de año, 31-may+1=30-jun). Sin regresiones: las 47 suites de spec
de Office verdes; `lint web` 0 errores; `build web` ✓.

## 72. Office/Sheets — fidelidad matemática (LOG base 10, CEILING/FLOOR cifra 1 por defecto)

**Contexto.** La auditoría de valores conocidos destapó tres funciones MUY comunes que en
`@formulajs/formulajs@2.9.3` fallan cuando se omite su argumento opcional (no le ponen el valor por
defecto de Excel): `LOG(100)`→`#NUM!` (debería usar base 10 → 2), `CEILING(4.3)`→0 (cifra 1 → 5),
`FLOOR(4.7)`→0 (cifra 1 → 4).

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/mathFidelity.ts` registra `LOG`/
`CEILING`/`FLOOR` que **rellenan el valor por defecto que faltaba** (base 10, cifra 1) y **delegan en
el mismo `formulajs`** cuando el argumento SÍ está → comportamiento idéntico con el argumento
explícito y riesgo cero de regresión.

**Verificación:** nueva suite `mathFidelity.spec.ts` (**15 aserciones**: `LOG(100)`=2, `LOG(8,2)`=3,
`CEILING(4.3)`=5 y con cifra explícita, `FLOOR(4.7)`=4 y con cifra, composición con `SUM`/`POWER`).
Sin regresiones: las 48 suites de spec de Office verdes; `lint web` 0 errores; `build web` ✓.

## 73. Office/Sheets — truncamiento de argumentos enteros en texto (REPT/RIGHT/MID/ROMAN)

**Contexto.** Excel **trunca hacia cero** los argumentos de conteo/longitud/posición fraccionarios
(`REPT("ab", 2.9)`=`"abab"`), pero `@formulajs/formulajs@2.9.3` los **redondea** o **revienta**:
`REPT(_, 2.9)`→`#ERROR!`, `RIGHT("hello", 2.9)`→`"llo"` (3 caracteres en vez de 2), `MID`/`ROMAN`
con fracción → resultado erróneo. (`LEFT` ya truncaba.)

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/textTrunc.ts` registra `REPT`/
`LEFT`/`RIGHT`/`MID`/`ROMAN` que **truncan** cada argumento entero antes de **delegar en el mismo
`formulajs`** (correcto con enteros) → idéntico con enteros, riesgo cero.

**Verificación:** nueva suite `textTrunc.spec.ts` (**15 aserciones**: `REPT`/`RIGHT`/`MID`/`ROMAN` con
fracción truncan; enteros y valores por defecto intactos; composición con `LEN`/`ROUND`). Sin
regresiones: las 49 suites de spec de Office verdes; `lint web` 0 errores; `build web` ✓.

## 74. Alertas proactivas de KPI (Fase 11 CIDE)

**Contexto.** El Centro de Inteligencia mostraba KPIs (valor + sparkline) pero era
pasivo: nadie avisaba cuando un KPI cruzaba su objetivo o empeoraba.

**Decisión.** Alertas **deterministas y RBAC-gated** sobre lo ya construido:
- **Objetivo (target) editable** en el editor self-serve: `UpsertMetricDto` gana
  `target?` (persistido en `MetricDefinition.config.target` vía `applyTarget`).
- `SemanticService.evaluateAlerts(principal)` combina valor en vivo + `direction`
  + snapshots (§28→tendencia): **(1)** *breach de objetivo* (severidad por
  magnitud; ≥20% → critical); **(2)** *tendencia adversa* (≥15% contra
  `direction`). Endpoint `GET /api/semantic/alerts`; herramienta CIDE `kpi_alerts`.
- **UI:** el Centro de Inteligencia abre con la sección "Alertas de KPI".

**Sin entidades nuevas** (target vive en `config`). Build API/web ✓, lint web 0
errores, 768/768 tests.

## 75. Alertas push de KPI a admins (Fase 12 CIDE)

**Contexto.** Las alertas (§74) eran visibles solo en el tablero; faltaba que el
sistema **alcanzara** al responsable.

**Decisión.** `SemanticService.notifyAlerts` evalúa alertas (actor sistema), filtra
**críticas** y crea una notificación por admin vía `NotificationsService.create`
(in-app + web push), con `dedupeKey` por métrica+kind+día (anti-spam: una por KPI
crítico por día). Solo las críticas se pushean (alta señal). Enganchado al **cron
diario** existente (tras el snapshot) + endpoint admin `POST /api/semantic/alerts/notify`
y botón "Notificar a admins" en el tablero. Servicios resueltos por `ModuleRef`
(módulo desacoplado); el contexto de tenant tiene fallback seguro fuera de request;
best-effort (nunca rompe el cron).

**Sin entidades nuevas.** Build API/web ✓, lint web 0 errores, 777/777 tests.

## 76. Borrado lógico en el editor de catálogo (Fase 13 CIDE)

**Contexto.** El editor self-serve (§25/§27) permitía crear y editar
métricas/objetos/relaciones, pero no **retirarlos**.

**Decisión.** Borrado lógico (reversible) usando la columna `active` existente:
`SemanticService.setActive(tenantId, kind, key, active)`;
`catalog(tenantId, includeInactive)` (el editor admin ve también los archivados;
para no-admin se ignora). Endpoints `GET /catalog?includeInactive=true` y
`POST /semantic/archive` (admin, `ArchiveItemDto`). En la UI, cada fila gana
**Archivar/Restaurar** + badge. Como el catálogo filtra `active:true`, archivar
oculta el ítem de CIDE y los tableros automáticamente.

**Sin entidades nuevas.** Build API/web ✓, lint web 0 errores, 788/788 tests.

> **Nota de proceso (Fases 11–13).** Estas entradas se agregaron en un PR-doc
> separado: `main` mergea PRs de Office/Sheets cada pocos minutos sobre
> `DECISIONS.md`, lo que causaba una carrera de conflictos que bloqueaba el CI. Se
> mantuvieron las ramas de feature **solo-código** y se saldó la deuda documental
> aquí, de una vez.

## 77. Office/Sheets — difusión de funciones escalares sobre matrices (cierra las fórmulas matriciales)

**Contexto.** Las fórmulas matriciales se construyeron en tres capas: la difusión de **operadores**
(§69, `rango*2`, `rango>x`) y el **`IF` matricial** (§70, selección elemento a elemento). Faltaba la
tercera: las **funciones escalares** (`ROUND`, `ABS`, `TEXT`, `LEN`, `LEFT`…) seguían sin aplicarse
celda a celda en contexto matricial. `SUM(ROUND(A1:A5*1.1; 0))`, `TEXT({1;2;3}; "000")` o
`FILTER(B; ABS(A)>x)` daban `#VALUE!` porque la función recibía la matriz entera en vez de cada
elemento. En Excel, una función escalar dentro de una fórmula matricial se difunde por definición.

**Decisión (sólo `apps/web`, aditiva):** `components/office/sheets/scalarBroadcast.ts` envuelve un
**conjunto curado** de ~37 funciones escalares (sólo unarias/diádicas elemento a elemento — **nunca**
agregados como `SUM`/`MAX` ni de matriz como `FILTER`/`SORT`). `broadcast(impl)` deja pasar los
argumentos escalares sin tocarlos y, si alguno es matriz 2D, aplica la función a cada celda
reciclando los escalares y, como los operadores, columna n×1 ⊗ fila 1×m → matriz n×m; devuelve una
matriz 2D que compone con `SUM`/`SUMPRODUCT`/`TEXTJOIN`/… y derrama (§38). `applyScalarBroadcast`
muta `CUSTOM_FUNCTIONS` tras el literal: usa la implementación propia ya registrada (p. ej. los
arreglos de fidelidad §72/§73) o un delegado a `formulajs`. **Riesgo cero**: con argumentos escalares
se llama a la implementación original sin cambios; sólo los argumentos-matriz (que antes fallaban)
activan la difusión.

Con esto, **las tres capas cierran el paradigma matricial**: operadores (§69) + `IF` (§70) +
funciones escalares (§77). El caso emblemático que documentaba la limitación —`FILTER(B1:B5;
A1:A5>2)` con condición calculada— y composiciones como `SUMPRODUCT(ROUND(rango;0); otro)` ya
funcionan de extremo a extremo.

**Verificación:** nueva suite `scalarBroadcast.spec.ts` (**20 aserciones**: escalar intacto en
`ROUND`/`ABS`/`TEXT`/`LEN`/`SQRT`/`LEFT`; difusión de `ROUND`/`ABS`/`INT`/`POWER`/`MOD`/`SQRT`/`LEN`/
`TEXT`/`UPPER`/`LEFT` sobre rangos y constantes `{…}`; `ROUND(rango·escalar)`; composición con
`SUM`/`SUMPRODUCT`/`TEXTJOIN`; combinación con operadores §69 e `IF` matricial §70). Sin regresiones:
las 49 suites de spec de Office verdes; `lint web` 0 errores; `build web` ✓.

## 78. Office/Sheets — autofiltro personalizado (comodines, empieza/termina, Y/O)

**Contexto.** El filtro de datos (`buildFilter`/`matchesCriterion`) ya admitía varios criterios pero
**siempre en AND** y con `=`/`!=` de **coincidencia exacta**. Excel ofrece más en su *Autofiltro
personalizado*: **comodines** (`*` = cualquier secuencia, `?` = un carácter, `~` escapa), operadores
**«empieza por»/«termina en»**, y **dos condiciones** sobre la misma columna unidas por **Y/O**.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):**
- `matchesCriterion` gana `beginsWith`/`endsWith` (insensibles a mayúsculas) y, en `=`/`!=`,
  **comodines de Excel** vía `wildcardToRegExp` — *sólo* cuando el valor contiene `*`/`?`; sin
  comodines, la comparación exacta/numérica queda **idéntica** (los tests previos siguen verdes).
- `buildFilter` acepta `conjunction?: 'AND' | 'OR'` (por defecto `AND`, comportamiento previo); con
  `'OR'` basta que se cumpla **algún** criterio.
- UI (`SheetDataDialog`, modo filtro): réplica del *Autofiltro personalizado* de Excel — una o **dos
  condiciones** sobre la misma columna con selector **Y (ambas) / O (cualquiera)**, nuevos operadores
  en el desplegable y aviso de que se admiten comodines `*`/`?`.

**Verificación:** `filter.spec.ts` ampliado (**27 aserciones**, +14: OR de criterios, comodines
`N*`/`?orte`/`~*` literal, `beginsWith`/`endsWith`, comodín dentro de `buildFilter`, y los casos
previos intactos). Sin regresiones: las 49 suites de spec de Office verdes; `lint web` 0 errores;
`build web` ✓.

## 79. Office/Sheets — combinar y separar celdas (UI)

**Contexto.** El roundtrip XLSX ya **preservaba** las combinaciones (`config.merge`), pero no había
forma de **crearlas** ni **deshacerlas** dentro de la app — una operación cotidiana en Excel
(«Combinar y centrar»).

**Decisión (sólo `apps/web`, aditiva — riesgo cero):**
- `sheetOps.ts` gana `mergeCells(sheet, range)` y `unmergeCells(sheet, range)` **puras**. `mergeCells`
  escribe `config.merge["r_c"] = { r, c, rs, cs }` — **el mismo formato que el roundtrip XLSX**, que
  Fortune-Sheet ya renderiza al recargar y exporta a `.xlsx` sin pérdida; retira primero cualquier
  combinación que se solape. El contenido del ancla se conserva y el de las celdas cubiertas queda
  **oculto** (no se borra → separar lo recupera; menos destructivo que Excel). `unmergeCells` quita
  toda combinación que intersecte el rango y devuelve cuántas.
- UI: menú **«Combinar»** (Combinar celdas / Separar celdas) en el grupo *Formato → Celdas*, que actúa
  sobre la **selección actual** del grid (`selectionRange()`), clona, muta y re-monta — igual que
  «Inmovilizar».

**Por qué `config.merge` y no `mc` por celda:** es la representación que el import XLSX produce y que
ya se renderiza/exporta correctamente; replicarla exactamente es lo de menor riesgo y se prueba como
función pura.

**Verificación:** nueva suite `merge.spec.ts` (**15 aserciones**: ancla/rs/cs de fila y bloque, una
sola celda → `false`, reemplazo de solapes, separación selectiva y por rango amplio, sin merge → 0,
roundtrip combinar→separar). Sin regresiones: las 50 suites de spec de Office verdes; `lint web` 0
errores; `build web` ✓.

## 80. Office/Sheets — autofiltro nativo en su sitio (un clic)

**Contexto.** Excel filtra **en su sitio** con las flechas desplegables del encabezado. En Axos eso
sólo aparecía al «Dar formato como tabla» (que además aplica estilos), o se filtraba creando una hoja
nueva (§78). Faltaba el gesto de Excel: **un clic** para poner el autofiltro sobre un rango, sin
tocar estilos ni duplicar datos.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `applyTableStyle` ya activaba el autofiltro
nativo de Fortune-Sheet con `sheet.filter_select` + `sheet.filter`; se **extrae ese mismo mecanismo
probado** a un par puro en `sheetOps.ts`:
- `setAutoFilter(sheet, range)` escribe `filter_select = { row:[r1,r2], column:[c1,c2] }` y `filter`
  (un solo autofiltro por hoja, como Excel: reemplaza el anterior).
- `clearAutoFilter(sheet)` los borra; devuelve si había uno.

UI: menú **«Autofiltro»** (Activar sobre la selección / Quitar) en *Datos → Ordenar y filtrar*, que
clona, muta y re-monta. Como usa el mismo formato que las tablas (que ya renderizan las flechas), el
render está probado de hecho.

**Verificación:** nueva suite `autoFilter.spec.ts` (**11 aserciones**: `filter_select` con fila/col
correctas, rango inválido → `false` sin tocar la hoja, reactivar reemplaza el rango, quitar borra y
devuelve `true`/`false`, roundtrip limpio). Sin regresiones: las 51 suites de spec de Office verdes;
`lint web` 0 errores; `build web` ✓.

## 81. Office/Docs — exportación a Markdown (GFM)

**Contexto.** Docs exportaba a `.docx` (`docx.ts`) y a PDF (impresión), pero no a **Markdown** — un
formato de texto plano, versionable y portable que todo editor moderno (Word incluido, vía
complementos) ofrece. Primer paso de diversificación hacia Docs tras consolidar Sheets.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `lib/office/markdown.ts` añade
`tiptapJsonToMarkdown(doc)`, **función pura sin dependencias** que recorre el árbol Tiptap/ProseMirror
(el modelo de Docs, el mismo que consume `docx.ts`) y lo mapea a Markdown GFM: encabezados, énfasis
(`**`/`*`/`~~`/`` ` ``), enlaces, listas con viñetas/ordenadas/**de tareas** y **anidadas**, citas,
bloques de código con lenguaje, reglas, imágenes y **tablas GFM**. Las marcas sin equivalente
(subrayado, resalte, sub/superíndice, color, control de cambios, comentarios) **degradan conservando
el texto**; los nodos exóticos (math, footnotes) caen a un texto razonable. Escapa los caracteres
especiales (`*_`` ` ``[]`) salvo dentro de código. Salida determinista (una línea en blanco entre
bloques, sin blancos triples, un único salto final). UI: opción **«Markdown (.md)»** en el menú
Exportar de `DocActions`, que descarga un Blob.

**Verificación:** nueva suite `markdown.spec.ts` (**21 aserciones**: encabezados, negrita/cursiva/
tachado/código/enlace, degradado de subrayado, escapado, `hardBreak`, listas anidadas/ordenadas/de
tareas, cita, bloque de código, regla, imagen, tabla GFM, separación por bloques, documento vacío).
Sin regresiones: las 52 suites de spec de Office verdes; `lint web` 0 errores; `build web` ✓.

## 82. Office/Docs — importación de Markdown (cierra el roundtrip)

**Contexto.** Tras exportar a Markdown (§81), faltaba **importarlo** para cerrar el roundtrip: abrir
un `.md` en Docs. El editor (Tiptap) ya ingiere **HTML** al importar (igual que el `.docx` vía
mammoth), así que basta convertir Markdown → HTML.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `lib/office/markdown.ts` añade
`markdownToHtml(md)`, **parser puro** (sin dependencias) que produce HTML que Tiptap convierte a su
esquema. Soporta encabezados ATX, párrafos, énfasis/enlaces/imágenes/código en línea (con escapes
`\`), listas con viñetas/ordenadas/**de tareas** y **anidadas** (por indentación → HTML
`taskList`/`taskItem` de Tiptap), citas, bloques de código vallados con lenguaje, reglas y **tablas
GFM**. Aísla los tramos de código y los caracteres escapados antes de transformar, y escapa el HTML
del resto. UI: el botón **Importar** acepta ahora `.docx`, `.md`, `.markdown` y `.txt`, ramificando
por extensión.

**Verificación:** nueva suite `markdownImport.spec.ts` (**24 aserciones**: bloques (h1/h3/p/hr),
en línea (negrita/cursiva/tachado/código/enlace/imagen), escapado de HTML y de `\*`, listas
(viñetas/ordenada/tareas/anidada), cita, bloques de código con y sin lenguaje, tabla GFM, dos
párrafos, y **roundtrip** doc→md→html que conserva h2/negrita/lista). Sin regresiones: las 53 suites
de spec de Office verdes; `lint web` 0 errores; `build web` ✓.

## 83. Office/Docs — tipografía inteligente (Autoformato de Word)

**Contexto.** Word convierte automáticamente la puntuación recta en sus formas tipográficas (comillas
curvas, raya `—`, puntos suspensivos `…`, `(c)`→©, fracciones). Docs no tenía nada de esto.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):**
- `lib/office/typography.ts` añade `smartTypography(text, opts?)` **pura, sin dependencias**: comillas
  y apóstrofos curvos (apertura/cierre según el carácter previo), `--`→`—`, `...`→`…`, `(c)/(r)/(tm)`
  →`© ® ™`, y `1/2`/`1/4`/`3/4`→`½ ¼ ¾` (con `lookbehind`/`lookahead` para **no** tocar fechas como
  `1/2/2024` ni números). Opciones para activar/desactivar cada grupo.
- `docs/smartTypography.ts` es la extensión Tiptap con el comando `applyTypography(opts?)`: la aplica
  al texto de la selección (o a **todo** el documento si no hay selección) **preservando las marcas**,
  **saltándose el código** (bloques y `code` en línea, donde la puntuación recta es significativa), y
  aplicando las sustituciones **de derecha a izquierda** (cambian la longitud → así no invalida
  posiciones). Mismo patrón probado que `changeCase.ts`.
- UI: botón **«Tipografía inteligente»** en la pestaña Inicio, junto a «Cambiar mayúsculas».

**Verificación:** nueva suite `smartTypography.spec.ts` (**17 aserciones**: comillas dobles/simples y
apóstrofo, raya, puntos suspensivos, símbolos, fracciones —y fechas/números intactos—, combinado,
opciones desactivadas, texto sin cambios). Sin regresiones: las 54 suites de spec de Office verdes;
`lint web` 0 errores; `build web` ✓.

## 84. Office/Slides — secciones del mazo (como PowerPoint)

**Contexto.** El mazo ya **guardaba** un arreglo `sections` paralelo a las diapositivas (persistido en
el JSON), pero **no había UI** para nombrarlas, quitarlas ni navegar por ellas — era una estructura
muerta. Las secciones son una forma estándar de organizar presentaciones largas en PowerPoint.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):**
- `slides/sections.ts` añade utilidades **puras** sobre `(string | null)[]` (donde un valor no nulo en
  `sections[i]` inicia una sección): `groupSlidesBySection`, `sectionTitleAt`, `isSectionStart`,
  `setSectionAt` (con relleno y recorte), `removeSectionAt`, `sectionCount`. Sin tocar el lienzo.
- UI: menú **«Secciones»** en *Inicio → Diapositivas* — agregar/renombrar la sección que empieza en la
  diapositiva actual, quitarla, y entradas **«Ir a …»** que saltan a la primera diapositiva de cada
  sección. Sigue el patrón de metadatos probado (mutar `sectionsRef` + `sync()`, igual que la
  transición), reutilizando `loadInto` para navegar.

**Verificación:** nueva suite `sections.spec.ts` (**15 aserciones**: agrupado con tramo inicial sin
nombre y con nombre, sin secciones, título activo heredado, `isSectionStart`, `setSectionAt`
rellena/recorta/vacía, `removeSectionAt`, `sectionCount`). Sin regresiones: las 55 suites de spec de
Office verdes; `lint web` 0 errores; `build web` ✓.

## 85. Office/Slides — secciones visibles en el clasificador

**Contexto.** Las secciones (§84) ya se podían nombrar y navegar desde el menú, pero el **clasificador
de diapositivas** (la rejilla de miniaturas) no las mostraba — el lugar donde más ayudan a organizar
visualmente un mazo largo.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `SlideSorter` acepta ahora la prop opcional
`sections` y, antes de la miniatura que **inicia** una sección, renderiza un encabezado a todo el
ancho (`col-span-full` en la rejilla CSS, dentro de un `React.Fragment` por diapositiva) con el
nombre de la sección. Cambio puramente de presentación que reutiliza el modelo de datos ya probado
(§84). De paso, el menú «Secciones» lee `slides.length` (estado reactivo) en vez del ref durante el
render.

**Verificación:** al ser sólo presentación (rejilla CSS) se cubre con `build` + `lint` y la lógica de
secciones ya tiene su suite (§84). Sin regresiones: las 55 suites de spec de Office verdes; `lint web`
0 errores; `build web` ✓.

## 86. Office/Sheets — copiar un rango como tabla Markdown

**Contexto.** Tras dar a Docs el roundtrip Markdown (§81/§82), faltaba en Sheets el gesto recíproco:
**copiar un rango como tabla Markdown** para pegarlo en un README, issue, PR o documento — algo que
Excel no hace de fábrica y que un usuario técnico agradece.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `lib/office/sheetMarkdown.ts` añade funciones
**puras**: `rangeValues(sheet, range)` (matriz de valores mostrados leyendo el `celldata` en memoria),
`gridToMarkdownTable(rows, opts)` (tabla GFM; primera fila = encabezado por defecto, escapa `|`/`\\`,
colapsa saltos de línea y rellena filas cortas) y el atajo `rangeToMarkdown`. UI: botón **«Copiar como
Markdown»** en *Datos → Herramientas de datos*, que toma la **selección actual** y escribe la tabla en
el portapapeles (`navigator.clipboard`).

**Verificación:** nueva suite `sheetMarkdown.spec.ts` (**9 aserciones**: tabla básica, varias filas,
sin encabezado, relleno de filas cortas, escape de `|` y saltos, vacío; `rangeValues` con hueco y
celda fuera de datos; `rangeToMarkdown` extremo a extremo). Sin regresiones: las 56 suites de spec de
Office verdes; `lint web` 0 errores; `build web` ✓.

## 87. Office/Docs — notas al pie en la exportación a Markdown

**Contexto.** La exportación a Markdown (§81) emitía un marcador de nota al pie **vacío** (`[^]`) y
**perdía el texto** de la nota: en el modelo de Docs el texto vive en `footnoteRef.attrs.content` (en
línea), no en un nodo de definiciones, y el serializador lo ignoraba. Pérdida de datos real al
exportar un documento con notas al pie.

**Decisión (sólo `apps/web`, aditiva):** `markdown.ts` acumula el texto de cada `footnoteRef` en un
recolector del documento en curso (reiniciado en cada `tiptapJsonToMarkdown`), emite una **referencia
numerada** `[^N]` en su sitio y, al final, vuelca un **bloque de definiciones** `[^N]: texto`
(sintaxis de notas al pie de GFM/Pandoc). Los saltos de línea internos de la nota se colapsan a un
espacio.

**Verificación:** `markdown.spec.ts` ampliado (**23 aserciones**, +2: nota única `Texto[^1]` +
`[^1]: …`, y dos notas numeradas en orden con su bloque de definiciones). Sin regresiones: las 56
suites de spec de Office verdes; `lint web` 0 errores; `build web` ✓.

## 88. Office/Docs — referencias cruzadas y citas en la exportación a Markdown

**Contexto.** Auditando la exportación a Markdown tras §87 se vio que los nodos en línea `crossRef`
(referencias cruzadas) y `citation` (citas) se **descartaban en silencio** —otra pérdida de datos—:
el serializador sólo conocía `hardBreak`/`image`/`mathInline`/`footnoteRef`/texto.

**Decisión (sólo `apps/web`, aditiva):** `serializeInline` emite ahora el **texto visible** de ambos
(igual que la exportación a `.docx`): `crossRef` → `attrs.label` (o `attrs.target` como respaldo);
`citation` → `attrs.inText`. Escapado como texto normal.

**Verificación:** `markdown.spec.ts` ampliado (**26 aserciones**, +3: `crossRef` con etiqueta, con
respaldo a `target`, y `citation` en el texto). Sin regresiones: las 56 suites de spec de Office
verdes; `lint web` 0 errores; `build web` ✓.

## 89. Office/Docs — Markdown cubre todos los nodos de bloque de Docs (TOC, bibliografía, firma)

**Contexto.** Cierre de la auditoría de la exportación a Markdown (§87/§88): faltaban los nodos de
bloque específicos de Docs `footnoteList`, `signatureLine`, `toc` y `bibliography`. El caso por
defecto recorría su contenido, lo que **perdía** TOC/bibliografía/firma (nodos generados, sin
contenido propio) y arriesgaba **duplicar** notas al pie (`footnoteList`).

**Decisión (sólo `apps/web`, aditiva):** `serializeBlocks` los trata explícitamente, igual que el
exportador `.docx`:
- `footnoteList` → **nada** (las notas van por el recolector §87; evita duplicarlas).
- `signatureLine` → línea de guiones bajos (escapada), nombre en **negrita** y cargo.
- `toc` → «## Tabla de contenido» + lista de los títulos del documento, indentada por nivel.
- `bibliography` → «## Bibliografía» + las fuentes (`citation.attrs.source`) del documento, únicas y
  ordenadas. `toc`/`bibliography` recorren la **raíz** del documento (fijada en `tiptapJsonToMarkdown`),
  no su propio contenido.

Con esto la exportación a Markdown cubre **todos** los tipos de nodo del modelo de Docs sin pérdidas.

**Verificación:** `markdown.spec.ts` ampliado (**35 aserciones**, +9: `footnoteList` sin salida, firma
con nombre/cargo/guiones, TOC con títulos indentados por nivel, bibliografía con la fuente de la
cita). Sin regresiones: las 56 suites de spec de Office verdes; `lint web` 0 errores; `build web` ✓.

## 90. Office/Docs — exportación a texto plano (.txt)

**Contexto.** Docs ya exportaba a `.docx`, Markdown (§81) y PDF (impresión); faltaba **texto sin
formato** (`.txt`), el «Guardar como texto sin formato» de Word — útil para volcar el contenido sin
ninguna marca.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `markdown.ts` añade `tiptapJsonToPlainText(doc)`
**pura**: recorre el árbol Tiptap conservando el texto y una estructura mínima (líneas en blanco entre
bloques, viñetas/números con indentación por nivel en listas, tabuladores entre celdas de tabla,
código literal) y descartando marcas y nodos decorativos. UI: opción **«Texto plano (.txt)»** en el
menú Exportar de `DocActions`.

**Verificación:** nueva suite `plainText.spec.ts` (**9 aserciones**: encabezado+párrafo, marcas
descartadas, viñetas y anidadas, ordenada, bloque de código, tabla con tabuladores, `footnoteList`
vacío, documento vacío). Sin regresiones: las 57 suites de spec de Office verdes; `lint web` 0
errores; `build web` ✓.

## 91. Office/Sheets — fidelidad de DEC2HEX (mayúsculas)

**Contexto.** Una auditoría de fidelidad (probando el motor REAL con ~72 valores conocidos de Excel:
fechas, financieras, texto, conversiones, ingeniería) salió **69/72**, confirmando que el motor es
muy correcto. La única discrepancia: `DEC2HEX` devuelve el hexadecimal en **minúsculas** (`"1f"`,
`"00ff"`, `"ffffffffff"`), mientras Excel lo da en **MAYÚSCULAS** (`"1F"`, `"00FF"`, `"FFFFFFFFFF"`).
Rompe comparaciones de texto y búsquedas exactas contra valores de Excel.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `components/office/sheets/hexFidelity.ts`
registra `DEC2HEX` que **delega en el mismo `formulajs`** (que calcula bien el valor, el relleno
`places` y el complemento a dos de los negativos) y sólo **pasa la cadena a mayúsculas**. Idéntico en
lo demás. (`HEX2DEC` ya acepta ambas cajas.)

**Verificación:** nueva suite `hexFidelity.spec.ts` (**8 aserciones**: `1F`, `1A`, relleno `00FF`,
negativo `FFFFFFFFFF`, `0`, `ABC`, sin letras intacto, roundtrip `HEX2DEC(DEC2HEX(123))`). Sin
regresiones: las 58 suites de spec de Office verdes; `lint web` 0 errores; `build web` ✓.

## 92. Office/Sheets — INDEX/MATCH horizontal (INDEX sobre vectores de una fila)

**Contexto.** Una segunda ronda de la auditoría de fidelidad destapó un fallo **común y serio**:
`INDEX(A1:C1, 2)` sobre un **rango de una sola fila** devolvía `#REF!` en vez de `20`, lo que **rompe
el patrón `INDEX(A1:C1, MATCH(x, A1:C1, 0))`** —la búsqueda horizontal clásica, omnipresente—. En
Excel, `INDEX(vector, n)` devuelve el n-ésimo elemento sea fila o columna; con una sola fila el índice
es la **columna**. `@formulajs/formulajs@2.9.3` lo trataba como número de fila → fuera de rango. (El
caso de una sola **columna** ya funcionaba.)

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `components/office/sheets/lookupFidelity.ts`
registra `INDEX` que **intercepta únicamente** el patrón roto —un solo índice (sin `col_num`) sobre un
vector 1D o una matriz de una fila— devolviendo el elemento por posición (e índice `0` → fila
completa, fuera de rango → `#REF!`); **todo lo demás se delega** en el mismo `formulajs` sin tocarlo
(`INDEX(rango, fila, col)`, columnas, matrices 2D…).

**Verificación:** nueva suite `lookupFidelity.spec.ts` (**10 aserciones**: `INDEX(fila,2)`,
`INDEX/MATCH` horizontal, constante `{fila}`, índice `0`→fila completa, fuera de rango→`#REF!`, y los
casos delegados —columna y matriz 2D— intactos). Sin regresiones: las **59 suites** de spec de Office
verdes (incluida la del motor de fórmulas); `lint web` 0 errores; `build web` ✓.

## 93. Office/Sheets — BIN2HEX y OCT2HEX en mayúsculas (extiende §91)

**Contexto.** Otra ronda de la auditoría (texto/fecha/matemáticas/ingeniería, 41/44) confirmó que el
defecto de minúsculas de §91 no era exclusivo de `DEC2HEX`: **`BIN2HEX`** y **`OCT2HEX`** también
devuelven el hexadecimal en minúsculas (`BIN2HEX(11111111)`=`"ff"`, `OCT2HEX(777)`=`"1ff"`), mientras
Excel los da en MAYÚSCULAS. (Aparte, la auditoría destapó que `CONVERT` no soporta temperatura
`"C"`/`"F"` —limitación de formulajs—; queda pendiente por ser más invasivo.)

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** se generaliza `hexFidelity.ts` con un
envoltorio `upper(name)` que delega en `formulajs` y sólo pasa la cadena a mayúsculas; se registran
así las tres conversiones a hex (`DEC2HEX`, `BIN2HEX`, `OCT2HEX`).

**Verificación:** `hexFidelity.spec.ts` ampliado (**14 aserciones**, +6: `BIN2HEX(11111111)`=`FF`,
relleno, sin letras intacto, `OCT2HEX(777)`=`1FF`, `OCT2HEX(10)`=`8`, roundtrip `HEX2DEC(BIN2HEX)`).
Sin regresiones: las 59 suites de spec de Office verdes; `lint web` 0 errores; `build web` ✓.

## 94. Office/Sheets — CONVERT con temperaturas (C/F/K)

**Contexto.** La deuda señalada en §93: `CONVERT(100,"C","F")` daba `#VALUE!` porque
`@formulajs/formulajs@2.9.3` no soporta las unidades de temperatura. La temperatura es **afín** (lleva
un desplazamiento, no sólo un factor), por eso formulajs —orientado a factores— no la cubre.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `components/office/sheets/convertTemp.ts`
registra `CONVERT` que **intercepta únicamente** cuando **ambas** unidades son de temperatura
(`"C"`/`"cel"`, `"F"`/`"fah"`, `"K"`/`"kel"`), pivotando por Celsius (`F=C·9/5+32`, `K=C+273.15`);
cualquier otra conversión (masa, longitud, tiempo…) se **delega** en el mismo `formulajs` sin tocarla.

**Verificación:** nueva suite `convertTemp.spec.ts` (**11 aserciones**: `C→F`=212, `F→C`=100, `C→K`/
`K→C`, `F→K`, misma unidad, alias en minúscula, −40 coincide; y delegadas —`lbm→kg`, `m→ft`,
`hr→mn`— intactas). Sin regresiones: las **60 suites** de spec de Office verdes; `lint web` 0 errores;
`build web` ✓.

## 95. Office/Sheets — VALUE convierte texto de fecha y hora (paridad Excel)

**Contexto.** Auditando el motor REAL contra valores conocidos de Excel: `VALUE("1:30:00")` debía dar
`0.0625`, `VALUE("2024-01-15")` debía dar `45306` y `VALUE("2024-01-15 13:30")` `45306.5625`. Pero
`@formulajs/formulajs@2.9.3` SÓLO entiende números, moneda y porcentaje en `VALUE` y devolvía `#VALUE!`
para cualquier texto de **fecha** u **hora**. Esto rompe un patrón cotidiano —`=VALUE(A1)+30` sobre una
columna de fechas/horas pegadas como texto— y la coherencia con `TIMEVALUE`/`DATEVALUE`, que sí existen.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `components/office/sheets/valueFidelity.ts`
registra `VALUE` que **delega primero** en la `VALUE` de `formulajs` (sólo cuando el texto no contiene
letras salvo `e`/`E`, para que no «aplane» fechas con nombre de mes —`"Jan 15, 2024"`→`152024`—); si esa
falla, **reusa el `TIMEVALUE`** propio del motor (ya fiel) para la parte de hora y `DATEVALUE` de
`formulajs` para la fecha, convirtiendo el `Date` al **número de serie** de Excel (época `1899-12-30`).
`VALUE` devuelve siempre un **número** (igual que Excel: el formato de celda decide cómo se ve). El error
se señala con la cadena `#VALUE!`, que `IFERROR` captura como en Excel.

**Verificación:** nueva suite `valueFidelity.spec.ts` (**30 aserciones**: números/moneda/% intactos;
horas con/sin segundos y AM/PM; fechas ISO, `M/D/Y`, `D-Mmm-Y`, `Mmm D, Y`; combinaciones fecha+hora;
errores capturados por `IFERROR`; roundtrip `HOUR`/`MINUTE`/`YEAR`/`MONTH`/`DAY` sobre el resultado). Sin
regresiones: toda la suite de spec de Office verde; `lint web` 0 errores; `build web` ✓.

## 96. Office/Sheets — PROPER con las reglas exactas de Excel (apóstrofo/dígito)

**Contexto.** Auditando contra Excel: `PROPER("o'brien")` debe dar `"O'Brien"` —Excel pone en
mayúscula toda letra que siga a un carácter **no alfabético** (espacio, apóstrofo, guion, dígito),
incluido el conocido quirk `PROPER("they're")="They'Re"`. Pero `@formulajs/formulajs@2.9.3` sólo trata
el **espacio** como separador y devolvía `"O'brien"`.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `components/office/sheets/properFidelity.ts`
reimplementa `PROPER` (trivial y exacta): recorre el texto y pone en mayúscula cada letra precedida por
algo que no sea letra, bajando el resto. Unicode-aware (`\p{L}`) para acentos y ñ.

**Verificación:** nueva suite `properFidelity.spec.ts` (**15 aserciones**: apóstrofo, dígito, guion,
acentos/ñ, baja el resto, bordes, idempotencia). Sin regresiones: toda la suite de spec de Office verde;
`lint web` 0 errores; `build web` ✓.

## 97. Office/Sheets — funciones de texto por bytes (LENB/LEFTB/RIGHTB/MIDB/REPLACEB/FINDB/SEARCHB)

**Contexto.** Excel expone las variantes «por bytes» de las funciones de texto (pensadas para idiomas
de doble byte). `@formulajs/formulajs@2.9.3` no las trae, así que devolvían `#NAME?` y cualquier `.xlsx`
que las usara se rompía al abrir. En una configuración regional de **un solo byte** (latinas) cada
carácter ocupa 1 byte y estas funciones son **idénticas** a sus versiones por carácter.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `components/office/sheets/byteFunctions.ts`
registra `LENB/LEFTB/RIGHTB/MIDB/REPLACEB/FINDB/SEARCHB` como **delegaciones** a la función por carácter
equivalente de `formulajs` (`LEN/LEFT/RIGHT/MID/REPLACE/FIND/SEARCH`). No toca ninguna función existente;
sólo añade los nombres que faltaban (mejora la interoperabilidad `.xlsx`).

**Verificación:** nueva suite `byteFunctions.spec.ts` (**15 aserciones**: equivalencia con las versiones
por carácter, FINDB sensible a mayúsculas, SEARCHB insensible, composición/anidamiento). Sin regresiones:
toda la suite de spec de Office verde; `lint web` 0 errores; `build web` ✓.

## 98. Office/Docs — legibilidad por idioma (Flesch para inglés) + módulo puro testeable

**Contexto.** El panel «Revisar» calculaba la legibilidad sólo con **Fernández-Huerta** (español) y la
lógica vivía mezclada dentro del componente `DocWordCount.tsx`, sin pruebas. El procesador de referencia
muestra, para inglés, **Flesch Reading Ease** y **Flesch-Kincaid Grade Level**.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** se extrae la lógica a un módulo **puro**
`components/office/docs/readability.ts` (conteo de sílabas ES/EN, estadísticas de texto, las tres
fórmulas y detección de idioma) y se testea con `npx tsx`. `DocWordCount.tsx` delega en él y muestra, en
inglés, «Facilidad de lectura» (Flesch) + «Nivel escolar» (Flesch-Kincaid); en español sigue con
Fernández-Huerta. El idioma se detecta por marcas inequívocas del español (ñ/¿/¡/acentos/stopwords).

**Verificación:** nueva suite `readability.spec.ts` (**34 aserciones**: sílabas EN/ES de palabras
conocidas, detección de idioma, fórmulas Flesch/FK/Fernández con valores controlados, bordes, integración).
Sin regresiones: toda la suite de spec de Office verde; `lint web` 0 errores; `build web` ✓.

## 99. Office/Slides — galería de formas ampliada + golden de fidelidad de export .pptx

**Contexto.** La galería de formas exporta cada forma a un **preset nativo** de PowerPoint vía
`HINT_TO_PRESET` (en `lib/office/pptx.ts`); si una forma no tuviera mapeo, el export caería
silenciosamente a un **rectángulo** (pérdida de fidelidad). No había prueba que garantizara la
cobertura, y faltaban en la galería formas comunes (rombo, flecha derecha, estrella de 5 puntas) que ya
tienen preset y botón rápido en el editor.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** se añaden `diamond`, `rightArrow` y `star5` a
`POLY_SHAPES` y a `SHAPE_LIBRARY` (ya cubiertos por `HINT_TO_PRESET`), y se exportan `HINT_TO_PRESET` y
`presetFor` desde `pptx.ts` para poder auditarlos. `addShapeByKind` ya instancia cualquier forma poly/path,
así que no hace falta tocar el editor.

**Verificación:** nueva suite `shapes.spec.ts` (**136 aserciones**): geometría de `starPoints`/
`regularPolygon`, todas las formas dentro de su caja, y el **golden**: cada forma de la galería (+ las de
inserción rápida) está definida y mapea a un preset que **existe** en PptxGenJS (sin caer a rectángulo).
Sin regresiones: `pptx.spec.ts` 19/19 y toda la suite de Office verde; `lint web` 0 errores; `build web` ✓.

## 100. Office/Sheets — SEARCH con comodines de Excel (?/*/~) + núcleo wildcard

**Contexto.** Excel admite comodines en `SEARCH` (`?`=un carácter, `*`=cualquier secuencia, `~`
escapa) y en los criterios de la familia `COUNTIF/SUMIF/MATCH`. `@formulajs/formulajs@2.9.3` no los
implementa: `SEARCH("b?d","abcd")` devolvía `#VALUE!`.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `components/office/sheets/wildcard.ts` aporta el
**núcleo** `excelWildcardToRegExp`/`hasWildcard`/`wildcardMatch` (patrón Excel → RegExp, insensible a
mayúsculas) y un `SEARCH` fiel que lo usa, registrado en CUSTOM_FUNCTIONS. `FIND` (literal, sensible a
may.) no se toca. El núcleo se reutilizará en la familia de criterios (siguiente fase).

**Verificación:** nueva suite `wildcard.spec.ts` (**28 aserciones**: literales con inicio e insensibles
a may. sin regresión, `?`/`*` en varias posiciones, escapes `~?`/`~*`/`~~`, inicio inválido, y el núcleo
expuesto). Sin regresiones: suite de Office verde; `lint web` 0 errores; `build web` ✓.

## 101. Office/Sheets — familia de criterios con comodines (COUNTIF/SUMIF/AVERAGEIF/MAXIFS…)

**Contexto.** `@formulajs/formulajs@2.9.3` entiende los operadores de criterio (`">5"`, `"<>x"`…) pero
**ignora los comodines**: `COUNTIF(rango,"ap*")` contaba 0, `SUMIF`/`AVERAGEIF` con `"a*"` daban 0/nulo.
Los comodines en criterios son cotidianos (filtrar por prefijo/sufijo).

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `components/office/sheets/criteriaIf.ts`
reimplementa `COUNTIF/COUNTIFS/SUMIF/SUMIFS/AVERAGEIF/AVERAGEIFS/MAXIFS/MINIFS` con un **evaluador de
criterios fiel** que reutiliza el núcleo `wildcard.ts` (§100). La coincidencia de texto se enruta SIEMPRE
por el patrón→RegExp anclado e insensible a may. (trata comodines, escapes `~?` y literales por igual), y
conserva los operadores de comparación y la igualdad numérica de Excel (vacío/`<>` incluidos).

**Verificación:** nueva suite `criteriaIf.spec.ts` (**23 aserciones**: comodines `?`/`*`/`~` en COUNTIF,
operadores `>`/`<=`/`<>`, número exacto, vacío/no-vacío, insensibilidad a may., SUMIF/AVERAGEIF con y sin
rango aparte, COUNTIFS/SUMIFS/AVERAGEIFS multi-criterio, MAXIFS/MINIFS). Sin regresiones: TODA la suite de
Office verde; `lint web` 0 errores; `build web` ✓.

## 102. Office/Sheets — comodines en MATCH/VLOOKUP/HLOOKUP (búsqueda exacta)

**Contexto.** En Excel, la búsqueda exacta (`MATCH(...,0)`, `VLOOKUP(...,FALSE)`, `HLOOKUP(...,FALSE)`)
admite comodines cuando el valor buscado es texto: `VLOOKUP("ap*",...,FALSE)` encuentra el primero que
empieza por «ap». `@formulajs/formulajs@2.9.3` no lo hace (`MATCH("ap*",...,0)` daba un índice erróneo y
`VLOOKUP("ap*",...,FALSE)` daba `#N/A`).

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `components/office/sheets/lookupWildcards.ts`
intercepta **sólo** el caso «exacto + texto con comodín» (reusando `wildcard.ts`, §100) y **delega** todo
lo demás (numérico, literal, coincidencia aproximada) en el mismo `formulajs`. XLOOKUP propio no se toca.

**Verificación:** nueva suite `lookupWildcards.spec.ts` (**16 aserciones**: comodines `?`/`*` en MATCH/
VLOOKUP/HLOOKUP, `#N/A` sin coincidencia, anclado; y que los casos numéricos/literales/aproximados NO se
rompen; INDEX/MATCH con comodín). Sin regresiones: TODA la suite de Office verde; `lint web` 0; `build` ✓.

## 103. Office/Slides — tablas .pptx con banda según el color de acento

**Contexto.** Al exportar una tabla a `.pptx`, las filas con banda usaban un azul fijo (`EEF2FF`)
independientemente del color de acento, mientras que en el lienzo (`slides/table.ts`) la banda es el
acento atenuado al 10% (`tint(accent, 0.10)`). Una tabla con acento verde se veía verde en pantalla pero
exportaba bandas azuladas — una incoherencia visible al abrir el archivo.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `lib/office/pptx.ts` calcula `tintHex(accent, 0.10)`
(espejo exacto del `tint()` del lienzo) y lo usa como relleno de las filas con banda. La cabecera ya usaba
el acento; el resto del export no cambia.

**Verificación:** se extiende `pptx.spec.ts` (**+3 aserciones, 22 total**): con acento `2563EB` la banda
exporta su tinte `E9EFFD`, la cabecera lleva el acento, y ya NO aparece el azul fijo anterior. Sin
regresiones: suite de Office verde; `lint web` 0 errores; `build web` ✓.

## 104. Office/Docs — alineación de columnas en tablas Markdown (roundtrip)

**Contexto.** La fila separadora GFM de una tabla Markdown (`:--`/`--:`/`:-:`) codifica la **alineación
horizontal** de cada columna, pero `markdownToHtml` la **ignoraba** (todas las `th/td` salían sin
`text-align`) y `tiptapJsonToMarkdown` emitía siempre `---`. La alineación se perdía al importar/exportar.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):**
 • Importación (`lib/office/markdown.ts`): `parseTable` lee la fila separadora y aplica
   `style="text-align:left|center|right"` a las celdas de cada columna.
 • Modelo (`docs/tableCellAttrs.ts`): nuevo atributo global `textAlign` en `tableCell`/`tableHeader`
   (parse/render de `el.style.textAlign`) para que la alineación viaje en el JSON/HTML.
 • Exportación (`serializeTable`): emite `:---`/`---:`/`:---:` según `attrs.textAlign` de la cabecera.

**Verificación:** nueva suite `tableAlign.spec.ts` (**12 aserciones**): importación traduce los 3 marcadores
(y deja sin estilo la columna por defecto), exportación emite los delimitadores correctos, y un roundtrip
conserva la alineación. Sin regresiones: specs de Markdown (export/import/plano/sheet) verdes; `lint web` 0
errores; `build web` ✓.

## 105. Office/Sheets — XLOOKUP/XMATCH: modo comodín (2) y dirección de búsqueda

**Contexto.** `XLOOKUP`/`XMATCH` propios ya hacían exacto (0) y aproximado (-1/1), pero faltaban dos
modos de Excel: **modo de coincidencia 2 = comodín** (`XLOOKUP("ap*",...,,2)`) y **modo de búsqueda -1 =
de fin a inicio** (devuelve la ÚLTIMA coincidencia, útil con duplicados). El comodín devolvía
`ifNotFound`/`#N/A`.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** se refactoriza la localización a un helper común
`xfind(L, key, mode, searchMode)` (en `formulaEngine.ts`, donde ya viven ambas funciones) que: con
`mode 2` casa por comodín reutilizando `wildcardMatch` (§100); con `searchMode -1` recorre el vector en
orden inverso (última coincidencia); 2/-2 (binaria) se tratan como lineal (mismo resultado exacto). Los
modos exacto/aproximado preexistentes quedan idénticos.

**Verificación:** nueva suite `xlookupModes.spec.ts` (**18 aserciones**: exacto/ifNotFound/aproximado sin
regresión, comodín `?`/`*` en XLOOKUP y XMATCH, dirección inversa con duplicados, comodín+inverso
combinados). Sin regresiones: motor + modernFunctions (80) + lookup* verdes; `lint web` 0; `build web` ✓.

## 106. Office/Sheets — fidelidad de formato de número (científico y fracción)

**Contexto.** Auditando `formatNumber` contra Excel aparecieron dos discrepancias finas: (1) el formato
**científico** rellenaba SIEMPRE el exponente a 2 dígitos (`0.0e+0` daba `1.2E+03` en vez de `1.2E+3`),
ignorando los ceros del patrón tras `E`; (2) en **fracciones** con hueco de entero y parte entera 0
(`# ?/?` con 0.5) faltaba el espacio del entero (`1/2` en vez de ` 1/2`), con el que Excel alinea la
fracción.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** en `renderNumericSection` (lib/office/sheetOps.ts):
(1) los dígitos del exponente se toman del nº de ceros tras `E+`/`E-` del patrón; (2) en la rama de
fracción, si el valor es < 1 y el patrón tiene hueco de entero seguido de espacio, se antepone el espacio.
También se corrige una aserción **no fiel** previa en `numfmt.spec` (`# ??/??` de 0.75 → ` 3/4`, como Excel).

**Verificación:** nueva suite `numfmtFidelity.spec.ts` (**12 aserciones**: exponente de 1/2/3 dígitos sin
regresión, exponente negativo, fracciones con y sin hueco de entero, enteros). `numfmt.spec` actualizado a
47/47. Sin regresiones en el resto de la suite; `lint web` 0; `build web` ✓.

## 107. Office/Docs — títulos de enlace e imagen en Markdown (roundtrip)

**Contexto.** El import de Markdown (`markdownToHtml`) ya parseaba el título opcional de enlaces e
imágenes (`[txt](url "título")`, `![alt](src "título")`), pero el export (`tiptapJsonToMarkdown`) lo
**descartaba**: el roundtrip perdía el título.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `lib/office/markdown.ts` emite el sufijo
` "título"` (helper `mdTitle`, con comillas escapadas) en los tres sitios de emisión: imagen en línea,
marca de enlace e imagen de bloque. Sin título, sin sufijo (sin regresión).

**Verificación:** nueva suite `mdTitle.spec.ts` (**6 aserciones**: enlace/imagen con título, sin título
sin sufijo, roundtrip import del export, comillas escapadas). Specs de Markdown (export/import/plano)
verdes; `lint web` 0 errores; `build web` ✓.

## 108. Office/Docs — alineación de columna de tabla en el export .docx (cierra el roundtrip de §104)

**Contexto.** §104 introdujo la alineación de columna en tablas Markdown y el atributo `textAlign` de
celda; §107 cerró los títulos. Faltaba el último tramo del roundtrip hacia Word: `tableToEl` (en
`lib/office/docx.ts`) respetaba fondo, colspan/rowspan, alineación vertical y anchos, pero **no la
alineación horizontal** de la celda — una tabla con columnas centradas/derecha exportaba a `.docx` sin
ellas (Word aplica la alineación al PÁRRAFO de la celda).

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** se añade una variable de cierre `cellAlign`
(patrón idéntico a `inHeaderCell`) que se fija con `cell.attrs.textAlign` alrededor de la construcción de
los párrafos de la celda; el caso `paragraph` la usa como respaldo cuando el propio párrafo no trae
alineación. Así la alineación de celda viaja como `w:jc` al `.docx`.

**Verificación:** nueva suite `docxTableAlign.spec.ts` (**4 aserciones**: empaqueta el `.docx` real,
descomprime y confirma `w:jc` center/right en las columnas alineadas). `docx.spec` (33) y
`docxRoundtrip.spec` (8) verdes — sin regresiones; `lint web` 0; `build web` ✓.

## 109. Office/Sheets — export .xlsx con ESTILOS vía ExcelJS (writer)

**Contexto.** El mayor hueco de fidelidad de Sheets: SheetJS (edición comunitaria, el writer en
`lib/office/xlsx.ts`) **no escribe estilos** al `.xlsx` (relleno, fuente, color, alineación). Un libro con
formato visual se exportaba en blanco y negro y no abría «idéntico» en Excel/LibreOffice — rompiendo el
objetivo de round-trip OOXML sin pérdida (Track B).

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** se añade `exceljs` (MIT) **solo como writer**.
`lib/office/xlsxStyled.ts` (función PURA, recibe el módulo `ExcelJS`) construye el libro desde el modelo
de Fortune-Sheet conservando: valores tipados, **fórmulas**, **formato de número**, **fuente**
(negrita/cursiva/subrayado/tachado/color/tamaño/familia), **relleno** de fondo, **alineación**
(horizontal/vertical/ajuste), **anchos de columna**, **altos de fila**, **combinaciones**, **paneles
inmovilizados** y **nombres definidos**, en varias hojas. `exportSheets` enruta el `.xlsx` por este writer;
el **CSV y toda la LECTURA siguen en SheetJS** (sin tocar el import ni los mappers puros). Carga dinámica
(`import('exceljs')`) para no engordar el bundle principal.

**Verificación:** nueva suite `xlsxStyled.spec.ts` (**22 aserciones**): helpers `toArgb`/`cellStyle`, y un
**golden round-trip** que escribe bytes reales y los REABRE con ExcelJS para confirmar fuente/relleno/
alineación/numFmt/fórmula/combinación/ancho. `xlsx.spec` (27) y toda la suite de Office verdes — sin
regresiones; `lint web` 0; `build web` ✓. Licencia anotada en THIRD_PARTY_NOTICES.

## 110. Office/Sheets — LECTURA de estilos al importar .xlsx (round-trip simétrico de §109)

**Contexto.** §109 hizo que el export `.xlsx` escribiera estilos (vía ExcelJS). Pero el import seguía en
SheetJS comunitario, que tampoco **lee** estilos: un libro con formato entraba «plano» (sin colores ni
negritas). El round-trip de estilos quedaba a medias.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `importSheets` complementa la lectura de SheetJS
(valores + fórmulas) con una pasada de **ExcelJS** que extrae los estilos y los **fusiona** en las celdas
Fortune. Inverso de §109: `fortuneStyleFromCell` mapea fuente/relleno/alineación de ExcelJS a las claves
Fortune (`bl/it/un/cl/fs/ff/fc/bg/ht/vt/tb`) y `readStylesIntoSheets` los inyecta por (hoja, r, c) sin
tocar valores ni fórmulas. Tolerante a fallos (si ExcelJS no lee algo, los valores entran igual).

**Verificación:** nueva suite `xlsxStyleImport.spec.ts` (**16 aserciones**): helpers inversos
(`argbToHex`, `fortuneStyleFromCell`) y un **round-trip COMPLETO** Fortune → writer §109 → bytes →
`readStylesIntoSheets` → Fortune, confirmando que negrita/cursiva/color/fondo/alineación/formato
sobreviven y que el valor numérico no se pisa. `xlsxStyled` (22) y `xlsx` mappers verdes — sin
regresiones; `lint web` 0; `build web` ✓.

## 111. Office/Sheets — export de validación de datos al .xlsx (ExcelJS)

**Contexto.** Tras §109/§110 (estilos en export e import), faltaba exportar la **validación de datos**
(`sheet.dataVerification`: listas desplegables, rangos numéricos/de fecha/de longitud) al `.xlsx`. Se
perdía al abrir el archivo en Excel. (El formato condicional ya se «hornea» en los estilos de celda, así
que §109 lo exporta como relleno; la validación no tenía equivalente.)

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `xlsxStyled.ts` añade `dataValidationFor(dvEntry)`
que mapea el modelo de Fortune a `cell.dataValidation` de ExcelJS (lista literal `"a,b,c"` o rango;
`whole`/`decimal`/`textLength`/`date` con su operador y 1–2 fórmulas; mensaje de entrada y rechazo
«stop»), y `fillWorksheet` lo aplica por celda. `text_content` (sin equivalente directo) se omite con
seguridad. No toca valores, estilos ni el resto del writer.

**Verificación:** nueva suite `xlsxValidation.spec.ts` (**15 aserciones**): mapeo puro de lista/entero/
decimal/fecha/longitud + un **round-trip real** que escribe bytes y los reabre para confirmar que la lista
con sus opciones, el rango entero y la regla de fecha viajan al `.xlsx`. `xlsxStyled` (22) e import-rt (16)
verdes — sin regresiones; `lint web` 0; `build web` ✓.

## 112. Office/Sheets — export del autofiltro al .xlsx (ExcelJS)

**Contexto.** Continuando la cadena de fidelidad `.xlsx` (§109–§111), faltaba exportar el **autofiltro**:
una hoja con `filter_select` (rango con encabezados filtrables) se exportaba sin las flechas de filtro, así
que en Excel había que volver a activarlo.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `fillWorksheet` (xlsxStyled.ts) traduce
`sheet.filter_select: { row:[r1,r2], column:[c1,c2] }` a `ws.autoFilter = { from, to }` de ExcelJS
(1-based). Si no hay filtro, no se escribe nada. No toca celdas, estilos ni el resto del writer.

**Verificación:** nueva suite `xlsxAutofilter.spec.ts` (**3 aserciones**): round-trip real — la hoja con
filtro exporta `autoFilter` con el rango correcto (`A1:B3`) y la hoja sin filtro no lo lleva. `xlsxStyled`
(22), validación (15) e import-rt (16) verdes — sin regresiones; `lint web` 0; `build web` ✓.

## 113. Office/Sheets — protección de hoja en el round-trip .xlsx (ExcelJS)

**Contexto.** Cerrando la fidelidad `.xlsx` (§109–§112), faltaba la **protección de hoja**: un archivo
protegido se abría desbloqueado tras pasar por Axos. ExcelJS la soporta (`worksheet.protect`).

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** modelo `SheetProtection` (`enabled`, contraseña y
permisos: seleccionar/formato/insertar/eliminar/ordenar/autofiltro). `protectOptionsFor` lo mapea a las
opciones de `worksheet.protect` y `styledXlsxBuffer` lo aplica (async, porque hashea la contraseña).
`readStylesIntoSheets` lee `ws.sheetProtection` al importar y reconstruye el modelo → **round-trip**: un
`.xlsx` protegido sigue protegido al re-exportar, sin necesidad de UI nueva (la UI para crear protección
desde cero llega como mejora posterior). No toca valores, estilos ni el resto del writer.

**Verificación:** nueva suite `xlsxProtection.spec.ts` (**12 aserciones**): mapeo puro de permisos +
round-trip real (export protegido → reabrir confirma `sheetProtection.sheet`, la hoja libre no; import
reconstruye `protection.enabled` y los permisos). `xlsxStyled` (22) e import-rt (16) verdes — sin
regresiones; `lint web` 0; `build web` ✓.

## 114. Office/Sheets — motor de segmentaciones (slicers) y escala de tiempo

**Contexto.** Excel ofrece **segmentaciones** (botones que filtran una tabla por los valores marcados de
una columna) y **escalas de tiempo** (filtro por rango de fechas). Axos no tenía nada de esto. Es una
feature grande (motor + panel UI); esta rebanada entrega el **motor PURO**, testeable y aislado; el panel
visual y su cableado con la rejilla llegan en la siguiente rebanada.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** `components/office/sheets/slicer.ts`:
`slicerValues` da los valores distintos (los botones) de una columna; `applySlicers` recalcula
`sheet.config.rowhidden` a partir de TODOS los slicers (`sheet.slicers`) y escalas de tiempo
(`sheet.timelines`) combinados con **Y** (oculta una fila si cualquiera la rechaza). Selección `null`=todos,
`[]`=ninguno; la escala de tiempo filtra por `[desde, hasta]` (fechas/seriales). Usa la convención
`rowhidden` de Fortune-Sheet. No toca nada existente (módulo nuevo).

**Verificación:** nueva suite `slicer.spec.ts` (**11 aserciones**): valores distintos (texto y numéricos
ordenados), un slicer (oculta no-coincidentes), selección vacía/todos, dos slicers con Y, y escala de
tiempo por rango de fechas. `lint web` 0; `build web` ✓.

## 115. Office/Sheets — panel de segmentaciones (slicers) y escala de tiempo (rebanada 2: UI)

**Contexto.** §114 dejó el motor puro de slicers/escala de tiempo (`slicer.ts`, probado). Esta rebanada
añade la **cara visible** que lo usa: insertar segmentaciones desde el ribbon y filtrar la tabla en vivo.

**Decisión (sólo `apps/web`, aditiva — riesgo cero):** nuevo `components/office/sheets/SheetSlicer.tsx`
(panel flotante: por cada slicer, botones toggle con los `slicerValues`; por cada escala de tiempo, dos
fechas). En `SheetEditor.tsx`, botones «Segmentación de datos» y «Escala de tiempo» (pestaña Datos) que
crean el filtro sobre la columna seleccionada (`makeSlicer`/`makeTimeline`), y handlers que mutan la hoja,
llaman `applySlicers` y **re-montan** la rejilla (mismo patrón que el autofiltro nativo). El estado vive en
`sheet.slicers`/`sheet.timelines`, así que viaja en el documento. No toca el motor `slicer.ts` ni el resto.

**Verificación:** el motor sigue verde (`slicer.spec.ts` 11/11). UI verificada con `lint web` 0 y
`build web` ✓ (no hay runtime de rejilla en specs). Sin regresiones.

## 116. CIDE — encender el motor en producción (Ollama en Railway) + health check

**Contexto.** Todo el stack de CIDE (servicio NestJS, provider compatible-OpenAI, loop
agéntico de herramientas con RBAC, metering, guardrails, chat + panel admin) ya estaba
completo en código, pero **nunca había un motor de inferencia real al que el backend
desplegado pudiera llegar**: `CIDE_BASE_URL` apuntaba a `localhost:11434` (Ollama local),
que en Railway no existe. En producción CIDE caía a modo demo (`AI_MOCK`) o devolvía
"motor no disponible". El "paso" que faltaba era **levantar el cerebro y cablearlo**.

**Decisión.** El usuario eligió mantener la soberanía de datos: **Ollama self-hosted como
servicio aparte en Railway**, dejando el código y la config listos para encender.

- **Infra (`infra/cide/`):** nuevo `Dockerfile` + `entrypoint.sh` + `railway.json` que
  despliegan Ollama como servicio propio. El entrypoint **bindea `0.0.0.0`** (clave: el
  default `127.0.0.1` es inalcanzable desde otros servicios en la red privada de Railway)
  y **descarga el modelo en el arranque** (idempotente; `ollama pull` no es necesario a
  mano). Volumen en `/root/.ollama` para persistir pesos. El API apunta a la URL **privada**
  `http://<servicio>.railway.internal:11434/v1` + `AI_MOCK=0`.
- **Backend, endurecimiento (aditivo):**
  - `CIDE_TIMEOUT_MS` configurable (default 120 s) — la inferencia en CPU es lenta.
  - `CIDE_DEFAULT_MODEL` / `CIDE_ESCALATION_MODEL` por env (validados contra el catálogo),
    para elegir modelo sin tocar código.
  - Nuevo tier **`qwen2.5:1.5b`** (Apache-2.0) para CPU ágil; el catálogo sigue 100 %
    permisivo (sin Qwen-3B/72B, que no son Apache-2.0).
  - `CideProvider.ping()` (GET `/models`) + `AiService.engineHealth()` + endpoint admin
    `GET /api/ai/health`: reporta alcanzabilidad, modelos cargados y si el modelo activo
    está presente. Nunca lanza 5xx — un motor caído se reporta como dato.
- **Web (aditivo):** proxy `/api/ai/health` y, en `/dashboard/admin/ai`, una píldora de
  estado ("motor en línea / sin modelo / inaccesible") con botón **"Probar conexión"**, para
  verificar el cableado de un vistazo.

**Cómo encender (resumen).** Desplegar `infra/cide` como servicio Railway → setear en el
API `CIDE_BASE_URL=...railway.internal:11434/v1` y `AI_MOCK=0` → abrir el panel admin y
"Probar conexión" hasta ver verde. CPU funciona pero lento; para producción fluida,
mover el motor a GPU (vLLM/TGI) — el código es idéntico, solo cambia la URL.

**Verificación:** `build API` ✓, `tsc` ✓, `lint web` 0, `build web` ✓. Cambios aditivos:
ningún endpoint ni comportamiento existente se modifica; sin migraciones (no toca el esquema).

## 117. CIDE — tier GPU (vLLM) drop-in + catálogo de modelos extensible por env

**Contexto.** §116 encendió CIDE en producción sobre CPU (Ollama en Railway), pero la
inferencia en CPU es lenta (decenas de seg/turno). El siguiente paso es un motor **GPU**
para respuestas fluidas, sin reescribir nada.

**Decisión (aditiva).** vLLM como tier GPU, manteniendo el mismo contrato compatible-OpenAI
para que el cambio sea **solo `CIDE_BASE_URL`** (cero código):

- **Infra:** nuevo `infra/cide/docker-compose.gpu.yml` con `vllm/vllm-openai`, reservas de
  GPU NVIDIA, `ipc: host` y volumen de caché HF. **Truco drop-in:** `--served-model-name`
  aliasa los pesos HF al mismo tag del catálogo (p. ej. `qwen2.5:7b`), así el backend sigue
  pidiendo el mismo id. Parametrizado por env (`CIDE_HF_MODEL`, `CIDE_MODEL`,
  `CIDE_MAX_MODEL_LEN`); `--api-key` y `--tensor-parallel-size` documentados como opt-in.
- **Catálogo extensible (`ai-pricing.ts`):** `CIDE_EXTRA_MODELS` (coma-separado) registra
  served-model-names arbitrarios (vLLM/TGI o ids HF crudos) — aparecen en el selector admin
  y pasan validación de DTO **sin tocar código**. Self-hosted ⇒ precio $0 como los built-ins.
  El catálogo base sigue 100 % permisivo; se advierte que Qwen2.5-3B/72B no son Apache-2.0.
- **Docs:** `infra/cide/README.md` (guía GPU + RunPod/Lambda/Vast, reglas de VRAM, registro
  de modelos) y `.env.example`.

**Cómo cambiar a GPU.** Levantar `docker-compose.gpu.yml` en un host GPU → en el API
`CIDE_BASE_URL=http://<host-gpu>:8000/v1` (+ `CIDE_API_KEY` si se habilitó `--api-key`) →
"Probar conexión" en el panel admin. Para servir un id HF crudo, añadir `CIDE_EXTRA_MODELS`
+ `CIDE_DEFAULT_MODEL`.

**Verificación:** `build API` ✓, `tsc` ✓, `lint web` 0, `build web` ✓. Sin migraciones; ningún
endpoint ni comportamiento existente cambia.

## 118. CIDE — streaming de respuestas, auto-escalación de modelo y tests del loop

**Contexto.** Con el motor encendible (§116) y el tier GPU (§117), CIDE ya respondía;
faltaba madurez de producto: respuestas que aparecen de golpe tras segundos, un solo
modelo para todo, y el loop agéntico sin pruebas. Tres mejoras, todas aditivas.

**A — Auto-escalación de modelo (`ai-escalation.ts`).** Función pura `shouldEscalate()`
+ `chooseModel()`: las consultas analíticas (causa, tendencia, comparación, recomendación,
o prompts largos) usan el `escalationModel`; las consultas factuales cortas se quedan en el
default. **Off por defecto**, gated por `CIDE_AUTO_ESCALATE=1` (el modelo de escalación debe
estar servido por el motor; en CPU con un solo modelo daría 404). Un `model` explícito por
request siempre gana. Integrado en `prepare()`; se devuelve `escalated` en la respuesta.

**B — Streaming (SSE).** `CideProvider.chatStream()` lee la respuesta como Server-Sent
Events y reensambla con `StreamAssembler` (clase pura: concatena content, junta fragmentos
de tool-calls por `index`, captura usage del chunk final). `runCide()` admite un sink
opcional `{onDelta,onTool}` reutilizando el MISMO loop agéntico. Nuevo `AiService.chatStream()`
(refactor: `prepare()` + `persistTurn()` compartidos con `chat()`, sin duplicar guardrails/
RBAC/persistencia) y endpoint `POST /api/ai/chat/stream` que emite eventos `meta`/`tool`/
`delta`/`done`/`error` (controller con `@Res()`, headers anti-buffering). Proxy Next
`/api/ai/chat/stream` (+ `backendUserStream`) que canaliza el cuerpo SSE sin bufferizar.
`Cide.tsx` consume el stream y va llenando la burbuja del asistente token a token. El endpoint
bloqueante `POST /ai/chat` se mantiene intacto (lo usan los helpers de chat).

**C — Tests del loop.** `ai.service.spec.ts` ejercita `runCide()` contra un **motor falso**
(tool→resultado→respuesta final; ruta de streaming con fan-out de deltas/tools; mapeo de
caída del motor a `ServiceUnavailableException`), `ai-escalation.spec.ts` cubre la heurística,
y `cide-stream.spec.ts` el ensamblador SSE. **+17 tests.**

**Verificación:** `build API` ✓, **API tests 1078/1078** ✓, `lint web` 0 errores,
`build web` ✓ (rutas `/api/ai/chat/stream` y `/api/ai/health` registradas). Sin migraciones;
ningún endpoint ni comportamiento existente cambia.

## 119. CIDE — control del chat: detener generación, borrar conversaciones y badge de modelo

**Contexto.** Con el streaming en vivo (§118), faltaban controles básicos de UX que el
streaming habilita: poder **detener** una respuesta larga, **borrar** conversaciones del
historial y **ver qué modelo** respondió (incluido si hubo escalación). Todo aditivo.

**Decisión.**
- **Borrar conversación.** `AiService.deleteConversation()` (owner, o admin para cualquiera)
  borra el hilo y sus mensajes; endpoint `DELETE /api/ai/conversations/:id` + proxy Next
  (`backendUserFetch` ahora acepta DELETE/PATCH). En el historial de `Cide.tsx`, botón
  papelera por fila; si borras el hilo activo, arranca uno nuevo.
- **Detener generación.** `Cide.tsx` aborta el fetch del stream con `AbortController`; el
  botón Enviar se convierte en **Detener** mientras genera, conservando lo ya transmitido.
- **Badge de modelo.** Bajo cada respuesta se muestra el modelo usado y, si aplicó
  auto-escalación, una etiqueta «escalado» (el evento `meta`/`done` ya traía `escalated`).

**Verificación:** `build API` ✓, **AI tests 21/21** (+4 de borrado: not-found, forbidden,
owner, admin), `lint web` 0 errores, `build web` ✓. Sin migraciones; nada existente cambia.

## 120. CIDE — renombrar y reaprovechar conversaciones (renombrar · copiar · regenerar)

**Contexto.** Tras borrar/detener (§119), faltaba completar la gestión de conversaciones y
facilitar reaprovechar respuestas. Todo aditivo, sin migraciones (la columna `title` ya existe).

**Decisión.**
- **Renombrar.** `AiService.renameConversation()` (owner; admin cualquiera) recorta y limita el
  título a 200 chars (vacío → «Nueva conversación»). `PATCH /api/ai/conversations/:id`
  (`RenameConversationDto`) + proxy Next. En el historial de `Cide.tsx`, botón lápiz → edición
  inline (Enter confirma, Esc cancela) con actualización optimista.
- **Copiar respuesta.** Botón de copiar al portapapeles en cada respuesta del asistente, con
  check transitorio.
- **Regenerar.** `runStream()` extraído de `send()`; nuevo `regenerate()` reaprovecha el último
  mensaje del usuario, descarta la respuesta previa y vuelve a transmitir.

**Verificación:** `build API` ✓, **AI tests 25/25** (+4 de renombrar: not-found, forbidden,
owner con recorte/límite, fallback de título vacío), `lint web` 0 errores, `build web` ✓.
Sin migraciones; ningún endpoint ni comportamiento existente cambia.

## 121. CIDE — persistir el modelo/escalación por mensaje (badge fiel al recargar)

**Contexto.** El badge de modelo y la marca «escalado» (§119/§120) se mostraban solo en vivo:
al reabrir una conversación se perdían, porque `ai_message` no los guardaba. Brecha de fidelidad.

**Decisión.** Persistirlos por mensaje (primera **migración** del trabajo de CIDE; aditiva).
- **Esquema:** `ai_message` gana `model` (varchar 64, nullable) y `escalated` (boolean, nullable).
  Migración idempotente `AddAiMessageModel20260627140000` (glob las recoge sola; sin índice).
- **Persistencia:** `persistTurn()` guarda `model`/`escalated` en el turno del asistente; en modo
  demo (`mock`) se guarda `model=null` (no hubo motor real).
- **Lectura/UI:** `getConversation` ya devuelve el mensaje completo; `Cide.tsx` mapea `model`/
  `escalated` al recargar, así el badge reaparece idéntico.

**Verificación:** `build API` ✓, **AI tests 27/27** (+2: persistTurn guarda modelo/escalación;
demo no atribuye modelo), `lint web` 0 errores, `build web` ✓. Migración 100% aditiva (columnas
nullable); ningún comportamiento existente cambia.

## 122. CIDE — prompts de inicio contextuales por módulo

**Contexto.** El chat es accesible desde toda página del dashboard, pero ofrecía siempre las
mismas 4 sugerencias genéricas. Adaptarlas al módulo donde está el usuario mejora la
relevancia y el descubrimiento, **sin costo de inferencia** (es solo un mapeo).

**Decisión (solo `apps/web`, aditiva).** Nuevo `lib/chat/cideSuggestions.ts` con
`suggestionsFor(pathname)`: extrae el primer segmento tras `/dashboard/` y devuelve 3 preguntas
hechas a la medida del módulo (inventory, mrp, planning, production, quality, maintenance,
shipping, suppliers, finance, crm, genealogy, control-tower, etc. — todas respondibles por las
herramientas de CIDE); fuera del dashboard o en un módulo no mapeado cae a las genéricas.
`Cide.tsx` reemplaza la constante estática por `suggestionsFor(pathname)`.

**Nota de pruebas.** `apps/web` no tiene runner de tests unitarios (CI solo corre `lint` +
`build` para el front); `suggestionsFor` es una función pura cubierta por el type-check del
build y el lint. No se añadió spec no ejecutable.

**Verificación:** `lint web` 0 errores, `build web` ✓. Sin backend ni migraciones; nada
existente cambia.

## 123. CIDE — cobertura total: que la IA entienda todos los módulos de Axos OS

**Contexto.** CIDE ya razonaba sobre producción, inventario, MRP, compras, finanzas, ventas,
calidad (holds/CAPA), proveedores, BOM, Event Ledger y métricas. Pero quedaban módulos
operativos sin herramientas, así que la IA "no veía" partes del negocio. El objetivo de esta
fase: que CIDE **entienda todo Axos OS**.

**Decisión.** Añadir **11 herramientas read-only**, cada una gateada por el permiso real de
lectura del módulo (mismo principio: la IA nunca lee lo que el usuario no podría leer en la UI)
y auto-escopada por tenant (ALS), resolviendo los servicios vía `ModuleRef` (todos singleton):
- **Mantenimiento:** `maintenance_orders`, `maintenance_assets`, `maintenance_pm_plans`
  (`maintenance:read`).
- **EHS/Seguridad:** `safety_incidents` (`reports:read`).
- **Calidad:** `fai_records` (FAI, `quality:report`), `rma_cases` (devoluciones, `quality:read`).
- **Logística:** `list_shipments` (`materials:read`).
- **Herramentales:** `list_tools` (`maintenance:read`).
- **Finanzas:** `list_fixed_assets` (activos fijos, `finance:read`).
- **Trazabilidad:** `genealogy_links` (genealogía as-built, `production:report`).
- **Ingeniería:** `visual_aids` (ayudas visuales / instrucciones, abierto a usuario autenticado,
  como su endpoint).

El system prompt se actualizó para enumerar explícitamente todos los dominios cubiertos, y
`cideSuggestions` ganó prompts contextuales para EHS, herramentales, RMA y activos fijos.

**Verificación:** `build API` ✓, **API tests 1101/1101** ✓ (sin regresiones; servicios singleton
confirmados, no request-scoped), `lint web` 0 errores, `build web` ✓. Solo lectura; sin
migraciones; ningún endpoint ni comportamiento existente cambia.

## 124. CIDE — "Ponme al día": briefing ejecutivo de un clic

**Contexto.** Con CIDE entendiendo ya todos los módulos (§123), un caso de alto valor para un
dueño/gerente es un resumen accionable de "cómo está la planta ahora" sin escribir la pregunta.

**Decisión (solo `apps/web`, aditiva).** Botón **"Ponme al día"** destacado en el estado inicial
del chat que envía un `BRIEFING_PROMPT` curado por el flujo de streaming normal: CIDE encadena
sus herramientas (KPIs en alerta, novedades 24 h, calidad —holds/CAPA/FAI—, mantenimiento
vencido, embarques del día) y responde con secciones breves + "Acciones sugeridas" (máx 3,
priorizadas), siempre fundamentado en datos reales. Sin backend nuevo: reusa `POST
/ai/chat/stream` y todo el toolset RBAC. El prompt vive en `lib/chat/cideSuggestions.ts`.

**Verificación:** `lint web` 0 errores, `build web` ✓. Sin backend ni migraciones; nada
existente cambia.

## 125. CIDE — toggle de auto-escalación por tenant en el panel admin

**Contexto.** La auto-escalación de modelo (§118) era solo por env (`CIDE_AUTO_ESCALATE`),
global a todo el proceso. Un admin no podía activarla/desactivarla por organización ni verla
en la UI.

**Decisión (aditiva).** Hacerla configurable por tenant, conservando el default de proceso.
- **Esquema:** `ai_tenant_config.auto_escalate` (boolean, nullable). `null` = heredar el env;
  true/false = override del tenant. Migración idempotente `AddAiAutoEscalate20260627150000`.
- **Backend:** `ConfigDto.autoEscalate`; `setConfig` lo persiste; `publicConfig` expone el valor
  **efectivo** (`cfg.autoEscalate ?? AUTO_ESCALATE`) y `autoEscalateSource` ('tenant'|'default');
  `prepare()` pasa `cfg.autoEscalate ?? undefined` a `chooseModel` (override gana; null hereda).
- **UI admin:** toggle "Escalado automático de modelo" en `/dashboard/admin/ai`, con nota de
  herencia cuando viene del entorno.

**Verificación:** `build API` ✓, **API tests 1108/1108** (+2: setConfig persiste el override y
reporta source; default cuando no hay override), `lint web` 0 errores, `build web` ✓. Migración
100% aditiva (columna nullable); nada existente cambia.

## 126. CIDE — acciones con confirmación humana (el salto Palantir, human-in-the-loop)

**Contexto.** Hasta aquí CIDE era estrictamente **read-only** (§22/§23: "la ejecución es acción
humana"). El siguiente salto de producto —pasar de un panel que *informa* a un cerebro que
*opera* AXOS OS— requiere que CIDE pueda **accionar**. Se hace con autorización explícita del
usuario y revirtiendo de forma controlada esa postura read-only, **sin** dar a la IA poder de
ejecución autónomo.

**Decisión.** Patrón **human-in-the-loop**: la IA **propone**, el humano **confirma**, el backend
**ejecuta** con el RBAC del usuario.
- **Registro de acciones (`ai-actions.ts`, puro):** catálogo acotado de acciones permitidas.
  Arranca con **una**: `create_maintenance_order` (permiso `maintenance:write`). Cada acción trae
  validación + normalización de params y un resumen legible.
- **Propuesta (tool `propose_action`):** la IA puede *proponer* (no ejecutar). El tool valida
  permiso + params y devuelve una **tarjeta de confirmación** (`action_proposal`); nunca muta.
- **Ejecución (`AiActionsService` + `POST /ai/actions/execute`):** único punto de escritura;
  re-chequea permiso y **re-valida** params (no confía en el cliente), despacha al servicio del
  módulo (que ya registra su evento en el **Event Ledger** → auditable). Proxy Next dedicado.
- **UI:** la tarjeta de propuesta en el chat muestra el resumen y botones **Confirmar/Descartar**;
  al confirmar ejecuta y muestra el folio resultante. El system prompt instruye a proponer solo
  cuando el usuario lo pida explícitamente.

**Seguridad.** La IA jamás ejecuta sola; toda acción pasa por (1) confirmación humana explícita,
(2) RBAC del usuario re-verificado en el backend, (3) re-validación de params y (4) traza en el
Event Ledger. El catálogo es deliberadamente mínimo para validar el patrón antes de ampliarlo.

**Verificación:** `build API` ✓, **API tests 1118/1118** (+10: validación del registro y
`AiActionsService` —permiso denegado, acción desconocida, params inválidos, éxito—), `lint web`
0 errores, `build web` ✓. Sin migraciones; los módulos de lectura no cambian.

## 127. CIDE — ampliar el catálogo de acciones (calidad, compras, producción, EHS)

**Contexto.** §126 validó el patrón human-in-the-loop con una sola acción
(`create_maintenance_order`). Con el patrón probado, se amplía el catálogo a las acciones de
mayor valor operativo, reusando exactamente la misma infraestructura (propose_action → tarjeta
de confirmación → `POST /ai/actions/execute` con RBAC re-verificado y traza en el ledger).

**Decisión.** Cuatro acciones nuevas en `ACTIONS`, cada una con su permiso real y su ejecutor:
- `release_quality_hold` (`QUALITY_APPROVE`) → `QualityService.releaseHold(holdId, actor)`.
- `create_purchase_requisition` (`materials:write`) → `ErpMmService.createRequisition` (cierra
  el lazo MRP→compra; `createdBy` = el usuario).
- `create_production_plan` (`MANAGE_PLANS`) → `PlansService.create` (model, line 1–7, quantity,
  shift T1/T2/T3, …).
- `assign_ehs_incident_owner` (`reports:read`, como su endpoint) → `EhsService.update` fijando
  `capaOwner`/`capaDueDate`.
El `run()` del servicio ahora recibe el `reqUser` para inyectar el actor donde se requiere
(liberación de hold, createdBy de la requisición). La descripción de `propose_action` enumera
las 5 acciones y sus params. La UI no cambió: la tarjeta de propuesta ya es agnóstica a la acción.

**Verificación:** `build API` ✓, **API tests 1125/1125** (+7: validación de las 4 acciones y
execute de requisición/forbid EHS), `lint web` 0 errores. Mismas garantías de §126 (confirmación
humana + RBAC + re-validación + ledger). Sin migraciones.

## 128. CIDE "Centinela" — inteligencia proactiva (de reactivo a "te aviso yo")

**Contexto.** Hasta aquí CIDE respondía cuando le preguntabas. El salto: que **proponga la
agenda** — al abrirlo, muestra priorizado y filtrado por permisos "qué necesita tu atención
ahora" cruzando todos los dominios, cada hallazgo a un clic de análisis profundo (y de ahí, de
una acción §126/§127). Esto convierte a CIDE de panel reactivo en monitor proactivo.

**Decisión (aditiva, sin migración).**
- **Núcleo determinista (`ai-insights.ts`, puro):** mappers que convierten la salida de las
  herramientas read-only en `Insight { area, severity, title, detail, suggestedQuestion }`:
  KPIs en alerta (uno por alerta), mantenimiento vencido, retenciones de calidad activas,
  incidentes EHS abiertos. `buildSituationReport` combina y ordena por severidad. **No usa el
  LLM**, así que funciona aunque el motor no esté arriba.
- **Servicio (`AiInsightsService`):** corre `kpi_alerts`, `maintenance_orders`, `quality_holds`
  y `safety_incidents` vía `AiToolsService.execute` bajo el RBAC del usuario (fuentes sin
  permiso se omiten), y arma el reporte. Endpoint `GET /api/ai/insights` + proxy Next.
- **UI:** nueva vista **"Centinela"** (icono escudo) en el widget de CIDE: lista priorizada con
  puntos de severidad; cada hallazgo tiene "Analizar con CIDE →" que salta al chat con la
  pregunta de profundización.

**Verificación:** `build API` ✓, **API tests 1131/1131** (+6: mappers y `buildSituationReport`,
incl. tolerancia a shapes/RBAC y orden por severidad), `lint web` 0 errores, `build web` ✓
(ruta `/api/ai/insights` registrada). RBAC: nunca surfacea lo que el usuario no podría ver.

## 129. CIDE — copiloto estilo ChatGPT: alcance amplio, respuestas ricas y Markdown

**Contexto.** El usuario quiere usar CIDE como usa ChatGPT. El diseño previo lo limitaba a
analista de datos que **rechazaba** todo lo demás, con respuestas muy cortas y texto plano. Se
amplía a un copiloto de trabajo completo sin perder el grounding de datos. (No se reentrenan
pesos —el modelo es open-weight self-hosted—; el salto es de prompt, presupuesto y formato.)

**Decisión.**
- **System prompt reescrito:** CIDE es ahora un copiloto con DOS capacidades que combina: (1)
  analista de datos (usa herramientas para todo lo de la operación) y (2) asistente general
  (explicar, redactar/mejorar textos, traducir, resumir, calcular, idear, fórmulas/Excel,
  programación básica, dudas de uso). Se elimina el rechazo general; solo declina lo dañino/
  ilegal. **Regla de oro intacta:** para datos concretos de la empresa, solo lo que devuelven
  las herramientas (nunca inventar cifras/nombres); el conocimiento general sí puede responderse.
- **Respuestas ricas:** `AI_MAX_OUTPUT_TOKENS` default 700 → **1500**; longitud adaptativa
  (concisa para lo simple, completa cuando amerite); historial de contexto 20 → **40** mensajes.
- **Markdown:** el prompt pide formato Markdown; nuevo `MarkdownLite.tsx` (sin dependencias,
  XSS-safe por construcción) renderiza negritas, listas, encabezados, código y enlaces en las
  respuestas del asistente del chat.

**Verificación:** `build API` ✓, `tsc` ✓, **AI tests 52/52**, `lint web` 0 errores, `build web` ✓.
Sin migraciones; los flujos de datos/acciones no cambian.

## 130. CIDE — "enséñale tu empresa": conocimiento propio por organización

**Contexto.** §129 amplió a CIDE a copiloto general, pero no "sabía" lo específico de la empresa
(políticas, definiciones, abreviaturas, objetivos). No se pueden reentrenar pesos (modelo
open-weight self-hosted); la vía práctica es **inyectar conocimiento curado** en su contexto.

**Decisión (aditiva).** Un panel donde el admin escribe el conocimiento de la organización y
CIDE lo usa como contexto autoritativo.
- **Esquema:** `ai_tenant_config.knowledge` (text, nullable). Migración idempotente
  `AddAiKnowledge20260628010000`.
- **Backend:** `ConfigDto.knowledge` (máx 8000); `setConfig` lo persiste (trim; vacío → null);
  `publicConfig` lo expone; `buildSystem(reqUser, knowledge)` inyecta un bloque "CONOCIMIENTO DE
  LA EMPRESA" cuando hay texto, instruyendo a priorizarlo sobre el conocimiento general (sin
  romper la regla de oro: los datos concretos siguen viniendo de las herramientas).
- **UI admin:** sección "Conocimiento de la empresa" en `/dashboard/admin/ai` con textarea
  (contador 0/8000) y guardado.

**Verificación:** `build API` ✓, `tsc` ✓, **AI tests 55/55** (+3: inyección en el prompt y
persistencia/limpieza de `knowledge`), `lint web` 0 errores, `build web` ✓. Total API 1134.
Migración 100% aditiva (columna nullable).

## 131. CIDE — evidencia clicable (provenance) + más acciones

**Contexto.** Dos pulidos: (1) dar **trazabilidad** a las respuestas (de dónde salieron los
datos), estilo Palantir; (2) ampliar el catálogo de acciones human-in-the-loop.

**Decisión (aditiva).**
- **Evidencia clicable (#1, web):** nuevo `lib/chat/toolSources.ts` mapea cada herramienta de
  grounding a su módulo (`toolSource`/`sourcesFor`). En el chat, bajo cada respuesta, los chips
  de herramientas se reemplazan por **"Fuentes: …"** con enlaces al módulo consultado (Inventario,
  Calidad, Mantenimiento, Finanzas, etc.). Determinista; tools sin página no enlazan.
- **Más acciones (#3, backend):** dos acciones nuevas en el patrón ya validado (propose→confirm→
  execute con RBAC + ledger): `set_maintenance_order_status` (`maintenance:write` →
  `MaintenanceService.updateOrder` con status OPEN/IN_PROGRESS/COMPLETED/CANCELLED) y
  `create_safety_incident` (`reports:read` → `EhsService.create`, folio INC-). `propose_action`
  ahora documenta 7 acciones.

**Verificación:** `build API` ✓, **API tests 1137/1137** (+3: validación de las 2 acciones),
`lint web` 0 errores, `build web` ✓. Sin migraciones.

## 132. CIDE — briefing proactivo programado (push a admins)

**Contexto.** Cerrar el círculo proactivo: que CIDE no solo muestre el Centinela al abrir, sino
que **avise** a los admins cada mañana cuando hay algo que atender, sin que nadie lo pida.

**Decisión (aditiva, sin migración).** Reutiliza el `DecisionBrief` diario (ya generado por
`BriefsService` a las 3AM, multi-tenant y determinista) y le añade el **push**.
- **Nuevo `AiBriefingTask` (módulo AI):** `@Cron` diario (default 7AM; `CIDE_BRIEF_PUSH_CRON`
  para ajustar, `CIDE_BRIEF_PUSH_ENABLED=false` para apagar). Para cada tenant lee el último
  brief (`BriefsService.listForTenant`, tenant-safe); si tiene alertas, notifica a los admins de
  ESE tenant (`UsersService.listByPermission('ADMIN_ACCESS')` filtrado por tenant, con helper
  `sameTenant` para el default) vía `NotificationsService.create` (severidad según criticidad,
  href a `/dashboard/intelligence`, **dedupeKey** por tenant/día/admin → idempotente).
- **Sin acoplar módulos:** los servicios cruzados (semantic/users/notifications) se resuelven con
  `ModuleRef` (strict:false), como el resto de CIDE. Falla suave (try/catch) para no tumbar el cron.

**Verificación:** `build API` ✓, `tsc` ✓, **API tests 1143/1143** (+4: `sameTenant` y `run` —
empuja solo a admins del tenant con alertas; no empuja sin alertas), `lint web` 0 (sin cambios web).
Sin migraciones.

<!-- Nuevas decisiones se agregan al final con número incremental -->
