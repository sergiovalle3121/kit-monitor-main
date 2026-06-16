# NIGHT_LOG_LIVE — Columna vertebral de TIEMPO REAL + tablero "Piso en Vivo"

Bitácora del **backbone de tiempo real** (`live`) y el tablero nuevo
`dashboard/live`. **100 % aditivo:** módulo/archivos NUEVOS, **CERO tablas
nuevas**, **CERO cambios a entidades o columnas existentes**. La fuente de
eventos es el **Event Ledger ya existente**, leído **read-only** con un **cursor
en memoria** (nunca se toca el servicio ni las entidades del ledger). Corre en
paralelo con otras sesiones; el único archivo existente tocado es
`app.module.ts` (1 import + 1 entrada, sin colisión).

---

## ▶ ESTADO: entregado y en verde (rama `claude/happy-fermat-i18eac`)

Las puertas obligatorias pasan:

- **Build API** (`npm run build` = nest build / tsc) → OK.
- **Unit tests API** (`npm test`) → **78 suites / 510 tests** verdes (incluye las
  3 suites nuevas de `live`: 29 tests).
- **Web typecheck** (`tsc --noEmit`) → **0 errores**.
- **Web lint** (`eslint` sobre los archivos nuevos) → **0 errores / 0 warnings**.
- **Web build** (`next build`) → OK; la ruta `○ /dashboard/live` se compila.
- **Smoke de bootstrap** contra **Postgres 16 fresco** (`synchronize` materializa
  TODO el esquema, resuelve DI y guards) → `OK — application graph initialized
  cleanly`. Confirma que el segundo `forFeature([LedgerEvent])` (read-only) y el
  gateway + poller arrancan sin colisión de tabla/FK/DI.

> **PR/merge:** NO se abrió PR ni se mergeó (instrucción dura del entorno: no crear
> PR sin que el usuario lo pida). El trabajo queda commiteado y pusheado a la rama
> designada, listo para revisión/merge supervisado.

---

## Qué se entregó (rebanada vertical completa)

### BACKEND — módulo nuevo `apps/api/src/modules/live/`

Patrón de WS copiado de `messaging/chat.gateway.ts` (auth del handshake con el
mismo JWT del REST); fuente de eventos = `event-ledger` (entidad `LedgerEvent`).

1. **`live-channel.ts` (+ `live-channel.spec.ts`)** — el corazón **puro** (sin
   I/O, testeable). Enruta cada evento de dominio a uno de los **cinco canales
   del piso**:
   - `channelForEvent(domain, action)` →
     - **andon** si la acción contiene `ANDON` (gana sobre production);
     - **oee** si contiene `DOWNTIME`/`OEE` (telemetría de disponibilidad);
     - **quality** si el dominio es `QUALITY` o la acción es `SF_QUALITY_*`;
     - **materials** si el dominio es `MATERIALS` o `SF_STAGING_*`/`SF_REPLENISH_*`;
     - **production** para el resto del dominio `PRODUCTION` (WO publicada/
       transicionada, avance confirmado);
     - **`null`** para todo lo demás (SYSTEM/ENGINEERING/SHIPPING y CRUD genérico
       del interceptor del ledger) → **no se difunde**.
   - `toLiveEvent()` proyecta un **DTO ligero** (id, canal, domain, action,
     referencia, line, workOrder, model, plant, actor, tenant, timestamp ISO) —
     **nunca filtra** `context/transaction/metadata` del ledger.
   - `sanitizeChannels()` valida la lista que manda el cliente al suscribirse.
2. **`live.gateway.ts` (+ `live.gateway.spec.ts`)** — `@WebSocketGateway` en el
   namespace **`/live`** (no toca `/signals` ni `/chat`). Seguridad (espejo del
   P0 de chat): el handshake se autentica con el JWT del REST y el **tenant se
   deriva en el servidor** del claim `tenant_id`, **nunca del cliente**; sin
   token válido → desconecta. El socket se une a `tenant:<tid>` y, al `subscribe`,
   a `tenant:<tid>:<canal>`. **Solo RELEVA** — no consulta la BD.
3. **`live-poller.service.ts` (+ `live-poller.service.spec.ts`)** — la **fuente**.
   Tail del Event Ledger con `@Interval('live:ledger-poll', 2500ms)` (corre sobre
   el `ScheduleModule.forRoot()` global ya cableado en `AppModule`). **READ-ONLY:**
   inyecta el `Repository<LedgerEvent>` solo para `find` (nunca el
   `EventLedgerService`, nunca escribe). **Cursor en memoria** `{ cursorTs, seen }`:
   el primer poll **prima** el baseline al evento más nuevo **sin reproducir
   historia** (la historia la sirve el snapshot REST); después emite solo lo nuevo,
   con dedupe por id para eventos del mismo timestamp. Tolerante a fallos (tabla no
   lista al boot / error transitorio → log debug, el siguiente tick reintenta).
4. **`live.service.ts`** — el **seed REST**. `getSnapshot({channels?, limit?})`
   devuelve los eventos recientes del ledger ya mapeados a canal + conteos por
   canal. Aislado por tenant vía `TenantContextService` (si el JWT trae tenant,
   filtra; single-tenant ve todo) — coherente con los rooms del gateway.
5. **`live.controller.ts`** — `GET /live/snapshot` (query `channels`, `limit`),
   gateado igual que la Torre de Control de línea (`@RequirePermissions
   ('production:read')`).
