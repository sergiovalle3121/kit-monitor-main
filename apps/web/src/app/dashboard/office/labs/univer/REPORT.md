# Spike: Univer como ruta a paridad real en Hojas

**Rama:** `claude/office-univer-spike` (aislada, **sin tocar el Office real**) · **PR draft, sin merge.**
**Fecha:** 2026-06-08 · **Univer evaluado:** `0.25.0` (última estable).

> **TL;DR / Recomendación:** **Quedarnos con Fortune-Sheet por ahora.** Univer **OSS**
> *no* resuelve el motivo principal del spike — **las tablas dinámicas son de pago
> (Univer Pro)**, igual que gráficas, sparklines, impresión y el motor de fórmulas
> "avanzado" y el import/export .xlsx oficial. Migrar a Univer OSS añadiría un
> bundle grande y un costo de migración alto **sin** obtener pivots. Caminos mejores:
> (1) **construir un pivot propio** sobre el modelo de datos de Fortune-Sheet
> (group-by → rango/tabla de salida), sin dependencias nuevas; (2) si pivots/print/
> fórmulas-avanzadas se vuelven requisito duro y hay presupuesto, evaluar **Univer
> Pro comercialmente** (ahí sí la migración cobra sentido como paquete).

---

## 1) Licencia (confirmada vía npm)

| Paquete | Licencia | Notas |
|---|---|---|
| `@univerjs/core`, `/sheets`, `/sheets-ui`, `/ui`, `/design`, `/engine-render`, `/engine-formula`, `/sheets-formula`, `/sheets-numfmt`, `/network`, `/rpc` | **Apache-2.0** ✅ | Núcleo OSS de hojas. |
| `@univerjs/preset-sheets-core` | **Apache-2.0** ✅ | Sus deps son **todas `@univerjs/*` OSS**. |
| `@univerjs/presets` (meta) | Apache-2.0 (el paquete) | ⚠️ **Pero depende de `@univerjs/preset-sheets-advanced` y `-collaboration`, que a su vez dependen de `@univerjs-pro/*`.** Instalarlo **mete paquetes Pro** (comerciales) en `node_modules`/lockfile aunque no los uses. **Evitar.** |
| `@univerjs-pro/sheets-pivot`, `-chart`, `-sparkline`, `-print`, `-outline`, `-shape`, `engine-formula`, `exchange-client`, `license` | **Comercial (Univer Pro)** ❌ | No declaran licencia OSI; requieren **clave de licencia** vía `@univerjs-pro/license`. |

- **GPL:** ✅ limpio. `@univerjs/engine-formula` (OSS) **no** depende de **HyperFormula** (verificado: motor de fórmulas **propio** de Univer, Apache-2.0). Sin contaminación GPL/AGPL/LGPL.
- **Implicación práctica:** para mantenerse 100% OSS hay que usar **solo** `@univerjs/preset-sheets-core` (o registrar plugins `@univerjs/*` a mano con la API de bajo nivel) y **no** instalar `@univerjs/presets` ni los presets "advanced/collaboration".

## 2) Tamaño de bundle

Tamaños *unpacked* (incluyen sourcemaps + ESM/CJS/UMD; el runtime real es bastante menor):

| Paquete OSS | Unpacked |
|---|---|
| `@univerjs/engine-render` | ~19.9 MB |
| `@univerjs/sheets-ui` | ~8.1 MB |
| `@univerjs/engine-formula` | ~6.6 MB |
| `@univerjs/sheets` | ~4.8 MB |
| `@univerjs/ui` | ~1.9 MB |
| `@univerjs/design` | ~1.1 MB |

- **Runtime real (estimado, minificado+gzip)** de una hoja con `preset-sheets-core`: ≈ **1.0–1.8 MB gzip** (Univer es pesado; usa su propio motor de render en canvas + UI propia).
- **Comparativa:** `@fortune-sheet/react` (actual) es del orden de **~300–500 KB**. → Univer es aproximadamente **3–5× más pesado**. En `apps/web` (que ya carga TipTap, Fabric, Chart.js, xlsx…) esto es relevante; el editor de hojas ya se carga con `dynamic(ssr:false)`, así que el costo es bajo demanda, pero sigue siendo grande.

## 3) Fórmulas y tablas dinámicas vs Fortune-Sheet

