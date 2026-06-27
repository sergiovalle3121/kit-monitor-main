# AXOS OS — Lenguaje Visual

> La **única fuente de verdad** del lenguaje visual de AXOS OS. Premium,
> minimalista, sobrio, industrial. "Software caro": calma, jerarquía y
> precisión por encima de efectos.
>
> Diagnóstico previo: [`AXOS_VISUAL_AUDIT.md`](./AXOS_VISUAL_AUDIT.md).

## 0. Principios

1. **Un acento, muchos neutros.** El color se gana, no se reparte. La pantalla
   descansa en grises refinados; el acento índigo marca lo interactivo.
2. **Materialidad, no `glow`.** Profundidad por luz y sombra neutra suave, no por
   halos de color.
3. **Jerarquía antes que decoración.** El tamaño, el peso y el espacio guían el
   ojo; nada brilla "porque sí".
4. **Calma.** Menos saturación, menos movimiento, menos ruido. Industrial = serio.
5. **Identidad por dominio, con disciplina.** Cada departamento conserva su color
   y símbolo como **firma**, pero en tono sobrio y sin neón.
6. **Accesible siempre.** Contraste AA, foco visible, respeta `reduced-motion`.

## 1. Sistema de color

### 1.1 Neutros (la base)
Los neutros son tokens semánticos en `globals.css` (canales HSL). Son el 90 % de
la pantalla. Claro = blancos y gris pizarra; oscuro = *deep slate* (su inverso
fiel). Usar **siempre** vía utilidad (`bg-background`, `text-foreground`,
`bg-card`, `text-muted-foreground`, `border-border`), nunca hex sueltos.

| Rol | Token | Claro | Oscuro |
| --- | --- | --- | --- |
| Fondo app | `--background` | `220 33% 99%` | `222 30% 7%` |
| Texto | `--foreground` | `222 47% 11%` | `210 20% 96%` |
| Tarjeta / superficie | `--card` / `--surface` | `0 0% 100%` | `222 24% 10%` |
| Apagado | `--muted` / `--muted-foreground` | `220 16% 96%` / `220 9% 43%` | `220 18% 15%` / `218 14% 68%` |
| Borde / input | `--border` / `--input` | `220 13% 91%` | `220 16% 22%` |

### 1.2 Acento de sistema (uno solo)
**Índigo** (`--primary`, `--ring`, `--accent`). Es el ÚNICO acento para todo el
cromo interactivo: foco, selección, enlaces, estado activo, buscador, paleta de
comandos, badges de sistema.

- Claro: `239 84% 67%` · Oscuro: `239 72% 70%` (menos chroma para no "quemar"
  sobre el fondo profundo).
- **Regla:** nada de violetas hardcodeados (`violet-500`, `#7c5cff`,
  `rgba(124,92,255,…)`). Si necesitas el acento, usa el token
  (`bg-primary`, `text-primary`, `ring-primary`, `border-primary`) o
  `color-mix(in srgb, hsl(var(--primary)) …%, transparent)`.

### 1.3 Estados semánticos
`--success` (verde), `--warning` (ámbar), `--danger` (rojo). Solo para
significado (éxito/alerta/error), nunca como decoración.

### 1.4 Color por dominio (firma, no neón)
La paleta de `src/lib/design/domains.ts` da **identidad** a cada departamento en
su loseta (`IconTile`), encabezado (`PageHeader`) y notificaciones. Reglas:

- **Desaturada y refinada:** ~15–25 % menos chroma que la versión "viva". Tonos
  más profundos y sobrios; recognocibles, nunca brillantes.
- **Sin halo de color:** la sombra de la loseta es suave y casi neutra
  (materialidad), no un `glow` del color.
- **Solo en la firma:** un número, un valor o un estado interactivo usan el
  **acento de sistema** o un neutro — no el color de dominio.
- **Una familia de íconos** (lucide) y **un grosor** (`ICON_STROKE = 1.75`).

## 2. Tipografía

