# AXOS OS

**ERP + MES para una EMS** (Electronics Manufacturing Services / manufactura por
contrato de electrónica). AXOS OS es una plataforma industrial multi-tenant que
cubre el flujo de manufactura de punta a punta —del maestro de materiales y la
lista de materiales (BOM) al ruteo, MRP, ejecución en piso, calidad, logística y
finanzas— con un **Event Ledger inmutable** como columna de trazabilidad.

> **Estado honesto.** Buena parte del sistema se construyó con agentes en
> sesiones autónomas ("modo nocturno"; bitácoras en
> [`docs/archive/night-logs/`](docs/archive/night-logs/INDEX.md)). La superficie
> es grande (~76 módulos de backend, ~90 pantallas) pero **la madurez varía por
> módulo**: algunos conectan de punta a punta y otros son andamiaje o conviven
> con un carril legacy + uno nuevo (ver [Notas honestas](#notas-honestas)).
> Trátalo como una base sólida en evolución, no como un producto cerrado.

## Orientación en 60 segundos

- **Qué es:** ERP/MES para una EMS (contract manufacturer de electrónica).
- **Forma:** monorepo **Turborepo** con dos apps + documentación.
- **Backend:** [`apps/api`](apps/api) — **NestJS** + TypeORM (PostgreSQL en prod, SQLite en dev), JWT, WebSockets.
- **Frontend:** [`apps/web`](apps/web) — **Next.js** (App Router) + React + TypeScript + Tailwind + shadcn/ui.
- **Correr local:** `npm install && npm run dev` desde la raíz.
- **Profundizar:** arquitectura en [`AXOS_OS_ARCHITECTURE.md`](AXOS_OS_ARCHITECTURE.md), decisiones/rationale en [`DECISIONS.md`](DECISIONS.md).

## Layout del monorepo

```
apps/
  api/   Backend NestJS — TypeORM, JWT, ~76 módulos de dominio   → http://localhost:3000  (prefijo /api)
  web/   Frontend Next.js (App Router) — dashboard por dominio   → http://localhost:3001
docs/    Arquitectura, blueprint, visión de producto, y archive/ (night-logs + listas de limpieza)
```

Los `workspaces` de npm reservan `packages/*` para tipos/contratos compartidos a
futuro, pero **ese directorio aún no existe**.

## Stack

| Capa | Tecnologías |
| --- | --- |
| **API** (`apps/api`) | NestJS · TypeORM · PostgreSQL (prod) / SQLite (dev) · JWT · WebSockets · RBAC + Event Ledger de auditoría · prefijo global `/api` |
| **Web** (`apps/web`) | Next.js App Router · React · TypeScript · Tailwind CSS · shadcn/ui · SWR |
| **Tooling** | Turborepo · npm workspaces · Node **20.9+** (Next 16 lo exige) |

## Mapa de dominios

La topología sigue un modelo tipo ISA-95:
**Plant → Customer → Program → Model → Revision → Work Order → Line / Station**
(detalle en [`AXOS_OS_ARCHITECTURE.md`](AXOS_OS_ARCHITECTURE.md)). Los dominios se
agrupan por Domain-Driven Design:

| Dominio | Qué cubre | Módulos backend (`apps/api/src/modules`) | UI (`/dashboard`) |
| --- | --- | --- | --- |
| **Materiales** | maestro de materiales, inventario, recepción, almacén, conteos cíclicos, surtido a línea | `material-master`, `materials`, `inventory`, `receiving`, `inbound`, `warehouse`, `cycle-counts`, `material-staging`, `material-requests` | `/materials`, `/inventory`, `/receiving`, `/warehouse`, `/cycle-counts`, `/material-staging` |
| **BOM & Modelos** | BOM multinivel, modelos y revisiones de ingeniería | `bom`, `bom-tree`, `product-models` | `/bom`, `/models` |
| **Ruteo** | rutas de proceso, estaciones, balanceo de línea, backflush | `routing`, `process-routing`, `routing-backflush`, `line-engineering` | `/routing`, `/line-engineering` |
| **MRP & Compras** | planeación de materiales, requisiciones, órdenes de compra, proveedores | `mrp`, `purchase-planning`, `procurement`, `suppliers` | `/mrp`, `/procurement`, `/suppliers` |
| **Planeación & Producción** | planes/WO, ejecución MES en piso, terminal de operador, monitor en vivo, OEE | `plans`, `production-plan`, `mes-execution`, `production-runtime`, `operator-terminal`, `live`, `oee`, `changeover` | `/planning`, `/production`, `/operador`, `/operator-terminal`, `/live`, `/line-control-tower` |
| **Calidad** | IQC/IPQC/OQC, NCR/CAPA, holds, FAI, RMA | `quality`, `floor-quality`, `ncr`, `fai`, `rma` | `/quality`, `/floor-quality`, `/rma` |
| **Logística & Embarques** | empaque, tráfico, salida, listas de surtido | `shipping`, `packing`, `outbound`, `traffic`, `pick-lists` | `/shipping`, `/packing`, `/outbound`, `/traffic` |
| **Finanzas & Costos** | contabilidad, costeo de producto, COGS / cost intelligence, gastos, activos fijos | `accounting`, `product-costing`, `cost-intelligence`, `cost-rollup`, `expenses`, `fixed-assets`, `erp-core` | `/finance`, `/erp/fin`, `/expenses`, `/fixed-assets` |
| **Trazabilidad** | genealogía cuna-a-tumba, Event Ledger inmutable | `genealogy`, `event-ledger` | `/genealogy` |
| **Torre de control & Inteligencia** | agregadores globales, forecast, decision intelligence, autopilot, **CIDE** (IA propia self-hosted), **capa semántica** (catálogo de métricas + ontología), **analítica** (tendencias + narrativa) | `control-tower`, `line-control-tower`, `forecast`, `decision-intelligence`, `autopilot`, `ai` (CIDE), `semantic`, `analytics` | `/control-tower`, `/forecast`, `/mission-control`, `/intelligence`, `/admin/ai` |
| **Plataforma** | usuarios/RBAC, governance/auditoría, numeración de folios, settings, búsqueda, chat, notificaciones, suite Office | `users`, `auth`, `governance`, `numbering`, `messaging`, `office`, `import-data` | `/settings`, `/admin`, `/chat`, `/documents` |

> Hay más módulos transversales (`crm`, `people`, `maintenance`, `ehs`,
> `engineering`, `visual-aids`, `tooling`, `legal`…). La lista completa vive en
> [`apps/api/src/modules/`](apps/api/src/modules).

## CIDE — la IA propia

**CIDE** (Cognitive Intelligence & Decision Engine) es el analista de datos
integrado: corre sobre un modelo **open-source self-hosted** (Qwen2.5,
Apache-2.0) servido por un motor **compatible-OpenAI** (Ollama por defecto) que
**tú controlas** — sin Anthropic, sin DeepSeek, sin proveedor externo, con la
data dentro de tu infraestructura. Responde **fundamentado en los datos reales**
de MES/ERP vía herramientas read-only filtradas por RBAC, incluida la analítica
sobre el **Event Ledger** (`operations_pulse`, `ledger_trace`).

```bash
# levantar el motor (una vez)
docker compose -f infra/cide/docker-compose.yml up -d
docker exec -it cide-ollama ollama pull qwen2.5:7b
# apuntar el API al motor (default ya coincide con Ollama local)
#   CIDE_BASE_URL=http://localhost:11434/v1
```

Detalle y operación en [`apps/api/src/modules/ai/README.md`](apps/api/src/modules/ai/README.md).

## Desarrollo local

**Requisitos:** Node 20.9+, npm 10+. PostgreSQL es opcional en dev: sin
`DATABASE_URL` el backend usa **SQLite** automáticamente.

```bash
npm install            # instala todo el monorepo (workspaces)
npm run dev            # turbo: API en :3000 (bajo /api) y web en :3001
```

O por separado:

```bash
# Backend  → http://localhost:3000  (rutas bajo /api)
cd apps/api && npm install && npm run start:dev

# Frontend → http://localhost:3001
cd apps/web && npm install && npm run dev
```

**Variables de entorno (API):** copia
[`apps/api/.env.example`](apps/api/.env.example) a `apps/api/.env` y ajusta
`NODE_ENV`, `PORT`, `ALLOWED_ORIGIN`, `DATABASE_URL` y `JWT_SECRET`.

## Build, tests y puertas de calidad

```bash
npm run build                            # turbo: build de API (nest/tsc) y web (next build)
cd apps/api && npm test                  # unit tests del API (Jest)
cd apps/api && npm run smoke:bootstrap    # arranca el dist compilado contra Postgres (DI/esquema)
cd apps/web && npm run lint               # eslint del frontend
```

**CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml), en cada PR y push
a `main`) corre las puertas **bloqueantes**: build API · unit tests API · lint web
· build web · **smoke de bootstrap** contra un Postgres efímero (materializa todo
el esquema y atrapa colisiones de tabla/FK/DI antes del merge). El **lint del API
es no-bloqueante** por ahora (deuda de formato preexistente; ver
[`DECISIONS.md`](DECISIONS.md) §13). Cada merge a `main` despliega a producción.

