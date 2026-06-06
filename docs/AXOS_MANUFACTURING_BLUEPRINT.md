# Axos OS — Blueprint de Manufactura (EMS/CM)

Investigación pragmática de las áreas de una planta de manufactura por contrato
(EMS/CMS, tipo Jabil/Flex/Foxconn), qué hace cada una, qué le duele, y cómo Axos
lo resuelve en una sola app. Sirve como mapa para el build profundo.

> Regla: el operador/ingeniero/almacenista no debe pensar en "software" — la app
> refleja el flujo físico real de la planta. Cada dato existe porque alguien en
> el piso lo necesita.

---

## 1. La planta como sistema (cadena de valor)

```
Demanda → Planeación → Compras → Recibo/IQC → Almacén → Kitting/Surtido
        → Línea de Producción (MES) → Calidad en proceso → Empaque → Embarque
                         ↑ Ingeniería (BOM, ruta, ayudas visuales, layout)
                         ↑ Mantenimiento · Finanzas · Personas/EHS (transversales)
        Trazabilidad (genealogía cuna→tumba) y Torre de Control cruzan TODO.
```

El dolor central de un CM: **el material y la información no van sincronizados**.
Planeación sabe el plan, pero almacén y piso no lo ven a tiempo; ingeniería tiene
el BOM y la ayuda visual, pero el operador no la tiene enfrente; se consume
material sin saber cuánto queda en la línea. Axos cierra esos huecos.

---

## 2. Áreas funcionales (qué hacen · qué les duele · qué necesitan en la app)

### Planeación (Planning / PC)
- **Hace:** forecast, plan maestro (MPS), MRP, secuencia y publicación de WOs.
- **Duele:** mandar Excel; piso/almacén no ven el plan; cambios sin avisar.
- **Necesita:** muro de publicación de planes, explosión de BOM automática,
  readiness (¿hay material/calidad para correr?), re-secuenciar.

### Compras (Procurement / SCM)
- **Hace:** RFQ, órdenes de compra, AVL/AML, allocation en escasez, scorecards.
- **Duele:** shortages sorpresa, EOL, proveedor incumplido.
- **Necesita:** POs ligadas a la demanda del MRP, alertas de escasez, riesgo.

### Recibo / IQC (Inbound)
- **Hace:** recibir material del proveedor, inspección de entrada (IQC), etiquetar
  lote/serie/date-code, liberar o retener.
- **Duele:** material que entra sin inspección, sin trazabilidad de lote.
- **Necesita:** recepción con captura de lote, IQC con pasa/no-pasa, cuarentena.

### Almacén / Inventario (Warehouse / EWM)
- **Hace:** custodia por ubicación (rack/bin), conteos cíclicos, kitting/staging,
  surtido a línea (pull system), reposición.
- **Duele:** no saber qué hay ni dónde; surtir lo que no está en plan.
- **Necesita:** existencias por ubicación, PickList automático, autorizar surtido
  por socket, candado "solo lo planeado". **(Axos ya lo tiene: Fase 1A/1B.)**

### Ingeniería (NPI / Process / IE)
- **Hace:** BOM por modelo y revisión, ruta de proceso (estaciones), **ayudas
  visuales (work instructions)**, **layout de línea: qué material va en qué
  estación y cuántos**, DFM, control de cambios (ECO/ECN).
- **Duele:** ayuda visual en papel/desactualizada; operador no sabe colocación.
- **Necesita:** autoría de BOM, subir ayudas visuales por paso, **designar
  material→estación + cantidad**, versionar revisiones.

### Producción / MES (Shop Floor Execution) — el corazón
- **Hace:** ejecutar la WO en la línea. Cada **operador** en su **estación** tiene
  el **modelo montado**, ve la **ayuda visual**, ejecuta los **pasos**, confirma
  cantidad, y el sistema **descuenta material (backflush)** mostrando consumo en
  tiempo real. Hour-by-hour, OEE, WIP, genealogía por serie.
- **Duele:** no saber qué corre dónde, consumo a ciegas, paros sin registrar.
- **Necesita:** **cuenta por operador**, tablero de estación (modelo, paso, ayuda
  visual, material y cuánto queda), avance por paso, consumo en vivo, paros.

### Calidad en proceso (IPQC / OQC / NCR-CAPA)
- **Hace:** inspección en proceso y final, **reportar incidentes en la línea**,
  NCR, disposición (retrabajo/scrap), CAPA, SPC, retención por calidad.
