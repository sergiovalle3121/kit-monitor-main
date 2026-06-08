# AXOS OS — Night Log

Bitácora cronológica del trabajo autónomo. Entrada por ítem: timestamp, área,
archivos, decisiones, endpoints/pantallas, KPIs, siguiente paso / bloqueos.

> **Modo de trabajo de esta sesión:** todo el desarrollo ocurre en la rama
> `claude/pensive-wright-cbkuE` (rama designada por el entorno). NO se hace
> auto-merge a `main`/producción sin revisión: cada bloque queda commiteado y
> pusheado a la rama para que el equipo lo revise y mergee. Ver `DECISIONS.md §1`.

---

## 2026-06-08 — FIX: doble `/api` del chat (REST + WebSocket) en producción

> Rama `claude/dazzling-dirac-1puYr`. Solo frontend, aditivo. El chat no
> funcionaba en prod: `NEXT_PUBLIC_API_URL` ya termina en `/api` (a propósito,
> para la convención de `useApi`), pero `chatApi` escribía rutas con `/api/...`
> → `…/api/api/messaging` (404), y el socket se conectaba a `${base}/chat` →
> namespace `/api/chat` (el gateway registra `/chat`) → tiempo real muerto.

- **REST (`lib/chatApi.ts`):** se quitó el prefijo `/api` de TODAS las rutas
  (`/messaging/...`), igual que `useApi`. Con el base que ya trae `/api` resuelven
  a `…/api/messaging/...` una sola vez. Incluye `fetchImageBlob`.
- **WebSocket:** nuevo `CHAT_API_ORIGIN = new URL(CHAT_API_BASE).origin` (con
  try/catch); `dashboard/chat/page.tsx` conecta `io(\`${CHAT_API_ORIGIN}/chat\`)`
  → namespace `/chat` en el origin (el prefijo HTTP `/api` no aplica a socket.io).
  Se conservó el handshake JWT (P0) y la lógica de presencia/typing/reacciones.
- **Verificado (aserción node):** prod `…/up.railway.app/api` → REST
  `…/api/messaging/conversations` (un solo `/api`) y WS `…/up.railway.app/chat`;
  local `http://localhost:3000` → `/messaging/...` y `/chat`. Build + lint verdes.
- **No se tocó** `NEXT_PUBLIC_API_URL` (Railway) — quitarle `/api` rompería el hub.

---

## 2026-06-08 — BLINDAJE DE ACCESO DEL OWNER (3 capas, deriva del EMAIL)

> Rama `claude/dazzling-dirac-1puYr`. El dueño (`sergiovallezarate@gmail.com`)
> caía recurrentemente en "solo lectura"/"sin permiso" por un **desajuste de
> casing**: backend/JWT usan rol `'Admin'` (mayúscula) y el frontend filtraba con
> `=== 'admin'` (minúscula) → `seesAll=false` → se ocultaban TODAS las áreas.
> Fix belt-and-suspenders **derivando del EMAIL**, no del rol almacenado, para que
> un JWT viejo, un reseed o una migración no puedan bloquearlo nunca más.

- **Capa 1 — Hub (`dashboard/page.tsx`) + `AiCopilot`:** comparaciones de rol
  **case-insensitive** + override por email de owner. Nuevo helper frontend
  `lib/owner.ts` (`ownerEmails`/`isOwnerEmail`/`isAdminAccess`/`seesAllAreas`,
  lee `NEXT_PUBLIC_OWNER_EMAILS`, default = dueño; espejo del backend).
- **Capa 2 — Sesión (`lib/session.ts` `setSessionCookie`):** normaliza el rol a
  minúscula y, si el email es owner, fija `role:'admin'` — en TODAS las rutas que
  crean sesión (login/demo/bridge) de una sola vez.
- **Capa 3 — Backend:** `auth.controller.me()` para owner siempre devuelve
  `Admin` + `ALL_PERMISSIONS`; `PermissionsGuard` hace override duro por email
  (`isOwnerEmail`) además de aceptar `admin` case-insensitive → ningún endpoint
  puede devolver 403 al dueño. El bloque idempotente de owner en `auth.service`
  se conservó.
- **Tests (runnables, backend):** `rbac.spec` (owner email + admin=ALL_PERMISSIONS,
  ya existía y se conservó), `auth.controller.spec` (me ⇒ Admin+ALL_PERMISSIONS aun
  sin rol/casing raro), `permissions.guard.spec` (owner pasa sin permiso; admin
  case-insensitive; sin-permiso es 403). Smoke Postgres OK; 285 tests verdes.
- **Nota:** `apps/web` no tiene runner de tests; el gate (b) del hub queda cubierto
  por el helper centralizado `seesAllAreas`/`isAdminAccess` (cuya base por email se
  testea en backend vía `isOwnerEmail`). NO se cambió el casing del rol global de
  forma destructiva (solo comparaciones case-insensitive + override por email).

---

## 2026-06-08 — REDISEÑO DEL HUB ESTILO APPLE (sistema de diseño + propagación)

> Rama `claude/dazzling-dirac-1puYr`. Luz verde para PR + merge por fase (squash).
> 5 fases, todas **mergeadas en verde** (cada una: `next build` + `tsc --noEmit` +
> eslint). Solo frontend (ninguna tocó backend/schema). Una sola familia de íconos
> (lucide), grosor único `1.75`, una sola flecha (`ArrowUpRight` en hover).

- **Fase 1 (#248) — Sistema de diseño:** `lib/design/domains.ts` (`DOMAINS`
  paleta por dominio + `domainTile()` + `ICON_STROKE`), `components/ui/IconTile`
  (squircle gradiente + sombra de color + brillo), `AuroraBackground`
  (`.aurora-bg` en globals.css, claro/oscuro por prefers-color-scheme),
  `HoverArrow`. Sin cambio visual.
