# CAD AXOS — Roadmap Fase 66–69 y contrato Claude⇄Codex

Documento vivo. Define **qué construimos para que el CAD compita con AutoCAD** (en el
nicho de layout de planta), **cómo nos dividimos** Claude y Codex sin chocar, y el
**contrato de interfaces** que Codex consume.

## Principio rector

No clonamos AutoCAD. Lo igualamos *en el trabajo específico de layout de línea EMS*:
precisión, OSNAP, capas, primitivas, e interoperabilidad de planos. Todo **aditivo**,
detrás de la pestaña **CAD**, sin romper otros módulos (cada merge a `main` despliega a prod).

## División por superficie (acordada)

| | **Claude** (yo) | **Codex** |
|---|---|---|
| Dueño de | Módulos **puros** (`*.ts` + `*.spec.ts`) y **backend** (`apps/api/.../line-engineering`) + entidad | Integración **React/Three** en `Layout3DEditor.tsx` + componentes UI nuevos |
| No toca | El editor gigante (`Layout3DEditor.tsx`) salvo acordado | Los `*.ts` puros y el backend salvo acordado |
| Contrato | Entrego firmas tipadas + tests primero | Consume las firmas; cablea UI/escena/eventos |

Así **solo Codex edita el archivo gigante** y Claude trabaja en archivos nuevos +
backend → conflictos de merge casi nulos.

## Módulos puros ya entregados por Claude (Fase 66, listos para consumir)

Ubicación: `apps/web/src/components/line-engineering/`. Tests: `npx tsx <archivo>.spec.ts`.

### `precision-input.ts`  — entrada numérica estilo CAD
```ts
interface Point { x: number; y: number }
parseCoordinate(raw: string, ctx?: { last?: Point|null; lockedAngleDeg?: number|null }): 
  | { ok: true; point: Point; mode: 'absolute'|'relative'|'polar-absolute'|'polar-relative'|'direct' }
  | { ok: false; error: string }
//  "10,20"  abs · "@5,-3" rel · "30<45" polar abs · "@10<90" polar rel · "25" directa(ang bloqueado)
constrainPoint(last: Point, cursor: Point, opts?: { ortho?: boolean; polarIncrementDeg?: number }):
  { point: Point; angleDeg: number; snapped: boolean }   // ortho / polar tracking
polarPoint(origin, dist, deg) · angleDeg(a,b) · distance(a,b) · normalizeDeg(deg)
```

### `snap-engine.ts`  — OSNAP sobre toda la geometría
```ts
type SnapType = 'endpoint'|'intersection'|'center'|'midpoint'|'perpendicular'|'node'|'nearest'|'grid'
interface SnapScene { segments?; centers?; endpoints?; nodes?; gridSize? }
snap(cursor: Point, scene: SnapScene, opts: { modes?; tolerance: number; from?: Point|null }):
  { point: Point; type: SnapType; distance: number } | null
rectGeometry({x,y,w,h,rotation}) → { corners, edges, center }   // rect rotado → esquinas/aristas/centro
segmentIntersection(s1,s2) · perpendicularFoot(p,s) · nearestOnSegment(p,s)
```

**Codex:** construye `SnapScene` desde estaciones/assets/muros (usa `rectGeometry`) + vértices
del DXF; dibuja el glifo según `type` (cuadro=endpoint, ▲=midpoint, ○=center, ⊥=perpendicular…).

