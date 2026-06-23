---
name: "Agent task (backlog 24/7)"
about: "Tarea atómica para el worker autónomo de AXOS OS. Un issue = un PR."
title: "[agent-task] <verbo + objetivo corto>"
labels: ["agent-task"]
assignees: []
---

<!--
El worker toma el issue `agent-task` ABIERTO más antiguo sin `agent-in-progress`,
lo implementa siguiendo CLAUDE.md y abre un PR DRAFT a `staging`. Mantén la tarea
PEQUEÑA y bien acotada: si no cabe en un PR chico y revisable, pártela.
-->

## Objetivo
<!-- Una frase clara: qué resultado de negocio / UX / infra se busca. -->

## Módulo / paths reales a tocar
<!-- Rutas REALES del repo (verifícalas) que el agente debe crear/modificar. Ej:
- `apps/api/src/modules/<modulo>/...`
- `apps/web/src/components/workspace/...`
Reusa `apps/web/src/components/ui/**` (no dupliques primitivos shadcn/ui). -->

## Criterio "aditivo"
<!-- Cómo se logra SIN romper nada:
- Columnas nuevas NULLABLE / con default seguro; migración no destructiva.
- Sin breaking changes en APIs/DTOs existentes.
- Feature flag o default seguro si introduce comportamiento nuevo. -->

## Definición de Done
- [ ] `npm run build` pasa
- [ ] `npm run lint` pasa
- [ ] Cambio 100% aditivo (sin DROP/ALTER destructivo ni columnas NOT NULL nuevas con datos)
- [ ] PR **DRAFT** a `staging` (nunca `main`), vinculado a este issue, con label `agent-pr`
- [ ] <criterios funcionales específicos del issue>

## Qué NO tocar
<!-- Zonas prohibidas por CLAUDE.md §5 salvo revisión humana explícita:
`apps/api/src/migrations/**`, `apps/api/src/common/tenant/**`, `**/auth/**`,
`**/security/**`, `apps/web/src/lib/owner.ts`, `**/.env`, `**/docker-compose*`,
`.github/workflows/**`. Añade aquí cualquier archivo extra intocable de esta tarea. -->
