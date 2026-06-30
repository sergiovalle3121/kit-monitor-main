# BUILD-FIX-REPORT — `main` compila en verde de forma reproducible

**Rama:** `claude/fix-main-build-wf7341` (rama dedicada desde `main`; **no** se mergea — un solo PR para revisión del owner).
**Fecha:** 2026-06-30
**Objetivo:** que `npm ci && npm run build` pase limpio en `apps/api` y `apps/web` desde cero, con la versión de Node fijada y alineada a producción, **sin silenciar errores ni tocar DB/auth/tenancy**.

---

## TL;DR

El build **no estaba roto en el código**. Estaba roto en el **entorno**: nada fijaba la versión de Node, así que el Codespace arrancaba con su default de imagen base (**Node 16.20.2**), por debajo del mínimo que exige el stack (**Node ≥ 20.9.0**). En Node 20 y Node 22, `npm ci && npm run build` pasa **verde** en ambos apps, con los 1190 tests unitarios del API en verde y el lint de web sin errores.

El arreglo es **solo de configuración** (fijar Node de forma reproducible). **No** se tocó ninguna zona prohibida (migraciones, entidades, `orm.options.ts`/`synchronize`, auth, guards, tenancy, ni lógica de negocio) — no hizo falta, porque no había ningún error de tipos/código real que arreglar.

---

## 1. Reproducción del fallo (antes de cambiar nada)

Se hizo una reproducción limpia (`rm -rf node_modules dist .next` → `npm ci` → `npm run build` por app).

| Entorno | `npm ci` | `apps/api` build | `apps/web` build |
|---|---|---|---|
| **Node 16.20.2** (default del Codespace) | — | ❌ falla | ❌ **falla** (causa raíz) |
| **Node 20.20.2** (= CI) | ✅ | ✅ | ✅ |
| **Node 22.22.2** | ✅ | ✅ | ✅ |

> Nota: en el entorno de verificación había Node 20, 21 y 22 disponibles, pero **no** Node 16. La incompatibilidad con Node 16 está demostrada por (a) el fallo original reportado en el Codespace con Node 16.20.2 y (b) los campos `engines` declarados por las propias librerías (ver §2), que son chequeos **duros** en tiempo de build de Next.

---

## 2. Diagnóstico — causa raíz

**Causa raíz única: versión de Node demasiado vieja, porque el repo no la fijaba en ningún sitio.**

Versiones mínimas que exige el stack (leídas de los `engines` de las propias dependencias instaladas):

| Paquete | Versión instalada | `engines.node` |
|---|---|---|
| `next` | 16.2.4 | **`>=20.9.0`** ← restricción que manda |
| `@nestjs/core` | 11.1.19 | `>= 20` |
| `typeorm` | 0.3.28 | `>=16.13.0` |
| `react` | 19.2.4 | `>=0.10.0` |

La restricción que manda es **Next.js 16 → Node ≥ 20.9.0**. Next.js hace una comprobación de versión y **aborta el build** si el Node es menor; no es un warning. Node `16.20.2 < 20.9.0` ⇒ el build de `apps/web` muere antes de compilar nada.

**Por qué pasaba:** antes de este PR, nada del repo fijaba la versión de Node:

- ❌ no había `.nvmrc`
- ❌ no había `.devcontainer/` (el Codespace caía al Node por defecto de su imagen base → 16.20.2)
- ❌ la raíz `package.json` no tenía `engines`
- ❌ `apps/web/package.json` no tenía `engines`
- ⚠️ `apps/api/package.json` tenía solo `engines.node: ">=18"` — un valor **incorrecto** (el stack necesita ≥20.9.0) y además meramente informativo (npm no lo aplica sin `engine-strict`).

Lo único que ya estaba bien era **CI** (`actions/setup-node` con `node-version: 20`), que es justo por lo que CI estaba en verde mientras el Codespace fallaba: discrepancia de entorno entre CI y dev.

**Descartado explícitamente** (no eran la causa): no hay error de tipos real, ni dependencia rota, ni breaking change de librería introducido por un merge reciente. Se verificó construyendo el `HEAD` actual de `main` (`fa4baef`) en limpio sobre Node 20 → verde. El código compila; lo que faltaba era fijar el Node correcto.

---

## 3. Cambios aplicados (todos de configuración)

| Archivo | Antes | Después | Por qué |
|---|---|---|---|
| `.nvmrc` *(nuevo)* | — | `20` | Única fuente de verdad de la versión de Node para nvm, el Codespace, CI y Railway (RAILPACK lee `.nvmrc`/`engines`). Major `20` = el mismo que ya usaba y validaba CI. |
| `.devcontainer/devcontainer.json` *(nuevo)* | — | imagen `mcr.microsoft.com/devcontainers/javascript-node:20` + `postCreateCommand: npm ci` | **Arreglo directo del fallo reportado:** garantiza que el Codespace levante con Node 20 en vez de caer a 16.20.2. |
| `package.json` (raíz) | sin `engines` | `engines: { node: ">=20.9.0", npm: ">=10" }` | Declara el requisito real del monorepo. RAILPACK también lo lee para elegir el Node de producción. |
| `apps/api/package.json` | `engines.node: ">=18"` | `engines.node: ">=20.9.0"` | Corrige un valor incorrecto: NestJS 11 + el stack necesitan ≥20.9.0, no 18. |
| `apps/web/package.json` | sin `engines` | `engines.node: ">=20.9.0"` | Declara el mínimo que exige Next.js 16; antes no había nada. |
| `packages/contracts/package.json` | sin `engines` | `engines.node: ">=20.9.0"` | Consistencia en todo el grafo de build del workspace. |
| `.github/workflows/ci.yml` | `node-version: 20` (a mano) | `node-version-file: .nvmrc` | Hace de `.nvmrc` la **única fuente de verdad** también para CI, para que CI no pueda divergir del Codespace/Railway. Comportamiento idéntico (`.nvmrc`=`20` resuelve igual que `node-version: 20`); **no debilita ninguna puerta de calidad.** |

