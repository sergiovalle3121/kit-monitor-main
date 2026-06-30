#!/usr/bin/env bash
# AXOS-OS · Borrado seguro de ramas stale/duplicadas/ya-en-main (2026-06-30)
# Generado tras fusionar los 4 PRs abiertos (#916/#917/#913/#918).
# Estas 118 ramas fueron verificadas como "ya en main por contenido" / duplicadas de clúster
# (plan docs/CONVERGENCE-PLAN.md). NO incluye: cuarentena backend/schema, revisión-owner, ni CAD reciente.
# El entorno de Claude bloquea el borrado de refs (push --delete -> 403; REST write -> 403).
# EJECUTA ESTO TÚ con tus credenciales de GitHub. Recuperar cualquier rama:
#   git push origin <sha>:refs/heads/<rama>     (SHAs en la tabla de recuperación al final)
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

# ===================== Tabla de recuperación (SHA  rama) =====================
#   fa70cc91ecb6  claude/axos-backnav-batch
#   38b3e376e505  claude/axos-cad-factory-scale-yd546i
#   658f765fd7a2  claude/axos-ux-fluidity-audit-jqxwmc
#   fbbd7f143ff5  claude/cad-contracts-67-69
#   3789ff6c1ee7  claude/cad-tool-summary-5d9krp
#   4ca99fbec3ba  claude/confident-cori-l1pima
#   69f77f9a18c2  claude/e2e-flow-diagnosis-c436if
#   3a0435447775  claude/npi-model-relation-7zy21h
#   ed45410280e1  claude/npi-release-to-mp-7zy21h
#   ce4668a2de65  claude/npi-risk-register-7zy21h
#   b33d082d2b18  claude/operator-terminal-theme-agkh8o
#   43e2f192111e  codex/add-approval-signoff-foundation-for-workbooks
#   74de1faa32fc  codex/add-axos-data-panel-in-sheets
#   12d2e02a3bbc  codex/add-collapsible-desktop-sidebar-for-axos
#   6c613738828b  codex/add-collapsible-sidebar-for-desktop
#   7015320b5757  codex/add-collapsible-sidebar-for-desktop-l63qbm
#   b4de3e8abcd5  codex/add-foundation-for-slicers-and-timeline-filters
#   df1d9f765a37  codex/add-pivot-engine-v2-features
#   3796a364b7dc  codex/add-pivot-engine-v2-features-48qv01
#   89b6977091a0  codex/add-slicers-and-timeline-filters-to-sheets
#   cede689ea33f  codex/create-codex-master-prompt-documentation
#   7ba222e2bcc1  codex/create-codex-master-prompt-documentation-3h7nim
#   eb39b65bb56b  codex/create-codex-master-prompt-documentation-6aygno
#   2593b420884a  codex/create-codex-master-prompt-documentation-e3kbom
#   ff284c0cac69  codex/create-codex-master-prompt-documentation-kz21de
#   d283da9cb0b7  codex/create-codex-master-prompt-documentation-x3ipq2
#   7db07ed24a4a  codex/create-codex-master-prompt-documentation-xcna09
#   8a426e7b695c  codex/design-roadmap-for-axos-docs-evolution
#   d2288c44ae7b  codex/design-roadmap-for-axos-docs-evolution-cq7enl
#   a255696bff39  codex/design-roadmap-for-axos-docs-evolution-dkdtld
#   d36969fc8496  codex/design-roadmap-for-axos-docs-evolution-wx0ryc
#   1a5fe5048da1  codex/design-roadmap-for-axos-docs-evolution-y3fxta
#   f742dc58cc13  codex/develop-axos-sheets-data-intelligence-workbench
#   406aee53de3e  codex/enhance-axos-sheets-with-advanced-analytics-features
#   1fde405a06b7  codex/evolve-axos-sheets-editor-for-erp-connection-bcp55a
#   acd405c57490  codex/evolve-axos-sheets-editor-for-erp-connection-ii3kns
#   e0991a8539e4  codex/evolve-axos-sheets-editor-for-erp-connection-n1xb1g
#   99d324fc3524  codex/evolve-axos-sheets-editor-for-erp-connection-nklz7p
#   4b0de80d92ba  codex/evolve-axos-slides-editor
#   6650be4688e4  codex/evolve-axos-slides-editor-fq57b6
#   0989febfe256  codex/evolve-axos-slides-editor-kw1cj2
#   cd32b4304c4c  codex/evolve-axos-slides-editor-rggdqf
#   b6989808cf90  codex/implement-axos-sheets-enterprise-collaboration
#   56bb0fbb3cd4  codex/implement-axos-sheets-workbench-v2-o4unq7
#   4ef54dfb63f7  codex/implementar-motor-de-formulas-y-compatibilidad
#   249cee104ea5  codex/improve-axos-os-public-landing-page
#   25a1435004e3  codex/improve-chart-builder-for-sheets
#   5dd5419f1185  codex/improve-operator-terminal-ux-7v9rsf
#   859a4c016a67  codex/improve-operator-terminal-ux-8nj3ym
#   7728846648d8  codex/improve-operator-terminal-ux-9rsfb6
#   ea1358a0dfd1  codex/improve-operator-terminal-ux-smgy3i
#   4e0d1d860a62  codex/integrate-cell/range-comments-from-sheets
#   d6ad7cebcbea  codex/integrate-cell/range-comments-in-axos-os
#   f9d684ef5f98  codex/integrate-cell/range-comments-in-axos-os-triilo
#   d4db7070b0a8  codex/integrate-persistent-comments-in-docs
#   959db89ace29  codex/integrate-persistent-review-comments-in-docs
#   2fa5b5bf3873  codex/integrate-persistent-review-comments-in-docs-zeuss3
#   5e6227dcddae  codex/night-cad-command-line-hints
#   aeef5b6eefba  codex/night-cad-dxf-critical-label-preflight
#   e1bfb39b60e1  codex/night-cad-dxf-export-readiness
#   b36b9659ef7e  codex/night-cad-dxf-label-export
#   c6152a7a2270  codex/night-cad-edge-clearance-dimensions
#   89adbca7ef74  codex/night-cad-flow-health-panel
#   d1df924131e9  codex/night-cad-industrial-templates
#   b6c9f63a7f3c  codex/night-cad-kitting-supermarket-template
#   02aef2c84ced  codex/night-cad-layer-isolation
#   5ac6aceb6309  codex/night-cad-layer-lock-edit-guards
#   618e7547ba2a  codex/night-cad-layer-quick-actions
#   30116d10d326  codex/night-cad-line-balance-command
#   4f863170ab4e  codex/night-cad-manufacturing-symbols
#   c782b59d68e0  codex/night-cad-object-inspector-pro
#   08edee601a1d  codex/night-cad-plot-package-metadata
#   b8efc430b9df  codex/night-cad-rack-row-command
#   2004640a0f67  codex/night-cad-rack-row-generator
#   1771ab912395  codex/night-cad-safety-path-zones
#   9c1ee24e0314  codex/night-cad-shortcuts-workbench
#   4382a733c05f  codex/night-cad-validation-center
#   0226afb355d1  codex/night-cad-validation-quickfixes
#   c6b43ce6853f  codex/night-cad-warehouse-generator
#   ab2b4fe346fc  codex/night-mes-confirm-actions-0629
#   099899c437ce  codex/night-mes-stop-confirm
#   6630edc2e757  codex/night-operator-material-request
#   c085c892b760  codex/night-planning-material-readiness
#   855d92dc6506  codex/night-planning-safe-cancel
#   2a5549289e87  codex/night-platform-envelope-cq019
#   02f398eae544  codex/night-platform-ledger-query
#   f56e5e002990  codex/night-sheets-approval-health-0629
#   63d6b2360acf  codex/night-sheets-chart-readiness
#   ab2c78ed3f8f  codex/night-sheets-comments-governance-0629
#   cacf0bfb2d64  codex/night-sheets-connector-contract-preview
#   12cac36e5458  codex/night-sheets-data-quality-issues
#   9963996c38a4  codex/night-sheets-live-refresh
#   f984bae37cdf  codex/night-sheets-recalc-inspector
#   976feeb0f88c  codex/night-sheets-table-quality-rules
#   a8b80eeec5f8  codex/night-sheets-template-readiness
#   30d18590993e  codex/night-slides-animation-timeline
#   21a1eaa946a0  codex/night-slides-animation-workflow
#   f29e4b1711fd  codex/night-slides-chart-preset-gallery
#   9ca64760c426  codex/night-slides-chart-presets-0629
#   7b9c495b261a  codex/night-slides-comments-review
#   0a01a29d79f6  codex/night-slides-image-readiness-tools
#   3b53a4b7bcd4  codex/night-slides-industrial-chart-presets
#   3fc933596ff4  codex/night-slides-industrial-table-presets
#   5060da1d475d  codex/night-slides-layer-health
#   891d8a2997b4  codex/night-slides-layer-health-0629
#   318cc1b1c7bb  codex/night-slides-layers-filter-health
#   9b413cd6ef31  codex/night-slides-navigation-workbench
#   725b37afc5f2  codex/night-slides-outline-find
#   904e5a3f9829  codex/night-slides-presentation-quality-audit
#   098de7560ee8  codex/night-slides-release-quality
#   5b5da6db13b4  codex/night-slides-release-readiness-panel
#   20776157ffd9  codex/night-slides-smartart-industrial-diagrams
#   dcd5af44753f  codex/night-slides-smartart-industrial-presets
#   7fc1ed2a3795  codex/night-slides-sorter-search
#   b30448aaed06  codex/redesign-dashboard-for-premium-experience
#   13f3d80acdf2  codex/redesign-dashboard-for-quality-command-center-6zs9sy
#   631be5230cfe  codex/review-app-axos-os-3j0qvk
#   2c0c68f9e1a0  codex/review-app-axos-os-xl83pi