- **Stack premium de sistema** (sin descarga, rápido y nativo): `--font-sans` =
  `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica
  Neue", Arial, …`. Reemplaza el `Arial` anterior. `antialiased` global,
  `font-feature-settings: "rlig" 1, "calt" 1`, `text-rendering: optimizeLegibility`.
- **Tabular para números** (`tabular-nums`) en KPIs y tablas: alinea cifras.

### Escala tipográfica
| Token | Uso | Clase de referencia |
| --- | --- | --- |
| Display | Hero del hub | `text-4xl md:text-5xl font-bold tracking-tight` |
| H1 página | Encabezado de área | `text-2xl md:text-3xl font-bold tracking-tight` |
| H2 sección | Título de bloque | `text-xs font-semibold uppercase tracking-wider text-muted-foreground` |
| Cuerpo | Texto general | `text-sm` / `text-base` |
| Métrica | Valor KPI | `text-2xl`–`text-4xl font-semibold tabular-nums` |
| Meta | Sub-texto | `text-[11px]`–`text-xs text-muted-foreground` |

Tracking ligeramente negativo en títulos grandes (`tracking-tight`); positivo y
en mayúsculas para etiquetas de sección (`uppercase tracking-wider`).

## 3. Espaciado y radios

- **Espaciado:** escala 4 px de Tailwind. Ritmo recomendado: `gap-4` entre
  tarjetas, `p-5` interior de tarjeta, `mb-8`/`mb-10` entre secciones. Más aire
  = más premium.
- **Radios (`--radius` = 1rem):**
  - Losetas de ícono → ~32 % del lado (squircle).
  - Tarjetas y tablas → `rounded-2xl` (16 px).
  - Tarjetas destacadas / paneles → `rounded-3xl` (24 px).
  - Píldoras / chips / dock → `rounded-full` o `rounded-[2rem]`.
  - Inputs / botones → `rounded-xl` (12 px).
  - **Consistencia:** misma jerarquía de radios en toda la app; no mezclar.

## 4. Sistema de elevación (sombra) y bordes

La profundidad es **neutra** (negro a baja opacidad), nunca tintada de color.
Tres niveles tokenizados en `globals.css`:

| Nivel | Token | Uso |
| --- | --- | --- |
| 0 — reposo | `--shadow-sm` | Tarjetas estáticas, inputs. Borde hairline + sombra mínima. |
| 1 — elevado | `--shadow-md` | Tarjetas interactivas en hover, popovers. |
| 2 — flotante | `--shadow-lg` | Dock, menús, paleta de comandos, modales. |

- **Bordes hairline:** `1px` con `--border`. En vidrio, un highlight superior
  tenue (`inset 0 1px 0 …`) da el canto de medio píxel premium.
- **`.glass`:** material translúcido reutilizable (blur + saturación). Su sombra
  es **neutra y suave** (sin tinte índigo). Es el material por defecto del cromo
  (topbar, dock, tarjetas del hub, menús).

## 5. Movimiento

- Solo `opacity` y `transform` (coste GPU bajo). Spring `stiffness 300 /
  damping 30`; ease no-spring = `cubic-bezier(0.16, 1, 0.3, 1)` (`--ease-out-expo`).
- **Sobrio:** entradas escalonadas suaves, `hover` con *lift* mínimo (`-4px`,
  `scale 1.02`), `press` `scale 0.98`. Nada de rebotes exagerados en UI densa.
- Respeta **siempre** `prefers-reduced-motion` (CSS + `useReducedMotion`).

## 6. Iconografía

- **lucide-react**, grosor único `1.75` (`ICON_STROKE`).
- Sobre loseta de dominio → ícono blanco. Suelto en texto/acciones → `currentColor`
  o `text-muted-foreground`; el acento solo para lo interactivo.
- Tamaños de loseta de referencia: `34` (notificación), `46` (KPI), `52`
  (encabezado de área).

## 7. Reglas por componente

### 7.1 Tarjetas (base / KPI)
- Material `.glass`, `rounded-2xl`/`rounded-3xl`, `p-4`/`p-5`.
- Loseta de dominio arriba; valor en `tabular-nums`; etiqueta en
  `text-muted-foreground`.
