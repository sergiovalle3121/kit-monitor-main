# NIGHT_LOG — Carril F0 · Fix RBAC «Office en SOLO LECTURA» para Master/owner

Carril: **F0 (RBAC fix Office)**
Archivos del carril:
- `apps/web/src/app/dashboard/office/[id]/page.tsx`
- `apps/web/src/app/dashboard/office/page.tsx`
- `apps/web/src/hooks/usePermissions.ts` (helper nuevo, centraliza el cálculo)

Reutiliza (no toca): `@/lib/owner` (`isOwnerEmail`) y `AuthContext.isAdmin`.
NO toca backend (`apps/api`).

---

## ▶ RETOMAR AQUÍ
Fix cerrado y verde (eslint sin errores, `tsc --noEmit` limpio, `next build` OK,
truth-table 12/12). Si se profundiza paridad en este carril, el siguiente hueco
natural es reusar `usePermissions()` en otros gates que aún hacen
`roles.includes('Admin')`/`endsWith(':write')` a mano FUERA de Office (no tocados
aquí por estar fuera del carril): `store.ts`, `DashboardDock`, `DashboardTopBar`,
`AiCopilot`, `finance/cost-rollup`. Coordinar antes de entrar a esos archivos.

---

## 1. Reproducción / diagnóstico — qué entrega `useAuth()`

`useAuth()` (en `contexts/AuthContext.tsx`) **decodifica el JWT del backend**
(`localStorage.axos_access_token`), no la cookie de sesión del front. De ahí salen:

| campo         | origen en el JWT            | para el Master/owner |
|---------------|-----------------------------|----------------------|
| `roles`       | `[payload.role]` (1 elem.)  | `'admin'` **en minúscula** (a veces) o `'Admin'` |
| `permissions` | `payload.permissions ?? []` | a veces **`[]` (vacío)** |
| `user.email`  | `payload.email`             | `sergiovallezarate@gmail.com` |

Cómo llega el JWT del owner: el bridge `/api/backend/token` → `backendSync(...)`
manda `role: session.role`, y `lib/session.ts` **normaliza el rol a minúscula**
(y fuerza el owner a `'admin'`). Según la versión del backend desplegada en
Railway, el JWT que vuelve puede traer:
- `role: 'admin'` (minúscula), y/o
- `permissions: []` — porque el backend viejo usa `ROLE_PERMISSIONS.admin = []`
  en vez del `permissionsFor('admin') = ALL_PERMISSIONS` (más nuevo).

**Causa raíz del bug.** El gate viejo, duplicado en las 2 páginas de Office, era:
```ts
canWrite = roles.includes('Admin')               // case-SENSITIVE → falla con 'admin'
           || permissions.some(p => p.endsWith(':write'));  // falla si perms = []
```
Para el owner con `roles=['admin']` y `permissions=[]` → **las dos ramas fallan
a la vez** → Office queda en SOLO LECTURA. Exactamente lo reportado.

> Reproducción en vivo: añadí un `console.debug('[usePermissions] auth snapshot', …)`
> **solo en desarrollo** (gated por `NODE_ENV !== 'production'`) dentro del helper.
> Al abrir Office con la cuenta Master, la consola del navegador imprime
> `{ email, isAdmin, permissions, isOwnerEmail, canWrite }` para confirmar qué
> llega de verdad. No se ejecuta en producción.
> (No pude conducir un login real de Master desde el contenedor — sin backend en
> ejecución ni credenciales—, por eso la reproducción es: trazado estático arriba
> + el log dev para confirmarlo en el navegador + la truth-table de §3.)

---

## 2. Fix — un helper centralizado, robusto para admin/owner

Nuevo `apps/web/src/hooks/usePermissions.ts` (fuente única de verdad). Concede
WRITE si **CUALQUIERA**:
- **admin** por rol case-insensitive — reusa `AuthContext.isAdmin`
  (`roles.some(r => r.toLowerCase() === 'admin')`), O
- **owner** del proyecto por email — reusa `isOwnerEmail(user.email)` de
  `@/lib/owner` (deriva del EMAIL, no del rol; un JWT viejo no puede bloquearlo), O
- **permiso comodín/escritura**: `'*'`, `'*:*'`, cualquiera que termine en `':*'`
  (p. ej. `office:*`) o en `':write'`.

`viewer`/`executive` (solo `*:read` / `*:read`-equivalentes) **siguen en SOLO
LECTURA** — ninguna rama los toca. `operator` (execute/report/read, sin `:write`)
sigue en solo lectura igual que antes (sin regresión).

Reemplacé **las 2 copias**:
- `office/page.tsx`: `const { canWrite, isAdmin } = usePermissions();` (antes 2 líneas a mano).
- `office/[id]/page.tsx`: idem; además el gate del `ShareButton`
  (`isOwner = roles.includes('Admin') || …`) ahora usa el `isAdmin` robusto del
  helper en vez del `includes('Admin')` case-sensitive.

El helper expone también `computeCanWrite({isAdmin, permissions, email})` (función
pura) para poder razonarlo/probarlo sin React.

---

## 3. Verificación

- **eslint** (3 archivos tocados): 0 errores. (1 *warning* preexistente
  `react-hooks/set-state-in-effect` en el efecto de carga de `[id]/page.tsx`, ya
  configurado como `warn` y ajeno a este cambio.)
- **`tsc --noEmit`**: limpio (exit 0).
- **`next build`**: verde; compilan `/dashboard/office` (estático) y
  `/dashboard/office/[id]` (dinámico).
- **Truth-table (12/12)** sobre la lógica de `canWrite`:
  - Master/owner rol minúscula + perms `[]` → **editable** ✓
  - Master/owner sin rol + perms `[]`, solo email (case-insensitive) → **editable** ✓
  - Admin literal + perms `[]` → **editable** ✓
  - Admin con set completo / comodín `*` / `*:*` / `office:*` / planner con
    `planning:write` → **editable** ✓
  - executive demo (solo `*:read`/READ_ALL), viewer (`*:read`), operator,
    no-auth → **solo lectura** ✓

---

## REQUIERE BACKEND (para mañana — NO tocar aquí)
El front ya es robusto pase lo que pase, pero la causa de fondo está en el backend:
- El JWT del owner puede llegar con `role:'admin'` (minúscula) y/o
  `permissions:[]`. Lo correcto en el backend es que el `sync`/login del owner/Admin
  emita `role:'Admin'` (columna canónica) **y** `permissions: ALL_PERMISSIONS`
  (`permissionsFor('admin')`, ya existe en `apps/api/src/modules/auth/rbac.ts`),
  para que ningún front que gatee por `permissions` lo bloquee.
- Acción backend (otra sesión/mañana): garantizar que `/auth/sync` y `/auth/login`
  usen `roleColumnFor('admin') === 'Admin'` y `permissionsFor('admin')` al mintar
  el JWT, y desplegar a Railway. Mientras tanto, este fix de front cubre el hueco.