| Capacidad | Fortune-Sheet (actual) | Univer **OSS** | Univer **Pro** |
|---|---|---|---|
| Motor de fórmulas | Funcional pero **set limitado** y casos de recálculo flojos | **Motor propio robusto** (~500+ funciones, grafo de dependencias, fórmulas matriciales) — **mejor** | `@univerjs-pro/engine-formula` (aún más) |
| **Tablas dinámicas (pivot)** | ❌ no estable | ❌ **NO existe en OSS** (`@univerjs/sheets-pivot` → 404) | ✅ `@univerjs-pro/sheets-pivot` (**de pago**) |
| Gráficas | ✅ vía Chart.js (nuestra capa) | ❌ no OSS | ✅ `@univerjs-pro/sheets-chart` (pago) |
| Sparklines | ⚠️ no | ❌ | ✅ Pro (pago) |
| Formato condicional / validación / filtro / ordenar / buscar-reemplazar / notas | ✅ (capa AXOS, Track A) | ✅ **nativo** (`preset-sheets-*` OSS) | ✅ |
| Formato de número | parcial | ✅ `sheets-numfmt` nativo | ✅ |

**Conclusión:** el único upgrade *neto* de Univer **OSS** sobre Fortune-Sheet es el **motor de fórmulas** (mejor) y algunas features nativas más pulidas (numfmt, filtro). **Pivots y gráficas — los motivos de peso — son Pro.**

## 4) Fidelidad import/export .xlsx

- El import/export **.xlsx oficial de Univer** es `@univerjs-pro/exchange-client` → **Pro**, y funciona contra un **servicio de conversión** (servidor de Univer / self-host de pago). **No** es una librería OSS de cliente.
- En **OSS** no hay un `.xlsx` de primera clase; habría que **seguir usando SheetJS** (nuestro `lib/office/xlsx.ts` actual) como puente Univer⇄.xlsx. → **La paridad de .xlsx NO mejora** con Univer OSS; mantendríamos SheetJS igual que hoy.

## 5) Esfuerzo de migración (solo Hojas)

**Alto (~1–2 semanas)** para una migración sólida de Sheets:
- Modelo de datos distinto: Univer usa `IWorkbookData` + **commands/mutations**; Fortune-Sheet usa `celldata`. Hay que escribir un **adaptador** Univer ⇄ nuestro shape persistido `{ sheets, charts }` (y migración de documentos existentes en la BD).
- Reescribir `SheetEditor` y **rehacer la capa de profundidad** (Track A: cond-format, validación, ordenar, etc.) contra las APIs de Univer **o** reemplazarla por las features nativas de Univer.
- **Gráficas:** se perdería la integración Chart.js (o se mantiene aparte); Univer chart es Pro.
- **Registro de plugins a mano** (para evitar `@univerjs/presets` y sus deps Pro): verboso pero necesario para quedarse OSS-limpio.
- **Next.js 16 / React 19 / SSR:** montar Univer **solo en cliente** (`dynamic(ssr:false)` + `import()` en `useEffect`), CSS de Univer, y validar build (webpack) — integración conocida-como-quisquillosa.

## 6) Riesgos

1. **Paywall OSS↔Pro:** las features "estrella" (pivot, chart, print, fórmula avanzada, exchange .xlsx) son **Pro**. Adoptar Univer "por paridad" empuja de facto hacia una **licencia comercial**.
2. **Bundle** ~3–5× vs Fortune-Sheet.
3. **Cadencia 0.x:** releases frecuentes con cambios rompientes.
4. **Trampa de licencia:** `@univerjs/presets` instala `@univerjs-pro/*` transitivamente → fácil contaminar el árbol con comerciales sin querer.
5. **Costo de oportunidad:** la migración congela otras mejoras 1–2 semanas sin entregar el pivot.

## 7) Recomendación final

- **Quedarnos con Fortune-Sheet** (no migrar a Univer OSS).
- **Resolver pivots con un componente propio** sobre `celldata` (group-by + agregados → rango/tabla de salida). Esfuerzo **moderado**, **sin dependencias nuevas**, y entrega justo lo que falta. Mantener **Chart.js** para gráficas (ya integrado en Track A).
- **Reconsiderar Univer solo si:** (a) hay **presupuesto para Univer Pro** (pivot/chart/print/fórmula-avanzada/exchange) — ahí la migración a Univer *Pro* sí tiene sentido como producto; o (b) la **corrección del motor de fórmulas** se vuelve prioridad crítica — entonces evaluar adoptar **solo** el `@univerjs/engine-formula` OSS de forma aislada (también no trivial).

## Nota sobre este prototipo

Para **no contaminar el repo** con paquetes comerciales (`@univerjs/presets` arrastra `@univerjs-pro/*`) ni inflar el bundle por una evaluación desechable, **no se instaló Univer** en esta rama. La página `page.tsx` de este directorio es un **tablero de evaluación interactivo** (matriz comparativa + veredicto) y queda **aislada** bajo `…/office/labs/univer`, sin tocar el Office real. La receta de integración **OSS-only** (registro manual de plugins `@univerjs/*`, sin `@univerjs/presets`) queda descrita arriba para ejecutarla si se decide avanzar.
