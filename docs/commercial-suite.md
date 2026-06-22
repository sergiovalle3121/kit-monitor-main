# Suite Comercial & Cliente 360 (CRM · Proveedores · Cliente cross-área)

> Capa de **profundidad de negocio** añadida sobre el backbone ERP/MES. El
> objetivo: que los módulos de cara al cliente y a la cadena de suministro dejen
> de ser "un formulario con + para capturar 4 datos" y se sientan como el
> software de una EMS transnacional (cuentas 360, contactos, cotizaciones,
> certificaciones, scorecards, vistas cross-departamentales).

Esta nota documenta tres frentes que comparten un mismo **patrón de profundidad**
reutilizable, pensado para replicarse en el resto de los módulos austeros.

---

## 1. El patrón de profundidad (cómo enriquecer un módulo)

Un módulo "se siente como herramienta" cuando tiene, como mínimo:

1. **Maestro rico** — la entidad raíz con los campos que el departamento usa de
   verdad (no 4 columnas): clasificación, estatus de ciclo de vida, dueño,
   términos comerciales, métricas, riesgo, etiquetas, enlaces a otros dominios.
2. **Sub-registros** — tablas hijas que cuelgan del maestro (contactos,
   líneas, certificaciones, actividades), no texto denormalizado.
3. **Vista 360 / detalle** — una pantalla de detalle con pestañas que **agrega**
   todo lo del maestro + sus hijos + métricas calculadas, no sólo una fila.
4. **Analítica** — KPIs reales calculados en el backend (rollups, scorecards,
   tasas), expuestos en la lista y el detalle.
5. **Enlace cruzado** — `*_id` / códigos que tejen el módulo con el resto
   (programa, cliente empresarial, parte, orden de venta…).
6. **Seed funcional** — datos demo creíbles e idempotentes para que la pantalla
   abra llena, no vacía.

Reglas de implementación (ver también `DECISIONS.md`):

- Entidades **sólo aditivas** (columnas nullable o con default; nada de DROP /
  rename / NOT NULL sin default). El esquema en prod se materializa desde las
  entidades (`synchronize: true`), así que cada columna nueva debe ser segura.
- Scoping multi-tenant con `TenantBaseEntity` + el helper de scope del módulo
  (ver `crm/services/crm-scope.ts`) cuando el maestro ya es tenant-scoped.
- Folios vía el servicio central de numeración (`DocumentNumberingService`,
  auto-provisiona cualquier `docType`).
- Frontend **Tailwind-only**, `glass`, `useApi` (SWR) para GET y `apiFetch`
  para mutaciones; cliente API tipado por dominio en `apps/web/src/lib/<dom>.ts`.
- No llamar `Date.now()` en el cuerpo de render (regla `react-hooks/purity`):
  usar un helper a nivel de módulo (`isOverdue`, etc.).

---

## 2. CRM — Suite comercial (front-door de la EMS)

De una sola tabla `crm_opportunities` (cliente/contacto como texto) a una suite:

| Tabla | Qué guarda |
| --- | --- |
| `crm_accounts` | Cliente/cuenta 360: tier (estratégico/A/B/C), tipo, industria, segmento, región, términos, crédito, salud (0-100), riesgo, NPS, `enterprise_customer_code` (puente a operaciones), dueño (account manager). |
| `crm_contacts` | Buying center: área (compras/ingeniería/calidad/dirección…) y rol de compra (decisor/influenciador/campeón/filtro), principal. |
| `crm_activities` | Timeline + tareas (llamada/correo/reunión/visita/nota/tarea) con vencimiento y worklist "mis próximas acciones". |
| `crm_quotes` + `crm_quote_lines` | RFQ→Quote: líneas con EAU (volumen anual), costo y precio; rollup de subtotal/total/descuento, **margen** y **valor anual**; folio `QT-`; ciclo DRAFT→SENT→ACCEPTED/REJECTED. |
| `crm_opportunities` (extendida) | + cuenta, fuente, competidor, línea de producto, siguiente paso, razón de pérdida. |

**Backend:** `AccountsService` (incl. `/crm/accounts/:id/360`), `ContactsService`,
`ActivitiesService` (worklist), `QuotesService` (líneas + recálculo de dinero).

