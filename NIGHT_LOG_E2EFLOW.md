# AXOS OS — Night Log · Carril E2E-FLOW (Playwright · un flujo end-to-end que CONECTA)

Bitácora del carril **E2E-FLOW**. Rama `claude/funny-cerf-ln9lqa`.
Fecha: 2026-06-20.

## 1. Objetivo

Ampliar la suite Playwright con **UN** flujo end-to-end que simule el camino real
de una pieza de trabajo por la planta, en **una sola sesión Master y un solo
backend en memoria** (el estado persiste entre páginas), validando en CADA paso
que **el dato del paso anterior reaparece en el siguiente** (que el flujo
**CONECTA**, no solo que cada pantalla carga):

```
login Master → crear modelo → BOM → activar → publicar plan → ver WO en el muro
→ abrir terminal de operador → surtir material como almacén → ver faltante
```

Los specs `01–08` ya prueban cada pantalla **por separado** (cada uno con su
backend fresco). Lo que faltaba —y es lo valioso— es un hilo único que demuestre
que las pantallas se **enganchan** entre sí. Eso es lo que añade `09`.

Alcance del carril: **solo `apps/web/e2e/**`**. No se tocó `ci.yml` ni ningún
componente de feature (`src/**`).

## 2. Qué se construyó

| Archivo | Qué es |
| --- | --- |
| `apps/web/e2e/golden/09-flow-end-to-end.spec.ts` | **El** flujo: un test que recorre 6 rutas con un solo backend stateful y comprueba la conexión en cada salto. |
| `apps/web/e2e/fixtures/mock-backend.ts` | Extendido (ver §4) para que el backend en memoria modele el **surtido a línea** y para que el contexto del operador **derive** material del BOM + surtido (antes estaba hard-codeado). |

### Datos deterministas del flujo (backend fresco por test ⇒ IDs fijos)

- Modelo: **`MDL-FLOW-001`**.
- BOM: **`CMP-FLOW-A`** (cantidad 2 — **con stock** en almacén) y **`CMP-FLOW-B`**
  (cantidad 1 — **sin stock** → será el faltante).
- Estación: **`EST-10`**.

## 3. El mapa de conexiones (qué prueba cada salto, no solo que carga)

| Paso | Pantalla | La conexión que se asserta (dato del paso previo → este paso) |
| --- | --- | --- |
| 1 · Login Master | `/dashboard` | El hub saluda **"Hola, Master."** y muestra las áreas del recorrido (Modelos·NPI, Surtido a línea, Terminal de operador). Se entra a Modelos **clicando el hub** (no por URL). |
| 2 · Crear modelo | `/dashboard/models` → `/models/[id]` | El número tecleado **`MDL-FLOW-001`** aterriza en el detalle, en **Borrador**. |
| 3 · BOM | `/models/[id]` | Las dos partes capturadas aparecen como renglones del BOM del **modelo del paso 2**. |
| 4 · Activar | `/models/[id]` | BOM → **"BOM activo — listo para planeación"**; modelo → pill **"Activo"**. |
| 5 · Publicar plan | `/dashboard/production-plan` | **El modelo del paso 2 aparece como `<option>` en el selector del planeador** (`MDL-FLOW-001`). Se publica una WO para él. |
| 6 · Ver WO en el muro | `/dashboard/production-plan` | La tarjeta de WO lleva `data-model="MDL-FLOW-001"` (modelo → muro). Su **Clear-to-Build = `caution`** y, al desplegar, lista **`CMP-FLOW-B`** en "Faltantes para terminar" (**BOM → muro**: la parte sin stock ya pinta faltante). Se captura el **folio** de la WO. |
| 7 · Terminal de operador | `/dashboard/operator-terminal` | **El folio de la WO del muro** aparece como botón seleccionable (muro → operador). La estación carga el **modelo** de la WO y **espera `CMP-FLOW-B`** como NP esperado (**BOM → operador**). Aún **sin bloqueo**. |
| 8 · Surtir como almacén | `/dashboard/material-staging` | **El folio de la WO** es la WO activa (muro → almacén). "Generar surtido" produce líneas que son **exactamente las partes del BOM** (BOM → surtido). Se **monta** `CMP-FLOW-A` (→ "Montado") y se marca **faltante** `CMP-FLOW-B`. |
| 9 · Ver faltante | `/dashboard/material-staging` | KPI **"Faltantes" = 1**, y el faltante levantó un **llamado de reposición de la MISMA parte** (`CMP-FLOW-B` aparece 2 veces: la línea + el llamado). |
| 9b · Cierre del lazo | `/dashboard/operator-terminal` | **El faltante del almacén llega al operador**: el material en línea queda **`SHORTAGE`** y la terminal **bloquea** con "No puedes avanzar · *Falta material en línea: CMP-FLOW-B*" (**almacén → operador**). |

