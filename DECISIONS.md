# AXOS OS — Decisiones de Arquitectura y Supuestos

Registro de decisiones tomadas durante el build autónomo (ADR ligero). Ante
ambigüedad se elige la opción más estándar (SAP / ISA-95 / convenciones del
repo), se registra aquí y se continúa.

---

## 1. Estrategia de ramas y despliegue (rieles de seguridad)

**Decisión:** Todo el desarrollo de esta sesión se realiza y se pushea en la
rama `claude/pensive-wright-cbkuE`. **No se hace auto-merge a `main`.**

**Motivo:** El entorno de ejecución indica explícitamente desarrollar en la rama
designada y no mergear a `main` ni abrir PRs sin permiso del usuario. Además,
cada merge a `main` despliega a producción en Railway corriendo migraciones en
vivo; un auto-merge no supervisado de decenas de módulos es de alto riesgo y
contradice el propio espíritu de los "rieles de seguridad" del brief (proteger
producción). El trabajo queda listo en la rama para revisión y merge por el
equipo; se puede abrir PR cuando se solicite explícitamente.

**ADENDA (2026-06-07):** el usuario otorgó autorización explícita y duradera para
**crear PR y mergear a `main` automáticamente por cada ítem que quede en verde**,
sin pedir confirmación entre ítems ("modo nocturno continuo"). A partir de aquí
el flujo por ítem es: rebanada vertical → puertas de calidad (build+test+lint
verdes, migración aditiva) → commit → push → PR → **merge (squash)** → siguiente.
Los rieles de seguridad siguen vigentes: nunca merge en rojo, solo migraciones
aditivas, jamás `migrate:run`/SQL contra prod. Si el entorno impidiera mergear,
se deja el PR abierto y se anota en `NIGHT_LOG`.

## 2. Migraciones: solo aditivas

**Decisión:** Solo se crean tablas nuevas, columnas NULLABLE o con default, e
índices. Prohibido DROP, rename con datos, narrowing de tipo, o NOT NULL sin
default en tablas con datos.

**Nota sobre `orm.options.ts`:** En producción (con `DATABASE_URL`), el repo usa
`synchronize: true` por defecto (bootstrap de esquema en Railway). Esto significa
que el esquema se materializa desde las entidades, no necesariamente desde las
migraciones. **No se toca esa lógica.** Como consecuencia, la disciplina
aditiva-only es doblemente importante: cualquier cambio de entidad se aplica solo
si es aditivo. Las entidades nuevas crean tablas nuevas; las columnas nuevas son
nullable/con default. No se ejecuta `migration:run` ni SQL contra ninguna base
remota.

## 3. Numeración de folios (T2)

**Decisión:** Servicio central `DocumentNumberingService` con una tabla
`document_sequences` (scoped por `tenant_id` + `plant_id` + tipo de documento).
Formato configurable con tokens (`{PREFIX}`, `{YYYY}`, `{YY}`, `{MM}`, `{SEQ}`),
relleno con ceros configurable, y política de reinicio (nunca / anual / mensual).
Incremento atómico vía `UPDATE ... RETURNING` (Postgres) con fallback
transaccional para SQLite (dev). Build-once / use-everywhere: cualquier módulo
(WO, PO, NCR, ASN, etc.) pide su folio a este servicio.

**Motivo:** El brief lo prioriza en Fase 0 (P0.8 / T2). Hoy la numeración es
ad-hoc por módulo; centralizarla evita colisiones y la hace configurable por
planta, como en SAP (rangos de números por sociedad/planta).

## 4. Mejora Continua / OpEx (Kaizen) — módulo nuevo

**Decisión:** módulo autocontenido `improvement` con entidad
`ImprovementInitiative`, máquina de estados pura
(DRAFT→IN_PROGRESS→IMPLEMENTED→VERIFIED→CLOSED + rework + CANCELLED) y captura de
ahorros estimado/realizado. Folios vía el servicio central de numeración
(`IMPROVEMENT` → `CI-…`).

**Supuestos:**
- **RBAC:** la captura de ideas (crear/editar/transicionar) queda abierta a
  cualquier usuario **autenticado** — un sistema de Kaizen/ideas es participativo
  por diseño. No se inventaron permisos que no existen en el seed; admin omite
  scope. Endurecer con permisos finos (p.ej. `OPEX_VERIFY` para VERIFIED/CLOSED)
  queda como mejora futura cuando exista el catálogo de permisos.
- **Dinero:** se modela como `float` (double precision) por portabilidad
  SQLite/PG y porque son montos de ahorro para reporting, no asientos contables.
  Si se requiere precisión contable, migrar a `decimal` con manejo string.

<!-- Nuevas decisiones se agregan al final con número incremental -->