- Hover: *lift* mínimo + paso a sombra nivel 1. **Sin** `blur` de color en la
  esquina (o, si se mantiene, casi imperceptible y neutro).
- KPIs en filas simétricas (`KpiRow`); el valor puede tintarse con la firma del
  dominio, el resto neutro.

### 7.2 Contenedores de ícono (`IconTile`)
- Squircle con gradiente **desaturado** del dominio + sombra suave neutra.
- Nunca pintar un ícono sobre gris plano: o loseta de dominio, o ícono neutro.

### 7.3 App shell / topbar
- `.glass` fijo, borde inferior hairline. Logo + `WorkspaceSwitcher` a la
  izquierda; buscador al centro; tema + notificaciones + avatar a la derecha.
- **Buscador:** neutro y calmado (estilo Linear): fondo `black/white` a muy baja
  opacidad, borde hairline, `hover` que sube ligeramente el borde — **sin anillo
  neón ni fondo violeta**. El atajo `⌘K` en `kbd` neutra.

### 7.4 Dock / navegación
- Píldora flotante `.glass`, sombra nivel 2. Activo = píldora sólida
  invertida (`bg-foreground text-background`), no color. Hover neutro.
- En desktop puede convivir, a futuro, con una barra lateral estructurada
  (evaluación en fase aparte; no romper la UX actual).

### 7.5 Modal / paleta de comandos (`⌘K`)
- Sobre `backdrop-blur` con velo neutro (`black/40`). Tarjeta con material
  translúcido y sombra nivel 2.
- Resultados agrupados por área/tipo, con punto de color de dominio como guía.
- **Foco premium:** fila seleccionada con anillo del **acento de sistema** a baja
  opacidad (`ring-primary/25`) y fondo apenas teñido — calmado, no neón.
- Atajos en `kbd` neutras; jerarquía clara (título > subtítulo > badge).

### 7.6 Encabezados de sección/página
- `PageHeader` con loseta de dominio + título `H1` + subtítulo
  `text-muted-foreground`. Acciones alineadas a la derecha.
- Etiqueta de sección: `uppercase tracking-wider text-muted-foreground`.

## 8. Dashboard (hub)

- **Jerarquía:** saludo/hero → fila de KPIs → áreas agrupadas por flujo real →
  actividad reciente.
- **Aire:** ancho contenido (`max-w-5xl`), `gap-4`, secciones separadas con
  `mb-10`. Menos densidad, más calma.
- **Tarjetas de área menos repetitivas:** misma estructura, diferenciadas por la
  firma de dominio; estados `hover`/`active` sobrios (lift + sombra, sin glow).
- **Favoritos / recientes:** aditivo si hay infraestructura; nunca duplicar
  pantallas.

## 9. Tema claro y oscuro

- El oscuro es el **inverso fiel** del claro: mismos componentes, misma
  jerarquía, mismo acento. Solo cambian fondo y texto.
- Un solo switch (`ThemeContext` → clase `.dark`) gobierna toda la app; el primer
  render respeta `prefers-color-scheme` (anti-flash en `layout.tsx`).
- Verificar **ambos** modos en cada cambio visual.

## 10. Checklist de implementación

- [ ] ¿Usa tokens semánticos en vez de hex/violetas sueltos?
- [ ] ¿Un solo acento (índigo) para lo interactivo?
- [ ] ¿Sombra neutra (sin tinte de color)?
- [ ] ¿Saturación de dominio sobria, sin neón?
- [ ] ¿Jerarquía tipográfica clara (`tabular-nums` en cifras)?
- [ ] ¿Radios consistentes con la escala?
- [ ] ¿`hover`/`focus`/`active` definidos y accesibles (AA + foco visible)?
- [ ] ¿Probado en claro y oscuro, y en responsive?
- [ ] ¿`prefers-reduced-motion` respetado?
- [ ] ¿Sin duplicar shells ni componentes existentes?
</content>