El hilo conductor que se sigue verbatim a través de 6 pantallas: el **modelo
`MDL-FLOW-001`**, el **folio** de su WO, y la **parte `CMP-FLOW-B`** (la que no
hay en almacén). Si cualquiera de esos tres no reapareciera, el assert
correspondiente fallaría.

## 4. ORO — dónde el flujo se rompe o no conecta

Esto es lo que el carril pidió reportar. Separo **(A) huecos del harness** (el mock
no modelaba algo; sin arreglarlo el flujo se rompe en el test) de **(B) hallazgos
reales de la app** (cómo conecta —o no— el frontend de verdad, lo verdaderamente
valioso).

### A. Huecos del harness que tuve que cerrar (si no, el flujo se rompe en el paso 8–9)

1. **`/material-staging/*` no existía en el mock.** La página de surtido lee
   `/material-staging/kpis`, `/material-staging/replenish`,
   `/material-staging/wo/:woId`, y postea a `/material-staging/generate`,
   `/material-staging/:lineId/{confirm,shortage}`,
   `/material-staging/replenish/:id/transition`. Sin handlers, todo caía al
   `default` (`[]` / `{ok:true}`) ⇒ la página se queda en **"Sin líneas de
   surtido"** para siempre y el paso 8 **no conecta**. Se añadieron handlers
   **stateful** que **explotan el BOM del modelo de la WO** en líneas de surtido
   (así la parte que tecleaste en el BOM es la misma que se monta/falta en línea),
   y que al marcar faltante **levantan un llamado de reposición** de esa parte.

2. **El contexto del operador estaba hard-codeado.** `operatorContext()` devolvía
   `material: { part: 'CMP-1', stagedQty: 200, status: 'OK' }` fijo — **no reflejaba
   el surtido**, así que la pata **almacén → operador no existía** en el harness.
   Se reescribió para **derivar** `npExpected` y `material` del **BOM del modelo de
   la WO + el estado de surtido**: si el almacén marcó faltante, el operador ve
   `SHORTAGE` (rojo) y queda **bloqueado** (`runnable:false` + blocker citando la
   parte). Compatibilidad: para WOs sin BOM/surtido (specs sembrados) cae a un
   default seguro y `04-operator-terminal` sigue verde.

> Ambos son límites del **mock**, no de la app. Pero el #2 toca un hallazgo real:
> ver B5.

### B. Hallazgos reales de la app (el oro de verdad)

