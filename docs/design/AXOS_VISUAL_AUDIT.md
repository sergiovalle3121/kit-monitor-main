# AXOS OS — Auditoría Visual

> Estado del lenguaje visual **antes** de la "Renovación Visual" y la deuda
> detectada. Este documento es el diagnóstico; el plan correctivo vive en
> [`AXOS_DESIGN_LANGUAGE.md`](./AXOS_DESIGN_LANGUAGE.md).
>
> Fecha de la auditoría: 2026‑06. Alcance: `apps/web`.

## 1. Resumen ejecutivo

AXOS ya tiene una base de diseño **buena y madura**: un sistema de tokens
semánticos (claro/oscuro como inverso fiel), una familia de íconos única
(lucide, grosor 1.75), un material translúcido reutilizable (`.glass`) y un
lenguaje de "losetas" por dominio (`IconTile`) que da identidad consistente al
hub, los encabezados de página y las notificaciones.

El problema **no es falta de sistema**, sino **exceso de energía visual**: mucha
saturación, varios acentos compitiendo, halos/`glow` de color sobre casi cada
superficie y una tipografía base genérica (`Arial`). El resultado se siente
"moderno y llamativo" en lugar de "caro y calmado".

La renovación es de **refinamiento**, no de reconstrucción. No se crean pantallas
nuevas ni se duplican shells. Se baja la saturación, se unifica a **un acento de
sistema**, se reduce el `glow` y se sube la jerarquía y la materialidad.

## 2. Inventario del sistema actual

| Capa | Dónde vive | Estado |
| --- | --- | --- |
| Tokens semánticos (color) | `src/app/globals.css` (`:root`, `.dark`) | ✅ Sólido. HSL, claro/oscuro espejo. |
| Mapeo a Tailwind v4 | `globals.css` (`@theme inline`) | ✅ Correcto. |
| Acento de sistema | `--primary` (índigo `239 84% 67%`) | ⚠️ Existe pero compite con los colores de dominio y con violetas hardcodeados. |
| Paleta por dominio | `src/lib/design/domains.ts` | ⚠️ 15 dominios, muy saturados, `glow` de color en cada loseta. |
| Loseta de ícono | `src/components/ui/IconTile.tsx` | ✅ Buen patrón; hereda la saturación/`glow` de `domains.ts`. |
| Material translúcido | `globals.css` (`.glass`, `.premium-glass`, `.apple-card`) | ⚠️ Tres materiales que se solapan; halo índigo en `.glass`. |
| Fondo ambiental | `.aurora-bg` + `AuroraBackground` | ⚠️ Blobs pastel saturados (morado/azul/verde) en las esquinas. |
| Tipografía | `body { font-family: Arial, Helvetica }` | ❌ Genérica. Sin escala tipográfica definida. |
| Movimiento | `src/lib/motion.ts` | ✅ Spring/ease consistentes, respeta `reduced-motion`. |
| Chrome del dashboard | `DashboardShell` + `DashboardTopBar` + `DashboardDock` | ✅ Montados una sola vez en el layout. |
| Navegación | `DashboardDock` (bottom floating) | ⚠️ Único patrón primario también en desktop. |
| Búsqueda global | `SearchPalette` (`⌘K`) | ✅ Muy completa; ⚠️ acento violeta intenso. |

## 3. Tokens existentes (lo que NO hay que reinventar)

- **Color:** `--background`, `--foreground`, `--card`, `--surface`, `--muted`,
  `--border`, `--input`, `--primary`, `--ring`, estados `--success/-warning/-danger`.
- **Radios:** `--radius` (= `--border-radius-custom`, `1rem`). En la práctica se
  usan radios sueltos (`rounded-2xl`, `rounded-3xl`, `rounded-[2rem]`).
- **Sombra:** no hay escala de elevación tokenizada; cada componente define su
  `box-shadow` (a menudo con tinte de color).
- **Spacing / type scale:** se apoya en las utilidades por defecto de Tailwind,
  sin una escala documentada propia.

## 4. Deuda visual detectada

### 4.1 Demasiados acentos compitiendo
- `--primary` es índigo, pero hay **violetas hardcodeados** por toda la UI
  (`violet-500`, `rgba(124,92,255,…)`, `text-violet-500`, `bg-violet-100`) en
  topbar, paleta de búsqueda y badges, en lugar de referenciar el token.
- `viewport.themeColor = "#7c3aed"` (morado neón) no coincide con el acento
  índigo del producto.
- La paleta de dominio aporta **15 colores** más; sumados a los violetas, la
  pantalla nunca descansa en un neutro.

### 4.2 Saturación alta / sensación "neón"
- `domains.ts` usa tonos muy vivos: `plan #7c5cff`, `staging/messaging #0a84ff`,
  `production #ff7a45`, `people #ff4d8d`, `mes #22b8cf`. Sobre tarjeta clara
  lucen como stickers brillantes, no como pigmentos premium.
- Cada `IconTile` añade `box-shadow: 0 6px 14px ${solid}40` → **halo de color**
  en cada loseta (hub, KPIs, encabezados, notificaciones, paleta).

### 4.3 Exceso de `glow`
- `.glass` arrastra un halo índigo (`rgba(99,102,241,…)`) en su sombra.
- El buscador de la topbar usa `hover:shadow-[0_0_0_4px_rgba(124,92,255,0.08)]`
  y fondo/borde violeta → "anillo neón".
- Las tarjetas de área del hub pintan un `blur-2xl` del color del dominio en la
  esquina (`opacity-20 → 40` en hover).
- `.aurora-bg` mantiene tres blobs pastel saturados siempre visibles.

### 4.4 Jerarquía tipográfica débil
- Fuente base `Arial` → look "sistema operativo viejo", no "software caro".
- Sin escala tipográfica documentada; tamaños y pesos elegidos ad‑hoc por página.

### 4.5 Materiales solapados
- `.glass`, `.premium-glass` y `.apple-card` resuelven lo mismo con parámetros
  distintos (blur 22 vs 64 vs 20, bordes y sombras propios). Falta una sola
  jerarquía de elevación.

### 4.6 Navegación
- El **dock flotante inferior** es el patrón primario también en desktop, donde
  una barra lateral estructurada comunicaría mejor jerarquía y "software serio".
  (Cambio mayor → se evalúa en fase aparte para no romper la UX actual.)

## 5. Lo que SÍ está bien (conservar)

- Tokens semánticos claro/oscuro como espejo fiel.
- Sistema de losetas por dominio como **identidad** (solo hay que calmarlo).
- Familia de íconos única + grosor único (`ICON_STROKE`).
- Movimiento consciente de `prefers-reduced-motion`.
- Chrome compartida montada una vez (`DashboardShell`).
- `SearchPalette` ya jerarquiza por área/tipo y es accesible (combobox/listbox).

## 6. Prioridades de la renovación

1. **Un acento de sistema** (índigo) para TODO el cromo interactivo; los colores
   de dominio quedan solo como **firma** de identidad, desaturados.
2. **Bajar saturación** de la paleta de dominio (~15–25 % menos chroma).
3. **Reducir `glow`**: sombras de loseta más materiales, `.glass` y `.aurora`
   más neutros, quitar el anillo neón del buscador.
4. **Tipografía premium** (stack de sistema refinado) + escala documentada.
5. **Tokens de elevación y borde** para unificar materialidad.
6. **(Fase posterior)** evaluar navegación lateral en desktop.

Todo lo anterior es **aditivo y de bajo riesgo**: cambia el "tono", no la
arquitectura ni la estructura de las pantallas.
</content>
</invoke>
