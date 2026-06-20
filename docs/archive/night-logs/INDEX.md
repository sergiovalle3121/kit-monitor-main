# Night Logs — Índice del archivo

Bitácoras (`NIGHT_LOG*.md`) producidas durante las sesiones de build autónomo
("modo nocturno") de AXOS OS. Cada archivo documenta el avance, decisiones y
estado de un **carril** (lane) de trabajo. Se archivan aquí para sacar ruido de
la raíz del repo; **se conservan por su valor histórico** (rationale de diseño,
supuestos, deuda técnica anotada). No son documentación viva — para la
arquitectura actual ver [`../../../AXOS_OS_ARCHITECTURE.md`](../../../AXOS_OS_ARCHITECTURE.md)
y las decisiones en [`../../../DECISIONS.md`](../../../DECISIONS.md).

> Movidos desde la raíz con `git mv` (historial preservado). Una línea por log.

## Maestro

| Archivo | Cubre |
| --- | --- |
| `NIGHT_LOG.md` | Bitácora maestra / agregada de todo el build nocturno (la más larga). |

## Piso de producción (Shop Floor · carriles S)

| Archivo | Cubre |
| --- | --- |
| `NIGHT_LOG_OPERATOR.md` | Carril S1 — Operador / terminal de estación. |
| `NIGHT_LOG_QUALITY.md` | Carril S2 — Calidad (IQC/IPQC/OQC, holds). |
| `NIGHT_LOG_MATERIALS.md` | Carril S3 — Materiales / inventario. |
| `NIGHT_LOG_PLANNING.md` | Carril S4 — Planeación / muro de WOs. |
| `NIGHT_LOG_NPI.md` | Carril S5 — Ingeniería de manufactura (NPI). |
| `NIGHT_LOG_TESTS.md` | Carril S6 — Bitácora de pruebas. |

## Núcleo ERP / manufactura

| Archivo | Cubre |
| --- | --- |
| `NIGHT_LOG_ERP_CORE.md` | Núcleo ERP: Material Master, BOM multinivel, Routing, Import. |
| `NIGHT_LOG_READINESS.md` | Carril B5 — Lógica de `plans` vs `production-plan` (readiness de WO). |
| `NIGHT_LOG_GENEALOGY.md` | Carril B2 — Genealogía / trazabilidad de series. |
| `NIGHT_LOG_FAI.md` | Carril B4 — FAI (primera pieza) + Changeover / SMED. |
| `NIGHT_LOG_OEE.md` | Carril B1 — Módulo `oee` (Bloque H). |
| `NIGHT_LOG_MAINT.md` | Carril G2 — Mantenimiento / TPM (CMMS). |

## Finanzas / costos

| Archivo | Cubre |
| --- | --- |
| `NIGHT_LOG_COGS.md` | Carril B3 — Cost Intelligence / COGS (backend). |
| `NIGHT_LOG_UICOGS.md` | Carril UI-COGS — Frontend de finanzas / costos. |

## Tiempo real / monitoreo

| Archivo | Cubre |
| --- | --- |
| `NIGHT_LOG_LIVE.md` | Columna vertebral de tiempo real + tablero "Piso en Vivo". |
| `NIGHT_LOG_ACTIVITY.md` | Visor del Event Ledger (feed de actividad). |

## Logística / embarques (EMS Shipping Suite)

| Archivo | Cubre |
| --- | --- |
| `NIGHT_LOG_TRAFFIC.md` | Tráfico — EMS Shipping Suite, Fase 1. |
| `NIGHT_LOG_PACKING.md` | Empaque — EMS Shipping Suite, Fase 2a. |
| `NIGHT_LOG_SHIPPING.md` | Embarques (shipping). |

## Suite Office (documentos, hojas, slides)

| Archivo | Cubre |
| --- | --- |
| `NIGHT_LOG_DOCS.md` | Editor de Documentos (estilo Word). |
| `NIGHT_LOG_SHEETS.md` | Hojas de cálculo (Excel) a nivel Microsoft. |
| `NIGHT_LOG_SHEETFORMULA.md` | Hojas de cálculo — entrada y evaluación de fórmulas. |
| `NIGHT_LOG_SHEETUX.md` | Hojas de cálculo — usabilidad (UX). |
| `NIGHT_LOG_SLIDES.md` | Presentaciones (Slides) hacia PowerPoint. |
| `NIGHT_LOG_TEMPLATES.md` | Plantillas de Office. |

## Plataforma / UX / sistema

| Archivo | Cubre |
| --- | --- |
| `NIGHT_LOG_THEME.md` | Sistema de diseño (tema claro/oscuro). |
| `NIGHT_LOG_SETTINGS.md` | Carril G3 — Settings (usuarios y roles). |
| `NIGHT_LOG_RBACFIX.md` | Carril F0 — Fix RBAC ("Office en solo lectura" para Master/owner). |
| `NIGHT_LOG_SEARCH.md` | Búsqueda global (carril ⌘K). |
| `NIGHT_LOG_CHAT.md` | Carril F4 — Chat interno. |
| `NIGHT_LOG_UINOTIF.md` | Centro de notificaciones (frontend). |
| `NIGHT_LOG_UIGEN.md` | UI de genealogía (frontend). |
| `NIGHT_LOG_UIREPORTS.md` | UI de reportes (frontend). |
| `NIGHT_LOG_SEED.md` | Seed / purga legal (datos de dominio público). |

## Pruebas end-to-end

| Archivo | Cubre |
| --- | --- |
| `NIGHT_LOG_E2E.md` | Carril G1 — E2E con Playwright. |
| `NIGHT_LOG_E2E2.md` | Carril E2E-2 — Playwright, flujos por dominio. |
| `NIGHT_LOG_E2EFLOW.md` | Carril E2E-FLOW — un flujo end-to-end que conecta de punta a punta. |
