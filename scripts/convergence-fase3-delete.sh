#!/usr/bin/env bash
# AXOS-OS - FASE 3 FINAL: borrar TODAS las ramas ya-en-main + stale/dup/superseded (sin PR abierto).
# Excluye: cuarentena RED (8), #746/#831 (revisión owner), PRs nuevos de otras sesiones (#899/#900/#902), y la rama del plan.
# El entorno de Claude bloquea el borrado de refs; ejecuta esto con tus credenciales.
# Recuperacion de cualquier rama: git push origin <sha>:refs/heads/<rama>  (SHAs al final).
set -uo pipefail
git push origin --delete \
  claude/axos-backnav-batch \
  claude/axos-cad-factory-scale-yd546i \
  claude/axos-ux-fluidity-audit-jqxwmc \
  claude/cad-contracts-67-69 \
  claude/cad-tool-summary-5d9krp \
  claude/confident-cori-l1pima \
  claude/e2e-flow-diagnosis-c436if \
  claude/npi-model-relation-7zy21h \
  claude/npi-release-to-mp-7zy21h \
  claude/npi-risk-register-7zy21h \
  claude/operator-terminal-theme-agkh8o \
  codex/add-approval-signoff-foundation-for-workbooks \
  codex/add-axos-data-panel-in-sheets \
  codex/add-collapsible-desktop-sidebar-for-axos \
  codex/add-collapsible-sidebar-for-desktop \
  codex/add-collapsible-sidebar-for-desktop-l63qbm \
  codex/add-foundation-for-slicers-and-timeline-filters \
  codex/add-pivot-engine-v2-features \
  codex/add-pivot-engine-v2-features-48qv01 \
  codex/add-slicers-and-timeline-filters-to-sheets \
  codex/create-codex-master-prompt-documentation \
  codex/create-codex-master-prompt-documentation-3h7nim \
  codex/create-codex-master-prompt-documentation-6aygno \
  codex/create-codex-master-prompt-documentation-e3kbom \
  codex/create-codex-master-prompt-documentation-kz21de \
  codex/create-codex-master-prompt-documentation-x3ipq2 \
  codex/create-codex-master-prompt-documentation-xcna09 \
  codex/design-roadmap-for-axos-docs-evolution \
  codex/design-roadmap-for-axos-docs-evolution-cq7enl \
  codex/design-roadmap-for-axos-docs-evolution-dkdtld \
  codex/design-roadmap-for-axos-docs-evolution-wx0ryc \
  codex/design-roadmap-for-axos-docs-evolution-y3fxta \
  codex/develop-axos-sheets-data-intelligence-workbench \
  codex/enhance-axos-sheets-with-advanced-analytics-features \
  codex/evolve-axos-sheets-editor-for-erp-connection-bcp55a \
  codex/evolve-axos-sheets-editor-for-erp-connection-ii3kns \
  codex/evolve-axos-sheets-editor-for-erp-connection-n1xb1g \
  codex/evolve-axos-sheets-editor-for-erp-connection-nklz7p \
  codex/evolve-axos-slides-editor \
  codex/evolve-axos-slides-editor-fq57b6 \
  codex/evolve-axos-slides-editor-kw1cj2 \
  codex/evolve-axos-slides-editor-rggdqf \
  codex/implement-axos-sheets-enterprise-collaboration \
  codex/implement-axos-sheets-workbench-v2-o4unq7 \
  codex/implementar-motor-de-formulas-y-compatibilidad \
  codex/improve-axos-os-public-landing-page \
  codex/improve-chart-builder-for-sheets \
  codex/improve-operator-terminal-ux \
  codex/improve-operator-terminal-ux-7v9rsf \
  codex/improve-operator-terminal-ux-8nj3ym \
  codex/improve-operator-terminal-ux-9rsfb6 \
  codex/improve-operator-terminal-ux-smgy3i \
  codex/integrate-cell/range-comments-from-sheets \
  codex/integrate-cell/range-comments-in-axos-os \
  codex/integrate-cell/range-comments-in-axos-os-triilo \
  codex/integrate-persistent-comments-in-docs \
  codex/integrate-persistent-review-comments-in-docs \
  codex/integrate-persistent-review-comments-in-docs-zeuss3 \
  codex/night-cad-command-line-hints \
  codex/night-cad-dxf-critical-label-preflight \
  codex/night-cad-dxf-export-readiness \
  codex/night-cad-dxf-label-export \
  codex/night-cad-edge-clearance-dimensions \
  codex/night-cad-flow-health-panel \
  codex/night-cad-industrial-templates \
  codex/night-cad-kitting-supermarket-template \
  codex/night-cad-layer-isolation \
  codex/night-cad-layer-lock-edit-guards \
  codex/night-cad-layer-quick-actions \
  codex/night-cad-line-balance-command \
  codex/night-cad-manufacturing-symbols \
  codex/night-cad-object-inspector-pro \
  codex/night-cad-plot-package-metadata \
  codex/night-cad-rack-row-command \
  codex/night-cad-rack-row-generator \
  codex/night-cad-safety-path-zones \
  codex/night-cad-shortcuts-workbench \
  codex/night-cad-validation-center \
  codex/night-cad-validation-quickfixes \
  codex/night-cad-warehouse-generator \
  codex/night-mes-confirm-actions-0629 \
  codex/night-mes-stop-confirm \
  codex/night-operator-material-request \
  codex/night-planning-material-readiness \
  codex/night-planning-safe-cancel \
  codex/night-platform-envelope-cq019 \
  codex/night-platform-ledger-query \
  codex/night-sheets-approval-health-0629 \
  codex/night-sheets-chart-readiness \
  codex/night-sheets-comments-governance-0629 \
  codex/night-sheets-connector-contract-preview \
  codex/night-sheets-data-quality-issues \
  codex/night-sheets-live-refresh \
  codex/night-sheets-recalc-inspector \
  codex/night-sheets-table-quality-rules \
  codex/night-sheets-template-readiness \
  codex/night-slides-animation-timeline \
  codex/night-slides-animation-workflow \
  codex/night-slides-chart-preset-gallery \
  codex/night-slides-chart-presets-0629 \
  codex/night-slides-comments-review \
  codex/night-slides-image-readiness-tools \
  codex/night-slides-industrial-chart-presets \
  codex/night-slides-industrial-table-presets \
  codex/night-slides-layer-health \
  codex/night-slides-layer-health-0629 \
  codex/night-slides-layers-filter-health \
  codex/night-slides-navigation-workbench \
  codex/night-slides-outline-find \
  codex/night-slides-presentation-quality-audit \
  codex/night-slides-release-quality \
  codex/night-slides-release-readiness-panel \
  codex/night-slides-smartart-industrial-diagrams \
  codex/night-slides-smartart-industrial-presets \
  codex/night-slides-sorter-search \
  codex/redesign-dashboard-for-premium-experience \
  codex/redesign-dashboard-for-quality-command-center-6zs9sy \
  codex/review-app-axos-os-3j0qvk \
  codex/review-app-axos-os-xl83pi \

