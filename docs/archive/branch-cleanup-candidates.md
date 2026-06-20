# Candidatos de limpieza de ramas — AXOS OS

> **Solo lista. No se borró ninguna rama.** Documento generado para que Sergio
> decida. La eliminación de cualquier rama requiere su confirmación explícita.

## Metodología

Las **92 ramas** remotas (`git ls-remote --heads origin`) se categorizaron por el
**estado de su Pull Request en GitHub** (vía API), **no** con `git branch --merged`.
Motivo: el repo mergea por **squash**, lo que crea un commit nuevo en `main` y deja
el tip de la rama fuera de la ascendencia de `main` — así `git branch --merged`
reportaría como *no mergeadas* ramas cuyo trabajo **sí** está en `main` (falso negativo).

Detalle importante del API: el endpoint *List PRs* devuelve el booleano `merged`
siempre en `false`; la señal fiable es **`merged_at`** (timestamp no nulo = mergeada).
Se verificó contra el endpoint *Get PR* (autoritativo): p. ej. PR #149 → `merged:true`,
PR #157 → `merged:false`. La categorización usa `merged_at`.

| Categoría | Significado | Acción sugerida | # |
| --- | --- | --- | --- |
| **A** | PR **mergeado** a `main` (trabajo ya integrado) | Seguras de borrar tras tu OK | 84 |
| **B** | PR **cerrado sin merge** | Revisar (trabajo descartado) | 0 |
| **C** | PR **abierto** | **NO TOCAR** | 2 |
| **D** | **Sin PR** | Revisar a mano | 5 |
| | `main` (protegida) + rama de trabajo actual | — | 2 |

Total ramas remotas: **91 categorizadas + `main`** (la rama de trabajo de esta
sesión, `claude/fervent-clarke-6pzi10`, es local y no está en el remoto).

---

## C — PR ABIERTO · NO TOCAR (2)

Estas ramas tienen un PR abierto. **No borrar.**

| Rama | PR | Base | Título |
| --- | --- | --- | --- |
| `claude/office-univer-spike` | #259 (abierto) | `main` | spike(office): evaluación aislada de Univer para Hojas (n… |
| `claude/security-hardening` | #218 (abierto) | `main` | [DRAFT] Seguridad: sin synchronize en prod + JWT_SECRET s… |

## D — SIN PR · revisar a mano (5)

No se encontró ningún PR cuyo head sea esta rama. Pueden ser experimentos, trabajo
nunca propuesto, o ramas viejas auto-generadas. **No borrar sin revisar.**

- `chat-interno-industrial-real-time-bbe51`
- `claude/compassionate-fermat-yr7uin`
- `claude/nice-ride-oaxg4r`
- `claude/youthful-dirac-rhxwel`
- `tablero-ejecutivo-industrial-en-tiempo-real-083ae`

## B — PR CERRADO SIN MERGE (0)

Ninguna rama sobreviviente cae aquí: toda rama con PR cerrado resultó tener
también un PR **mergeado** (categoría A).

## A — PR MERGEADO · seguras de borrar tras tu OK (84)

El trabajo de estas ramas **ya está en `main`** (PR mergeado por squash) pero la
rama no se borró al mergear. Son las candidatas más claras de limpieza. Para borrar
(tras tu confirmación), por rama: `git push origin --delete <rama>`.