- **B1 — "Publicar plan" te manda al carril equivocado para el muro.**
  En el detalle del modelo, la sección "Planes de este modelo" y el enlace
  **"Publicar plan"** llevan a **`/dashboard/planning`**, y cada renglón de plan
  enlaza a **`/dashboard/production`**. Pero la WO que **de verdad** aparece en el
  Muro (y que consumen operador y almacén) la crea el **propio Muro** con su
  "Publicar WO" (`POST /production-plan/publish` → `sf_work_orders`). El "publicar"
  de Planeación (`POST /plans` + `/pick-lists`) es **otro carril** (legacy) que
  produce filas en `/plans` que **nunca** se vuelven `sf_work_orders`. **Resultado:
  seguir la invitación "Publicar plan" desde NPI NO conecta con muro/operador/
  almacén.** El flujo end-to-end solo conecta si publicas en el **Muro**. Es el
  "no conecta" más importante: hay **dos sistemas de publicación en paralelo** y la
  UI empuja al que no alimenta el piso.
  *Acción sugerida (a los dueños de `src/**`):* unificar el CTA "Publicar plan"
  del modelo para que abra el Muro (o que Planeación emita `sf_work_orders`).

- **B2 — El vínculo modelo→WO es un string de número de modelo, y la revisión se
  pierde.** El form del Muro postea `model` como string; la WO nace con
  `revision: 'A'` por defecto sin importar la revisión del modelo/BOM (los nuestros
  eran rev `1.0`). El Clear-to-Build casa el BOM por `bomByModel.get(wo.model)` —
  **solo modelo, ignora revisión**. Una WO rev A puede construirse contra un BOM
  rev 1.0 **sin aviso**. Conecta por modelo, pero el desajuste de revisión es
  silencioso.

- **B3 — Una WO de modelo nuevo nace "no construible" hasta que haya stock, y nada
  en el handoff NPI→planeación lo avisa.** Agregar un componente al BOM **da de
  alta la parte** (`POST /inventory/master-data`) pero **no crea posición de
  inventario**. `/inventory/positions` no devuelve nada para las partes nuevas ⇒
  el Clear-to-Build queda `no-go`/`caution` apenas se publica. El flujo conecta (el
  faltante es real), pero existe un paso implícito y no surfaceado de **"recibir
  stock"** entre NPI y un tablero verde. En el flujo lo modelamos honesto: A con
  stock, B sin él.

- **B4 — El surtido sale "del ruteo de IE", no del BOM directo.** La propia página
  dice *"Genera el kit desde el ruteo de IE"*. En el backend real el kit se explota
  del **ruteo de Ingeniería** (material por estación), que a su vez deriva del BOM.
  O sea **BOM → surtido es de dos saltos** (BOM→ruteo→surtido): si el modelo no
  tiene ruteo, "Generar surtido" no produce nada **aunque el BOM sea válido**. En
  el harness colapso el salto a uno (BOM→líneas en EST-10) para mantenerlo
  hermético; el caveat de producción es la **dependencia del ruteo**.

