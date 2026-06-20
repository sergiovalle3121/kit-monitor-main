# NIGHT_LOG — UI-REPORTS (Carril frontend)

Sección nueva `dashboard/reports/**`. Rama `claude/clever-tesla-20afub`.
Generador de documentos de planta **100% client-side / print-to-PDF** sobre datos
**reales** ya existentes (cero mock). No se tocó ninguna otra área: todo vive bajo
`apps/web/src/app/dashboard/reports/` + componentes locales en `_components/`.

---

## ▶ RETOMAR AQUÍ

- **Entregado y en verde:** sección Reportes con 4 documentos imprimibles + hub:
  1. **Certificado de Conformancia (CoC)** — por WO **o** por embarque.
  2. **Trazabilidad as-built por serie** — desde el visor de genealogía.
  3. **Reporte de calidad (NCR / Yield)** — con Pareto y rendimiento de prueba.
  4. **Producción por turno** — avance real vs objetivo, agrupado por turno.
- **Puertas web verdes:** `tsc --noEmit` (0 errores en todo `apps/web`), `eslint`
  (0 issues en `reports/`), `next build` (compiló OK; las 5 rutas salen estáticas).
- **Único hueco para coordinación (NO lo toqué — es otra área):** registrar la
  sección en el hub `apps/web/src/app/dashboard/page.tsx` (arreglo `AREAS`). La
  sección es alcanzable por URL (`/dashboard/reports`) pero NO aparece como loseta
  en el hub porque eso exige editar un archivo compartido fuera del carril. Snippet
  listo-para-pegar abajo (§ Follow-ups).

---

## Qué resuelve este carril

La planta necesita **sacar documentos** (certificados y reportes) de lo que ya vive
en el sistema, sin esperar a un servicio de generación de PDF. La vía honesta:
construir el documento en el cliente sobre los endpoints reales y **imprimir a PDF
con el navegador** (Imprimir → Guardar como PDF). Donde un documento *formal* exige
backend que aún no existe (folio oficial, firma electrónica, registro inmutable,
contenido a nivel serie), **no se inventa**: el documento sale marcado **BORRADOR**
con número de control derivado en cliente y una nota **REQUIERE BACKEND** explícita.

## Endpoints reales usados (GREP en main, sin mock)

| Documento | Endpoints | Permiso backend |
|---|---|---|
| CoC por WO | `GET /plans`, `GET /quality/oqc/history`, `GET /ncr`, `GET /testing/kpis` | mezcla (ver abajo) |
| CoC por embarque | `GET /outbound/shipments` | (lectura outbound) |
| Trazabilidad as-built | `GET /genealogy/as-built/by-serial/:serial` | `production:report` |
| Calidad (NCR/Yield) | `GET /ncr`, `GET /testing/kpis` | `quality:*` / testing |
| Producción por turno | `GET /production-runtime/completed`, `GET /production-runtime/lines` | `production:read` |

Cada tile del hub muestra su propia fuente de datos en letra chica (transparencia).

## Decisiones de diseño

- **Papel blanco fijo (metáfora documento):** la "hoja" `.axos-doc` NO responde a
  modo oscuro — se ve como un documento real sobre el lienzo y el print-to-PDF sale
  limpio sin importar el tema del SO. La **chrome** (selectores, barra, botón
  Imprimir) sí es dark-aware y se oculta al imprimir (`.axos-no-print`).
- **Aislamiento de impresión local al carril:** `_components/PrintStyles.tsx` inyecta
  un `<style>` con `@media print` que oculta TODO salvo `.axos-doc` (mismo patrón que
  el módulo Office con Paged.js), fuerza blanco/negro con `print-color-adjust: exact`
  y evita cortes feos. Vive dentro del componente (no en un CSS global compartido)
  para respetar el límite del carril; se monta sólo en páginas de reporte.
- **Estado vacío honesto en todos lados:** sin selección, sin permiso (403 →
  `forbidden`), sin registro → se dice qué falta y por qué; nunca ceros engañosos.
  Ejemplos: WO sin OQC ("no puede sustentarse documentalmente"), serie sin genealogía
  ("la red de captura aún no pobló este consumo"), turno sin ejecución, etc.
- **Veredicto de conformidad conservador (CoC):** `assessConformance(oqc, ncrs)`
  deriva CONFORME / CONDICIONAL / NO CONFORME **sólo** de la evidencia real (resultado
  OQC + NCR abiertas). Sin OQC → **SIN EVIDENCIA SUFICIENTE** (nunca conforme por
  defecto). NCR crítica abierta → NO CONFORME. NCR abierta no-crítica → degrada a
  CONDICIONAL.
- **Huecos de dato reconocidos, no inventados:**
  - La entidad `Plan` (WO) **no** lleva `customer`/`program`/`revision` → el CoC por
    WO intenta derivarlos de una NCR de la misma WO; si no hay, muestra "—".
  - El embarque `outbound` **no** lleva renglones (series/partes) → el CoC por
    embarque marca el contenido unidad-por-unidad como **REQUIERE BACKEND**.
  - El yield (`/testing/kpis`) es a **nivel planta**, no por WO ni por rango → se
    rotula como referencia, no como métrica del corte.
