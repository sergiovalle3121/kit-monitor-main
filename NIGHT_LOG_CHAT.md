# NIGHT_LOG — CHAT (Carril F4)

Bitácora del carril de chat/mensajería. Solo frontend, SOLO
`apps/web/src/app/dashboard/chat/**`. Reusa el backend existente y `lib/chatApi.ts`
(no se toca: está fuera del carril). Objetivo: acercar el chat a Teams usando
únicamente lo que el backend ya expone.

> Rama: `claude/ecstatic-davinci-veo8mv`. Puertas por rebanada: `tsc --noEmit` +
> `eslint` de lo tocado + `next build` en verde antes de commitear.

## Estado al empezar (auditoría)
El chat ya estaba MUY avanzado (sesión "CHAT TEAMS" del 2026-06-08):
- ✅ Presencia online/offline (WS `presence:*`) + punto verde en avatares.
- ✅ "escribiendo…" en vivo (WS `typing`).
- ✅ Reacciones (toggle `POST reactions`) + chips con conteo + mini-picker (6 emojis).
- ✅ Recibos de lectura: `markRead` + "Visto" / "Visto por" (`GET reads`).
- ✅ @menciones: autocompletado + resaltado XSS-safe + toast/badge.
- ✅ Canales vs DMs separados; crear canal (modal) y DM (búsqueda de empleado).
- ✅ Compartir imagen (`POST/GET messages/image`) vía `AuthImage`.

### Huecos reales de paridad detectados (lo que falta para "Teams")
1. **Búsqueda DENTRO de la conversación** — el buscador del sidebar solo abre DMs;
   no hay búsqueda de mensajes en el hilo abierto (la sesión previa lo dejó
   explícitamente "fuera de alcance"). → Rebanada 1.
2. **Imagen: preview antes de enviar + estados de envío** — hoy se envía al instante,
   sin preview ni estado "enviando/no enviado/reintentar". → Rebanada 2.
3. **Lista de "en línea"** (roster) + **emoji picker de reacciones más completo**.
   → Rebanada 3.

Todo lo anterior se puede hacer 100% en cliente con los endpoints/eventos que ya
existen (no requiere backend nuevo).

---

## Rebanada 1 — Búsqueda DENTRO de la conversación ✅

Antes el único buscador (sidebar) servía para encontrar empleados y abrir DMs; no
había forma de buscar mensajes en el hilo abierto (Teams sí).

- **Toggle de búsqueda** en el header de la conversación (icono lupa). Abre una
  barra `ConvoSearchBar` bajo el header.
- **Filtrado en cliente** sobre los mensajes ya cargados (`searchMatches`,
  `useMemo`): mensajes de texto cuyo cuerpo contiene el término (case-insensitive).
  No pega al backend (los mensajes ya están en memoria).
- **Navegación** entre resultados: contador "k de n" / "Sin resultados", flechas
  ↑/↓, `Enter`/`Shift+Enter` para siguiente/anterior, `Esc` para cerrar.
- **Resalte**: las coincidencias se marcan con `<mark>` (helper `highlightText`,
  XSS-safe; se integró en `renderBody` sin romper el resalte de @menciones ni los
  links). El resultado activo recibe `ring` ámbar y se centra con `scrollIntoView`
  (efecto solo-DOM, sin `setState` → compiler-safe).
- La búsqueda se cierra/limpia al cambiar de hilo (resets en `openConversation`).
  De paso, los DMs ahora también usan `openConversation` (antes `setActiveId`
  directo) → mismo skeleton/reset que canales (consistencia).

**Alcance honesto:** busca sobre los mensajes **cargados** del hilo. La paginación
/ scroll infinito hacia historial más viejo sigue siendo deuda de UI+backend (ya
anotada en `NIGHT_LOG.md`); cuando exista, la búsqueda lo cubrirá igual.

**Compiler note:** la 1.ª versión reseteaba la búsqueda dentro del `useEffect` de
carga → warning `react-hooks/set-state-in-effect`. Se movió el reset al handler
`openConversation` (acción, no efecto) → 0 warnings.

Puertas: `tsc` 0 · `eslint` 0 · `next build` OK.

---

## Rebanada 2 — Imagen con preview + estados de envío (UI optimista) ✅