- **Fase 2 (#249) — Rebuild del HUB:** `dashboard/page.tsx` con AuroraBackground,
  AREAS con `domain` (paleta consolidada), KPIs/áreas/actividad con IconTile,
  glow por dominio + HoverArrow en hover, buscador Spotlight (glow violeta).
  Datos (useApi), roles y motion intactos.
- **Fase 3 (#250) — Aurora global + PageHeader:** el layout del dashboard monta
  `AuroraBackground` (reemplaza `AmbientBackground` SOLO en el dashboard; landing/
  login lo conservan). Nuevo `PageHeader({domain,title,subtitle})`.
- **Fase 4 (#251) — Centro de notificaciones:** panel frosted agrupado Hoy/Antes
  con IconTile por dominio; integra `unread` del chat (deep-link a /dashboard/chat);
  badge = admin + mensajería; para TODOS los usuarios; "Marcar leídas". Sin tablas
  ni endpoint nuevo (agregación en cliente).
- **Fase 5 — Propagación de acentos:** FAB de chat con gradiente mensajería; FAB de
  IA violeta→rosa; header de la lista de chat con IconTile de mensajería.

### `PageHeader` — adopción
- **Adoptado (7):** Calidad, Almacén, Producción, Planeación (F3) + Inventario,
  Finanzas, Ingeniería (F5).
- **Pendiente (resto de `/dashboard/*`):** Operador MES, Terminal de operador,
  Mission Control, Torre de control de línea, Costos/métricas, Axos ERP, Lab,
  Ing. Industrial, Disposición de líneas, RH, Office, Calidad de piso/MRB, CRM,
  RMA, Legal, Outbound, Inbound, Compras, Tooling, Gastos, Activos fijos, Conteos
  cíclicos, Skills, Settings, etc. Patrón mecánico: importar `PageHeader`,
  reemplazar el `<header>` (ícono sobre tinte plano) por
  `<PageHeader domain="<dominio>" title subtitle/>`, quitar el ícono del import.

### DEUDA / PENDIENTE
- **Top bar + dock globales en el layout (Fase 3 del enunciado): DIFERIDO a
  propósito.** 34+ páginas de departamento ya tienen su propio header
  `sticky top-0` (back-link + título); montar un top bar global se encimaría y
  rompería esas páginas (viola "no romper funcionalidad"). La unificación real
  requiere primero migrar esas páginas a `PageHeader` (quitando sus headers
  propios) y luego mover la chrome al layout. Hacerlo por lotes.
- El dashboard ya no usa el `NodeNetwork` (estaba en `AmbientBackground`); si se
  quiere de vuelta, superponerlo bajo `AuroraBackground` en el layout.
- Centro de notificaciones: hoy via polling 20 s + `unread` por conversación;
  se podría suscribir al socket del chat para tiempo real, y exponer @menciones
  por separado (hoy van implícitas dentro de `unread`).

---

## 2026-06-08 — CHAT "TEAMS": Seguridad P0 + Presencia, Reacciones, Recibos, @menciones, Pulido

> Rama `claude/dazzling-dirac-1puYr`. **Esta sesión SÍ tuvo luz verde explícita
> del owner para PR + merge a `main`** una vez terminadas las fases (a diferencia
> del modo por defecto). Orden ejecutado (de menor a mayor riesgo, + un P0 de
> seguridad insertado por auditoría del owner ANTES de lo bonito):
> **P0 socket auth → 1 Presencia → 2 Reacciones → 3 Recibos → 4 @menciones → 5 Pulido.**
>
> **Puertas de calidad (todas verdes en cada fase):** `apps/api` build + `npx jest`
> (51 suites / **278 tests**) + eslint (0 errores) + **smoke:bootstrap con Postgres
> efímero** (puerto 5433, receta de esta bitácora); `apps/web` `tsc --noEmit` +
> eslint + **`next build`** completo. Migraciones SOLO aditivas e idempotentes;
> `synchronize` intacto (en prod crea tabla/columna nuevas solas; las migraciones
> son para el registro/entornos sin sync). Tablas nuevas PREFIJADAS `chat_`.

### [P0] Seguridad del WebSocket — ARREGLADO (era crítico, en prod)
- **Agujero:** el socket confiaba en un `userId` que mandaba el cliente en `join`
  → cualquiera podía unirse al room de otro y leer sus mensajes.
- **Fix (`chat.gateway.ts`):** autenticación en el **handshake** con el MISMO JWT del
  REST (`getJwtSecret()` resuelto en runtime → idéntico a `JwtStrategy`; `JwtModule`
  importado en `messaging.module.ts`). El `userId` sale del claim `sub` del token,
  NUNCA del payload. Handshake sin token válido → `disconnect`. `typing` deriva
  emisor (token) y destinatarios (server-side, `assertMember`) — anti-spoofing; el
  cliente solo manda `{ conversationId }`. Tope de longitud de mensaje (4000) en
  `sendText`. Frontend manda el JWT en `auth.token`.
- **Tests:** `chat.gateway.spec.ts` (7) — rechazo sin token / token inválido,
  derivación del userId, no unirse a rooms ajenos, presencia multi-socket, anti-spoof.

### [1] Presencia online/offline (sin schema)
- `ChatGateway` mantiene `Map<userId, Set<socketId>>`; online mientras haya ≥1 socket.
  `presence:state` (al conectar) + `presence:update` (transiciones) + `getOnlineUserIds()`.
- Front: punto verde/gris en avatares de DMs (lista) y header (usa `counterpartId`).

### [2] Reacciones (1 tabla aditiva `chat_message_reactions`)
- Entity + migración aditiva; `@Unique(messageId,userId,emoji)`. `POST
  /messages/:id/reactions {emoji}` = toggle (valida acceso + emoji). Devuelve
  agregado `[{emoji,count,userIds,mine}]`; broadcast `reaction:update`. `listMessages`
  agrega reacciones **en lote** (sin N+1). Helper puro `aggregateReactions` (+specs).
- Front: chips bajo la burbuja (resalta `mine`), **toolbar al hover** con mini-picker.

### [3] Recibos de lectura "Visto" (sin schema, reusa `lastReadAt`)
- `markRead` difunde `read:update`; `GET /conversations/:id/reads`. Front: "Visto"
  (DM) o avatares de lectores (canal) bajo mi último mensaje leído (`computeSeenInfo`).

### [4] @menciones (1 columna aditiva `messages.mentioned_user_ids`, `simple-array`)
- `sendText` parsea `@handle` y lo resuelve contra los MIEMBROS (helper puro
  `parseMentionTokens`, ignora correos; +specs). Broadcast incluye `mentionedUserIds`
  + emite `mention:new` a cada mencionado. Front: autocompletado `@`, resaltado
  XSS-safe (sin `dangerouslySetInnerHTML`), toast + acento "@" en la lista.

### [5] Pulido UX nivel Teams (solo frontend)
- Composer multilínea + autosize + Shift+Enter; separadores por día; agrupado de
  consecutivos; avatares en canales con presencia; botón "ir al final" + contador;
  links clickeables; skeletons + estado vacío; badge de no leídos en el título;
  toasts en vez de `alert()`; responsive (lista↔chat colapsan + botón volver) y
  a11y (foco visible, aria-labels, región `aria-live`).

### Eventos WS nuevos (todos a `user:<id>` de los miembros)
`presence:state`, `presence:update`, `reaction:update`, `read:update`, `mention:new`.

### PENDIENTE / DEUDA (NO entró en esta sesión — backlog del chat)
- **Hilos (threads)** y **búsqueda de mensajes** — explícitamente fuera de alcance.
- **Editar / borrar / responder-citar** mensajes: requiere columnas aditivas
  `edited_at`, `deleted_at`, `reply_to_message_id` (nullable) + endpoints + eventos
  `message:update`/`message:delete` + UI (edición inline, "Mensaje eliminado", cita).
  Por eso el toolbar de hover hoy solo trae **reaccionar** (no se dejaron botones
  muertos). Es el siguiente ítem natural.
- **Adjuntos no-imagen** (PDF/Excel/NCR), **gestión de canal** (renombrar/archivar/
  salir/miembros/roles/privacidad), **pin/guardar/no-leído manual**, **drafts
  persistentes** por conversación.
- **Notificaciones** (módulo): Notification API del navegador, sonido, centro
  in-app, preferencias mute/DND; a futuro push real. Hoy solo toast + título.
- **P1 escala:** reescribir `listConversations` (hoy N+1: ~queries por conversación)
  con JOIN/GROUP BY; **paginación/infinite-scroll** hacia arriba en la UI (la API ya
  acepta `before`); migrar imágenes `bytea` → S3/Cloudinary (campo ya aislado).
- **P1 robustez:** `@nestjs/throttler` (rate-limit) en endpoints de envío; **scoping
  multi-tenant** de las queries de messaging (hoy se gatea por `assertMember`, falta
  `TenantScopedRepository`); UI optimista de envío; tipar `req: any` del controller;
  e2e del flujo socket-auth + envío.
- **P2 diferenciador AXOS:** mensajería contextual ligada a entidades (`#WO-1234`,
  `#NCR-77`) con preview/unfurl + deep-link; acciones desde el chat (crear NCR, hold,
  surtido); canales/eventos de sistema (mensajes `type: system`).
- **@menciones (mejora):** el autocompletado asume cursor al final del borrador;
  con multilínea convendría usar `selectionStart`. Usuarios cuyo `username` es un
  correo no resuelven por `@` (limitación conocida).

---

## 2026-06-07 — PULIDO Y FUNCIONALIDAD (que lo que existe sirva)

> Sesión de pulido (no features nuevas, no borrar). Rama `claude/hopeful-lovelace-GZEYN`.
> Orden: 1 acceso owner → 2 JWT estable → 3 auditoría hub → 5 landing → 4 admin →
> 6 estética → 7 chat → 8 office.

### [1] Acceso del owner (CRÍTICO) — ARREGLADO de raíz
- **Causa raíz:** `permissionsFor('admin')` devolvía `[]`. El guard del backend ya
  hace bypass para `role==='Admin'`, pero el **frontend** gatea la UI con el array
  `permissions` (`hasPermission`) → el owner quedaba bloqueado / "solicitar permiso"
  / read-only en las apps del hub.
- **Fix:** `rbac.ts` → `permissionsFor('admin')` ahora devuelve `ALL_PERMISSIONS`
  (unión de todos los permisos + auth/settings). El JWT del owner carga TODO.
  `AuthContext.hasPermission/hasRole` además hacen bypass para Admin (case-insensitive)
  y exponen `isAdmin`. `auth.service.validateUser` refresca al owner a Admin + perms
  completos de forma idempotente (incluso si tenía perms vacíos por un registro viejo).
  `main.ts seedAdmins` ya garantizaba el owner como Admin activo (con self-check de login).
- **Tests:** admin = superset de todos los roles; owner email reconocido.

### [2] JWT estable entre deploys — ARREGLADO
- **Causa:** sin `JWT_SECRET` en prod, se generaba un secreto aleatorio por proceso
  → cada redeploy deslogeaba a todos.
- **Fix:** `ensurePersistentJwtSecret()` corre en `main.ts` ANTES de `NestFactory.create`;
  si no hay env secret, lee/crea el secreto en la tabla singleton `app_settings`
  (Postgres) → se reusa entre deploys. SQLite dev = no-op. Nunca tira (fallback a
  secreto por proceso). Migración aditiva `CreateAppSettings`. **Verificado** contra PG:
  genera→persiste, y un "redeploy" lee el MISMO secreto.

### [3] Auditoría funcional del hub — INVENTARIO
Recorrí las ~50 páginas del dashboard. Hallazgo principal: el hub está **más
funcional de lo que parecía**; el bloqueo real era el acceso del owner (Bloque 1).
- **Navegación de regreso:** ✅ universal. Las que "parecían" sin botón usan headers
  compartidos que ya lo traen (`DepartmentWorkspace` → "← Dashboard"; `ErpHeader` →
  "← ERP"). Ninguna deja atrapado al usuario.
- **CRUD real + backend:** la mayoría usa `useApi`/`apiFetch` con loading/empty/error
  y toasts (plan, operador, almacén, calidad, inbound, outbound, procurement, crm,
  improvement, ehs, maintenance, legal, tooling, fixed-assets, expenses, cycle-counts,
  rma, skills, test-engineering, numbering, control-tower, + los 6 del piso).
- **Borrado con confirmación:** ✅ planning, office (papelera + permanente), fixed-assets,
  organization*, floor-quality. **Arreglado** ⚠️→✅: `engineering` (borrar estación/
  material ahora confirma) y `settings/organization` (borrar edificio/cliente/proyecto
  ahora confirma) — antes borraban al instante.
- **Read-only por diseño (no roto):** `inventory`, `production` (vistas; las mutaciones
  viven en cycle-counts/staging/operador). `forecast` = simulación client-side.
- **⚠️ Pendiente menor:** `documents` es una página estática (mock) que duplica a
  **Office** (sistema real `office-documents`). Se deja intacta (no romper); Office es
  el sistema real — se pulirá en Bloque 8. Anotado para no confundir.

### [5] Landing honesta + auth arriba a la derecha — HECHO
- Header: "Iniciar sesión" + "Crear cuenta" (esquina superior derecha). `/login?register=1`
  abre directo el formulario de registro.
- **Quitado lo no verificable/fraudulento:** tarjeta "Aeroespacial / cumplimiento
  AS9100"; suavizado "AI"/"millisecond latency"/"Perfected".
- Copy honesto: el hero dice lo que AXOS realmente hace (unir los departamentos de una
  manufacturera: piso MES con poka-yoke/backflush, ERP, calidad, inventario, Office/chat).
  Tarjetas enlazan a pantallas reales (operator-terminal, floor-quality…). Estética intacta.

### [4] Admin / gestión de usuarios real — HECHO
- `settings/users` era una tabla read-only con botones muertos y stats falsos. Ahora
  consola real (owner/Admin): **crear** usuario (rol + scope planta/línea + password),
  **editar** (cambia rol → recomputa permisos, scope, nombre), **resetear contraseña**,
  **activar/desactivar**; stats reales; back-nav.
- Backend (extiende governance, ADMIN_ACCESS; owner bypass): `updateUser` recomputa
  permisos al cambiar rol; nuevo `POST /governance/users` (createUser con permisos por rol).

### [6] Profundidad estética (con vida, sin exagerar) — HECHO
- `NodeNetwork`: red de nodos en movimiento (canvas) muy sutil, baja opacidad, DPR-aware,
  pausa con pestaña oculta y **estática con prefers-reduced-motion** (perf + accesibilidad).
  Integrada en `AmbientBackground` (prop `network`) en landing (vívida) y hub (calm).
- Hub en **bento-grid** (primera área destacada 2x2 + tiles anchos) en vez de cuadrícula
  uniforme; conserva el stagger fade-in + hover-lift existentes. `next build` verde.

### [7] Chat → indicador "escribiendo…" (extiende, no rehace) — HECHO
- El backend de messaging ya reenvía el evento socket `typing` pero la UI no lo emitía ni
  mostraba. Cableado: emite `typing` (throttle ~1.5s) a los miembros al teclear; escucha y
  muestra "escribiendo…" animado para la conversación activa (auto-limpia a 2.5s). Messaging
  ya tenía DMs, canales, recibos de lectura (`/read`) y adjuntos de imagen.

### [8] Office — auditado, ya funcional (no se rompe) — HECHO
- Hallazgo: Office ya está pulido — autosave debounced (800ms) + estado guardado/guardando,
  Cmd/Ctrl+S, flush al desmontar, historial de versiones, papelera/restaurar + borrado
  permanente con confirmación, back-nav ("Volver a Office"), **plantillas** (TemplateGallery)
  y **export/import .xlsx/.csv** (hojas). Cumple los pedidos del bloque; se deja intacto para
  no regresionar un módulo que ya sirve.

<!-- (resto de bloques de esta sesión se agregan arriba conforme avanza) -->

## 2026-06-07 — SUITE DE PISO DE PRODUCCIÓN (edición Jabil)

> Sesión: rama `claude/hopeful-lovelace-GZEYN`. 7 entregas aditivas (PRE-2 + A,B,C,D,F,L).
> 100% aditivo: NO se modificó ningún módulo/entidad/endpoint/página existente — solo
> se extendió (RBAC, positions, hub, Cmd-K). Tablas nuevas prefijadas `sf_`. Acoplamiento
> por servicios (sin tocar legacy). 4 puertas en verde por bloque (build, unit, web tsc/lint,
> bootstrap smoke PG). Suite API: **48 suites / 253 tests**. Ver `DECISIONS.md §12`.

### [PRE-2] RBAC de piso consolidado en `auth/rbac.ts` (ÚNICA fuente) — HECHO
- Roles nuevos: operator, materialist, industrial_engineer, mrb_member,
  cycle_count_analyst, maintenance_tech, plant_manager (se conservan todos los previos).
- Permisos nuevos: production:execute/authorize, planning:publish, materials:stage,
  quality:hold/report/disposition, inventory:reconcile, maintenance:write. Concedidos
  aditivamente a roles existentes (planner publish, supervisor authorize, quality hold/disp).
- `roles-seeder` DB alineado aditivamente (nota: rbac.ts es la verdad). `positions.ts` +
  hub + ROLE_LABELS extendidos. **Test `rbac.spec.ts`**: operator NO publica/autoriza,
  solo quality/mrb disponen, solo quality pone hold.

### [A] Disposición de líneas (Ing. Industrial) — FUNCIONAL
- `line-engineering`: `sf_line_stations` (modelo/rev/línea/estación/secuencia, **NP esperado**
  = poka-yoke, **factor de uso** = backflush, tiempo std, feeder, ayuda visual, CTQ) +
  `sf_model_lines` (calificación modelo↔línea, changeover, takt target).
- Lógica pura `line-balance.ts`: takt, cuello de botella, %balance, estaciones sobre takt,
  completeness de layout; capacidad/carga con changeover. `stationRequirements()` es el
  puente a surtido (C) y operador (D).
- Endpoints `/line-engineering/*` (stations, routing, requirements, qualifications, balance,
  capacity, kpis) guard engineering:read/write. KPIs: %ayuda visual, %modelos balanceados,
  layouts incompletos. Página `dashboard/line-engineering`. Tests: 12 (balance puro + SQLite).

### [B] Muro de publicación del plan + WOs — FUNCIONAL
- `production-plan`: `sf_work_orders` (folio `WO-` central; modelo/línea/bahía/cantidad/
  fecha/secuencia/prioridad; **consumptionMode** BY_UNIT|BY_QTY_FACTOR, **serialControl**
  NONE|BY_UNIT; readiness material/quality/FAI; `authorizedOperators` = acceso).
- Máquina de estados pura RELEASED→STAGED→EN EJECUCIÓN→COMPLETED (+CANCELLED). `runBlockers()`
  explica por qué no corre. Hooks: setMaterialReady/setQualityClear/setFaiApproved,
  incrementCompleted (auto-arranca/auto-completa). KPIs: adherencia, %readiness, atrasos.
- Endpoints guard planning:publish (publish), planning:write (resequence/transition),
  production:authorize (authorize). Página `dashboard/production-plan`. Tests: 13.

### [C] Surtido + e-kanban de reposición — FUNCIONAL
- `material-staging`: `sf_staging` (líneas de kit por estación, requerido=factor×cantidad,
  montado, kanban) + `sf_replenish_calls` (pull con cronómetro). Expande la WO desde el
  ruteo de IE. Faltante bloquea readiness + llamado. **consumeStaged()** decrementa en vivo
  (backflush del operador); bajo kanban auto-genera llamado; stockout lanza faltante crítico
  (bloquea) + llamado URGENTE. KPIs: fill-rate, faltantes, llamados, tiempo de reposición.
- Endpoints guard materials:read/stage/request. Página `dashboard/material-staging`. Tests: 7.

### [D] Terminal de operador (el corazón) — FUNCIONAL
- `operator-terminal`: `sf_consumption_events` (inmutable, **idempotente**) + `sf_floor_events`
  (andon/defecto/paro). `confirm()` valida en orden: bloqueos de WO (material/hold/FAI) →
  autorización (acceso) → estación en ruteo → **skill** (certificaciones people) → **poka-yoke**
  (NP escaneado = esperado) → **serial** (genealogía) → **idempotencia** → **backflush**
  (=unidades×factor vía staging, decremento en vivo) → incrementa WO → **SAP 261 (stub)**.
- ANDON (material/calidad/máquina/ayuda/seguridad) + REPORTAR DEFECTO ruteados al rol. Hora
  por hora + KPIs (u/h, andons, defectos). Endpoints guard production:execute/quality:report.
  Página `dashboard/operator-terminal` (scanner/táctil, botón grande, banner de bloqueos,
  ayuda visual, andon). **Tests: 9** (backflush, poka-yoke, hold, skill, qty×factor,
  idempotencia, serial, andon, defecto).

### [F] Calidad de piso: Hold → MRB → Disposición — FUNCIONAL
- `floor-quality`: `sf_quality_holds` (folio `NCR-`; origen IQC/en-proceso/OQC, parte/cant/
  lote/serie/WO/estación/defecto/severidad/foto). Crear hold sobre una WO **bloquea su consumo**
  (qualityClear=false). Máquina HELD→MRB_REVIEW→DISPOSITIONED→(REWORK→REINSPECT)→CLOSED.
  Disposición requiere firma; USE_AS_IS→waiver, RTV→SCAR. Retrabajo + re-inspección
  (pasa libera / falla vuelve). Cerrar el último hold libera la WO. **Where-used** (genealogía)
  desde el ledger de consumo. KPIs: holds abiertos, %use-as-is, scrap, retrabajo, ciclo, vencidas.
- Endpoints guard quality:hold/disposition/read. Página `dashboard/floor-quality`. Tests: 12.

### [L] Torre de control de línea (Director de Operaciones) — FUNCIONAL
- `line-control-tower`: agregador read-only SIN tablas. Por línea: readiness, plan vs real,
  andons/holds/reposición abiertos, modelos, **semáforo** (worst-of) con motivos; estado
  global. Resiliente (un área caída no rompe la vista). Endpoint guard production:read.
  Página `dashboard/line-control-tower`. Tests: 4 (agregación, rojo por hold/andon, resiliencia).

### [setup] Baseline verde + arranque de plataforma (P0.1)
- **Estado inicial verificado:** monorepo Turborepo con 37 módulos en
  `apps/api/src/modules` y app Next.js en `apps/web`. Infra de multi-tenencia
  (TenantBaseEntity, TenantContextService, TenantSubscriber, TenantInterceptor)
  ya presente. `apps/api` compila limpio (`npm run build`).
- **Fix de baseline (`fix(governance)`):** los smoke tests
  `governance.controller.spec.ts` y `governance.service.spec.ts` eran stubs del
  CLI de Nest sin dependencias inyectadas → fallaban por DI. Reparados con
  mocks de proveedores y override de guards. Suite de API ahora **verde**:
  5 suites / 14 tests.
- **Archivos:** `apps/api/src/modules/governance/governance.{service,controller}.spec.ts`
- **Tracking creado:** `NIGHT_LOG.md`, `DECISIONS.md`, `THIRD_PARTY_NOTICES.md`.

### [numbering] Capacidad transversal de folios (T2 / P0.8) — FUNCIONAL
- **Qué:** servicio central `DocumentNumberingService` + tabla nueva
  `document_sequences` (extiende `TenantBaseEntity`, scope tenant+planta). Antes
  la numeración era ad-hoc por módulo (p.ej. `plans` consultaba todas las WO para
  sacar el máximo). Ahora cualquier módulo pide su folio: `allocate('PURCHASE_ORDER')`.
- **Lógica real (no CRUD vacío):** formato por tokens (`{PREFIX} {YYYY} {YY} {MM}
  {DD} {SEQ}`), relleno configurable, política de reinicio NUNCA/ANUAL/MENSUAL con
  `periodKey`, asignación atómica en transacción (lock pesimista en Postgres),
  reserva de bloques contiguos, alta perezosa desde un registro de defaults EMS
  (WO, PO, SO, NCR, CAPA, ASN, RFQ…), y guardia anti-reúso (no se mueve el
  contador hacia atrás). Eventos de config al Event Ledger (dominio SYSTEM).
- **Backend:** `apps/api/src/modules/numbering/` (entity, dto, format, defaults,
  service, controller, module) + `migrations/20260607120000-CreateDocumentSequences.ts`
  (aditiva, idempotente) + registro en `app.module.ts`.
- **Endpoints:** `GET /numbering/sequences`, `GET /numbering/kpis`,
  `GET /numbering/sequences/:docType`, `GET /numbering/sequences/:docType/preview`,
  `POST /numbering/sequences`, `PATCH /numbering/sequences/:id`,
  `POST /numbering/allocate` (Swagger `Numbering`, guard JWT + `MANAGE_MASTER_DATA`
  en mutaciones).
- **Frontend:** `dashboard/admin/numbering` — KPIs, lista con vista previa de
  folio en vivo, alta/edición (prefijo, patrón, relleno, reinicio, contador),
  activar/desactivar; estados loading/empty/forbidden + toasts. Enlace en el
  buscador Cmd-K (`SearchPalette`).
- **KPIs:** tipos de documento (activos), folios emitidos (total y del periodo),
  tipo más usado.
- **Tests:** `numbering.format.spec.ts` (formato/reset/validación) +
  `document-numbering.service.spec.ts` (flujo crítico contra SQLite en memoria:
  alta perezosa, incremento, bloques contiguos, preview sin consumo, KPIs,
  guardia anti-reúso). Suite API: **7 suites / 35 tests verdes**. Build API limpio.
  Web: typecheck + lint limpios.
- **Pendiente/siguiente:** integrar `allocate()` en los módulos que hoy numeran a
  mano (plans/WO, kits, NCR, receiving, shipping) — cambio incremental por módulo.

### [improvement] Mejora Continua / OpEx — Kaizen (P2.13) — FUNCIONAL
- **Qué:** módulo nuevo, 100% aditivo, autocontenido, que además ESTRENA el
  servicio de numeración (`allocate('IMPROVEMENT')` → folios `CI-2026-00001`).
- **Backend** (`apps/api/src/modules/improvement/`): entidad
  `ImprovementInitiative` (extiende `TenantBaseEntity`, scope tenant+planta,
  `program_id` de primera clase), máquina de estados pura
  (DRAFT→IN_PROGRESS→IMPLEMENTED→VERIFIED→CLOSED, + rework y CANCELLED), servicio
  con captura de ahorros (estimado vs realizado, multimoneda), KPIs de OpEx, y
  eventos al Event Ledger. Controller REST (Swagger `Improvement`).
- **Endpoints:** `GET /improvement` (filtros status/methodology/area/programId),
  `GET /improvement/kpis`, `GET /improvement/:id`, `POST /improvement`,
  `PATCH /improvement/:id`, `POST /improvement/:id/transition`.
- **Migración:** `20260607130000-CreateImprovementInitiatives` (aditiva,
  idempotente). Registrado en `app.module.ts`. Añadido docType `IMPROVEMENT`
  (prefijo `CI`) a los defaults de numeración.
- **Frontend** (`dashboard/improvement`): tablero por estado, KPIs (iniciativas,
  en progreso, implementadas+, ahorro realizado vs estimado), alta de iniciativa,
  y botones de transición que respetan la máquina de estados. Enlace Cmd-K.
- **KPIs:** total, por fase, en progreso, implementadas+, ahorro estimado y
  realizado (formato moneda).
- **Tests:** `initiative-state.spec.ts` (máquina de estados) +
  `improvement.service.spec.ts` (flujo crítico en SQLite: folio CI, ciclo de
  vida con timestamps, transición ilegal rechazada, KPIs de ahorro). API:
  **9 suites / 45 tests verdes**. Build API limpio. Web typecheck + lint limpios.
- **Decisión:** la captura de ideas (POST/PATCH/transition) está abierta a
  cualquier usuario autenticado (sistema de ideas/Kaizen es participativo);
  admin omite scope. Ver `DECISIONS.md §4`.

### [ehs] EHS / Seguridad y Medio Ambiente (P2.10) — FUNCIONAL
- **Qué:** módulo nuevo, 100% aditivo, autocontenido; consume numeración
  (`allocate('EHS_INCIDENT')` → `INC-2026-00001`).
- **Backend** (`apps/api/src/modules/ehs/`): entidad `SafetyIncident` (extiende
  `TenantBaseEntity`, scope tenant+planta, `program_id`), máquina de estados pura
  (REPORTED→INVESTIGATING→ACTION_PENDING→CLOSED, + cierre rápido, rework,
  CANCELLED), servicio con tipos (near-miss/first-aid/recordable/lost-time/
  environmental/property), severidad, causa raíz, acción correctiva, días
  perdidos, y KPIs de seguridad. Controller REST (Swagger `EHS`). Reporte abierto
  a usuarios autenticados (reportar debe ser sin fricción).
- **Endpoints:** `GET /ehs/incidents` (filtros), `GET /ehs/kpis`,
  `GET /ehs/incidents/:id`, `POST /ehs/incidents`, `PATCH /ehs/incidents/:id`,
  `POST /ehs/incidents/:id/transition`.
- **Migración:** `20260607140000-CreateSafetyIncidents` (aditiva, idempotente).
  Registrado en `app.module.ts`. Añadido docType `EHS_INCIDENT` (prefijo `INC`).
- **Frontend** (`dashboard/ehs`): KPI estrella "días sin registrable", incidentes
  abiertos, registrables (con tiempo perdido), días perdidos; reporte de
  incidente, lista por estado con chips de tipo/severidad y transiciones que
  respetan la máquina de estados (captura causa raíz / acción / días perdidos por
  prompt). Enlace Cmd-K.
- **KPIs:** total, abiertos, registrables, tiempo perdido, casi-accidentes, días
  perdidos, **días desde el último registrable**.
- **Tests:** `incident-state.spec.ts` + `ehs.service.spec.ts` (SQLite: folio INC,
  ciclo de investigación con timestamps, transición ilegal, KPIs incl. días sin
  registrable). API: **11 suites / 56 tests verdes**. Build limpio. Web tsc+lint
  limpios.

### [maintenance] Mantenimiento / TPM (CMMS) (P2.7) — FUNCIONAL
- **Backend** (`apps/api/src/modules/maintenance/`): `Asset` + `MaintenanceOrder`
  (folio `MO-` vía numeración; máquina de estados OPEN→IN_PROGRESS→COMPLETED +
  reopen + CANCELLED), KPIs CMMS (abiertas, vencidas, %PM cumplido, MTTR, downtime
  total, activos parados). Controller `maintenance` (assets + orders). Migración
  aditiva (2 tablas). docType `ASSET` (prefijo `EQ`) añadido.
- **Frontend** (`dashboard/maintenance`): KPIs, tira de activos con alta rápida,
  alta de orden (con selección de activo), tablero por estado con transiciones.
  Enlace Cmd-K.
- **Tests:** `order-state.spec` + `maintenance.service.spec` (SQLite). 

### [hotfix] 🔴→🟢 Prod caída: PermissionsGuard no resolvía AuditService
- **Causa:** los módulos nuevos usaban `@UseGuards(PermissionsGuard)` pero el guard
  inyecta `AuditService` (solo exportado por `GovernanceModule`), que esos módulos
  no importaban → crash al bootstrap. `tsc`/unit tests NO lo detectan.
- **Arreglo sistémico:** `common/security/security.module.ts` `@Global()` que
  provee+exporta `PermissionsGuard` y re-exporta `GovernanceModule`; importado una
  vez en `AppModule`. Ahora cualquier controller usa el guard sin imports extra.
  (Ver `DECISIONS.md §5`.)
- **NUEVA PUERTA DE CALIDAD (obligatoria):** smoke de bootstrap COMPILADO contra
  Postgres: `apps/api/scripts/bootstrap-smoke.js` (`npm run smoke:bootstrap`).
  Hace `NestFactory.create + app.init()` sobre `dist/` → resuelve proveedores y
  guards; atrapa exactamente este fallo. NO se usó test Jest porque `ts-jest`
  (`isolatedModules`) no emite la metadata de decoradores igual que `tsc` y da
  fallos falsos (`MaterialRequest.status` → "Object"). (Ver `DECISIONS.md §6`.)
- **Verificado:** `dist/main.js` arranca limpio contra Postgres local
  ("Nest application successfully started", login self-check OK) y
  `npm run smoke:bootstrap` → OK. Build + 66 unit tests + web tsc/lint verdes.

### [legal] Legal / Compliance / Contratos (P2.14) — FUNCIONAL
- **Backend** (`apps/api/src/modules/legal/`): `Contract` (folio `CON-` vía
  numeración; máquina de estados DRAFT→ACTIVE→EXPIRED↔ACTIVE(renovación)→
  TERMINATED + CANCELLED), tipo (CUSTOMER/SUPPLIER/NDA/LEASE/SERVICE), valor +
  moneda, fechas, auto-renovación, notas. KPIs: activos, por vencer (30/60/90d),
  vencidos, valor activo. Controller `legal`. Migración aditiva. docType
  `CONTRACT` (prefijo `CON`).
- **Frontend** (`dashboard/legal`): KPIs (activos, por vencer 90d, vencidos, valor
  activo), alta de contrato, lista por estado con badge "vence en Nd" y
  transiciones (incl. renovación con nueva fecha). Enlace Cmd-K.
- **Tests:** `contract-state.spec` + `legal.service.spec` (SQLite). Gate completo
  verde: build, 15 suites / 77 tests, web tsc+lint, **bootstrap smoke (Postgres)**.

### [testing] Test Engineering / Yields (P2.8) — FUNCIONAL
- **Backend** (`apps/api/src/modules/testing/`): `TestRecord` inmutable (serie,
  estación ICT/FCT/AOI/FINAL, PASS/FAIL, código de falla, modelo, operador; folio
  `TST-` vía numeración). Sin máquina de estados (registro inmutable). Servicio con
  KPIs: **First-Pass Yield** (primer test por serie), yield total, Pareto de
  códigos de falla (top 10), series distintas. Evento al Event Ledger (QUALITY).
  Controller `testing` (records + recent + kpis). Migración aditiva. docType
  `TEST_RECORD` (prefijo `TST`, reinicio mensual).
- **Frontend** (`dashboard/test-engineering`): captura scanner-friendly (Enter
  para capturar, autofocus en SN), KPIs (FPY, yield, pruebas, fallas), **Pareto**
  de fallas (barras), capturas recientes. Enlace Cmd-K.
- **Tests:** `testing.service.spec` (SQLite): folio, forzar/limpiar failureCode,
  cálculo de yield + FPY + Pareto. Gate completo verde: build, **17 suites /
  80 tests**, web tsc+lint, **bootstrap smoke (Postgres)**.

### [procurement] Compras / Procurement — Órdenes de Compra (P2.4) — FUNCIONAL
- **Backend** (`apps/api/src/modules/procurement/`): `PurchaseOrder` (folio `PO-`
  vía numeración; proveedor denormalizado — NO acoplado a `suppliers`; máquina de
  estados DRAFT→ISSUED→ACKNOWLEDGED→RECEIVED→CLOSED + CANCELLED; fechas
  requerida/prometida/recibida para OTD). KPIs: abiertas, por recibir, vencidas,
  OTD proveedor, valor comprometido. Controller `procurement`. Migración aditiva.
  Evento al Event Ledger (MATERIALS). `PURCHASE_ORDER` ya existía en defaults.
- **Frontend** (`dashboard/procurement`): KPIs, alta de PO, tablero por estado con
  badge "vencida" y transiciones (captura fecha prometida al confirmar). Cmd-K.
- **Tests:** `po-state.spec` + `procurement.service.spec` (SQLite). Gate completo
  verde: build, **19 suites / 90 tests**, web tsc+lint, **bootstrap smoke (PG)**.

### [people] RH / Capital Humano — Skills & Certificaciones (P2.9) — FUNCIONAL
- **Backend** (`apps/api/src/modules/people/`): `Certification` (empleado
  denormalizado — NO acoplado a `users`; skill, área, estación, fechas; folio
  `CERT-`). Estatus **derivado** por fecha (VALID/EXPIRING/EXPIRED/NO_EXPIRY) vía
  helper puro `cert-status.ts`. KPIs: vigentes, por vencer 30/60/90d, vencidas,
  empleados, skills, cobertura por skill. Controller `people`. Migración aditiva.
  docType `CERTIFICATION` (prefijo `CERT`).
- **Frontend** (`dashboard/skills`): KPIs, alta/registro de certificación,
  cobertura por skill (chips), lista con badge de estatus y botón "Recertificar"
  (recaptura fecha de expiración). Enlace Cmd-K.
- **Tests:** `cert-status.spec` (helper puro) + `people.service.spec` (SQLite).
  Gate completo verde: build, **21 suites / 98 tests**, web tsc+lint, **bootstrap
  smoke (PG)**.

### [control-tower] Torre de Control / Cockpit ejecutivo (P3.1/P3.2) — FUNCIONAL
- **Qué:** capstone aditivo SIN tablas propias. `ControlTowerModule` importa las 8
  áreas y `ControlTowerService` inyecta sus servicios, llamando `.kpis()` en
  paralelo (`Promise.all`, defensivo: un área que falle no rompe la vista) y
  deriva un **semáforo** (green/amber/red) por área + estado global (worst-of).
- **Backend** (`apps/api/src/modules/control-tower/`): service + controller
  `GET /control-tower/summary`. Sin entidad, sin migración. Reglas de salud:
  EHS (registrables→rojo), Compras (vencidas→rojo, por recibir→ámbar),
  Mantenimiento (vencidas→rojo), Test (FPY<90→rojo, <97→ámbar), Legal/RH
  (vencidos→rojo, por vencer→ámbar).
- **Frontend** (`dashboard/control-tower`): banner de estado global + tarjetas por
  área con semáforo, headline y 3 métricas, enlazadas a cada área. Refresh. Cmd-K.
- **Tests:** `control-tower.service.spec` (mocks): agregación, bubble-up a rojo,
  resiliencia ante área que falla. Gate completo verde: build, **22 suites /
  101 tests**, web tsc+lint, **bootstrap smoke (PG)** — clave aquí por las 7
  inyecciones cross-módulo.

### [outbound] Logística / Embarque (P2.6) — FUNCIONAL
- **Backend** (`apps/api/src/modules/outbound/`): `Shipment` (tabla
  **`outbound_shipments`** — renombrada para no chocar con la tabla `shipments`
  legacy; cliente/destino denormalizados, incoterm, carrier, tracking, bultos;
  máquina de estados PACKING→READY→SHIPPED→DELIVERED + CANCELLED; **genera ASN**
  (folio `ASN-`) al embarcar). Folio `SHP-` al crear. KPIs: por embarcar, en
  tránsito, vencidas, **OTD a cliente**. Controller `outbound`. Migración aditiva.
  Event Ledger (SHIPPING).
- **Frontend** (`dashboard/outbound`): KPIs, alta de embarque, tablero por estado
  con badges (ASN, vencida) y transiciones (captura tracking al embarcar). Cmd-K.
- **Tests:** `shipment-state.spec` + `outbound.service.spec` (SQLite).
- **⚠️ El smoke de bootstrap atrapó una colisión real de tabla** (`shipments` ya
  existía en el módulo `shipping` legacy con PK integer + FK `shipment_items`).
  Renombrada a `outbound_shipments`. Ver `DECISIONS.md §8`. Gate final verde:
  build, **23 suites / 110 tests**, web tsc+lint, **bootstrap smoke (PG)**.

### [inbound] Recibo / Inbound + IQC (P2.5) — FUNCIONAL
- **Backend** (`apps/api/src/modules/inbound/`): `Receipt` (tabla
  **`inbound_receipts`** prefijada; proveedor/PO denormalizados, parte, cantidad,
  UOM, lote/serie/date-code; flujo IQC RECEIVED→INSPECTING→RELEASED|QUARANTINE,
  QUARANTINE→RELEASED|REJECTED; resultado IQC PASS/FAIL, código de rechazo). Folio
  `RCV-`. KPIs: **dock-to-stock** (h), **% rechazo en recibo**, pendientes IQC, en
  cuarentena. Controller `inbound`. Migración aditiva. Event Ledger (MATERIALS).
- **Frontend** (`dashboard/inbound`): captura scanner-friendly (Enter para
  recibir, autofocus en parte), KPIs, cola por estado con transiciones IQC
  (pasa/cuarentena/rechazo con código). Enlace Cmd-K.
- **Tests:** `receipt-state.spec` + `inbound.service.spec` (SQLite). Gate completo
  verde: build, **25 suites / 121 tests**, web tsc+lint, **bootstrap smoke (PG)**.

### [cycle-counts] Conteos Cíclicos (P2.3) — FUNCIONAL
- **Backend** (`apps/api/src/modules/cycle-counts/`): `CycleCount` (folio `CC-`;
  parte, ubicación, cantidad sistema vs contada, **varianza derivada**; máquina de
  estados OPEN→COUNTED→RECONCILED|ADJUSTED + CANCELLED; `count` calcula varianza y
  pasa a COUNTED; ADJUSTED sincroniza sistema=contado y varianza=0). KPIs:
  **exactitud de inventario** (% conteos sin varianza), abiertos, con varianza,
  varianza absoluta total, ajustes. Controller `cycle-counts`. Migración aditiva.
  Event Ledger (MATERIALS) con `transaction.quantity`.
- **Frontend** (`dashboard/cycle-counts`): KPIs, alta de conteo, captura inline de
  cantidad contada (Enter), badges de varianza/exacto, botones Conciliar/Ajustar.
  Enlace Cmd-K.
- **Tests:** `count-state.spec` + `cycle-counts.service.spec` (SQLite, incl.
  varianza, ajuste, exactitud). Gate completo verde: build, **27 suites /
  131 tests**, web tsc+lint, **bootstrap smoke (PG)**.

### [crm] CRM / Oportunidades (P1.1 SD-CRM) — FUNCIONAL
- **Backend** (`apps/api/src/modules/crm/`): `Opportunity` (tabla
  `crm_opportunities`; cliente/contacto denormalizados, valor estimado + moneda,
  probabilidad %, máquina de estados LEAD→QUALIFIED→PROPOSAL→WON|LOST con
  probabilidad por etapa). Folio `OPP-` (docType añadido a defaults). KPIs:
  **pipeline** (valor abierto), **ponderado** (valor×prob), valor ganado,
  **win-rate**, por etapa. Controller `crm`. Migración aditiva. Event Ledger.
- **Frontend** (`dashboard/crm`): pipeline por etapa con subtotal de valor, KPIs,
  alta de oportunidad, transiciones. Enlace Cmd-K.
- **Tests:** `opportunity-state.spec` + `crm.service.spec` (SQLite, incl. pipeline/
  ponderado/win-rate). Gate completo verde: build, **29 suites / 141 tests**, web
  tsc+lint, **bootstrap smoke (PG)**.

### [fixed-assets] Activos Fijos / Depreciación (P1.1 FIN) — FUNCIONAL
- **Backend** (`apps/api/src/modules/fixed-assets/`): `FixedAsset` (folio `FA-`;
  costo, rescate, vida útil meses, fecha adquisición; estado IN_SERVICE→DISPOSED).
  **Helper puro `depreciation.ts`** (línea recta: dep mensual, acumulada capada,
  valor en libros) + spec. Servicio serializa con campos derivados; baja pone
  valor en libros 0 y bloquea re-baja. KPIs: **valor en libros total**, costo,
  depreciación acumulada, en servicio. Controller `fixed-assets`. Migración
  aditiva. docType `FIXED_ASSET` (prefijo `FA`).
- **Frontend** (`dashboard/fixed-assets`): KPIs, capitalización, lista con barra
  de % depreciado, valor en libros y acción de baja. Enlace Cmd-K.
- **Tests:** `depreciation.spec` (helper puro) + `fixed-assets.service.spec`
  (SQLite). Gate completo verde: build, **31 suites / 149 tests**, web tsc+lint,
  **bootstrap smoke (PG)**.

### [expenses] Gastos / Viáticos (FIN-AP) — FUNCIONAL
- **Backend** (`apps/api/src/modules/expenses/`): `ExpenseReport` (folio `EXP-`;
  empleado denormalizado, categoría, monto + moneda; máquina de estados
  DRAFT→SUBMITTED→APPROVED|REJECTED→REIMBURSED, REJECTED→DRAFT resubmit,
  DRAFT→CANCELLED). KPIs: pendientes de aprobación, aprobados sin pagar (+monto),
  reembolsado, monto promedio. Controller `expenses`. Migración aditiva. docType
  `EXPENSE` (prefijo `EXP`). Event Ledger.
- **Frontend** (`dashboard/expenses`): KPIs, alta de gasto, tablero por estado con
  transiciones (enviar/aprobar/rechazar con motivo/reembolsar). Enlace Cmd-K.
- **Tests:** `expense-state.spec` + `expenses.service.spec` (SQLite). Gate completo
  verde: build, **33 suites / 159 tests**, web tsc+lint, **bootstrap smoke (PG)**.

### [tooling] Tooling / Herramentales (NPI) — FUNCIONAL
- **Backend** (`apps/api/src/modules/tooling/`): `Tool` (tabla `tooling_assets`;
  tipo MOLD/FIXTURE/STENCIL/GAUGE, cavidades, vida en disparos, disparos usados,
  estado AVAILABLE/IN_USE/MAINTENANCE/RETIRED). **Helper puro `tool-life.ts`**
  (%vida, disparos restantes, near-EOL ≥80%) + spec. Endpoints: registrar uso
  (suma disparos) y cambiar estado. KPIs: activos, **vida consumida promedio**,
  próximos a EOL, en mantenimiento. Controller `tooling`. Migración aditiva.
  docType `TOOL` (prefijo `TL`). Event Ledger (ENGINEERING).
- **Frontend** (`dashboard/tooling`): KPIs, alta, lista con barra de %vida (roja
  si EOL), captura inline de disparos y selector de estado. Enlace Cmd-K.
- **Tests:** `tool-life.spec` (helper puro) + `tooling.service.spec` (SQLite).
  Gate completo verde: build, **35 suites / 167 tests**, web tsc+lint, **bootstrap
  smoke (PG)**.

### [rma] Quejas de Cliente / RMA (P2.2 Calidad) — FUNCIONAL
- **Backend** (`apps/api/src/modules/rma/`): `RmaCase` (tabla `rma_cases`;
  cliente/parte/serie denormalizados, falla, severidad; máquina de estados
  OPEN→INVESTIGATING→DISPOSITION→CLOSED + CANCELLED; disposición
  REPAIR/REPLACE/CREDIT/REJECT requerida al disponer; causa raíz). Folio `RMA-`.
  KPIs: abiertas, en investigación, **tiempo de cierre promedio (días)**, por
  disposición. Controller `rma`. Migración aditiva. docType `RMA`. Event Ledger
  (QUALITY).
- **Frontend** (`dashboard/rma`): KPIs, alta de queja, tablero por estado con
  chips de severidad/disposición y transiciones (captura disposición). Cmd-K.
- **Tests:** `rma-state.spec` + `rma.service.spec` (SQLite). Gate completo verde:
  build, **37 suites / 177 tests**, web tsc+lint, **bootstrap smoke (PG)**.

## CONSOLIDACIÓN (sesión de cierre de riesgos — sin features nuevas)

### [P1a] JWT_SECRET sin fallback inseguro (re-aplicado + blindado) — HECHO
- **Causa de la reversión:** el fix original (`9a1c69f`) vivía en la rama
  `claude/security-hardening`, **nunca mergeada** a `main` (no es ancestro). Ver
  `DECISIONS.md §9`.
- **Fix:** `common/config/jwt-secret.ts` `getJwtSecret()` (≥16 chars; throw en
  prod si falta/corto; default explícito en dev). Usado en `auth.module.ts` +
  `jwt.strategy.ts` (quitado `|| 'secretKey'`). **Blindaje:** `jwt-secret.spec.ts`
  falla si reaparece cualquier fallback hardcodeado. Ver `DECISIONS.md §10`.
- **Gate:** build, **183 tests** (+6), web tsc/lint, **bootstrap smoke (PG)** verdes.

### [P2.1] Multi-tenencia: `TenantScopedRepository` + anti-fuga — HECHO
- **Qué:** `common/tenant/tenant-scoped.repository.ts` auto-inyecta
  `WHERE tenant_id = ctx.tenant_id` en find/findOne/findBy/findOneBy/count/
  findAndCount/exists (tenant del JWT vía `TenantContextService`). Aditivo: sin
  tenant en contexto o sin columna `tenant_id` → no filtra. `withTenantScope()`
  sigue para QueryBuilder. Wiring: `provideTenantScopedRepository(Entity)` +
  `getTenantRepositoryToken(Entity)`. Ver `DECISIONS.md §11`.
- **Anti-fuga (gate):** `tenant-scoped.repository.spec.ts` — 2 tenants, 0 datos
  cruzados, findOne no alcanza a otro tenant, backward-compat sin contexto.
- **Gate:** build, **190 tests** (+7), bootstrap smoke (PG) verdes. Sin cambios de
  entidades/servicios → cero riesgo prod.
- **Siguiente (P2.2):** adoptar el repo en módulos (cierra fuga real en
  `getOne(id)`/`findOne` que hoy no scopea por tenant) + migrar entidades
  sensibles a `extends TenantBaseEntity` (aditivo) — por commits gateados.

### [P2.2] Adopción del `TenantScopedRepository` (improvement, legal, procurement) — HECHO
- **Qué:** estos 3 servicios ahora inyectan el repo tenant-scoped, así que
  `getOne(id)`/`findOne` (y por ende `update`/`transition` que llaman a `getOne`)
  quedan **aislados por tenant automáticamente** (cerraba fuga: antes `findOne({where:{id}})`
  alcanzaba filas de otros tenants conociendo el UUID). Los `list()` ya scopeaban
  vía QueryBuilder+applyScope.
- **Recipe por módulo (mecánico, replicar en los demás):**
  1. Servicio: en `@nestjs/common` añadir `Inject`; borrar `import { InjectRepository }`;
     cambiar `import { Repository, SelectQueryBuilder } from 'typeorm'` → solo
     `SelectQueryBuilder`; importar `{ TenantScopedRepository, getTenantRepositoryToken }`
     de `common/tenant/tenant-scoped.repository`.
  2. Constructor: `@Inject(getTenantRepositoryToken(Entity)) private readonly repo:
     TenantScopedRepository<Entity>`.
  3. Módulo: `providers: [Service, provideTenantScopedRepository(Entity)]`
     (+ import). Mantener `TypeOrmModule.forFeature([Entity])`.
  4. Spec: el repo del servicio pasa de `dataSource.getRepository(Entity)` a
     `createTenantScopedRepository(Entity, dataSource.manager, ctx)` (else tsc rompe).
- **Anti-fuga del MISMO servicio:** `improvement.service.spec.ts` — 2 tenants, list
  scopeada, getOne/transition no alcanzan a otro tenant, dueño lee lo suyo.
- **Gate:** build, **191 tests**, **bootstrap smoke (PG)** verdes (valida el DI de
  los 3 providers scoped en la app real).

### [P2.3] Adopción del `TenantScopedRepository` (rma, expenses, ehs) — HECHO
- Misma recipe de [P2.2] aplicada a `rma`, `expenses`, `ehs` (customer/financial/
  safety). `getOne`/`findOne`/`update`/`transition` ahora aislados por tenant.
- **Adoptados hasta ahora (6/16 módulos nuevos):** improvement, legal, procurement,
  rma, expenses, ehs. Gate: build, **191 tests**, bootstrap smoke (PG) verdes.

### 🔴→🟢 HOTFIX prod: arranque resiliente sin JWT_SECRET
- **Síntoma:** Railway crasheaba en loop: `Error: JWT_SECRET is required in production`
  (el guard P1a funcionando; `JWT_SECRET` nunca estuvo en Railway — prod corría con
  el fallback inseguro `'secretKey'`).
- **Fix (decisión del usuario: disponibilidad > hard-fail):** `getJwtSecret()` en
  prod, si falta/≤16, **genera un secreto ALEATORIO por proceso + WARNING** en vez
  de tirar. Seguro (aleatorio, NO reintroduce `'secretKey'`; el test de blindaje
  sigue pasando), cacheado por proceso (firma==verifica). Rota en cada reinicio →
  setear `JWT_SECRET` fijo en Railway para sesiones estables. Ver `DECISIONS.md §10`.
- **Verificado:** `NODE_ENV=production` sin `JWT_SECRET` → `auth.module` carga sin
  crashear (warning + secreto aleatorio); con `JWT_SECRET` válido → lo usa. Build,
  191 tests, bootstrap smoke (PG) verdes.
- **Nota:** P1b (baseline de esquema) sigue en la rama, NO mergeado (commit
  `103da7c`, se re-aplica con cherry-pick tras este hotfix).

<!-- Próximas entradas arriba de esta línea, orden cronológico inverso por bloque -->

---

## ▶ RETOMAR AQUÍ (handoff para la próxima sesión)

> **PULIDO Y FUNCIONALIDAD (sesión más reciente) — rama `claude/hopeful-lovelace-GZEYN`.**
> Hecho y en verde: [1] acceso del owner (raíz: admin con permisos completos en el JWT +
> bypass en UI), [2] JWT estable entre deploys (persistido en `app_settings`), [3] auditoría
> del hub (back-nav universal; confirmaciones de borrado en engineering/organization;
> inventario en NIGHT_LOG), [5] landing honesta + auth arriba a la derecha, [4] admin de
> usuarios real (crear/editar/rol/scope/activar/reset), [6] estética (red de nodos + bento),
> [7] chat "escribiendo…", [8] Office auditado (ya funcional).
> **Siguiente (si se desea profundizar, opcional):** Teams completo en chat (presencia,
> reacciones, @menciones con notificación, hilos, búsqueda, recibos de lectura en UI) —
> el backend ya soporta varios; faltaría UI. Office: export de docs/slides (hojas ya
> exportan). `documents` (página estática mock) podría unificarse con Office real.
> **Recordatorio:** lo ideal sigue siendo setear `JWT_SECRET` en Railway (con [2] ya no
> deslogea en cada deploy aunque falte).

---

> **SHOP FLOOR (edición Jabil) — rama `claude/hopeful-lovelace-GZEYN`.**
> Entregado y en verde: PRE-2 (RBAC piso) + bloques **A** (disposición de líneas),
> **B** (muro del plan/WOs), **C** (surtido + e-kanban), **D** (terminal de operador:
> poka-yoke, backflush, andon), **F** (calidad hold/MRB), **L** (torre de línea).
> Suite API **48/253 verde**; las 4 puertas pasan por bloque (incl. bootstrap smoke PG).
> Flujo de punta a punta probado: IE dispone línea → planeación publica WO → materialista
> surte → operador ejecuta (con bloqueos reales) → calidad retiene/MRB → torre lo ve.
>
> **Siguiente paso exacto (orden del backlog A→M, faltan E,G,H,I,J,K,M-explícito):**
> 1) **Bloque E — FAI + Changeover/SMED:** módulo `fai-changeover` (tabla `sf_fai` +
>    `sf_changeovers`). FAI: inspección de primera pieza que aprueba `production-plan`
>    `setFaiApproved(woId,true)` (ya existe el hook + `faiRequired`). Changeover: checklist
>    + cronómetro de setup (SMED) ligado a OEE. Reusar patrón de `floor-quality` (captura)
>    + `production-plan` (hook). Guard quality:report (FAI) / production:write (changeover).
> 2) **Bloque G — Andon board + escalamiento + downtime:** ya existe `sf_floor_events`
>    (operator-terminal). Crear un módulo/endpoint de **escalamiento por tiempo** (sube
>    `escalationLevel` si no se atiende) + tablero en vivo por línea/estación + downtime→OEE
>    + (máquina) abre orden de mantenimiento (maintenance module). Extender, no duplicar.
> 3) **Bloque H — Hour-by-hour + OEE + entrega de turno:** OEE = Disp×Rend×Calidad por
>    línea/turno desde consumo (D) + downtime (G) + holds (F). `hourByHour` ya existe en D.
> 4) **Bloque I — Genealogía/As-built:** ya hay `whereUsed` (F) sobre `sf_consumption_events`
>    (serial). Agregar reporte AS-BUILT completo por serie (lote de cada NP, operador, hora).
> 5) **J (packout/etiquetas ZPL/ASN), K (conciliación conteos vs backflush), M (puentes
>    explícitos restantes: Finanzas COGS en vivo desde backflush, Compras escasez).**
> - **Puerta de bootstrap (obligatoria):** levantar Postgres efímero (receta abajo) y
>   `npm run smoke:bootstrap` antes de cada merge. Prefijar SIEMPRE tablas nuevas (`sf_`).
> - **Cómo extender el piso:** inyectar los servicios exportados (no tocar legacy);
>   referencias denormalizadas; tenant-scoped repos; eventos al Event Ledger.

