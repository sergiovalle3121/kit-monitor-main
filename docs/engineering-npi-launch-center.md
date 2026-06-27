# NPI Launch Command Center

> Cómo AXOS convierte un paquete de cliente en un proceso manufacturable,
> repetible y liberable a producción. Esta es la guía de la experiencia
> unificada **Product Master ↔ NPI Launch Center** y de los contratos que la
> alimentan hoy (y los que faltan).

## 1. Modelo mental

AXOS separa dos verdades que antes se sentían como dos pantallas sueltas:

```
/dashboard/models          = Product Master   (la verdad del producto)
/dashboard/models/[id]     = ficha del producto + vínculos a launch/BOM/planes
/dashboard/npi             = Launch Center     (la ejecución del lanzamiento)
/dashboard/npi/[id]        = Launch Dossier    (gates + readiness + dependencias)
```

- **Modelos = producto maestro.** `modelNumber`, revisión, cliente, programa,
  estatus, BOM, planes. Es el registro canónico que todo lo demás referencia.
- **NPI = ejecución del lanzamiento.** Un *launch* por `model+revision` que
  orquesta fases (QUOTE→MP), readiness (go/no-go), gates (decisiones) y las
  dependencias de ingeniería que deben cerrarse antes de producir.

No se fusiona el backend: se unifica la **experiencia** con navegación cruzada
(`Modelo → Crear/Abrir launch`, `Launch → Ver modelo`, `Launch → faltantes por
módulo`).

## 2. Las preguntas que el ingeniero NPI debe poder contestar

El Launch Dossier (`/dashboard/npi/[id]`) está diseñado alrededor de estas
preguntas, en este orden:

1. **¿Puedo producir esto mañana?** → *Release banner* (go/no-go global).
2. **¿En qué fase estoy?** → *Phase timeline* (QUOTE→MP, hecho/actual/pendiente).
3. **¿Estoy listo?** → *Readiness panel* (BOM, FAI, línea, tiempo estándar, AVL).
4. **¿Qué falta para liberar?** → *Qué falta para liberar* (bloqueos + verificar).
5. **¿Qué módulos AXOS debo cerrar?** → *Dependencias de ingeniería* (matriz).
6. **¿Puedo pasar el gate?** → *Gates de fase* (decidir PASSED/FAILED/WAIVED).
7. **¿Cómo ha evolucionado?** → *Historial de readiness* (snapshots/auditoría).

## 3. Flujo industrial

```
RFQ / paquete cliente
  → crear/relacionar Product Model (maestro)
  → crear launch NPI (model + revision)        ← idempotente por model+revision
  → cargar/validar BOM
  → validar AVL / proveedores
  → definir routing / tiempos estándar
  → tooling / fixtures / stencils              (pendiente de integración)
  → visual aids / work instructions            (pendiente de integración)
  → calidad / FAI / control plan
  → piloto → yield / scrap
  → aprobar gates (QUOTE→MP)
  → liberar a producción masiva (MP)
```

Inspirado en la lógica APQP/PPAP: *evidencia objetiva antes de liberar a
producción*. AXOS no copia PPAP literalmente, pero sí cierra el triángulo
**producto ↔ proceso ↔ calidad** con readiness advisory y gates auditables.

## 4. Qué datos reales usa hoy

Todo el Launch Center se construye **sin cambios de backend**, sobre contratos
existentes:

| Vista | Endpoint | Notas |
| --- | --- | --- |
| Lista de launches | `GET /npi/projects` | base (sin gates/readiness) |
| Pipeline rail | derivado de `currentPhase` de cada proyecto | cliente |
| Detalle / dossier | `GET /npi/projects/:id` | incluye `gates` + `readiness` en vivo |
| Readiness lookup | `GET /npi/readiness?model=&revision=` | go/no-go ad-hoc |
| Historial | `GET /npi/readiness/history?projectId=` | snapshots |
| Decidir gate | `POST /npi/gates/:id/decide` | advisory |
| Cross-link a modelo | `GET /product-models?search=` | join por `modelNumber` |
| Crear launch desde modelo | `POST /npi/projects` | idempotente |