Antes la imagen se enviaba en el acto (sin ver qué se mandaba) y el texto solo se
restauraba si fallaba; no había feedback de "enviando"/"no enviado".

- **Preview antes de enviar**: al elegir archivo ya NO se envía; se muestra un panel
  sobre el composer con la miniatura, nombre y tamaño (`formatBytes`) + **Enviar** /
  **Descartar**. El object URL del preview se libera con un efecto de limpieza.
- **Estados de envío (optimista) para texto e imagen**: nuevo tipo local `UiMessage`
  (= `ChatMessage` + `status`/`localPreviewUrl`/`pendingFile`/`pendingText`).
  `enqueueText`/`enqueueImage` pintan la burbuja al instante con estado **"Enviando…"**
  (reloj + opacidad; la imagen usa el preview local mientras sube) y la reconcilian
  con el mensaje real del servidor (`reconcileSent`, dedup anti-eco del socket).
- **Fallo + reintento**: si la petición falla, la burbuja queda **"No se envió ·
  Reintentar"**; el botón quita la burbuja fallida y reenvía (conserva el texto o el
  `File`). El toolbar de reacción se oculta en mensajes en vuelo/fallidos (aún no hay
  id de servidor para reaccionar).
- DM ahora también pasa por `openConversation` (de la Rebanada 1) → reset consistente.

**Sin backend nuevo:** usa `chatApi.sendText` / `chatApi.sendImage` tal cual. El
backend de imagen no acepta **caption** (solo `conversationId` + `file`), así que el
preview NO añade texto a la imagen → **REQUIERE BACKEND** para captions junto a la
imagen (alternativa actual: mandar un texto aparte). Anotado.

Puertas: `tsc` 0 · `eslint` 0 · `next build` OK.

---

## Rebanada 3 — Lista "en línea" (roster) + emoji picker de reacciones completo ✅

- **Roster "En línea · N"** en el sidebar (sobre Canales): lista los compañeros
  conectados ahora (`onlineUsers` = `users` ∩ `onlineIds`, sin contarme), con punto
  verde; clic en uno → abre/crea el DM (`startDm`). Cierra el pedido literal
  "+ lista de en línea" del enunciado; reusa la presencia WS ya existente.
- **Emoji picker de reacciones más completo**: el mini-picker del hover ahora trae
  las 6 reacciones rápidas **+ botón "+"** que despliega el set completo (16 emojis,
  grid 8 col). Antes solo había 6 fijas. Sigue siendo toggle (`POST reactions`).

Puertas: `tsc` 0 · `eslint` 0 · `next build` OK.

---

## Cierre del carril (estado de paridad "Teams")

Cubierto por el enunciado F4, todo sobre el backend existente (0 cambios a `apps/api`):
- ✅ Presencia + "escribiendo…" en vivo **+ lista de en línea** (Rebanada 3).
- ✅ Reacciones con **emoji picker** (rápidas + set completo) y conteos.
- ✅ Recibos de lectura ("Visto" / "Visto por").
- ✅ @menciones con autocompletar + resaltado.
- ✅ **Búsqueda dentro de la conversación** (Rebanada 1); canales vs DMs separados;
  crear canal/DM.
- ✅ Compartir imagen **con preview + estados de envío** (Rebanada 2).

### REQUIERE BACKEND (no inventado — UI honesta / anotado, NO entró)
- **Hilos/threads**, **editar/borrar/responder-citar** mensaje (faltan columnas +
  endpoints + eventos `message:update`/`delete`). Por eso el toolbar de hover solo
  reacciona (sin botones muertos).
- **Caption** junto a la imagen (el endpoint de imagen solo acepta `file`).
- **Notificaciones push** del navegador / centro in-app con preferencias (hoy: toast
  + título de pestaña).
- **Adjuntos no-imagen** (PDF/Excel/NCR); **gestión de canal** (renombrar/archivar/
  salir/miembros); **paginación/scroll infinito** del historial (la búsqueda cubrirá
  el historial cuando exista).

Estos ya estaban anotados como deuda en `NIGHT_LOG.md` (sesión CHAT TEAMS). No se
tocó `lib/chatApi.ts` ni `components/AuthImage.tsx` (fuera del carril; se reusan).

