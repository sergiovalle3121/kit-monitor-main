# NIGHT_LOG — UI-GENEALOGY (carril frontend)

Visor de **trazabilidad y genealogía** en el dashboard. 100% aditivo: **una sola ruta
nueva** + componentes locales co-ubicados. No se tocó backend, ni navegación, ni
componentes compartidos, ni ninguna otra área. Rama `claude/trusting-mendel-r9k330`.

---

## ▶ RETOMAR AQUÍ

- **Entregado:** página `/dashboard/genealogy` — visor de trazabilidad con dos modos:
  1. **Por serie → AS-BUILT** (cuna-a-tumba): árbol de qué lote/reel de cada NP se
     consumió, con operador · estación · hora · fuente. Consume
     `GET /genealogy/as-built/by-serial/:serial`.
  2. **Por lote/reel → WHERE-USED** (contención de recall): qué series contienen el
     lote/reel defectuoso y qué embarques/clientes alcanzaría el recall, con el
     conjunto deduplicado "listo para contención" (copiable). Consume
     `GET /genealogy/where-used/by-lot?lot=&reel=&part=`.
- **Cierra el hueco anotado en `inventory/page.tsx`** (la consulta inversa por serie
  serial→as-built estaba marcada "pendiente backend"; ahora ya existe el endpoint y
  esta página lo expone).

---

## El backend que consume (grep del módulo `genealogy` en main)

`apps/api/src/modules/genealogy/genealogy.controller.ts` — guard
`JwtAuthGuard + PermissionsGuard`:

| Método | Ruta | Permiso | Respuesta |
|---|---|---|---|
| GET | `as-built/by-serial/:serial` | `production:report` | `AsBuiltTree` |
| GET | `where-used/by-lot?lot=&reel=&part=` | `quality:report` | `WhereUsedResult` |

Formas de respuesta tomadas de `genealogy.derivation.ts` (fuente de verdad):
`AsBuiltTree { serial, model, woId, woFolio, componentCount, parts[], lotCaptureGap,
firstBuiltAt, lastBuiltAt }` y `WhereUsedResult { query, serialCount, affectedSerials[],
shipmentCount, shipments[], recallScope{serials,shipments,customers} }`. Los tipos del
front (`_lib/types.ts`) son un espejo exacto de esas interfaces.

**Señales honestas que el visor respeta (del diseño backend):**
- `lotCaptureGap: true` → banner ámbar "captura de lote parcial" (el ledger de piso aún
  no captura lote/reel; el árbol NP·estación·operador·hora sigue completo).
- where-used con 0 series → mensaje honesto: la búsqueda inversa por lote sólo resuelve
  sobre genealogía con lote/reel capturado (índice/terminal); el ledger sin lote no
  participa.
- `shipmentCount === 0` → "contención interna: nada embarcado, sigue en planta".

## Archivos (todos nuevos, bajo la ruta del visor)

- `apps/web/src/app/dashboard/genealogy/page.tsx` — shell, switch de modo, controles de
  búsqueda, orquestación de fetch (vía `useApi`), deep-link `?serial=` / `?lot=&reel=&part=`.
- `apps/web/src/app/dashboard/genealogy/_lib/types.ts` — tipos espejo del backend.
- `apps/web/src/app/dashboard/genealogy/_lib/format.ts` — formateadores puros (fecha,
  relativo, cantidad, badge de fuente, copiar al portapapeles).
- `apps/web/src/app/dashboard/genealogy/_components/primitives.tsx` — primitivas locales
  (Spinner, Badge, Kpi, EmptyState, AccessDenied, ErrorCard, CopyButton).
- `apps/web/src/app/dashboard/genealogy/_components/AsBuiltView.tsx` — árbol as-built.
- `apps/web/src/app/dashboard/genealogy/_components/WhereUsedView.tsx` — contención recall.

## Decisiones de diseño (front)

- **Co-ubicación `_components` / `_lib`** (prefijo `_` = no es ruta en App Router),
  siguiendo el precedente de `dashboard/settings`. Nada se exporta a `components/`
  compartidos → cero acoplamiento con otras áreas.
- **Lenguaje visual del sistema:** `PageHeader` por dominio (`production`, ícono
  `Network`) + `glass` + íconos lucide, igual que `floor-quality` (el hermano de
  where-used). Tema claro/oscuro respetado (`text-black dark:text-white`, `:global(.dark)`).
- **RBAC por la respuesta real:** se usa el flag `forbidden` de `useApi` (401/403) por
  modo, porque refleja el RBAC real del backend (incluye comodines/admin). As-built pide
  `production:report`; where-used pide `quality:report` → un usuario puede ver un modo y
  no el otro (se muestra "Sin acceso" honesto en el que no tenga).
- **Sin polling:** `refreshInterval: 0` (la genealogía es historia inmutable; el usuario
  re-busca cuando quiere). Búsqueda on-demand con tecla Enter + botón.
- **Deep-link sin Suspense:** se leen los query params con `window.location.search` en un
  efecto de montaje y se reflejan con `history.replaceState`, evitando el bailout de
  `useSearchParams` en build (sin tocar el layout).
- **Recall accionable:** el panel where-used muestra el "alcance de contención" (series /
  embarques / clientes) y el conjunto deduplicado `recallScope` con botones **Copiar**
  para bloquear/notificar.

## Puertas (frontend) — verdes

1. `npx tsc --noEmit` (web) ✅ — sin errores de tipos en el carril (los tipos del
   front son espejo exacto del backend).
2. `npm run lint` (web) ✅ EXIT 0 — 1 *aviso* en `page.tsx:60`
   (`react-hooks/set-state-in-effect`, el efecto de montaje del deep-link). El
   `eslint.config.mjs` del repo fija esas reglas del React Compiler como `"warn"`
   a propósito ("sin bloquear el build"); el efecto es el patrón hidratación-segura
   correcto para sembrar estado desde la URL, así que se deja visible (política del
   repo). No introduce errores.
3. `npm run build` (web) ✅ — `/dashboard/genealogy` compila y queda **prerenderizada
   estática** (`○ Static`), confirmando que leer la URL con `window.location` (en vez
   de `useSearchParams`) evita el bailout dinámico. Artefactos en
   `.next/server/app/dashboard/genealogy/`.

## Tripwires respetados

- ⛔ NO se tocó backend (sólo se leyó el contrato del controller/derivation).
- ⛔ NO se tocó navegación (dock/sidebar/SearchPalette/hub) ni componentes compartidos.
  La página es alcanzable por URL directa `/dashboard/genealogy` y por deep-link.
- ⛔ NO se modificó ninguna otra página/área. Todo nuevo vive bajo la ruta del visor.
</content>
</invoke>
