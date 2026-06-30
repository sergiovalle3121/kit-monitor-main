#!/usr/bin/env bash
# AXOS-OS - FASE 1: borrar ramas STALE+DUPLICATE (muertas). Plan: PR #894. 64 ramas.
# El entorno remoto de Claude bloquea el borrado de refs; ejecuta esto donde tengas permisos.
# Recuperacion de cualquier rama: git push origin <sha>:refs/heads/<rama>  (SHAs al final).
set -uo pipefail
echo "Borrando 64 ramas muertas (PRs ya cerrados/mergeados)..."
git push origin --delete \
  codex/night-slides-layer-health-0629 \
  claude/axos-os-ux-polish-mh8aem \
  claude/axos-sweep-batch3 \
  codex/add-collapsible-sidebar-for-desktop-l63qbm \
  codex/add-pivot-engine-v2-features-48qv01 \
  codex/create-codex-master-prompt-documentation \
  codex/create-codex-master-prompt-documentation-6aygno \
  codex/create-codex-master-prompt-documentation-e3kbom \
  codex/create-codex-master-prompt-documentation-kz21de \
  codex/create-codex-master-prompt-documentation-x3ipq2 \
  codex/create-codex-master-prompt-documentation-xcna09 \
  codex/design-roadmap-for-axos-docs-evolution \
  codex/design-roadmap-for-axos-docs-evolution-dkdtld \
  codex/design-roadmap-for-axos-docs-evolution-wx0ryc \
  codex/design-roadmap-for-axos-docs-evolution-y3fxta \
  codex/evolve-axos-sheets-editor-for-erp-connection \
  codex/evolve-axos-sheets-editor-for-erp-connection-ii3kns \
  codex/evolve-axos-sheets-editor-for-erp-connection-n1xb1g \
  codex/evolve-axos-sheets-editor-for-erp-connection-nklz7p \
  codex/evolve-axos-slides-editor-fq57b6 \
  codex/evolve-axos-slides-editor-rggdqf \
  codex/implement-axos-sheets-workbench-v2-o4unq7 \
  codex/improve-axos-os-public-landing-page \
  codex/improve-operator-terminal-ux \
  codex/improve-operator-terminal-ux-7v9rsf \
  codex/improve-operator-terminal-ux-9rsfb6 \
  codex/improve-operator-terminal-ux-smgy3i \
  codex/integrate-cell/range-comments-in-axos-os-triilo \
  codex/integrate-persistent-review-comments-in-docs-zeuss3 \
  codex/night-backflush-sap-outbox \
  codex/night-cad-command-shortcuts \
  codex/night-cad-ehs-utility-assets \
  codex/night-cad-grid-snap-cq006 \
  codex/night-cad-rack-row-command \
  codex/night-import-model-capability \
  codex/night-inventory-discrepancy-monitor \
  codex/night-inventory-location-filter-0629 \
  codex/night-mes-confirm-actions-0629 \
  codex/night-mes-wi-viewer-0629 \
  codex/night-mrp-planned-order-filter \
  codex/night-operator-material-request-0629 \
  codex/night-packing-passed-readiness \
  codex/night-planning-material-readiness \
  codex/night-platform-ledger-query-0629 \
  codex/night-platform-response-envelope \
  codex/night-sheets-comments-governance-0629 \
  codex/night-sheets-connector-refresh-governance \
  codex/night-sheets-formula-risk-panel \
  codex/night-sheets-governance-status \
  codex/night-sheets-keyboard-command-center \
  codex/night-sheets-mrp-control-room \
  codex/night-sheets-pivot-preview \
  codex/night-sheets-slicer-timeline-pro-0629 \
  codex/night-sheets-transform-panel \
  codex/night-sheets-xlsx-readiness \
  codex/night-slides-animation-timeline \
  codex/night-slides-asset-library-pro \
  codex/night-slides-audit-readiness \
  codex/night-slides-comments-review \
  codex/night-slides-comments-review-pro \
  codex/night-slides-pptx-export-preflight \
  codex/night-warehouse-location-visibility \
  codex/review-app-axos-os \
  codex/review-app-axos-os-xl83pi

