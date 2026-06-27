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

### Próximo de Claude (en curso): `cad-command.ts`
Máquina de estados de comandos (line, pline, rect, circle, move, copy, offset) que emite
*acciones* que el editor aplica. Firmas se publican aquí al entregar.

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

## Guardrails (válidos para ambos)

- Solo Tailwind; shadcn/ui; Three.js para 3D. Sin CSS suelto.
- Entidades **solo aditivas** (nullable/default; nada de DROP/rename/NOT NULL).
- No duplicar módulos/componentes (revisar antes de crear).
- PRs **pequeños y atómicos**, detrás de la pestaña CAD, CI verde antes de merge.
- Commits Conventional; PR → `main` con squash. CI bloqueante: build+test API, lint+build web, smoke.