- **Duele:** incidentes en libreta, sin ligar a serie/estación.
- **Necesita:** **reportar incidente desde la estación** (tipo, severidad, foto),
  retención que **bloquea** avance, NCR/CAPA con trazabilidad.

### Mantenimiento (TPM)
- **Hace:** activos, preventivo/predictivo, refacciones, paros de máquina.
- **Necesita:** registro de equipos, PM calendarizado, ligar paros a OEE.

### Logística / Embarque (Outbound)
- **Hace:** empaque, picking de PT, embarque, aduana/IMMEX.
- **Necesita:** packing list, dispatch, ligar a la WO/serie.

### Finanzas (Costing)
- **Hace:** costeo de producto (BOM × costo), varianzas, P&L por contrato.
- **Necesita:** rollup de costo del BOM, costo real vs estándar, P&L por proyecto.

### Personas / EHS
- **Hace:** plantilla, turnos, skills/certificaciones, incidentes de seguridad.
- **Necesita:** matriz de skills (quién puede operar qué estación), EHS.

### Transversales
- **Trazabilidad/Genealogía:** todo evento al Event Ledger (cuna→tumba por serie).
- **Torre de Control:** agrega riesgo/ETA por programa, cross-área.

---

## 3. El piso de producción a detalle (MES)

```
WO publicada → ruta del modelo (estaciones en orden)
   Estación 1 ── Estación 2 ── … ── Estación N ── PT
     │ operador con cuenta propia
     │ ve: modelo montado, paso actual, AYUDA VISUAL, material del paso
     │ confirma cantidad → backflush descuenta BOM del paso
     │ consumo en vivo (cuánto queda en la línea por parte)
     │ si hay defecto → reporta INCIDENTE (calidad) → puede BLOQUEAR
     ▼
   genealogía por serie + hour-by-hour + OEE
```

**Datos mínimos para manufacturar (que la app debe plasmar):**
- Ruta: modelo → estaciones ordenadas (existe `enterprise_lines/stations`).
- Colocación: material → estación + cantidad por unidad (hoy `bay_layout` da
  material→bahía; falta cantidad explícita por paso).
- Ayuda visual por paso/modelo (`visual_aids` ya existe).
- Ejecución: evento por estación con cantidad (`production_bay_events` ya existe).
- Consumo: estado de material por estación (`production_bay_material_states`).
- Incidentes: por estación/serie (`production_bay_incidents` ya existe).

---

## 4. Mapeo a Axos (qué existe / qué falta)

| Área | Backend hoy | Frontend hoy | Falta |
|---|---|---|---|
| Planeación | ✅ plans, pick-lists | ✅ Muro | readiness, re-secuencia |
| Almacén/Pull | ✅ kit-materials, material-requests, socket | ✅ Almacén | recepción, ubicaciones, conteos |
| Inventario | ✅ positions, movements | ✅ lista | ajustes, kitting UI |
| Ingeniería | ✅ bom, bay-layout, visual-aids | ⚠️ solo lista BOM | **autoría layout + ayudas + qty/paso** |
| Producción/MES | ✅ bay-events, incidents, material-state, wip | ⚠️ solo lista WOs | **pantalla operador MES, consumo vivo** |
| Calidad | ✅ ncr, quality-holds | ⚠️ solo lista | **incidente en línea, NCR/CAPA** |
| Compras | ✅ suppliers | ❌ | módulo Compras |
| Recibo | ✅ receiving | ❌ | módulo Recibo + IQC |
| Logística | ✅ shipping | ❌ | módulo Embarque |
| Finanzas | ✅ accounting, cost-rollup | ✅ lista | costeo BOM |
| Personas | ⚠️ users/roles | ⚠️ | skills, turnos, EHS |

**Conclusión:** el backbone del piso ya existe. El build profundo del núcleo es
sobre todo **frontend MES + autoría de ingeniería + calidad en línea**, con
ajustes puntuales de backend (cantidad por paso, backflush, ruta por estaciones).

---

## 5. Roadmap (núcleo primero)

1. **Ingeniería autoría** — asignar material→estación + cantidad, subir ayudas
   visuales por modelo/paso, versión. *(prerequisito del MES.)*
2. **MES del operador** — cuenta por operador, tablero de estación (modelo, paso,
   ayuda visual, material), avance por paso, **consumo en vivo (backflush)**.
3. **Calidad en línea** — reportar incidente desde la estación, retención que
   bloquea, NCR/CAPA.
4. **Recibo + Inventario profundo** — recepción con lote, ubicaciones, conteos.
5. Compras, Logística, Mantenimiento, Personas — módulos completos.
6. Torre de Control + genealogía por serie (transversal).
