# NIGHT_LOG — SEARCH (carril ⌘K)

Bitácora del carril de búsqueda global. Solo frontend, SOLO
`apps/web/src/components/SearchPalette.tsx` + un helper local
(`apps/web/src/components/searchSources.ts`). Reusa los endpoints de lista que
cada módulo ya expone — no se toca backend ni otras páginas. Objetivo: que el
command-palette (⌘K) deje de ser solo un "ir a…" y haga **búsqueda global REAL**
sobre registros: WO, NCR, partes, personas y documentos.

> Rama: `claude/magical-cori-nxphv1`. Puertas: `tsc --noEmit` (web) en verde +
> `eslint` de lo tocado sin warnings antes de commitear.

## Estado al empezar (auditoría)

`SearchPalette` era un lanzador estilo Linear/Cmd-K que **solo** filtraba un
catálogo estático de destinos (`DESTS`, ~45 áreas) por palabras clave y navegaba
a la ruta del área. No buscaba ningún registro real: escribir el folio de una WO,
un número de parte, una NCR o el nombre de una persona no encontraba nada.

### GREP de endpoints existentes (no hay `/search` global en el backend)

No existe un endpoint de búsqueda transversal; cada módulo expone su lista. Lo que
hay por tipo:

| Tipo | Endpoint de lista | Forma | ¿Detalle propio? |
|------|-------------------|-------|------------------|
| **WO / producción** | `GET /production-plan` (`SfWorkOrder[]`) | `folio` (WO-…), `model`, `line`, `status`, `quantityPlanned/Completed`, `customer`, `priority` | ❌ no hay ruta `[id]`; viven en el muro `/dashboard/production-plan` |
| **NCR / calidad** | `GET /ncr` (`NCR[]`) | `id`, `ncrNumber` (NCR-AAAA-NNNN), `partNumber`, `model`, `workOrder`, `category`, `status`, `description` | ✅ `/dashboard/quality/ncr/[id]` |
| **Partes / inventario** | `GET /product-models` (`ProductModel[]`) | `id` (uuid), `modelNumber` (MDL-…), `name`, `customer`, `revision`, `status` | ✅ `/dashboard/models/[id]` |
| **Personas** | `GET /people/certifications` (`Certification[]`) | `employeeName`, `skill`, `area`, `station`, `status` | ❌ matriz en `/dashboard/skills` |
| **Documentos / office** | `GET /office-documents` (todos los tipos si se omite `type`) | `id` (uuid), `title`, `type` (doc/sheet/slides), `model`, `updatedAt` | ✅ `/dashboard/office/[id]` |

(`product-models` incluso acepta `?search=`, pero por consistencia se filtra en
cliente junto con el resto.)

**Conclusión de diseño:** sin backend de búsqueda, la única forma honesta es
agregar en cliente. Se traen las listas una vez, se normalizan a un índice plano
y se filtra/puntúa localmente conforme se teclea.

---

## Lo que se construyó

### Helper `searchSources.ts` (el "motor")

- **Índice plano** `SearchHit[]`: cada registro se normaliza a
  `{ kind, id, title, subtitle, badge?, href, haystack, score, ts }` con un
  `haystack` (texto en minúsculas) precomputado para matchear sin recalcular en
  cada tecla.
- **Normalizadores por fuente** (5): WO, NCR, parte, persona, documento. Las
  certificaciones se **colapsan por persona** (`employeeName`) → un hit por
  persona con "N certificaciones · áreas", no una fila por skill.
