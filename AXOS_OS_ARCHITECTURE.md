# AXOS OS — Master Architecture & Design System Plan

## 1. Topología del Sistema (Multi-Customer & Multi-Program)
Para asegurar que AXOS OS funcione a escala global y no se amarre a un solo proyecto (ej. "Optics"), la arquitectura debe ser agnóstica al producto y estrictamente jerárquica.

### Modelo Organizacional
Todo dato en el sistema pertenecerá o cruzará a través de esta topología:
1.  **Plant / Site:** La instalación física (ej. Planta 1, Planta 2).
2.  **Customer:** El cliente final (ej. Tesla, Dell, Cisco).
3.  **Program / Project:** El programa específico dentro de un cliente (ej. Optics, Servers Gen5).
4.  **Model:** El número de parte top-level (el producto final a ensamblar).
5.  **Revision:** La versión de ingeniería activa de ese modelo.
6.  **Work Order (WO):** La orden transaccional autorizada para producir "N" unidades.
7.  **Line / Bay / Station:** El ruteo físico de la planta donde se ejecutará la WO.

---

## 2. Nueva Arquitectura de Módulos (Frontend y Backend)

Basado en Domain-Driven Design (DDD), agruparemos lógica y componentes estrictamente por Dominio.

### Backend (NestJS) `src/modules/`
```text
/control-tower      (Agregadores globales, Riesgo por programa, ETA)
/planning           (Forecast, Production Plan, Risk Matrix, WO Readiness)
/materials          (Receiving, Warehouse, Inventory Control, Kitting, Resupply, Holds)
/engineering        (BOM, Visual Aids, Bay Layout, Routing, Model Config)
/production         (Live Monitor, Execution, Hourly Tracking, Incidents, WO Control)
/quality            (IQC, IPQC, OQC, NCR, CAPA, Quality Holds)
/shipping           (Packing, Picking, Dispatch)
/system             (Users, RBAC, Ledger, Master Data)
```

---

## 3. Dominio de Materiales (El Backbone Operacional)
El módulo de Kitting ya no existirá de forma aislada. Todo el flujo de materiales vivirá estructurado bajo la sombrilla de **Materials**, segmentado en:

*   **Receiving / Inbound:** Ingreso de material desde proveedores.
*   **Warehouse:** Gestión de ubicaciones físicas (Racks, Bins).
*   **Inventory Control:** Niveles de inventario, ajustes y conciliaciones.
*   **Kitting:** Ejecución de recolección de partes atadas a una WO.
*   **Resupply / Line Feeding:** Reposición de material a línea (Andon logístico).
*   **Cycle Counts:** Auditorías de exactitud de inventario.
*   **Holds / Quarantine:** Material retenido temporalmente (Calidad/Ingeniería).
*   **Material Traceability:** Historial genealógico (Cuna a tumba) del número de parte.

---

## 4. El Event Ledger Inmutable (Trazabilidad Absoluta)
Nunca dependeremos del "estado actual" para auditorías. Toda acción transaccional generará un registro en el **Event Ledger**. 
El ledger se enriquece para capturar el contexto dimensional completo:

**Esquema `LedgerEvent`:**
*   `eventId` (UUID)
*   `timestamp` (ISO)
*   `actor` (UserId)
*   `action` (Ej. 'KIT_CLOSED', 'WO_STARTED', 'MATERIAL_HELD')
*   `domain` (Ej. 'MATERIALS', 'PRODUCTION')
*   `referenceType` & `referenceId` (WO, Kit, Serial, Receipt)
*   `context` (JSONB):
    *   `plant`, `warehouse`, `line`, `shift`
    *   `customer`, `program`, `model`, `revision`
    *   `wo`, `lot`, `serial`
*   `transaction` (JSONB):
    *   `quantity`
    *   `fromLocation` -> `toLocation`
*   `metadata` (JSONB):
    *   `reasonCode`, `approvalContext`, `beforeState`, `afterState`

---

## 5. Mapeo Legacy a AXOS OS

*   **`/monitor`** -> `Production / Live Monitor` (Y agregado a Control Tower)
*   **`/plan`** -> `Planning / Production Plan` (Atado a WO)
*   **`/forecast`** -> `Planning / Decision Intelligence`
*   **`/bom`** -> `Industrial Engineering / BOM & Models`
*   **`/kits`** -> `Materials / Kitting Execution`
*   **`/conteos`** -> `Materials / Cycle Counts`
*   **`/production/logistics`** -> `Materials / Resupply` + `Production / Incidents`
*   **`/visual-aids`** -> `Industrial Engineering / Visual Aids`
*   **`/disposition`** -> `Industrial Engineering / Bay Layout`
*   **`/production`** -> `Production / Shopfloor Execution`
*   **`/production/hourly`** -> `Production / Hour-by-Hour`
*   **`/production/completed`** -> `Production / Historical Runs`

---

## 6. Design System AXOS (Premium / Apple-like)

El rediseño mantendrá Vanilla CSS pero introducirá jerarquía extrema:
*   **Tarjetas y Paneles:** Off-white o Graphite puro, bordes sutiles de 1px.
*   **Espacios (Spacing Scale):** Uso masivo de espacio negativo para respirar.
*   **Identidad Visual:** Emblema hexagonal premium, metálico, oscuro, con una “X” geométrica central.
*   **Estados de Flujo:** 
    *   *Ready / Success:* Green (`#10b981`)
    *   *Warning / Shortage:* Amber (`#f59e0b`)
    *   *Critical / Down:* Red (`#ef4444`)
*   **Navegación Táctica vs Ejecutiva:** Los operadores verán botones grandes (Scanner-friendly); la gerencia verá densidades de datos elegantes.