La **matriz de dependencias** se deriva de los `signals` de readiness:

| Dependencia | Señal usada | Estado posible |
| --- | --- | --- |
| Product Model | lookup por `modelNumber` | conectado / falta |
| BOM | `signals.bomStatus` | conectado / incompleto / falta |
| Material Master / AVL | `signals.avlCoverage` | conectado / incompleto / falta |
| Proceso · Routing | `lineBalancePct`, `lineCompletenessPct`, `stdTimeComplete` | conectado / incompleto / falta |
| Tooling / Fixtures | `signals.toolingAssets` (por programa) | conectado / falta / sin integrar |
| Visual Aids / WI | `signals.visualAidsActive` | conectado / falta |
| Calidad · FAI | `signals.faiStatus` | conectado / incompleto / falta |
| Plan de producción | `signals.productionWorkOrders` | conectado / falta |

**Regla de honestidad** (igual que el agregador backend): una señal que no se
puede resolver se reporta como *falta* o *sin integrar* — **nunca** se asume
buena. No se inventan conteos ni estados.

Las señales de **Tooling**, **Visual Aids** y **Plan de producción** son
*advisory*: se resuelven read-only (conteo de `tooling_assets` por programa del
modelo, `visual_aids` activos por modelo y `sf_work_orders` por modelo) y
enriquecen la matriz, pero **no** se pliegan en `gateReady` (no cambian la
semántica del go/no-go ni de los gates). Tooling es program-scoped: el modelo
canónico aporta su `programId` (desde `pm_product_models`); si el modelo no tiene
programa, la señal queda *sin integrar* honestamente.

## 4.1 Relación modelo ↔ launch (implementado)

`npi_project` lleva una columna `product_model_id` (varchar, nullable, **sin
FK** — mantiene NPI desacoplado del maestro). El servicio la resuelve por
`modelNumber` (case-insensitive, scoped tenant+plant) **al crear** y la
**rellena de forma perezosa al leer** (`getProject`), así los launches previos
quedan enlazados al verse. El frontend usa `project.productModelId` para enlazar
directo a `/dashboard/models/[id]` — sin búsqueda difusa. Cuando no existe modelo
maestro para el número, queda `null` y la matriz lo reporta honestamente.

## 5. Limitaciones actuales

- `GET /npi/projects` no trae `readiness` ni `gates`; las tarjetas de la lista
  muestran fase/estatus, y el go/no-go completo vive en el dossier.
- Las señales de dependencia (tooling, visual aids, plan) son conteos *advisory*:
  enriquecen la matriz pero no se pliegan en `gateReady`.
- "Liberar a MP" es advisory: el banner indica readiness, pero no hay un endpoint
  transaccional de release con checklist + auditoría todavía.

## 6. Contratos backend sugeridos (siguientes PRs)

1. **`GET /npi/projects?withReadiness=true`.** Adjuntar un resumen ligero
   (`gateReady`, `readyCount`, `notReadyCount`) por proyecto para enriquecer las
   launch cards sin N+1 requests.
2. **Risk register NPI.** `npi_risk` con `owner`, `severity`, `dueDate`, `status`
   para el panel de riesgos abiertos.
3. **Evidence package.** Vincular documentos Office/CAD/FAI/visual aids y
   aprobaciones a un gate como evidencia versionada.
4. **Release to MP.** Endpoint transaccional `POST /npi/projects/:id/release`
   con checklist duro + auditoría (sin romper el carácter advisory por defecto).

## 7. Diseño

Se respeta `docs/design/AXOS_DESIGN_LANGUAGE.md`: material `glass`, `IconTile`
por dominio (engineering), radios y tipografía consistentes, `tabular-nums` en
cifras, estados semánticos (verde/ámbar/rojo) solo por significado, dark/light
coherente y sin CSS custom. La experiencia debe sentirse premium e industrial:
una consola de decisión, no un CRUD.