---

> **MODO PREVIO: CONSOLIDACIÓN / cierre de riesgos (sin features nuevas).**
> Orden: P1a JWT ✅ → **P2 multi-tenencia real (EN CURSO, lo más importante)** →
> P1b baseline de esquema (SIN flip de synchronize) → P3 profundizar austero.

- **Último ítem terminado:** `feat(tenant)` P2.2 — adopción del
  `TenantScopedRepository` en improvement/legal/procurement (anti-fuga del mismo
  servicio). `main` verde (191 tests). P1a (JWT) y P2.1 (infra) ya mergeados.
- **Siguiente ítem (P2.4 — continuar adopción, mecánico):** replicar la
  **recipe de [P2.2]** (arriba) en los módulos nuevos que faltan:
  testing, people, cycle-counts, crm, fixed-assets, tooling, inbound, outbound, y
  **maintenance** (OJO: 2 repos — Asset + MaintenanceOrder; scopear ambos;
  `getOne` usa el de orders). (control-tower no tiene repo; numbering es infra.)
  Cada uno: servicio+módulo+spec, gate verde (incl. **bootstrap smoke**), merge.
  Luego:
  - **P1b (SIN flip):** generar baseline del esquema
    (`npm run migration:generate -- src/migrations/Baseline`), revisar aditivo/
    idempotente (sin DROP), y documentar el **procedimiento de corte** en
    `DECISIONS.md`. Marcar **"REQUIERE DEPLOY SUPERVISADO POR SERGIO"** — NO
    ejecutar el corte ni flipear `synchronize`.
  - **P2 (core, riesgoso):** migrar entidades que NO extienden `TenantBaseEntity`
    (inventory, erp-core, plans, kits, bom, production-runtime, quality) — OJO:
    colisión de `@CreateDateColumn`/`createdAt` (renombre a `created_at` rompe
    refs en front/serialización). Hacer entidad por entidad, aditivo, con cuidado.
  - **P3:** cablear `allocate()` en módulos que numeran a mano (plans/WO, kits,
    NCR, receiving, shipping) sin romper parsers; frontend NCR/CAPA.
