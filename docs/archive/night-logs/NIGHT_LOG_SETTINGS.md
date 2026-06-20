# AXOS OS — Night Log · Carril G3 (Settings · Usuarios y roles)

Bitácora del carril de **Configuración → Usuarios, roles y permisos** (G3).
Rama `claude/dreamy-edison-uvdk9w`.
Alcance de archivos: **solo** `apps/web/src/app/dashboard/settings/**`.
Backend reutilizado (**cero cambios de backend este turno**): `governance` (users),
`auth` (rbac/roles).

> **Reglas que seguí:** trabajo solo en mi carril; cero mock (toda lista sale del
> API real, estado vacío honesto); reuso **endpoints existentes** (grep de los
> controllers antes de cablear); **NO** toco `dashboard/office/**` ni su `page.tsx`
> (carril F0); **NO** toco backend de users/auth (solo lo consumo); puertas antes
> de cerrar: `tsc --noEmit` + `eslint` en verde.

---

## Mapa del backend de mi carril (grep antes de cablear)

**Usuarios (lo que consume la página) — `governance.controller.ts`, guard
`JwtAuthGuard + PermissionsGuard`, todos `@RequirePermissions('ADMIN_ACCESS')`:**
- `GET /governance/users` → `usersService.findAll()` (lista cruda de usuarios).
- `POST /governance/users` → `createUser(dto)`: alta directa **activa**; deriva
  `permissions = permissionsFor(role)` y arma `scopes` desde `buildingId/line/programId`.
- `PATCH /governance/users/:id` → `updateUser(id, dto)`: si llega `role` válido lo
  normaliza (`roleColumnFor`, `'Admin'` para admin) y **recalcula** `permissions`.
  Acepta también `isActive`, `status`, `name`, `scopes`, `tenantId`, `password`.
- **No existe** `DELETE /governance/users/:id` → el "borrado" real es desactivar
  (`isActive:false`). **No existe** endpoint de invitación por correo.

**RBAC (catálogo) — `apps/api/src/modules/auth/rbac.ts` (fuente de verdad):**
- `ROLE_PERMISSIONS: Record<AppRole, string[]>` — 17 roles → `resource:action`.
  `admin: []` (omite el guard; `permissionsFor('admin')` = `ALL_PERMISSIONS`).
- `ALL_PERMISSIONS` = unión de los grants no-admin + `auth:read/write` +
  `settings:read/write` → **33 permisos** en **12 recursos**.
- `permissionsFor(role)` es exactamente lo que el backend estampa en el JWT.

**RBAC en DB (sistema aparte, NO usado para la matriz) — `roles.controller.ts`,
`user-roles.controller.ts`:** `GET /api/roles`, `GET /api/roles/:id/permissions`,
`GET /api/users/:id/roles?tenantId=…` (+ POST/DELETE). Requieren `auth:write` y
operan sobre tablas `role/permission/user_role`. Es un sistema **distinto** del
string `User.role`; puede estar sin sembrar. No es la verdad de "qué otorga el rol
que asigna esta UI", así que **no** lo usé como fuente de la matriz (ver Decisión 1).

**Master / Dueño — `apps/api/src/main.ts` (seedAdmins) + `@/lib/owner`:**
- Backend siembra: *Service admin*, *Master admin* (`MASTER_ADMIN_EMAIL/PASSWORD`)
  y *Owner admin(s)* (`OWNER_ADMIN_EMAILS`, default `sergiovallezarate@gmail.com`).
- Frontend ya tenía `@/lib/owner` (`isOwnerEmail`, espejo de `ownerEmails`): el
  dueño se deriva del **email**, no del rol, para que un JWT viejo/reseed no lo deje
  en solo-lectura. Lo reutilicé como base de "intocable".

---

## Qué ya existía vs. qué agregué

- **Ya existía** `settings/users/page.tsx`: lista desde `/governance/users`, crear,
  editar (rol/scope/nombre), reset password y activar/desactivar. Tenía su propio
  `ROLE_OPTIONS` duplicado en línea.
- **Faltaba** (lo nuevo de este turno): la **matriz de permisos por rol**, la
  protección del **Master/Dueño**, la nota honesta de capacidades de backend, y unir
  la sección con navegación. Además **deduppliqué** el catálogo de roles a un módulo
  compartido para que página y matriz nunca se desincronicen.

## Archivos (todos dentro de `settings/**`)

- **`_lib/rbac.ts`** *(nuevo)* — espejo de `auth/rbac.ts` (verbatim `ROLE_PERMISSIONS`)
  + metadata de UI en español: `ROLE_META`/`ROLE_OPTIONS`, `RESOURCE_META`,
  `ACTION_LABELS`, `PERMISSION_GROUPS` (columnas de la matriz, agrupadas por recurso),
  `permissionsForRole`, `roleHasPermission`, `TONES` (clases Tailwind literales).
  **Única fuente de verdad** compartida por la página de usuarios y la matriz.