- **Sin dependencias nuevas:** todo con lo ya presente (React, SWR vía `useApi`,
  framer-motion, lucide, Tailwind). No se usó `jspdf` (la consigna es print-to-PDF
  del navegador, más fiel para un documento). Componentes locales, no compartidos.
- **Reutilización honesta:** se **importan** (no se modifican) hooks/lib compartidos
  (`useApi`, `apiFetch`, `glass`, `IconTile`, `PageHeader`, `design/domains`,
  `AuthContext`). Los tipos se **espejan** localmente en `reports.types.ts` (igual
  criterio que `quality.types.ts`: `packages/contracts` aún no existe).

## Archivos (todos nuevos, dentro del carril)

```
apps/web/src/app/dashboard/reports/
├── page.tsx                      Hub: 4 tarjetas + disclaimer print/REQUIERE BACKEND
├── reports.types.ts              Tipos locales que espejan shapes reales del backend
├── reports.utils.ts             Helpers puros (formato, nº control BORRADOR, Pareto,
│                                 conformidad, agrupación por turno) — sin React, testeables
├── coc/page.tsx                  Certificado de Conformancia (modo WO / modo embarque)
├── traceability/page.tsx        Certificado de trazabilidad as-built por serie
├── quality/page.tsx             Reporte de calidad (NCR/yield) con filtro de periodo
├── production/page.tsx          Reporte de producción por turno
└── _components/
    ├── ReportChrome.tsx          Marco: barra + controles + "hoja" + pie + PrintStyles
    ├── PrintStyles.tsx           Aislamiento @media print (local)
    ├── DocLetterhead.tsx         Membrete con emblema + metadatos + sello BORRADOR
    ├── DocSection.tsx            Sección titulada del documento
    ├── KeyValueGrid.tsx          Rejilla etiqueta/valor
    ├── DocTable.tsx              Tabla sobria optimizada para impresión
    ├── SignatureBlock.tsx       Bloque de firmas (líneas en blanco — REQUIERE BACKEND e-sign)
    ├── BackendNote.tsx          Callout "REQUIERE BACKEND"
    ├── ConformanceBanner.tsx    Veredicto CONFORME/CONDICIONAL/NO CONFORME/SIN DATOS
    ├── EmptyState.tsx           Estado vacío honesto
    └── Picker.tsx               Selector buscable (WO / embarque) — sólo pantalla
```

## Puertas (web) — todas verdes

1. `npx tsc --noEmit` (apps/web) → **0 errores** (todo el proyecto).
2. `npx eslint src/app/dashboard/reports` → **0 issues**.
3. `npx next build` → **✓ Compiled successfully**; rutas `reports`, `reports/coc`,
   `reports/traceability`, `reports/quality`, `reports/production` prerenderizadas (○).
4. Backend / API — N/A (no se tocó backend).

## Tripwires respetados

- ⛔ NO se tocó ninguna otra área: cero ediciones fuera de `dashboard/reports/**`.
- ⛔ NO se modificó/añadió endpoint, entidad ni esquema backend.
- ⛔ NO se inventó generación de PDF por backend: es print-to-PDF del navegador, y
  donde haría falta backend se marca **REQUIERE BACKEND** (no se simula).
- ⛔ NO se inventó dato: huecos reales salen como "—" / banner honesto, nunca cero
  decorativo ni firma/aprobación simulada.

## Follow-ups (REQUIERE COORDINACIÓN / BACKEND)

1. **Registrar en el hub** (`apps/web/src/app/dashboard/page.tsx`, arreglo `AREAS`)
   — fuera del carril; lo dejo para el orquestador. Snippet aditivo sugerido:
   ```ts
   // sección "Control e inteligencia" o nueva "Documentos":
   { name: "Reportes", desc: "Certificados y reportes (PDF)", href: "/dashboard/reports",
     icon: Icons.FileText, domain: "office",
     roles: ["quality_engineer", "production_supervisor", "planner", "plant_manager"],
     section: "Control e inteligencia" },
   ```
2. **Servicio de numeración de certificados** (folio oficial tipo `COC-`/`TRC-`) +
   **firma electrónica** + **registro inmutable** en el Event Ledger. Hoy: número de
   control BORRADOR en cliente + firma manuscrita post-impresión.
3. **CoC por WO server-side:** endpoint que agregue OQC + NCR + yield por WO (hoy se
   agrega en cliente; además `/quality/oqc/history` trae sólo los 100 más recientes,
   así que OQC muy viejas pueden no aparecer → se reporta como "sin registro").
4. **Contenido de embarque a nivel serie/parte** (renglones de `outbound`) para
   certificar conformidad unidad por unidad y cruzar con genealogía.
5. **Reporte por periodo/turno real:** ventanas de turno (hora inicio/fin) y corte por
   fecha del lado servidor; yield/FPY segmentado por modelo/línea/WO.
6. **Árbol multinivel de sub-ensambles** en as-built (la genealogía ya guarda
   `parent_serial`; falta exponer la recursión hija — ya anotado en NIGHT_LOG_GENEALOGY).