- **Estado de plataforma:** en producción 17 entregas nuevas + hotfix:
  **numeración** (T2), **Mejora Continua** (P2.13), **EHS** (P2.10),
  **Mantenimiento/TPM** (P2.7), **Legal** (P2.14), **Test Engineering** (P2.8),
  **Compras** (P2.4), **RH/Skills** (P2.9), **Torre de Control** (P3.1/P3.2),
  **Logística/Embarque** (P2.6), **Recibo/Inbound+IQC** (P2.5), **Conteos
  Cíclicos** (P2.3), **CRM/Pipeline** (P1.1), **Activos Fijos** (P1.1 FIN),
  **Gastos/Viáticos** (FIN-AP), **Tooling/Herramentales** (NPI), **RMA/Quejas**
  (P2.2), más el **SecurityModule global** + **smoke de bootstrap**. API: 37
  suites / 177 tests. Migraciones solo aditivas. Patrón por
  módulo: (state machine / derivación pura si aplica) + entity (TABLA PREFIJADA
  para no chocar con legacy) + dto + service (scope tenant+plant, usa numeración) +
  controller + module + migración aditiva + specs + página + Cmd-K.
- **PUERTAS DE CALIDAD ahora (obligatorio antes de cada merge):**
  1) `cd apps/api && npm run build`  2) `npm test` (unit)  3) `npm run lint`+`tsc`
  en web para archivos tocados  4) **`npm run smoke:bootstrap` con Postgres** —
  ver setup abajo. Si el smoke falla, NO mergear.