- **`_lib/access.ts`** *(nuevo)* — `protectionFor(user, currentEmail)` →
  `{locked, reason, label, note}`. Marca intocable a: **owner** (`isOwnerEmail`),
  **master** (`NEXT_PUBLIC_MASTER_ADMIN_EMAIL` o heurística nombre/usuario/local-part
  == "master") y **self** (la cuenta con la que iniciaste sesión → evita auto-bloqueo).
- **`_components/SettingsTabs.tsx`** *(nuevo)* — sub-nav (Usuarios · Matriz · Organización).
- **`permissions/page.tsx`** *(nuevo)* — **Matriz de permisos (solo lectura)**.
  Dos vistas: **Tarjetas** (por rol: qué puede, agrupado por recurso, con conteo y
  "Acceso total" para Admin) y **Cuadrícula** (17 roles × permisos, `✓`/sin-acceso,
  encabezados de recurso, primera columna sticky, scroll horizontal). Filtros: búsqueda
  de permiso, chips por recurso, enfocar rol, "solo recursos con acceso". Explica que
  esto vuelve transparente justo lo que causó el *read-only*.
- **`users/page.tsx`** *(modificado)*:
  - Roles desde `_lib/rbac` (se eliminó el duplicado).
  - **Protección Master/Dueño/self**: badge "Dueño · Master"/"Tu cuenta", botón de
    desactivar **deshabilitado** (con tooltip), y en el editor el **select de rol
    bloqueado** + se **omite `role`** del PATCH para no poder degradarlo.
  - **Nota honesta de backend**: "Crear usuario" = alta directa (no hay invitación
    por correo); "Desactivar" = apagado suave (no hay borrado por API); registro
    self-service se aprueba en Aprobaciones.
  - **Preview de permisos del rol** en alta/edición (lista los `resource:action` que
    otorga + enlace a la matriz), conectando la asignación con la transparencia.

---

## Decisiones

1. **La matriz refleja `rbac.ts` (espejo en frontend), no `/api/roles`.** La verdad
   de "qué otorga el rol que asigna esta UI" es `ROLE_PERMISSIONS` (lo que el backend
   mete al JWT vía `permissionsFor`). No hay endpoint que exponga ese mapa estático;
   `/api/roles` es el RBAC en DB (otro sistema, requiere `auth:write`, puede estar
   vacío). Espejarlo es el patrón ya establecido en el repo (`@/lib/owner` espeja
   `ownerEmails`; la página ya espejaba `ROLE_OPTIONS`). Queda robusto y sin permisos
   extra. *Riesgo:* drift si cambia el backend → mitigación en Follow-ups.
2. **"Master" = owner ∪ master-seed ∪ self.** El front no ve `MASTER_ADMIN_EMAIL`
   (env de backend), así que protejo por `isOwnerEmail` (siempre cubre al dueño),
   por `NEXT_PUBLIC_MASTER_ADMIN_EMAIL`/heurística "master", y por la propia sesión
   (anti auto-bloqueo). Es defensa en profundidad de **UI**; el backend sigue siendo
   la autoridad real.
3. **Solo lectura en la matriz.** La tarea pide lectura; existe write (`/api/roles/:id/
   permissions`) pero no se cablea — editar el catálogo es trabajo de backend.
4. **Carpetas privadas `_lib`/`_components`** (prefijo `_`): Next.js las excluye del
   ruteo, así que no crean rutas accidentales y conviven con `permissions/page.tsx`.

## Puertas (verde)

- `tsc --noEmit` sobre **toda** `apps/web`: **0 errores**.
- `eslint src/app/dashboard/settings`: **0 errores, 0 warnings**.
- (No corrí `next build` completo: requiere construir rutas ajenas a mi carril; el
  typecheck global ya cubre las TSX nuevas, que son client components.)

## No tocado

- `dashboard/office/**` y su `page.tsx` (carril F0). Backend de users/auth (solo
  consumido). `@/lib/owner`, `@/config/positions`, `AuthContext` (solo importados).

## Follow-ups para backend (gaps honestos detectados)

- **Invitación por correo**: no hay endpoint. Hoy el admin crea la cuenta y comparte
  credenciales. Sugerido: `POST /governance/users/invite` (genera token + correo).
- **Borrado**: no hay `DELETE /governance/users/:id`. Hoy se desactiva. Si se quiere
  baja definitiva, exponer el endpoint (la UI ya distingue "desactivar").
- **Evitar drift de la matriz**: exponer un `GET /governance/rbac` (o `auth/rbac`) que
  devuelva `ROLE_PERMISSIONS`/`ALL_PERMISSIONS` para que la matriz lo consuma en vez de
  espejarlo. Mientras tanto, `_lib/rbac.ts` debe mantenerse en sync con `auth/rbac.ts`
  (lo cubre `rbac.spec.ts` del lado servidor).
- **Proteger al Master en backend**: el PATCH actual permitiría degradar a un admin si
  alguien llama el API directo; la protección de este turno es de UI. Idealmente el
  backend rechaza degradar/desactivar a owner/master.