### Decisión de versión: ¿20 o 22?
Se fijó **Node 20** (major) porque:
1. Es **exactamente** lo que CI ya usaba y validaba en verde (paridad con la puerta que protege `main`).
2. Satisface todos los `engines` del stack (Next ≥20.9.0, Nest ≥20).
3. Railway despliega con **RAILPACK**, que detecta el Node desde `engines`/`.nvmrc` — al fijarlos, producción queda alineada con dev y CI.

Se fija el **major** (20), no un patch exacto: la regresión era 16 vs 20; 20.19 vs 20.20 no afecta el build, y fijar el patch en cuatro sitios distintos (nvm/devcontainer/CI/Railway) introduce drift sin beneficio real.

### Lo que NO se hizo (a propósito)
- **No** se añadió `engine-strict=true` en un `.npmrc`. Habría hecho fallar `npm ci` de forma ruidosa en Node viejo (deseable), pero `engine-strict` también valida los `engines` de dependencias transitivas y puede romper instalaciones por paquetes de terceros con rangos raros. El riesgo no compensa: el `.devcontainer` ya garantiza el Node correcto en el Codespace, y Next imprime un error de versión claro si alguien fuerza un Node viejo a mano.
- **No** se cambió ningún `// @ts-nocheck`, `ignoreBuildErrors`, `eslint.ignoreDuringBuilds`, ni se borró ningún test. No se silenció nada.

---

## 4. Verificación (build limpio desde cero, Node 20)

Ejecutado sobre el `HEAD` actual de `main` con todos los cambios aplicados:

```
rm -rf node_modules apps/*/node_modules packages/*/node_modules apps/api/dist apps/web/.next packages/contracts/dist
npm ci                       # ✅ OK, sin errores EBADENGINE
cd apps/api && npm run build # ✅ OK (nest build)
cd apps/web && npm run build # ✅ OK (next build, 119 páginas generadas)
```

| Puerta | Resultado | Nota |
|---|---|---|
| `npm ci` (raíz, incluye `postinstall` que compila el API) | ✅ verde | |
| `apps/api` `npm run build` | ✅ verde | |
| `apps/web` `npm run build` | ✅ verde | 119 rutas |
| `apps/api` `npm test` (jest) | ✅ **173 suites / 1190 tests** | sin cambios vs. base |
| `apps/web` `npm run lint` | ✅ pasa (0 errores, 77 warnings preexistentes) | sin cambios vs. base |
| `apps/api` `npm run lint` | ⚠️ exit 1 (igual que antes) | **no-bloqueante en CI** (`continue-on-error`); deuda de formato prettier preexistente (~miles de hallazgos), ver `DECISIONS §13`. No tocado. |
| e2e golden (`apps/web` playwright) | no ejecutado / sin cambios | tenía specs pre-fallando de antes; **no se empeoró ni se tocó**. |

Los cambios son **solo de configuración** (cero archivos de código fuente modificados), por lo que lint/tests quedan **donde estaban**.

---

## 5. Paridad con producción (Railway)

- Los servicios de la app (`apps/api/railway.json`, `apps/web/railway.json`) usan el builder **`RAILPACK`**, que detecta la versión de Node desde `engines`/`.nvmrc`. Al fijar ambos, producción usará el mismo Node 20 que dev y CI ⇒ "compila en mi Codespace" ahora significa "compila en Railway".
- `infra/cide/` es un servicio aparte (motor de inferencia Ollama, Dockerfile propio); no interviene en el build del API/web y no se tocó.

---

## 6. Para revisión del owner — cosas que NO se arreglaron por estar fuera de alcance o en zona sensible

1. **Deuda de lint del API (~miles de hallazgos de formato prettier).** Preexistente, no-bloqueante en CI por diseño (`DECISIONS §13`). Limpiarla es un commit de formato masivo separado; **no se tocó** para no mezclarlo con el fix de build.
2. **Specs e2e golden pre-fallando** (web/playwright). Preexistentes; **no se tocaron ni se empeoraron**.
3. **Vulnerabilidades de `npm audit`** (37 reportadas: 3 low, 14 moderate, 20 high). Fuera del alcance de este fix; `npm audit fix --force` arrastraría cambios mayores de versión con riesgo de breaking changes. Se documenta para decisión del owner.
4. **Ninguna zona prohibida requirió cambios** (migraciones, entidades, `synchronize`, auth, guards, tenancy, lógica de negocio): el build no fallaba por código, así que no hubo nada que silenciar ni que escalar a revisión humana en esas áreas.

---

## 7. Nota sobre el nombre de rama

El prompt original pedía la rama `fix/build-green`. El harness de esta sesión asignó como rama de trabajo obligatoria `claude/fix-main-build-wf7341` (no es `codex/*`, así que respeta esa restricción del prompt). El contenido entregado es idéntico al pedido: rama dedicada desde `main`, sin merge, un solo PR en borrador para revisión del owner.
