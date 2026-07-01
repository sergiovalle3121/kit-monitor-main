# Vulnerabilidades conocidas (npm) — estado y plan

> **Política:** aplicamos `npm audit fix` (correcciones **no-breaking**).
> **NUNCA** `npm audit fix --force`, porque arrastra cambios mayores que rompen
> la app (p. ej. `sqlite3@6`, `next@16.2.9` fuera del rango declarado). Las
> vulnerabilidades que sólo se resuelven con un salto mayor —o que no tienen fix
> publicado— se documentan aquí con un plan, en lugar de dejar la app rota.

_Última auditoría: 2026-07-01._

## Resumen

| Momento | total | high | moderate | low |
| --- | --- | --- | --- | --- |
| Antes de `npm audit fix` | 37 | 20 | 14 | 3 |
| **Después de `npm audit fix` (aplicado)** | **24** | **17** | **5** | **2** |

`npm audit fix` corrigió 13 hallazgos no-breaking (entre ellos `fast-uri` [high],
`form-data` [high], `dompurify`, `@babel/core`, `brace-expansion`, `ip-address`,
`js-yaml`). Sólo cambió `package-lock.json` (deps transitivas); no tocó
`package.json` ni versiones directas. Build/test/lint/typecheck verdes tras el fix.

## Remanente (requiere salto mayor o sin fix) — NO forzado

### 1. Cadena `sqlite3` (driver de DEV) — `tar`, `cacache`, `node-gyp`, `make-fetch-happen` · **high**
- **Por qué no se arregla sin breaking:** `npm audit fix --force` instalaría
  `sqlite3@6.0.1` (breaking) y potencialmente un `typeorm` nightly.
- **Exposición real: baja.** `sqlite3` es **sólo el driver de desarrollo**
  (producción usa PostgreSQL). Las vulnerabilidades (`tar`/path-traversal,
  `cacache`) están en las **dependencias de *build*** de `node-gyp`, no en el
  runtime de producción.
- **Plan sugerido:** PR dedicado de dependencias que suba `sqlite3` a la línea
  parchada y valide compatibilidad con `typeorm`; alternativa, migrar el driver
  de dev a `better-sqlite3`. Validar con el smoke de bootstrap y los tests.

### 2. `next` (Next.js) — **high** · `postcss` (transitiva) — **moderate**
- **Advisories:** cache poisoning en respuestas RSC; bypass de middleware/proxy
  en App Router y en Pages Router (i18n); XSS en `postcss` al stringificar CSS.
- **Por qué no se arregla sin breaking:** el fix instala `next@16.2.9`, **fuera
  del rango declarado** por la app → cambio potencialmente breaking del framework.
- **Plan sugerido:** PR dedicado que suba Next.js a una **16.x parchada**,
  corriendo la regresión web completa (build + lint + e2e Playwright) antes de
  mergear. Prioridad alta por la severidad y por ser superficie expuesta.

### 3. `xlsx` (SheetJS) — **high** · **sin fix publicado en npm**
- **Advisories:** Prototype Pollution (GHSA-4r6h-8v6p-xvw6) y ReDoS
  (GHSA-5pgg-2g8v-p4x9). `npm audit` reporta *No fix available*.
- **Por qué:** SheetJS dejó de publicar en el registro de npm; la versión de npm
  quedó congelada/vulnerable. El parche vive en el tarball oficial de SheetJS.
- **Plan sugerido:** migrar la dependencia al **CDN oficial de SheetJS**
  (`https://cdn.sheetjs.com/`) o reemplazar por `exceljs` donde aplique.
  Mientras tanto, **no procesar hojas de cálculo de origen no confiable** sin
  validación previa. Requiere cambio de código → fuera de alcance de higiene.

### 4. `uuid` (<11.1.1) vía `@fortune-sheet/core`, `@fortune-sheet/react`, `exceljs` — **moderate** · **sin fix**
- **Advisory:** falta de verificación de límites de buffer en v3/v5/v6 **cuando
  se pasa `buf`** (GHSA-w5hq-g745-h8pq).
- **Por qué:** son deps transitivas; los paquetes padre fijan un `uuid` viejo.
  `npm audit` reporta *No fix available*.
- **Exposición real: baja** (el patrón vulnerable requiere pasar `buf`, uso poco
  común).
- **Plan sugerido:** esperar a que `@fortune-sheet`/`exceljs` actualicen `uuid`,
  o reemplazar `@fortune-sheet` (usado por el módulo de hojas). Revisar en la
  siguiente ronda de dependencias.

## Cómo reproducir

```bash
npm ci
npm audit                 # estado actual
npm audit fix             # SOLO correcciones no-breaking (ya aplicado)
# NUNCA: npm audit fix --force   (rompe la app: sqlite3@6, next fuera de rango)
```