| Rama | PR mergeado | Fecha merge | Título |
| --- | --- | --- | --- |
| `claude/admiring-cray-8zputw` | #319 | 2026-06-16 | feat(activity): Event Ledger viewer — timeline + entity h… |
| `claude/affectionate-mendel-ts6tfo` | #308 | 2026-06-16 | feat: add maintenance/TPM (CMMS) cockpit with orders, ass… |
| `claude/amazing-dijkstra-ul2s1a` | #304 | 2026-06-16 | feat(cost-intelligence): COGS y variancia en vivo desde e… |
| `claude/amazing-rubin-5E6GH` | #219 (+6 PR) | 2026-06-07 | Planeación: borrar plan (bote de basura) + notificaciones… |
| `claude/bold-mccarthy-l97puw` | #344 (+12 PR) | 2026-06-20 | feat(inbound): putaway a inventario al liberar (IQC-gated… |
| `claude/charming-turing-uh9b94` | #302 | 2026-06-16 | feat(fai,changeover): primera pieza (FAI) + changeover/SM… |
| `claude/chat-interno` | #158 | 2026-06-05 | feat: internal chat (channels + DMs, text/emoji/images) |
| `claude/clever-tesla-20afub` | #315 | 2026-06-16 | feat(reports): generador de documentos de planta (CoC, tr… |
| `claude/cockpit-home-cleanup` | #167 | 2026-06-06 | feat(web): home cockpit vivo + purga de datos maqueta y c… |
| `claude/confident-ptolemy-0ITZe` | #188 (+7 PR) | 2026-06-06 | Make demo account (admin@axos.com) read-only |
| `claude/cors-context-headers` | #175 | 2026-06-06 | fix(api): permitir X-Building-Id / X-Project-Id en CORS |
| `claude/dazzling-dirac-1puYr` | #255 (+8 PR) | 2026-06-08 | feat(ui): cierra Fase 3 — barra superior + dock compartid… |
| `claude/deepseek-actions-agent` | #156 (+1 PR) | 2026-06-05 | ci: add DeepSeek cloud agent via GitHub Actions |
| `claude/dreamy-edison-uvdk9w` | #307 | 2026-06-16 | feat(settings): panel de usuarios/roles + matriz de permi… |
| `claude/ecstatic-davinci-veo8mv` | #305 | 2026-06-16 | feat(chat): Teams-parity gaps — in-conversation search, i… |
| `claude/eloquent-cannon-xpjmmk` | #314 | 2026-06-16 | feat(notifications): centro de notificaciones de eventos … |
| `claude/eloquent-euler-eYstb` | #263 | 2026-06-08 | feat(office/docs): editor de Documentos hacia Microsoft W… |
| `claude/epic-brown-veux7r` | #300 (+5 PR) | 2026-06-13 | feat(cycle-counts): búsqueda + cancelar conteo OPEN |
| `claude/epic-pasteur-xvyuhp` | #320 | 2026-06-16 | Slides → PowerPoint parity (themes re-style deck, slide m… |
| `claude/festive-faraday-4g6m4r` | #339 (+1 PR) | 2026-06-20 | fix(sheets): UX de la hoja — sin flotantes encima y tecla… |
| `claude/fix-auth-module-providers` | #154 | 2026-06-05 | fix(api): register auth repositories and authorization pr… |
| `claude/fix-autopilot-governance-import` | #152 | 2026-06-05 | fix(api): import GovernanceModule into AutopilotModule |
| `claude/fix-chat-rest-and-auth-selfheal` | #257 | 2026-06-08 | fix(chat+auth): REST del chat (doble /api) + auth fronten… |
| `claude/fix-decision-intelligence-export` | #151 | 2026-06-05 | fix(api): export DecisionIntelligenceService from its mod… |
| `claude/fix-icon-types-railway` | #149 | 2026-06-05 | Improve icon type safety with LucideIcon type |
| `claude/friendly-meitner-klqdti` | #267 (+1 PR) | 2026-06-13 | ci: red de seguridad de calidad + reparar tooling de migr… |
| `claude/funny-cerf-ln9lqa` | #330 | 2026-06-20 | test(e2e): end-to-end flow that CONNECTS the real path (c… |
| `claude/gallant-curie-x8w49h` | #340 (+4 PR) | 2026-06-20 | feat(purchasing): generar órdenes de compra desde el MRP |
| `claude/gracious-archimedes-tss6qb` | #292 (+5 PR) | 2026-06-13 | feat(planning): enlazar Planeación ↔ Muro de WOs en sus e… |
| `claude/happy-fermat-i18eac` | #321 | 2026-06-16 | feat(live): real-time floor spine + &#34;Piso en Vivo&#34… |
| `claude/home-redesign-purge-mock` | #170 | 2026-06-06 | feat(web): home simétrica + purga de datos maqueta en las… |
| `claude/hopeful-lovelace-GZEYN` | #246 (+4 PR) | 2026-06-07 | fix(ui): make the subtle background effects actually visi… |
| `claude/ios-desktop-home` | #153 | 2026-06-05 | feat(web): iOS-desktop polish for the SCOR dashboard home |
| `claude/job-catalog` | #168 | 2026-06-06 | feat(web): catálogo de puestos + RBAC por puesto |
| `claude/kind-ramanujan-khzgco` | #285 (+2 PR) | 2026-06-13 | test(plans): cubrir update y releaseWorkOrder — S6 round 3 |
| `claude/laughing-feynman-HB1w9` | #211 (+22 PR) | 2026-06-07 | fix(auth): carry role/permissions in JWT (fixes read-only… |
| `claude/lucid-galileo-yjzwpb` | #303 | 2026-06-16 | feat(oee): OEE / shop-floor metrics module (Block H) |
| `claude/magical-bohr-dctcnn` | #337 | 2026-06-20 | feat(seed): forbidden-data audit/purge tooling + enriched… |
| `claude/magical-cori-nxphv1` | #317 | 2026-06-16 | feat(search): búsqueda global real en ⌘K (WO, NCR, partes… |
| `claude/manufacturing-blueprint` | #171 | 2026-06-06 | docs: blueprint de manufactura (áreas, MES, roadmap) |
| `claude/materials-pull-1b` | #163 | 2026-06-06 | feat(materials): Fase 1B — solicitud de producción + auto… |
| `claude/mes-routing-foundation` | #172 | 2026-06-06 | feat(mes): fundación de ruta de proceso + autoría de inge… |
| `claude/mission-control-real` | #159 | 2026-06-06 | feat(web): real Mission Control wired to backend KPIs |
| `claude/modules-unify` | #260 | 2026-06-08 | feat: unificar módulos — conectarlos a la espina dorsal (… |
| `claude/multi-project-context` | #162 (+1 PR) | 2026-06-06 | feat(web): workspace selector (Building x Project) with c… |
| `claude/nice-cerf-iva3nk` | #318 | 2026-06-16 | test(web): Playwright golden-path E2E harness (carril G1) |
| `claude/nifty-ramanujan-rvfemc` | #311 | 2026-06-16 | feat(finance): COGS y variancia reales en la UI de Finanz… |
| `claude/office-error-handling` | #174 | 2026-06-06 | fix(office): mostrar errores al abrir documentos (no fall… |
| `claude/office-pro` | #176 | 2026-06-06 | feat(office): editores más pro y más grandes (Word/Excel/… |
| `claude/office-ribbon` | #258 | 2026-06-08 | feat(office): Ribbon pro estilo Office + profundidad real… |
| `claude/office-suite` | #173 | 2026-06-06 | feat(office): Word/Excel/PowerPoint integrados (MIT) |
| `claude/optimistic-hawking-n4cB9` | #262 | 2026-06-08 | feat(slides): Presentaciones hacia PowerPoint — gráficos,… |
| `claude/org-admin-purge-seeds` | #169 | 2026-06-06 | feat: organización admin (edificios/clientes/proyectos) +… |
| `claude/pensive-darwin-2z9jbm` | #306 | 2026-06-16 | feat(genealogy): cradle-to-grave traceability — AS-BUILT … |
| `claude/pensive-volta-tn9zyo` | #301 | 2026-06-16 | fix(office): centralizar gate de escritura para no bloque… |
| `claude/pensive-wright-cbkuE` | #241 (+21 PR) | 2026-06-07 | fix(security): resilient JWT secret in prod instead of cr… |
| `claude/planning-ui-1a` | #164 | 2026-06-06 | feat(web): Muro de Planeación (publicar → PickList) + pue… |
| `claude/polish-aesthetic-sweep` | #350 | 2026-06-20 | fix(ui): legibilidad en modo oscuro (tooltips de recharts… |
| `claude/polish-alerts-toast` | #346 | 2026-06-20 | refactor(office): window.alert() → toasts (ToastContext) … |
| `claude/polish-card-clipping` | #345 | 2026-06-20 | fix(dashboard): evitar recorte de descripción en tarjetas… |
| `claude/polish-confirm-dialog` | #348 | 2026-06-20 | feat(ui): ConfirmDialog accesible — erradicar window.conf… |
| `claude/polish-hygiene` | #349 | 2026-06-20 | chore(tcode): quitar console.log de producción + alert de… |
| `claude/practical-hypatia-60nims` | #289 (+3 PR) | 2026-06-13 | feat(operator-terminal): flujo de escáner manos-libres en… |
| `claude/railway-config-as-code` | #150 | 2026-06-05 | chore: add railway.json per service for config-as-code |
| `claude/seed-demo-data` | #264 | 2026-06-08 | 🚨 Datos semilla DEMO funcionales (universo AXOS) + PURGA … |
| `claude/seed-purge-dryrun` | #265 | 2026-06-08 | fix(seed): purga DRY-RUN por defecto (salvaguarda para pr… |
| `claude/slides-canvas-editor` | #177 | 2026-06-06 | feat(office): editor de diapositivas tipo PowerPoint (imá… |
| `claude/socket-prod-fix` | #166 | 2026-06-06 | fix(web): conectar el socket /signals en producción (En v… |
| `claude/sweet-hawking-UQaaU` | #256 | 2026-06-08 | feat: Golden path usable — Maestro de Modelo → BOM → Plan… |
| `claude/tender-lovelace-masv7v` | #322 | 2026-06-16 | test(e2e): domain flows on the golden harness — escasez, … |
| `claude/trusting-dijkstra-do4x0w` | #299 (+7 PR) | 2026-06-13 | refactor(floor-quality): adopt PageHeader (remove transit… |
| `claude/trusting-dirac-krggzf` | #310 | 2026-06-16 | feat(plans,production-plan): readiness Clear-to-Build rea… |
| `claude/trusting-mendel-r9k330` | #312 | 2026-06-16 | feat(genealogy): visor de trazabilidad — as-built por ser… |
| `claude/vibrant-faraday-1LIjE` | #161 | 2026-06-06 | feat(materials): PickList pull system Fase 1A + repara el… |
| `claude/warehouse-flow-1b` | #165 | 2026-06-06 | feat(materials): pantalla de Almacén + botón Solicitar — … |
| `claude/wizardly-babbage-5dtfdj` | #313 | 2026-06-16 | feat(docs): paridad con Word — control de cambios, TOC, s… |
| `claude/wizardly-goodall-LfB7g` | #261 | 2026-06-08 | feat(office/sheets): profundidad tipo Excel — tablas diná… |
| `claude/zen-cray-gtja5d` | #294 (+5 PR) | 2026-06-13 | feat(industrial-engineering): KPIs reales de IE + enlace … |
| `claude/zen-einstein-eicv79` | #324 | 2026-06-16 | feat(office): biblioteca rica y diseñada de plantillas (s… |
| `claude/zen-meitner-pwl3o3` | #309 | 2026-06-16 | feat(sheets): validación de datos, formato como tabla y f… |
| `feat/theme-light-dark` | #347 | 2026-06-20 | feat(web): sistema de diseño claro/oscuro con toggle glob… |
| `feature/axos-core-erp` | #179 | 2026-06-06 | feat: Axos Core ERP — FIN · MM · PP (MRP) · SD + HUB /das… |
| `feature/master-admin` | #181 | 2026-06-06 | feat: master admin por env vars (sin secretos en el repo) |
| `feature/saas-auth-identity` | #180 | 2026-06-06 | feat: SaaS auth — identidad real por usuario + RBAC en el… |

---

_Generado durante la sesión de limpieza/legibilidad. Datos de PR vía GitHub API
(91 ramas, 201 PRs cruzados). Ninguna rama fue borrada._