**Frontend:**
- `/dashboard/crm` — pestañas Pipeline · Cuentas · Actividades, 6 KPIs.
- `/dashboard/crm/accounts/[id]` — Cliente 360 (Resumen · Contactos ·
  Oportunidades · Cotizaciones · Actividades) + editor de ~20 campos.
- `/dashboard/crm/quotes/[id]` — constructor de cotizaciones con tabla de
  líneas, margen por línea/global y transiciones.

---

## 3. Proveedores 360 (cadena de suministro)

De `suppliers` (4 campos) a un maestro de cadena de suministro:

- **Supplier extendido (aditivo):** tipo, commodity, `qualification_status`
  (aprobado/condicional/pendiente/descalificado), región, OTD %, PPM,
  responsiveness, `risk_level`, salud financiera, **single-source**, SQE/comprador.
- **`supplier_contacts`** y **`supplier_certifications`** (ISO 9001 / IATF 16949 /
  ISO 13485 / AS9100 / ISO 14001 / RoHS / REACH…) con **vencimiento** y estatus
  derivado (VALID/EXPIRING/EXPIRED) → alertas de compliance.
- **AVL** reutiliza `erp_supplier_prices` (partes que surte el proveedor), sin
  tabla nueva. **SCARs** ya existentes se muestran en el 360.

**Backend:** `SuppliersService.supplier360()` (scorecard IQC/SCAR + contactos +
certificaciones + partes + SCARs), `kpis()` (calificación, OTD/PPM prom.,
en-riesgo, single-source, certs por vencer, SCARs abiertas). Rutas con orden
estático-antes-de-`:id`.

**Frontend:** `/dashboard/suppliers` (KPIs + filtros + scorecard por fila) y
`/dashboard/suppliers/[id]` (Resumen · Contactos · Certificaciones · Partes(AVL)
· SCARs).

---

## 4. Cliente 360 — vista ejecutiva cross-departamental

Módulo **read-only** `customer-insights` (sin tablas nuevas) que unifica a un
cliente a través de los departamentos, aprovechando `enterprise_customers`:

| Sección | Fuente | Llave de unión |
| --- | --- | --- |
| Comercial | CRM (account/opps/quotes) | `crm_accounts.enterprise_customer_code` |
| Programas | `enterprise_programs` | `customer_id` |
| Calidad | `rma_cases` | `customer_name` |
| Entrega | `outbound_shipments` (+ OTD) | `customer_name` |
| Finanzas | `erp_sales_orders` | `customer_code` |

- Índice ejecutivo: `GET /customer-insights` (clientes + rollup).
- Detalle: `GET /customer-insights/:code`.
- Frontend: `/dashboard/customers` y `/dashboard/customers/[code]` (una tarjeta
  por departamento + enlace a la cuenta CRM). Loseta en el hub
  (Control e inteligencia).

Es la demostración de "todos los departamentos en un solo lugar": las secciones
degradan con gracia (muestran 0) cuando un dominio aún no tiene datos del cliente.

---

## 5. Seed demo

`apps/api/src/seed/seed-demo.ts` siembra de forma idempotente y con datos de
dominio público (universo AXOS, `.example`):

- CRM: 6 cuentas, 10 contactos, 9 oportunidades (todas las etapas), 2
  cotizaciones con líneas, 7 actividades (tareas vencidas incluidas).
- Proveedores: 12 maestros enriquecidos, 13 certificaciones (1 vencida, 2 por
  vencer), 7 contactos.
- Cliente 360: órdenes de venta por cliente + RMAs llaveadas a clientes.

`npm run seed:demo` (usa SQLite por defecto, o `DATABASE_URL` para Postgres).

---

## 6. Qué sigue (replicar el patrón)

Módulos candidatos a una vista de detalle 360 / sub-registros con el mismo
patrón: EHS (investigación + CAPA), Legal (renovaciones/obligaciones), Tooling
(vida en disparos + PM), Activos Fijos (cédula de depreciación), Gastos (líneas +
aprobación), Mejora Continua (tablero Kaizen). El backend de varios ya es rico;
el faltante suele ser la **superficie** (detalle + analítica), no el modelo.