# === recuperacion (SHA  rama) ===
#   fa70cc91  claude/axos-backnav-batch
#   38b3e376  claude/axos-cad-factory-scale-yd546i
#   658f765f  claude/axos-ux-fluidity-audit-jqxwmc
#   fbbd7f14  claude/cad-contracts-67-69
#   3789ff6c  claude/cad-tool-summary-5d9krp
#   4ca99fbe  claude/confident-cori-l1pima
#   69f77f9a  claude/e2e-flow-diagnosis-c436if
#   3a043544  claude/npi-model-relation-7zy21h
#   ed454102  claude/npi-release-to-mp-7zy21h
#   ce4668a2  claude/npi-risk-register-7zy21h
#   b33d082d  claude/operator-terminal-theme-agkh8o
#   43e2f192  codex/add-approval-signoff-foundation-for-workbooks
#   74de1faa  codex/add-axos-data-panel-in-sheets
#   12d2e02a  codex/add-collapsible-desktop-sidebar-for-axos
#   6c613738  codex/add-collapsible-sidebar-for-desktop
#   7015320b  codex/add-collapsible-sidebar-for-desktop-l63qbm
#   b4de3e8a  codex/add-foundation-for-slicers-and-timeline-filters
#   df1d9f76  codex/add-pivot-engine-v2-features
#   3796a364  codex/add-pivot-engine-v2-features-48qv01
#   89b69770  codex/add-slicers-and-timeline-filters-to-sheets
#   cede689e  codex/create-codex-master-prompt-documentation
#   7ba222e2  codex/create-codex-master-prompt-documentation-3h7nim
#   eb39b65b  codex/create-codex-master-prompt-documentation-6aygno
#   2593b420  codex/create-codex-master-prompt-documentation-e3kbom
#   ff284c0c  codex/create-codex-master-prompt-documentation-kz21de
#   d283da9c  codex/create-codex-master-prompt-documentation-x3ipq2
#   7db07ed2  codex/create-codex-master-prompt-documentation-xcna09
#   8a426e7b  codex/design-roadmap-for-axos-docs-evolution
#   d2288c44  codex/design-roadmap-for-axos-docs-evolution-cq7enl
#   a255696b  codex/design-roadmap-for-axos-docs-evolution-dkdtld
#   d36969fc  codex/design-roadmap-for-axos-docs-evolution-wx0ryc
#   1a5fe504  codex/design-roadmap-for-axos-docs-evolution-y3fxta
#   f742dc58  codex/develop-axos-sheets-data-intelligence-workbench
#   406aee53  codex/enhance-axos-sheets-with-advanced-analytics-features
#   1fde405a  codex/evolve-axos-sheets-editor-for-erp-connection-bcp55a
#   acd405c5  codex/evolve-axos-sheets-editor-for-erp-connection-ii3kns
#   e0991a85  codex/evolve-axos-sheets-editor-for-erp-connection-n1xb1g
#   99d324fc  codex/evolve-axos-sheets-editor-for-erp-connection-nklz7p
#   4b0de80d  codex/evolve-axos-slides-editor
#   6650be46  codex/evolve-axos-slides-editor-fq57b6
#   0989febf  codex/evolve-axos-slides-editor-kw1cj2
#   cd32b430  codex/evolve-axos-slides-editor-rggdqf
#   b6989808  codex/implement-axos-sheets-enterprise-collaboration
#   56bb0fbb  codex/implement-axos-sheets-workbench-v2-o4unq7
#   4ef54dfb  codex/implementar-motor-de-formulas-y-compatibilidad
#   249cee10  codex/improve-axos-os-public-landing-page
#   25a14350  codex/improve-chart-builder-for-sheets
#   38cf922b  codex/improve-operator-terminal-ux
#   5dd5419f  codex/improve-operator-terminal-ux-7v9rsf
#   859a4c01  codex/improve-operator-terminal-ux-8nj3ym
#   77288466  codex/improve-operator-terminal-ux-9rsfb6
#   ea1358a0  codex/improve-operator-terminal-ux-smgy3i
#   4e0d1d86  codex/integrate-cell/range-comments-from-sheets
#   d6ad7ceb  codex/integrate-cell/range-comments-in-axos-os
#   f9d684ef  codex/integrate-cell/range-comments-in-axos-os-triilo
#   d4db7070  codex/integrate-persistent-comments-in-docs
#   959db89a  codex/integrate-persistent-review-comments-in-docs
#   2fa5b5bf  codex/integrate-persistent-review-comments-in-docs-zeuss3
#   5e6227dc  codex/night-cad-command-line-hints
#   aeef5b6e  codex/night-cad-dxf-critical-label-preflight
#   e1bfb39b  codex/night-cad-dxf-export-readiness
#   b36b9659  codex/night-cad-dxf-label-export
#   c6152a7a  codex/night-cad-edge-clearance-dimensions
#   89adbca7  codex/night-cad-flow-health-panel
#   d1df9241  codex/night-cad-industrial-templates
#   b6c9f63a  codex/night-cad-kitting-supermarket-template
#   02aef2c8  codex/night-cad-layer-isolation
#   5ac6aceb  codex/night-cad-layer-lock-edit-guards
#   618e7547  codex/night-cad-layer-quick-actions
#   30116d10  codex/night-cad-line-balance-command
#   4f863170  codex/night-cad-manufacturing-symbols
#   c782b59d  codex/night-cad-object-inspector-pro
#   08edee60  codex/night-cad-plot-package-metadata
#   b8efc430  codex/night-cad-rack-row-command
#   2004640a  codex/night-cad-rack-row-generator
#   1771ab91  codex/night-cad-safety-path-zones
#   9c1ee24e  codex/night-cad-shortcuts-workbench
#   4382a733  codex/night-cad-validation-center
#   0226afb3  codex/night-cad-validation-quickfixes
#   c6b43ce6  codex/night-cad-warehouse-generator
#   ab2b4fe3  codex/night-mes-confirm-actions-0629
#   099899c4  codex/night-mes-stop-confirm
#   6630edc2  codex/night-operator-material-request
#   c085c892  codex/night-planning-material-readiness
#   855d92dc  codex/night-planning-safe-cancel
#   2a554928  codex/night-platform-envelope-cq019
#   02f398ea  codex/night-platform-ledger-query
#   f56e5e00  codex/night-sheets-approval-health-0629
#   63d6b236  codex/night-sheets-chart-readiness
#   ab2c78ed  codex/night-sheets-comments-governance-0629
#   cacf0bfb  codex/night-sheets-connector-contract-preview
#   12cac36e  codex/night-sheets-data-quality-issues
#   9963996c  codex/night-sheets-live-refresh
#   f984bae3  codex/night-sheets-recalc-inspector
#   976feeb0  codex/night-sheets-table-quality-rules
#   a8b80eee  codex/night-sheets-template-readiness
#   30d18590  codex/night-slides-animation-timeline
#   21a1eaa9  codex/night-slides-animation-workflow
#   f29e4b17  codex/night-slides-chart-preset-gallery
#   9ca64760  codex/night-slides-chart-presets-0629
#   7b9c495b  codex/night-slides-comments-review
#   0a01a29d  codex/night-slides-image-readiness-tools
#   3b53a4b7  codex/night-slides-industrial-chart-presets
#   3fc93359  codex/night-slides-industrial-table-presets
#   5060da1d  codex/night-slides-layer-health
#   891d8a29  codex/night-slides-layer-health-0629
#   318cc1b1  codex/night-slides-layers-filter-health
#   9b413cd6  codex/night-slides-navigation-workbench
#   725b37af  codex/night-slides-outline-find
#   904e5a3f  codex/night-slides-presentation-quality-audit
#   098de756  codex/night-slides-release-quality
#   5b5da6db  codex/night-slides-release-readiness-panel
#   20776157  codex/night-slides-smartart-industrial-diagrams
#   dcd5af44  codex/night-slides-smartart-industrial-presets
#   7fc1ed2a  codex/night-slides-sorter-search
#   b30448aa  codex/redesign-dashboard-for-premium-experience
#   13f3d80a  codex/redesign-dashboard-for-quality-command-center-6zs9sy
#   631be523  codex/review-app-axos-os-3j0qvk
#   2c0c68f9  codex/review-app-axos-os-xl83pi