# === Tabla de recuperacion (SHA  rama) ===
#   891d8a29  codex/night-slides-layer-health-0629
#   908c6956  claude/axos-os-ux-polish-mh8aem
#   1744c145  claude/axos-sweep-batch3
#   7015320b  codex/add-collapsible-sidebar-for-desktop-l63qbm
#   3796a364  codex/add-pivot-engine-v2-features-48qv01
#   cede689e  codex/create-codex-master-prompt-documentation
#   eb39b65b  codex/create-codex-master-prompt-documentation-6aygno
#   2593b420  codex/create-codex-master-prompt-documentation-e3kbom
#   ff284c0c  codex/create-codex-master-prompt-documentation-kz21de
#   d283da9c  codex/create-codex-master-prompt-documentation-x3ipq2
#   7db07ed2  codex/create-codex-master-prompt-documentation-xcna09
#   8a426e7b  codex/design-roadmap-for-axos-docs-evolution
#   a255696b  codex/design-roadmap-for-axos-docs-evolution-dkdtld
#   d36969fc  codex/design-roadmap-for-axos-docs-evolution-wx0ryc
#   1a5fe504  codex/design-roadmap-for-axos-docs-evolution-y3fxta
#   44475d37  codex/evolve-axos-sheets-editor-for-erp-connection
#   acd405c5  codex/evolve-axos-sheets-editor-for-erp-connection-ii3kns
#   e0991a85  codex/evolve-axos-sheets-editor-for-erp-connection-n1xb1g
#   99d324fc  codex/evolve-axos-sheets-editor-for-erp-connection-nklz7p
#   6650be46  codex/evolve-axos-slides-editor-fq57b6
#   cd32b430  codex/evolve-axos-slides-editor-rggdqf
#   56bb0fbb  codex/implement-axos-sheets-workbench-v2-o4unq7
#   249cee10  codex/improve-axos-os-public-landing-page
#   38cf922b  codex/improve-operator-terminal-ux
#   5dd5419f  codex/improve-operator-terminal-ux-7v9rsf
#   77288466  codex/improve-operator-terminal-ux-9rsfb6
#   ea1358a0  codex/improve-operator-terminal-ux-smgy3i
#   f9d684ef  codex/integrate-cell/range-comments-in-axos-os-triilo
#   2fa5b5bf  codex/integrate-persistent-review-comments-in-docs-zeuss3
#   44d288b7  codex/night-backflush-sap-outbox
#   56f3be7c  codex/night-cad-command-shortcuts
#   371b2585  codex/night-cad-ehs-utility-assets
#   007cc38f  codex/night-cad-grid-snap-cq006
#   b8efc430  codex/night-cad-rack-row-command
#   11d2322e  codex/night-import-model-capability
#   301dc717  codex/night-inventory-discrepancy-monitor
#   69711ec2  codex/night-inventory-location-filter-0629
#   ab2b4fe3  codex/night-mes-confirm-actions-0629
#   5889b6b8  codex/night-mes-wi-viewer-0629
#   5e8ecc1f  codex/night-mrp-planned-order-filter
#   4682f4e9  codex/night-operator-material-request-0629
#   3704f754  codex/night-packing-passed-readiness
#   c085c892  codex/night-planning-material-readiness
#   fa01f3ae  codex/night-platform-ledger-query-0629
#   d82a172a  codex/night-platform-response-envelope
#   ab2c78ed  codex/night-sheets-comments-governance-0629
#   431b228a  codex/night-sheets-connector-refresh-governance
#   571fb76b  codex/night-sheets-formula-risk-panel
#   197d1981  codex/night-sheets-governance-status
#   b495fec7  codex/night-sheets-keyboard-command-center
#   0b39bdd1  codex/night-sheets-mrp-control-room
#   ea1e984d  codex/night-sheets-pivot-preview
#   5d208104  codex/night-sheets-slicer-timeline-pro-0629
#   e9b6bce4  codex/night-sheets-transform-panel
#   2db0589c  codex/night-sheets-xlsx-readiness
#   30d18590  codex/night-slides-animation-timeline
#   08e454ed  codex/night-slides-asset-library-pro
#   87beee94  codex/night-slides-audit-readiness
#   7b9c495b  codex/night-slides-comments-review
#   f4087c7c  codex/night-slides-comments-review-pro
#   73bd546f  codex/night-slides-pptx-export-preflight
#   c5ba7f96  codex/night-warehouse-location-visibility
#   88e2dff1  codex/review-app-axos-os
#   2c0c68f9  codex/review-app-axos-os-xl83pi
