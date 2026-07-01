# Landing — Auditoría de honestidad (FASE 0)

> **Objetivo:** que la landing diga la **verdad** de lo que AXOS hace hoy, **sin tocar la estética**
> (gradientes, tipografía, layout, animaciones, orbes, colores se quedan 100%). Sólo cambia el
> **contenido**: quitar afirmaciones de funciones que la app ya no tiene y reencuadrar el mensaje
> hacia lo que AXOS **sí** hace.
>
> **Estado:** FASE 0 (auditoría). **No se ha cambiado ningún copy todavía.** Este documento se
> entrega para aprobación del owner antes de aplicar FASE 1.

---

## 0. Método de verificación

Cada afirmación se contrastó contra el **código real** del repo (rutas existentes, módulos con
backend, historial de git), no contra el brief de marketing.

- **Rutas:** `apps/web/src/app/dashboard/**/page.tsx` (inventario completo de rutas).
- **Historial:** `git log` — commit `e69f7cd chore: remove Office suite + lib/office + documents shell (FASE 1)` y PR #922 `remove-office-shells`.
- **SAP:** `DECISIONS.md` §133 — `SapAdapter.postGoodsIssue261` es un **stub** (`SENT_STUB` = "contrato generado, no confirmación SAP real"; "sin conector SAP real").
- **Superficie auditada (alcance del task):** `apps/web/src/app/page.tsx`, `apps/web/src/components/landing/LandingBento.tsx`, `apps/web/src/components/landing/LandingMockup.tsx`, `apps/web/messages/en/landing.json`, `apps/web/messages/es/landing.json`.

### Leyenda de veredictos

| Símbolo | Significado | Acción |
|---|---|---|
| ✅ **VERDAD** | AXOS lo hace hoy (ruta/módulo real verificado) | Se queda |
| ❌ **HUMO** | Módulo borrado, función inexistente, o afirmación falsa | Quitar / reescribir |
| ⚠️ **ILUSTRATIVO** | Mockup/dato de ejemplo de algo real, sin etiquetar como ejemplo | Se queda, **marcado como ejemplo** |
| 🟠 **POSICIONAMIENTO** | Afirmación cuya verdad depende de una decisión estratégica del owner | Requiere aprobación (ver §3) |

---

## 1. Qué ES AXOS hoy (verificado en código)

**Rutas reales del piso** (todas existen y con backend): `operador` (MES), `inventory`,
`material-staging`, `cycle-counts`, `backflush`, `packing`, `shipping`, `traffic`, `quality` +
`quality/holds` (MRB), `genealogy`, `mission-control` / `control-tower` (torre), `line-engineering`
(CAD 2D⇄3D), `intelligence` (IA/CIDE), `mrp`, `npi`, `bom`, `routing`, `models`.

**Módulos ERP reales** (con backend, no stubs): `erp` + `erp/fin`, `erp/mm`, `erp/pp`, `erp/sd`
(códigos estilo SAP: FI/MM/PP/SD), con estados de resultados, valuación, órdenes de compra,
requisiciones y corridas MRP.

**Integración SAP:** existe el **contrato** de movimiento 261 (backflush/goods-issue) vía outbox,
pero el **conector es un stub** — no hay posteo real a SAP todavía (`DECISIONS.md` §133).

> **Tensión clave:** el principio rector del task define AXOS como *"una capa sobre SAP + MES … NO es
> un ERP"*, pero el código **sí** contiene un ERP real (`erp/fin/mm/pp/sd`) además de otros módulos
> administrativos (`crm`, `finance`, `rh`, `legal`, `expenses`, `fixed-assets`, `skills`) que **siguen
> presentes** en el repo. Esto es una **decisión de posicionamiento** que sólo el owner puede cerrar
> (ver §3), no una corrección mecánica.

---

## 2. Hallazgos por superficie

### 2.1 HUMO confirmado — "Office" (módulo borrado)