6. **`live.module.ts`** — registra `TypeOrmModule.forFeature([LedgerEvent])`
   **read-only** (segundo `forFeature` inofensivo — mismo patrón que `oee` con las
   entidades de piso) + `JwtModule.register` para el handshake. Provee gateway +
   poller + service. **Sin tablas, sin entidades nuevas.**

**Wiring (`app.module.ts`):** exactamente **1 import** + **1 entrada** en el array
`imports`, junto al clúster de piso (`OeeModule`/`LineControlTowerModule`). Sin
colisión con otras sesiones.

### FRONTEND

1. **`apps/web/src/lib/liveChannels.ts`** — metadata compartida y **pura** (sin
   React/socket): tipos `LiveChannel`/`LiveEvent`/`LiveSnapshot`, `CHANNEL_META`
   (label + color por canal), `actionLabel()` (acción del ledger → frase de piso
   en español), `timeAgo()`. Espeja el contrato del backend.
2. **`apps/web/src/hooks/useLiveEvents.ts`** — **hook reusable** `useLiveEvents
   (channel | channels)`: se conecta al namespace `/live` con el JWT del
   `localStorage`, se suscribe a los canales, expone `{ status, events, lastEvent,
   clear }` y **reconecta** (backoff de socket.io + re-suscribe en cada reconexión).
   Opciones `max` (ring buffer), `onEvent` (efecto, p.ej. revalidar), `enabled`.
   **NO se cabló en páginas existentes** (colisiona con otras sesiones) — solo lo
   consume el tablero nuevo (ver follow-up).
3. **`apps/web/src/app/dashboard/live/page.tsx`** — tablero **"Piso en Vivo"**.
   `mission-control` **NO se tocó** (ya tenía contenido). Muestra la planta
   respirando, actualizándose solo:
   - **Estado por línea (corriendo/parada vía andon)** + **avance de WO vs meta**
     (barra plan vs real) + **OEE en vivo por línea** (Disp/Rend/Cal) — **fusiona
     `/line-control-tower/summary` con `/oee/control-tower`** (endpoints ya en main,
     GREP antes de inventar).
   - **Holds de calidad activos** desde `/floor-quality/holds` (filtra no
     CLOSED/CANCELLED).
   - **Ticker de eventos recientes del ledger**: seed `/live/snapshot` + cola en
     vivo de `useLiveEvents(LIVE_CHANNELS)`, de-dup por id, orden desc.
   - El stream **nudgea** los agregados (SWR `mutate` con dedupe) → el tablero
     "respira" en eventos reales, además del auto-refresh por intervalo.
   - **Estados vacíos honestos** por tile (sin líneas / sin holds / sin eventos /
     sin acceso por permiso) y **`prefers-reduced-motion`** respetado
     (`useReducedMotion()` apaga el "latido" y las animaciones del ticker; el
     globals.css ya mata animaciones CSS).

---

## Decisiones / supuestos

- **CERO tablas, read-only sobre el ledger:** el backbone no necesita persistencia
  propia; el cursor vive en memoria. Si el proceso reinicia, el cursor re-prima al
  baseline y el snapshot REST cubre la historia. (Trade-off aceptado: un evento
  creado en el instante exacto del reinicio podría no streamear, pero sí aparece en
  el snapshot — irrelevante para un ticker en vivo.)
- **Enrutado por canal en un solo lugar** (`live-channel.ts`): gateway, poller y
  snapshot comparten la misma regla, blindada por unit tests.
- **Auth del socket = token válido** (igual que chat), no permiso fino: el JWT del
  payload no trae permisos resolubles sin BD. El gate fino (`production:read`) vive
  en `/live/snapshot`; los eventos van por **rooms aislados por tenant**.
- **Gate del snapshot = `production:read`** para igualar la Torre de Control de
  línea (la "vista del piso"). Cada tile degrada **independiente** si falta un
  permiso (p.ej. `production:report` para OEE, `quality:read` para holds) → estado
  "sin acceso" honesto en ese tile, el resto sigue vivo.

## Follow-up documentado (NO hecho aquí — evita colisión con otras sesiones)

- **Adopción del hook `useLiveEvents` en páginas existentes** (operador,
  planeación, calidad, materiales, torres): cada una se suscribe a su canal para
  refrescar en vivo. Es el follow-up natural; **no se cableó** para no chocar con
  el trabajo en paralelo sobre esas páginas.
- **Registrar `dashboard/live` en el hub y en Cmd-K** (archivos compartidos de alta
  colisión): hoy la ruta es navegable directo en `/dashboard/live`. Añadir el tile
  del hub + la entrada de Cmd-K cuando se consolide, de forma aditiva.
- **Hardening opcional:** permisos finos en el handshake del socket si el JWT llega
  a portar scopes; backpressure si una línea llegara a emitir >200 eventos/2.5s
  (hoy el poll tiene `take: 200` como tope de seguridad).

---

## Cómo levantar el smoke (el contenedor se resetea entre sesiones — repetir)

```
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | head -1)
rm -rf /tmp/pgdata && mkdir -p /tmp/pgdata && chown -R postgres /tmp/pgdata
runuser -u postgres -- $PGBIN/initdb -D /tmp/pgdata --auth=trust -U postgres
runuser -u postgres -- $PGBIN/pg_ctl -D /tmp/pgdata -o "-p 5433 -k /tmp" -l /tmp/pg.log start
runuser -u postgres -- $PGBIN/createdb -h /tmp -p 5433 -U postgres axos_smoke
cd apps/api && npm run build \
  && DATABASE_URL="postgres://postgres@/axos_smoke?host=/tmp&port=5433" npm run smoke:bootstrap
```