- **B5 — Que el operador "vea si falta material" depende de un join del backend.**
  El frontend del operador **ya está bien cableado**: pinta `ctx.material.status
  === 'SHORTAGE'` en rojo y bloquea con `ctx.runnable`/`ctx.blockers`. Es decir, la
  UI **puede** mostrarle al operador el faltante del almacén — pero **solo si
  `/operator-terminal/context` une el estado de material-staging**. El punto de
  conexión existe en la UI; que conecte en prod es un **contrato del backend**. (En
  el mock hice ese join para demostrar que la pata de UI funciona; es exactamente
  la promesa que imprime la página de surtido: *"el operador ve si falta
  material"*.)

- **B6 — Lo que SÍ conecta limpio (vale registrarlo).** `/production-plan` es la
  **espina dorsal compartida**: el Muro la publica y **tanto la terminal de
  operador como la página de surtido la leen** para sus selectores de WO. Una WO
  publicada en el Muro es **inmediatamente** seleccionable por operador y
  materialista, con **modelo y folio idénticos**. Esta es la conexión real más
  fuerte y el backbone del flujo. (Además, la terminal recuerda estación+WO en
  `localStorage`, lo que ayuda al lazo almacén→operador al revisitar.)

## 5. Resultados de ejecución (dev server real + Chromium 141, build 1194)

| Corrida | Resultado |
| --- | --- |
| `09-flow-end-to-end` solo | **1/1 ✅** (~13–20 s) |
| Suite completa (`01–08` + `09`) | **12/12 ✅** (49.8 s) — sin regresiones |
| `09 --repeat-each=3` (auditoría de flaky) | **3/3 ✅, 0 flaky** |
| `eslint` (puerta **Lint web**) | **0 errores ✅** (sin hallazgos en `e2e/`) |
| `tsc --noEmit` + `next build` (puerta **Build web**) | **✅** (el `tsconfig` incluye `**/*.ts`, así que el build **type-chequea** el spec; pasa) |

## 6. Determinismo — cómo se sostiene

- **Un solo backend stateful por test** (`installMockBackend` + `loginAsMaster`):
  el modelo creado en el paso 2 vive hasta el paso 9; nada se reinventa.
- **Stock controlado por override** de `/inventory/positions` (A con stock, B sin),
  registrado **después** del mock base (gana), para que el faltante del muro sea
  **real** y no inventado.
- **Sin esperas por tiempo**: todo es `expect` con auto-retry. `test.slow()` solo
  sube la cota superior (6 rutas que `next dev` compila on-demand la 1ª vez).
- **Selectores durables**: se reutilizan los `data-testid` existentes
  (`wo-card`/`wo-ctb`/`model-status-pill`/`bom-*`/`station-input`/`step-badge`…) y,
  donde el DOM es ambiguo y **no hay testid** (filas de surtido, tiles KPI, detalle
  del Clear-to-Build), localizadores semánticos **acotados**: fila por
  `filter({ hasText }).filter({ has: botón }).last()`, KPI por etiqueta única
  (`"Faltantes"` en plural) + `xpath=..`, faltante **scopeado a la tarjeta**. El
  folio se **lee** del `data-folio` y se reusa aguas abajo (conexión verificable,
  no hardcode).
- **IDs en mayúsculas** donde la app normaliza (el form del BOM hace `toUpperCase`),
  así los asserts casan con lo renderizado.

## 7. `data-testid` recomendados (a los dueños de `src/**`)

Mi carril es **solo-e2e**, así que no pude añadir `data-testid` a componentes. La
página de surtido es la más ambigua de localizar; recomiendo, para endurecer:

| Página (src) | Elemento | `data-testid` sugerido |
| --- | --- | --- |
| `dashboard/material-staging/page.tsx` | fila de surtido · badge de estado · botones · tile KPI | `staging-row-<part>` · `staging-status` · `staging-stage`/`staging-short` · `kpi-<label>` |
| `dashboard/material-staging/page.tsx` | tarjeta de llamado de reposición | `replenish-call-<part>` |
| `dashboard/operator-terminal/page.tsx` | panel "Material en línea" | `op-material` (+ `data-status`) |

## 8. Alcance (lo que se tocó)

- **Nuevo:** `apps/web/e2e/golden/09-flow-end-to-end.spec.ts` + este log.
- **Editado:** `apps/web/e2e/fixtures/mock-backend.ts` (endpoints de surtido +
  `operatorContext` derivado; aditivo y retrocompatible — `01–08` siguen verdes).
- **Intacto:** `ci.yml`, `playwright.config.ts`, y **todo `src/**`** (cero cambios
  a componentes de feature).

## 9. Cómo correr

```bash
npm install -w web                                   # deps (una vez)
npx playwright install chromium                       # navegador (una vez)
npm run e2e -w web                                    # toda la suite (01..09)
npm run e2e -w web -- e2e/golden/09-flow-end-to-end.spec.ts            # solo el flujo
npm run e2e -w web -- e2e/golden/09-flow-end-to-end.spec.ts --repeat-each=3   # flaky
```

> En entornos con egress restringido a `cdn.playwright.dev` (como el de CI/web):
> el Chromium 141 (build 1194) viene preinstalado y casa con `@playwright/test@1.56`.
> Apunta `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` si Playwright no lo encuentra.