Office se eliminó del código (commit `e69f7cd`, PR #922). **No queda ninguna ruta `/dashboard/office`
ni link a ella** — pero la landing **sigue vendiendo "Office" como pilar** en 4 lugares de texto:

| # | Superficie | Clave i18n | Texto actual (EN / ES) | Veredicto | Acción |
|---|---|---|---|---|---|
| H1 | Hero badge | `hero.badge` | `… · MES · **Office** · CAD · AI …` | ❌ HUMO | Quitar "Office" del badge |
| H2 | Hero pills | `heroPills[5]` | `"Native Office"` / `"Office nativo"` | ❌ HUMO | Quitar el pill (o reemplazar por capacidad real de piso) |
| H3 | Footer stack | `footer.stack` | `"ERP · MES · **Office** · CAD · AI"` | ❌ HUMO | Quitar "Office" |
| H4 | FAQ (respuesta) | `faq.items[3].a` | `"… módulos de ERP, MES, **Office**, CAD, calidad …"` | ❌ HUMO | Quitar "Office" de la lista |

> No hay links muertos en la landing hoy — el problema de Office es puramente **textual** (menciones a
> un pilar que ya no existe).

### 2.2 ILUSTRATIVO — datos fabricados sin etiquetar

Todos estos son gráficos decorativos (`aria-hidden`) que **ilustran capacidades reales** (OEE,
throughput, FPY, andon, trazabilidad, e-kanban, backflush — todos módulos verificados). Según el
criterio del task (§2.3): la capacidad existe → el número puede quedarse **como ejemplo**, pero debe
**etiquetarse** para no afirmar métricas reales de un cliente.

| # | Archivo | Elemento | Dato hardcodeado | Veredicto | Acción |
|---|---|---|---|---|---|
| I1 | `LandingMockup.tsx` | KPIs | OEE 94.2%, Throughput 1,284/h, On-time 98.6%, FPY 99.1% (+2.1/+5.4/+0.8/+1.2) | ⚠️ ILUSTRATIVO | Añadir etiqueta discreta "Vista de ejemplo" al mockup |
| I2 | `LandingMockup.tsx` | Andon por línea | SMT-1 96%, SMT-2 91%, FINAL-A 68%, TEST-1 99% | ⚠️ ILUSTRATIVO | Cubierto por la etiqueta del mockup |
| I3 | `LandingBento.tsx` | Anillo OEE | 94% | ⚠️ ILUSTRATIVO | Etiqueta "ejemplo" en la sección bento (eyebrow) |
| I4 | `LandingBento.tsx` | e-kanban / plan-a-piso / hold | NPs, WO-4821, "Publicada · 1,200 u" | ⚠️ ILUSTRATIVO | Cubierto por la etiqueta de la sección |
| I5 | `LandingBento.tsx` | CIDE (IA) | Q: "¿Por qué cayó el FPY en SMT-2 ayer?" + respuesta inventada | ⚠️ ILUSTRATIVO | Cubierto por la etiqueta de la sección |

> **Nota:** el FAQ ya dice *"la demo debe tratarse como muestra … no se muestran métricas comerciales
> inventadas"*, así que sólo falta reflejar eso **visualmente** en el mockup/bento con una etiqueta
> mínima (no cambia el diseño).

### 2.3 VERDAD — afirmaciones que se quedan (verificadas)

| Superficie | Clave | Por qué es verdad (ruta/evidencia) | Veredicto |
|---|---|---|---|
| Flow (6 pasos) | `flow.steps.*` | Design·NPI (`npi`), Planning, Materials (`material-staging`), Production, Quality (`quality`), Logistics (`shipping`/`traffic`) | ✅ |
| Galaxy · Inventario | `galaxy.programs.inventory` | "Kitting, e-kanban y conteos cíclicos" → `inventory`, `cycle-counts` (núcleo del producto real) | ✅ |
| Galaxy · MES | `galaxy.programs.mes` | "Poka-yoke, backflush y andon" → `operador`, `backflush` | ✅ |
| Galaxy · Calidad·MRB | `galaxy.programs.quality` | "Holds, cuarentena y disposición MRB" → `quality/holds` | ✅ |
| Galaxy · CAD | `galaxy.programs.cad` | "Layout 2D⇄3D" → `line-engineering` (commits CAD recientes) | ✅ |
| Galaxy · Control Tower | `galaxy.programs.controlTower` | `mission-control` / `control-tower` | ✅ |
| Galaxy · IA·CIDE | `galaxy.programs.ai` | `intelligence` (analytics/autopilot con backend) | ✅ |
| Platform (6 features) | `platform.features.*` | controlTower, inventory, mes, quality, architecture, roles → todas con ruta real | ✅ |
| Why (3 de 4) | `why.items.{planToFloor,traceability,ai}` | Plan→piso, trazabilidad as-built/where-used, IA con contexto | ✅ |
| Solutions (3) | `solutions.items` | Trazabilidad/genealogía, Plan→piso, BOM/ingeniería | ✅ |
| Enterprise | `enterprise.*` | Aprobación de cuentas, roles, sesión firmada HMAC/HttpOnly | ✅ (claims de seguridad) |
| FAQ (Q2, Q3) | `faq.items[1,2]` | Demo solo-lectura sin datos reales; login con aprobación | ✅ (ya honestos) |
| FinalCTA | `finalCta.*` | "sin promesas infladas" | ✅ |

### 2.4 POSICIONAMIENTO — afirmaciones que dependen de decisión del owner (§3)

| # | Superficie | Clave | Texto actual | Tensión |
|---|---|---|---|---|
| P1 | Hero título | `hero.titleLead/Highlight` | "El sistema operativo que corre **toda tu planta**" | "toda tu planta" vs. producto = capa de **flujo de piso** |
| P2 | Hero subtítulo | `hero.subtitle` | "… sobre una base de datos común — **sin silos ni integraciones frágiles** …" | Contradice §1 ("capa **sobre** SAP+MES" = SÍ integra con SAP) |
| P3 | Why · DB | `why.items.db` | "Una sola base de datos … **sin integraciones frágiles**" | Igual que P2 |
| P4 | Galaxy · ERP | `galaxy.programs.erp` | "Compras, materiales y finanzas integradas" | §1 dice "NO es un ERP", pero el módulo ERP **existe** en código |
| P5 | FAQ Q1 | `faq.items[0].a` | "La **ambición** … operar como ERP y MES" | Ya hedge-ado con "ambición"; ¿mantener o suavizar? |
| P6 | FAQ Q4 | `faq.items[3].a` | "capacidades **nativas** … no integraciones externas" | Contradice §1 (SAP layer) + menciona Office (ya en H4) |

---

## 3. Decisión de posicionamiento (necesita aprobación)

El código muestra **dos identidades a la vez**: un "OS industrial que reemplaza ERP+MES+CAD+AI"
(lo que dice la landing hoy) **y** una "capa de flujo de piso sobre SAP+MES" (lo que dice el §1 del
task). No puedo elegir esto solo — cambia el thesis completo de la landing. Dos caminos:

### Opción A — Reencuadre completo al §1 (capa sobre SAP+MES)
- Líder del mensaje: **kitting, backflush, conteos cíclicos, empaque, embarque/tráfico** — el flujo de
  materiales en piso.
- Suaviza "reemplaza tu ERP" → **"se integra con tu SAP + MES"**; quita "sin integraciones frágiles".
- "toda tu planta" → **"tu piso de producción"**.
- De-enfatiza ERP/CAD/AI como pilares co-iguales.
- **Riesgo:** contradice el ERP real que sí existe en el repo; es el cambio más grande.

### Opción B — Honestidad manteniendo la amplitud (mínimo viable)
- Sólo lo **inequívoco**: quitar Office (H1–H4), etiquetar datos de ejemplo (I1–I5).
- Suavizar los absolutos: "sin integraciones" → "se integra donde ya corres SAP"; "toda tu planta" →
  "tu operación de producción".
- Mantiene ERP/MES/CAD/AI como pilares (todos verificados como reales).
- **Riesgo:** sigue vendiendo "OS que lo reemplaza todo", que es más ambicioso que el §1.

### Opción C — Híbrido (recomendado)
- **Aplicar ya** todo lo inequívoco: Office (H1–H4) + etiquetas de ejemplo (I1–I5). Cero controversia.
- **Suavizar** los absolutos de P1–P3 hacia lenguaje compatible con SAP y liderado por el piso, sin
  borrar los módulos ERP/CAD/AI que existen.
- **Reconciliar** P4/P6 quitando Office y ajustando "sin integraciones" → "integra con SAP".
- Resultado: floor-first + honesto sobre SAP, **sin negar** módulos que sí están construidos.

---

## 4. Propuesta de copy (para los ítems inequívocos + suavizado C)

> Sólo se editan **valores de texto** en `landing.json` (EN+ES) y se añade **una etiqueta mínima** en
> el mockup/bento. **No** se toca layout, colores, animaciones ni estructura.

### 4.1 Office (H1–H4) — quitar en ambos idiomas

| Clave | Antes | Después (propuesto) |
|---|---|---|
| `hero.badge` (EN) | `Industrial OS · ERP · MES · Office · CAD · AI — on a single platform` | `Industrial OS · ERP · MES · CAD · AI — on a single platform` |
| `hero.badge` (ES) | `Industrial OS · ERP · MES · Office · CAD · IA — en una sola plataforma` | `Industrial OS · ERP · MES · CAD · IA — en una sola plataforma` |
| `heroPills[5]` (EN/ES) | `Native Office` / `Office nativo` | **Reemplazar** por `Kitting` / `Kitting` (capacidad real) — o eliminar el pill |
| `footer.stack` (EN/ES) | `ERP · MES · Office · CAD · AI` | `ERP · MES · CAD · AI` |
| `faq.items[3].a` (EN) | `… ERP, MES, Office, CAD, quality, analytics and AI …` | `… ERP, MES, CAD, quality, analytics and AI …` |
| `faq.items[3].a` (ES) | `… ERP, MES, Office, CAD, calidad, analítica e IA …` | `… ERP, MES, CAD, calidad, analítica e IA …` |

### 4.2 Etiqueta "ejemplo" (I1–I5) — adición mínima

- **`LandingMockup.tsx`:** añadir una etiqueta discreta en el title-bar del mockup, p. ej. un chip
  `Vista de ejemplo` / `Example view` (misma tipografía/tokens existentes, sin cambiar el diseño).
- **`LandingBento.tsx`:** añadir al eyebrow o subtítulo una nota `· datos de ejemplo` / `· sample data`.
- Nuevas claves i18n sugeridas: `mockup.sampleBadge`, `bento.sampleNote` (EN+ES).

### 4.3 Suavizado de absolutos (P1–P3, sólo si se aprueba Opción C/A)

| Clave | Antes (ES) | Después (propuesto, ES) |
|---|---|---|
| `hero.subtitle` | "… **sin silos ni integraciones frágiles**, con la operación completa en una pantalla." | "… **conectado a tu SAP + MES** donde ya lo corres, con la operación de piso en una pantalla." |
| `why.items.db.body` | "Del diseño al embarque **sin integraciones frágiles** ni silos …" | "Del diseño al embarque sobre una base común, **integrado con tu SAP**, sin silos entre departamentos." |
| `faq.items[3].a` | "capacidades **nativas** … no integraciones externas" | "capacidades nativas del repo **que se integran con SAP** (p. ej. el contrato de movimiento 261)…" |

*(El equivalente EN se ajusta en paralelo con las mismas claves.)*

> El título "toda tu planta / your whole plant" (P1) se deja a decisión explícita del owner: mantener,
> o cambiar a "tu piso de producción / your production floor".

---

## 5. Plan de FASE 1 (tras aprobación — aún NO ejecutado)

1. Quitar todas las menciones a **Office** (H1–H4) en `messages/{en,es}/landing.json` y `heroPills`.
2. Añadir etiqueta **"ejemplo"** al mockup (`LandingMockup.tsx`) y nota al bento (`LandingBento.tsx`)
   vía claves i18n nuevas — sin tocar estilos.
3. Aplicar el **suavizado de posicionamiento** aprobado (Opción A / B / C) — sólo valores de texto.
4. **No** tocar sistema de diseño, layout, animaciones, colores.

### Gate (obligatorio antes del PR)
- `npx turbo run build` ✅ (incluye `next build` → typecheck)
- `npx turbo run lint` ✅ (ESLint)
- Sin links muertos (ya verificado: 0 hoy; re-verificar tras cambios).
- Tema claro y oscuro OK.
- Commit limpio: revertir cualquier auto-fix de lint no relacionado.

### Reglas
- Frontend puro. Rama de trabajo: `claude/axos-landing-honesty-jgrawu` (rama designada por el harness;
  el task mencionaba `ux/landing-honesty`, pero se respeta la designada). **UN PR, sin mergear.**

---

## 6. Resumen ejecutivo

- **1 humo inequívoco:** "Office" (módulo borrado) sigue vendido en 4 lugares → quitar. **Cero links
  muertos** en la landing hoy.
- **5 grupos ilustrativos:** datos hardcodeados de capacidades reales → etiquetar como "ejemplo".
- **1 decisión del owner:** posicionamiento "OS que reemplaza todo" vs. "capa de flujo de piso sobre
  SAP+MES" — el código soporta ambos; recomiendo la **Opción C (híbrido)**.
- **La mayoría de la landing ya es verdad** (flujo, galaxy, platform, solutions, enterprise, FAQ Q2–Q3).

**➡️ Se requiere aprobación del owner antes de FASE 1** (especialmente la decisión §3).