### `cad-command.ts`  — máquina de comandos multi-paso (ENTREGADO)
```ts
type CommandId = 'line'|'polyline'|'rect'|'circle'|'move'|'copy'|'offset'
type DrawAction =                                   // geometría declarativa que el editor aplica
  | { type:'addSegment'; a:Point; b:Point } | { type:'addPolyline'; points:Point[]; closed:boolean }
  | { type:'addRect'; x,y,w,h } | { type:'addCircle'; cx,cy,r }
  | { type:'moveBy'; dx,dy } | { type:'copyBy'; dx,dy } | { type:'offsetBy'; distance }
interface CommandState { id; points:Point[]; prompt:string; done:boolean; emitted:DrawAction[]; awaitingRadius? }
startCommand(id) · feedPoint(state,p) · feedDistance(state,d) · commit(state) · cancel(state) · previewGeometry(state,cursor)
```
**Codex:** en cada click resuelve la coord (con `parseCoordinate` si fue tecleada) → `feedPoint`;
aplica `state.emitted`; usa `previewGeometry` para el rubber-band; `commit` con Enter, `cancel` con Esc.

## Contratos de backend entregados por Claude

- **Capas CAD (Fase 66 #6).** Columna aditiva `layers` en `sf_line_layouts` +
  `layer?: string` opcional en assets y annotations. Expuesto en `GET /layout`
  (`layers: LayoutLayer[]`) y persistido por `PUT /layout` (`layers`, y `layer` en cada
  asset/annotation). `LayoutLayer = { id, name, color, visible, locked }`. Codex ya puede
  cargar/guardar capas reales y asignar objetos a capa — sin más backend.

## Secuencia de fases

- **Fase 66 — Núcleo de precisión.** Entrada numérica + línea de comandos, OSNAP completo,
  ortho/polar, gizmo de transformación con lectura en vivo, sistema de capas real.
- **Fase 67 — Herramientas de dibujo.** Primitivas (línea/polilínea/rect/círculo/arco/región),
  trim/extend/offset/fillet, ruteo manual de conectores con waypoints.
- **Fase 68 — Interop DWG/plot.** Lectura/escritura DWG, DXF de alta fidelidad (arcos/círculos/
  texto/bloques/capas), paper space + plot a escala, PDF **vectorial**.
- **Fase 69 — CAD inteligente (OpenAI-compatible).** Barra de comandos en lenguaje natural
  (function calling), visión para vectorizar planos/fotos, voz en piso (Realtime). Contra el
  **endpoint OpenAI-compatible** que el repo ya usa (CIDE/Ollama) → sigue siendo self-hosted-first.

## Estado de contratos entregados por Claude (consumibles desde `main`)

| Módulo | Fase | Qué da a Codex | Tests |
|---|---|---|---|
| `precision-input.ts` | 66 | parseo `@dx,dy`/`d<a`/directa + ortho/polar | 20/20 |
| `snap-engine.ts` | 66 | OSNAP completo + `rectGeometry` | 14/14 |
| backend `layers` | 66 | columna aditiva + `layer?` en assets/annotations | 44/44 svc |
| `cad-command.ts` | 66/67 | comandos multi-paso → `DrawAction[]` | 18/18 |
| `geom-edit.ts` | 67 | offset/extend/trim/chamfer/fillet | 15/15 |
| backend `line-dxf` | 68 | CIRCLE/ARC + capas CAD en DXF | 10/10 |
| `cad-intent.ts` | 69 | tools OpenAI-compatible + normalizador NL→CAD | 16/16 |

**Pendiente de Claude (backend):** endpoint mediador `POST /line-engineering/cad-intent`
que reciba el texto del usuario, llame al modelo (`CIDE_BASE_URL`, OpenAI-compatible) con
`CAD_TOOLS`, valide la respuesta con `normalizeToolCalls` y devuelva `CadIntent[]` con RBAC.
**Codex** hace la UI del chat-comando y aplica los intents.

## Guardrails (válidos para ambos)

- Solo Tailwind; shadcn/ui; Three.js para 3D. Sin CSS suelto.
- Entidades **solo aditivas** (nullable/default; nada de DROP/rename/NOT NULL).
- No duplicar módulos/componentes (revisar antes de crear).
- PRs **pequeños y atómicos**, detrás de la pestaña CAD, CI verde antes de merge.
- Commits Conventional; PR → `main` con squash. CI bloqueante: build+test API, lint+build web, smoke.