- **Carga tolerante a fallos**: `Promise.all` + guardas por fuente. Si una fuente
  da 403/red/forma inesperada, cae en `degraded[]` y las demás siguen
  funcionando. Si **ninguna** responde → `authError` (sesión caída ≠ "sin
  resultados").
- **Caché con TTL (45 s)** a nivel módulo + dedupe de la carga en vuelo
  (`inflight`): reabrir el palette o seguir tecleando no re-pega a la red; solo
  re-filtra el índice ya cargado. Si la carga se aborta (el usuario sigue
  tecleando) no se cachea un resultado a medias.
- **Filtrado + scoring** (`filterSearchIndex`): match AND de todos los términos
  contra el `haystack`; score por igualdad/prefijo/inclusión en el título y
  prefijo en el haystack; orden por relevancia y luego recencia; **tope de 6 por
  grupo** para que una fuente ruidosa no ahogue al resto. Devuelve un array plano
  ya ordenado por `ENTITY_ORDER` → listo para navegación por teclado.

### Componente `SearchPalette.tsx`

- **Búsqueda real + navegación coexisten.** Los registros van primero, agrupados
  por tipo con encabezado e icono; el catálogo `DESTS` se conserva como grupo
  "Ir a…" al final (sigue siendo útil para saltar a áreas).
- **Agrupado por tipo** con conteo por grupo; cada hit muestra título + contexto
  + pill de estado (`badge`).
- **Navegación con teclado** sobre la lista plana combinada (↑/↓, Enter), con
  `scrollIntoView` del seleccionado (efecto solo-DOM). El mouse-hover también
  selecciona.
- **Ir directo al detalle** donde existe ruta `[id]`: NCR → `/quality/ncr/{id}`,
  parte → `/models/{id}`, documento → `/office/{id}`. WO y personas (sin ruta de
  detalle propia) navegan a su superficie real: el muro del plan y la matriz de
  skills, respectivamente.
- **Debounce 180 ms** + `AbortController` por búsqueda. El spinner solo aparece en
  la primera carga (no parpadea en cada tecla una vez que hay índice caliente).
- **Estados honestos:**
  - Vacío (sin query) → catálogo de áreas, como antes.
  - 1 carácter → solo navegación + “Escribe al menos 2 caracteres…”.
  - ≥2 cargando → fila "Buscando en órdenes, calidad, inventario, personas y
    documentos…".
  - Sin coincidencias → "Sin resultados para «q». Prueba con un folio, número de
    parte, NCR o nombre."
  - Sesión/registro inalcanzable → "No se pudo buscar. Revisa tu conexión o vuelve
    a iniciar sesión." (distinto de "sin resultados").
  - Fuentes degradadas → nota ámbar "No se pudo consultar: <tipos>. Mostrando el
    resto."

---

## Alcance honesto

- **WO y personas no tienen ruta de detalle `[id]`** en el frontend actual. Como el
  carril es SOLO `SearchPalette.tsx` + helper, no se inventó una ruta falsa: esos
  hits abren su superficie real (muro del plan / matriz de skills). Los otros tres
  tipos sí hacen deep-link al registro exacto.
- **Agregación en cliente, no servidor.** Se traen listas completas (los módulos no
  paginan en estos endpoints) y se filtra local. Es lo realista mientras no exista
  `/search` en el backend; con cientos–miles de filas y la caché TTL, el costo es
  aceptable para un palette. Si algún día crece mucho, el lugar natural sería un
  endpoint de búsqueda en backend (deuda anotada).
- **Permisos:** `production-plan` exige `production:read`; si el usuario no lo
  tiene, esa fuente cae en `degraded` y el resto sigue — el palette lo dice en vez
  de mentir con "sin resultados".

## Compiler note

La 1.ª versión reseteaba el estado de búsqueda **síncronamente** dentro del
`useEffect` de la query → warning `react-hooks/set-state-in-effect`. Se consolidó
el estado en un solo atom (`SearchState`) escrito **solo** desde callbacks async
(timer de debounce / resolución de la promesa); el reset de query-corta se difiere
con `setTimeout(…, 0)`. Además, los grupos de registros se "gatean" por
`query.length >= 2`, así que hits viejos nunca parpadean al acortar la query.

## Puertas (verde)

- `npx tsc --noEmit -p apps/web/tsconfig.json` → **0 errores** en toda la app.
- `npx eslint src/components/SearchPalette.tsx src/components/searchSources.ts` →
  **0 warnings / 0 errors**.
- `SearchPalette` se monta sin props en `app/layout.tsx`; la firma del export no
  cambió → reemplazo drop-in (mismo ⌘K, mismo evento `axos:open-search`).