- **Setup del Postgres efímero para el smoke (el contenedor se resetea, repetir):**
  ```
  PGBIN=$(ls -d /usr/lib/postgresql/*/bin | head -1)
  rm -rf /tmp/pgdata && mkdir -p /tmp/pgdata && chown -R postgres /tmp/pgdata
  runuser -u postgres -- $PGBIN/initdb -D /tmp/pgdata --auth=trust -U postgres
  runuser -u postgres -- $PGBIN/pg_ctl -D /tmp/pgdata -o "-p 5433 -k /tmp" -l /tmp/pg.log start
  runuser -u postgres -- $PGBIN/createdb -h /tmp -p 5433 -U postgres axos_smoke
  # gate:
  cd apps/api && npm run build && DATABASE_URL="postgres://postgres@/axos_smoke?host=/tmp&port=5433" npm run smoke:bootstrap
  ```
- **Siguiente ítem exacto a hacer:** **Auditorías por Capas / LPA (P2.2 Calidad)**
  como módulo nuevo `audits` (100% aditivo, tabla `layered_audits` PREFIJADA).
  Entidad `LayeredAudit` (folio `LPA-` — añadir docType `LPA` prefijo `LPA`; área,
  capa/nivel del auditor, auditor, total de ítems, ítems conformes; **score
  derivado** = conformes/total; estado SCHEDULED→IN_PROGRESS→COMPLETED +
  CANCELLED; findings count). Helper puro de score + spec. KPIs: % cumplimiento
  promedio, auditorías del periodo, hallazgos abiertos, programadas. Pantalla
  `dashboard/audits` + Cmd-K. Patrón a copiar: `testing` (captura/score) + `rma`
  (estados).
