# NIGHT_LOG — UI-NOTIF (Centro de notificaciones)

Bitácora del carril UI-NOTIF. Solo frontend, archivos: **SOLO**
`apps/web/src/app/dashboard/notifications/**` + un toque MÍNIMO a la campanita
compartida del header (anotado abajo). Objetivo: un centro de notificaciones que
consuma **eventos reales** (andon, holds de calidad, aprobaciones pendientes, NCR
nuevos) con lista, marcar leído, filtros por tipo y link al origen — usando
únicamente lo que el backend ya expone.

> Rama: `claude/eloquent-cannon-xpjmmk`. Puertas: `tsc --noEmit` 0 · `eslint` 0 ·
> `next build` en verde. Fecha: 2026-06-16.

## Estado al empezar (auditoría)

- **No existía** `dashboard/notifications/`. La única "campanita" era el dropdown
  de `components/DashboardTopBar.tsx`, que unifica **chat sin leer** +
  **notificaciones de admin** (`/api/admin/notifications`) y `pending` de admin.
  Es un panel de vistazo rápido, no un centro.
- **GREP de eventos/messaging en `main`** (lo que de verdad hay):
  - `event-ledger` (backend): bitácora *append-only*; **no** tiene endpoint de
    "listar eventos recientes" (solo `GET /ledger/reference/:type/:id` y
    `/work-order/:wo`). No sirve como feed general → no se usa como fuente.
  - Tiempo real ya existente: `hooks/useMesSignals` (namespace socket `/signals`,
    eventos `mes:andon`, `mes:shortage`, `mes:incident-*`, …) y `hooks/useSignals`
    (`signal:critical-event`, `signal:new-proposal`). **Sí hay push en vivo**, pero
    es efímero (no persiste por usuario ni tiene estado leído).
  - Patrón de datos del front: `useApi<T>(path)` (SWR, Bearer, auto-refresh 20 s,
    expone `forbidden` en 401/403); mutaciones con `apiFetch`.
- **Endpoints reales consumibles por tipo** (sin backend nuevo):
  | Tipo | Endpoint | Origen (deep-link) |
  |---|---|---|
  | Andon | `GET /operator-terminal/floor-events?status=OPEN` (tipos `ANDON_*`) | `/dashboard/operador` |
  | Holds de calidad | `GET /floor-quality/holds` (estatus abiertos) | `/dashboard/floor-quality` |
  | Aprobaciones · disposición | `GET /quality/dispositions` (`proposed`/`under_review`) | `/dashboard/quality` |
  | Aprobaciones · cancelación | `GET /cancellation-requests/pending` | `/dashboard/cancellation-requests` |
  | NCR nuevos | `GET /ncr` (`open`/`under_review`) | `/dashboard/quality/ncr/{id}` |

---

## Lo que entró ✅

Estructura (convención `_lib`/`_components` ya usada en `settings/`):

```
dashboard/notifications/
├─ page.tsx                       # UI del centro
└─ _lib/
   ├─ types.ts                    # modelo unificado AxosNotification
   ├─ sources.ts                  # normalizadores puros por fuente + meta de presentación
   ├─ readState.ts                # estado de "leído" (useSyncExternalStore + localStorage)
   └─ useNotificationCenter.ts    # agregador: 5 fuentes → 1 lista + tiempo real
```

- **Consumo de eventos reales**: cada fuente se lee con `useApi` y se **normaliza**
  a un modelo único `AxosNotification` (`kind`, `source`, `domain`, `icon`, `title`,
  `body`, `severity`, `at`, `href`). Los normalizadores son funciones puras y
  **defensivas** (toleran respuestas envueltas `{data|items}`, camelCase vs
  snake_case en fechas, y campos faltantes), porque las APIs no comparten contrato.
- **Lista** ordenada por fecha desc, agrupada en **Hoy / Antes** (mismo idioma visual
  que el dropdown del header).
- **Filtros por tipo**: chips Todas / Andon / Holds / Aprobaciones / NCR con conteo,
  + toggle **"Solo no leídas"**. Color y loseta por dominio via el design-system
  (`IconTile`/`DOMAINS`), severidad crítica/alta resaltada (acento + badge).
- **Marcar leído**: por fila (botón ✓, sin navegar) y **"Marcar todo leído"**; al
  abrir una notificación se marca leída y se navega al **origen** (`href`).
- **Link al origen**: cada notificación enlaza a la página dueña del dato (tabla
  arriba). Para NCR es deep-link directo al detalle `/dashboard/quality/ncr/{id}`.
- **Tiempo real (con infra existente, sin backend nuevo)**: el centro engancha
  `useMesSignals`; un `mes:andon` / `mes:incident-*` / `mes:shortage` en vivo
  **revalida el feed de andon al instante**. El resto sigue por *polling* de 20 s
  (SWR). Un *pill* "En vivo / Conectando… / Sin conexión" refleja el socket.
- **Permisos sin romper**: las fuentes con 403 aportan 0 ítems y se listan en una
  **nota honesta** ("Sin acceso (por permisos) a: …"). Si las 5 dan 403 → tarjeta
  "Sin acceso" completa.

### Toque MÍNIMO a la campanita compartida (anotado)
`components/DashboardTopBar.tsx`: se añadió **un solo enlace** al pie del panel
existente — *"Abrir centro de notificaciones →"* → `/dashboard/notifications`
(cierra el panel). **No se rediseñó** la campanita, ni su lógica, ni sus fuentes;
es aditivo (1 `<Link>`, sin imports nuevos) y necesario para que el centro sea
alcanzable. Marcado con comentario `UI-NOTIF` en el código.

---

## Decisiones / alcance honesto

- **Estado de "leído" es POR DISPOSITIVO** (`localStorage`, vía
  `useSyncExternalStore` → SSR-safe, sin parpadeo de hidratación, sincroniza entre
  pestañas). Motivo: el backend **no** tiene buzón de notificaciones por usuario
  (ni tabla con leído/no-leído, ni endpoint de "marcar leído" para
  andon/holds/NCR). Es honesto y útil, pero **no** cruza dispositivos ni se sincroniza
  con el contador de la campanita. La interfaz del hook está lista para cambiarse a
  un read-model de servidor sin tocar la UI.
- **`event-ledger` no se usa como feed** porque no expone "listar recientes"; en su
  lugar se consumen las colas operativas reales de cada dominio (más útiles y con
  contexto: folio, WO, severidad, parte…).
- **Andon = solo `status=OPEN` y tipos `ANDON_*`** (lo que necesita atención). Los
  `DEFECT`/`DOWNTIME` quedan fuera del feed de "andon" a propósito.
- Andon enlaza a `/dashboard/operador` (el tablero donde se levantan/atienden).

## REQUIERE BACKEND (no inventado — anotado, NO entró)
- **Buzón de notificaciones por-usuario** persistente (tabla + estado leído/no-leído
  por usuario + endpoints `list`/`mark-read`). Hoy el leído vive en el dispositivo.
- **Push real**: web-push / PWA / Notifications API. Hoy el "tiempo real" es el
  socket de planta (revalida el feed) + *polling* 20 s; no hay notificación del SO
  ni del navegador con el panel cerrado.
- **Feed de eventos unificado** en servidor (preferencias por tipo, *digest*,
  silenciar) — fuera de alcance del carril (solo front).

Sin cambios en `apps/api/**`. Sin tocar `lib/` compartido salvo lectura. Único
archivo compartido tocado: `DashboardTopBar.tsx` (1 enlace, descrito arriba).

Puertas: `tsc` 0 · `eslint` 0 · `next build` OK (`/dashboard/notifications`
prerenderiza como estática).