## Base de datos y migraciones (leer antes de tocar)

- **Dev:** SQLite. **Prod** (Railway, con `DATABASE_URL`): PostgreSQL con
  `synchronize: true` → el esquema se **materializa desde las entidades**, no
  desde las migraciones.
- Las migraciones existentes son **parches incrementales** sobre ese esquema; **no
  lo construyen desde cero**. No corras `migration:run` contra una base
  remota/fresca a ciegas (ver [`DECISIONS.md`](DECISIONS.md) §14).
- Regla de oro: cambios de entidad **solo aditivos** (tablas/columnas nullable o
  con default; nada de DROP/rename/NOT NULL sin default). Ver
  [`DECISIONS.md`](DECISIONS.md) §2.

## Notas honestas

- **Carriles paralelos.** Algunos dominios tienen un carril legacy y uno nuevo
  conviviendo —p. ej. planeación (`plans` vs `production-plan`) y material master
  (`material_master` legacy vs `mm_material`). **No todos conectan de punta a
  punta**; el caso de planeación está analizado en
  [`docs/analysis-planning-cta.md`](docs/analysis-planning-cta.md).
- **`synchronize: true` en prod** es deliberado pero frágil; el smoke de bootstrap
  en CI es la red que lo protege.
- **Multi-tenant:** `tenant_id` + `TenantScopedRepository`, con adopción
  incremental por módulo (no todos los módulos lo aplican aún).

## Más documentación

| Documento | Para qué |
| --- | --- |
| [`AXOS_OS_ARCHITECTURE.md`](AXOS_OS_ARCHITECTURE.md) | Topología, módulos por dominio (DDD), Event Ledger, design system. |
| [`DECISIONS.md`](DECISIONS.md) | ADR ligero: rationale, supuestos, deuda técnica y rieles de seguridad. |
| [`docs/`](docs) | Blueprint de manufactura, arquitectura back/front, visión de producto, plan de multi-tenencia. |
| [`docs/archive/night-logs/INDEX.md`](docs/archive/night-logs/INDEX.md) | Bitácoras históricas del build autónomo (índice). |
| [`AGENTS.md`](AGENTS.md) | Reglas para agentes de IA que contribuyen al repo. |