- **Más backlog aditivo disponible (mismo patrón):** Calidad NCR/CAPA frontend
  (backend ya existe — SOLO UI); Portal de cliente (rol externo — RBAC); Acciones
  8D (`eight-d`); Capacidad/Planeación CRP; Inventario consignado.
- **IMPORTANTE — puerta de bootstrap (obligatoria, atrapa colisiones de tabla):**
  levantar Postgres efímero (receta arriba) y `npm run smoke:bootstrap` ANTES de
  cada merge. El contenedor se resetea entre sesiones → re-crear el cluster. Y
  **prefijar SIEMPRE el nombre de tabla** de módulos nuevos (lección §8).
- **Hygiene recomendada (de-riesga el gate):** portar los 14 `jsonb` hardcodeados
  a `JSON_COLUMN_TYPE` y crear `ENUM_COLUMN_TYPE` (`'enum'` en PG / `'simple-enum'`
  en sqlite) para los 4 `type:'enum'`. Es **no-op en Postgres** y haría que el
  smoke corra en sqlite dentro de `npm test` (sin Postgres). NO cambiar tipos de
  columna de forma destructiva en prod (los helpers mantienen el mismo tipo en PG).
- **Cómo construir (receta probada):** entity → state machine (puro) + spec →
  dto → service (scope tenant+plant; usa `DocumentNumberingService`) → controller
  (`@UseGuards(JwtAuthGuard, PermissionsGuard)`) → module → migración aditiva
  idempotente → registrar en `app.module.ts` → `npx tsc --noEmit` + `npx jest
  src/modules/<x>` → build → frontend page (mirar `improvement/page.tsx`) +
  entrada en `SearchPalette.tsx` → web tsc + eslint → commit/push → PR → merge.
- **Notas/trampas:** fechas en entidades usar `DATE_COLUMN_TYPE` (no `timestamp`,
  rompe SQLite). Tipos en firmas decoradas → `import type`. Dinero → `float`.
  Rutas frontend sin prefijo `/api` (lo añade `NEXT_PUBLIC_API_URL`).
- **Pendiente transversal (cuando haya tiempo):** cablear `allocate()` en módulos
  que numeran a mano (WO/plans, kits, NCR, receiving, shipping) — cambio
  incremental por módulo, cuidando no romper parsers de folios existentes en prod.
