# CLAUDE.md — Reglas duras para agentes (AXOS OS)

> Este archivo gobierna **toda corrida de agente** (incluido el worker autónomo
> 24/7 de `.github/workflows/agent-worker.yml`). Es complementario a `AGENTS.md`
> (contexto de producto, stack y roles). **Donde haya conflicto para una corrida
> automatizada de agente, manda este archivo.** En particular: los agentes del
> pipeline **ramifican y PRean a `staging`, nunca a `main`** y **nunca mergean**
> (esto sustituye, para PRs de agente, la convención humana de "squash a main"
> descrita en `AGENTS.md §5`).

Las reglas de abajo son **duras**: si una tarea te obliga a violar cualquiera de
ellas, **detente** y deja el PR en *draft* pidiendo revisión humana explícita.

---

## 1. Cambios SOLO aditivos

- **Nunca** elimines ni rompas lo existente. Prohibido `DROP`, `TRUNCATE` y
  cualquier `ALTER` destructivo (cambiar tipo, volver `NOT NULL` una columna con
  datos, renombrar/eliminar columnas o tablas).
- **Columnas nuevas siempre `NULLABLE`** (o con `DEFAULT` seguro). Nunca agregues
  una columna `NOT NULL` sin default a una tabla con datos.
- **Migraciones que no rompen**: una migración debe poder correr sobre una base
  con datos de producción sin pérdida ni downtime. Solo *forward*, aditivas.
  Toda la familia de migraciones vive en `apps/api/src/migrations/` y entra en la
  **zona de revisión humana obligatoria** (ver §5).
- Sin breaking changes de contrato en APIs/DTOs existentes: agrega campos
  opcionales, no cambies/quites los actuales. Si necesitas comportamiento nuevo,
  protégelo con un default seguro o feature flag.

## 2. Git: base `staging`, nunca `main`, nunca merge

- **Ramifica siempre desde `staging`** (`git checkout staging && git pull
  --ff-only origin staging && git checkout -b agent/issue-<N>-<slug>`).
- **Todo PR tiene base `staging`.** **NUNCA** abras un PR contra `main` ni
  empujes a `main` o `staging` directamente.
- **Nunca mergees automáticamente.** Abre el PR en **draft** y deja que un humano
  revise y mergee. No toques *branch protection* ni *auto-merge*.

## 3. PRs chicos, reuso y guardrails

- **Un issue → un PR.** PRs pequeños y revisables; nada de mega-cambios.
- **Reusa, no dupliques.** Antes de crear UI nueva revisa y reutiliza:
  - `apps/web/src/components/ui/**` — primitivos (shadcn/ui). **No** los dupliques.
  - `apps/web/src/components/workspace/**` — componentes de workspace existentes.
  - Módulos backend en `apps/api/src/modules/**`.
- **Respeta el guardrail de acceso del owner.** La lógica de "quién ve todo" vive
  en `apps/web/src/lib/owner.ts` (`seesAllAreas`, `apps/web/src/lib/owner.ts:36`;
  `isOwnerEmail`, `ownerEmails`). Es el espejo de
  `apps/api/src/modules/auth/rbac.ts`. **No** lo debilites, evadas ni
  reimplementes: si un área necesita gating, llama a `seesAllAreas` / `isAdminAccess`.
  Tocar `owner.ts` exige revisión humana (ver §5).

## 4. Nada de vendorizar / forkear librerías

- No copies código de terceros al repo ni hagas fork local de una dependencia.
  Usa el paquete publicado vía `package.json` (npm workspaces / Turbo).
- Si una librería no alcanza, propónlo en el issue/PR para decisión humana; no
  metas una copia parcheada al árbol.

## 5. Zonas PROHIBIDAS sin marcar para revisión humana obligatoria

No modifiques las rutas siguientes salvo que el issue lo pida explícitamente.
Si las tocas, **deja el PR en draft, descríbelo en el cuerpo y pide revisión
humana** (estas rutas además están protegidas por `.github/CODEOWNERS`):

| Zona | Paths reales en este repo |
|------|---------------------------|
| Migraciones DB | `apps/api/src/migrations/**` |
| Aislamiento multi-tenant | `apps/api/src/common/tenant/**` |
| Autenticación | `apps/api/src/modules/auth/**`, `apps/web/src/app/api/auth/**`, y cualquier `**/auth/**` |
| Seguridad | `apps/api/src/common/security/**`, y cualquier `**/security/**` |
| Guardrail del owner | `apps/web/src/lib/owner.ts` |
| Secrets / entorno | cualquier `**/.env` (jamás commitees uno; el único versionado es `apps/api/.env.example`) |
| Infra de contenedores | cualquier `**/docker-compose*` (p. ej. `infra/cide/docker-compose.yml`) |
| CI / automatización | `.github/workflows/**` |

## 6. Verifica en el código real antes de afirmar

- **No inventes.** Antes de afirmar que algo existe/funciona, ábrelo en el repo y
  **cita el path y la línea reales** (p. ej. `apps/web/src/lib/owner.ts:36`).
- Antes de crear un módulo/componente, busca si ya existe (§3) y reutilízalo.
- Verifica calidad **desde la raíz** antes de abrir el PR:
  - `npm run build`
  - `npm run lint`
  Si alguno falla, **no** abras PR: reporta el error en el issue y libera el
  label `agent-in-progress`.

---

_Resumen de una línea para cada corrida: aditivo, desde `staging`, PR draft a
`staging`, un issue por PR, reusa primitivos, no toques las zonas del §5, y cita
paths reales._
