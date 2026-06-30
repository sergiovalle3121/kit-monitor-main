#!/usr/bin/env bash
# AXOS-OS - FASE 2: borrar ramas ya integradas en main + stale/dup. Ejecutar con tus credenciales.
# (El entorno remoto de Claude bloquea el borrado de refs.) Recuperacion: git push origin <sha>:refs/heads/<rama>
set -uo pipefail
git push origin --delete \
  codex/night-mes-start-confirm \
  codex/night-sheets-print-layout \
  codex/night-sheets-transform-reshape-0629 \
  codex/night-cad-kitting-supermarket-template \
  codex/night-slides-image-readiness-tools \
  claude/axos-night-integration-audit-w0yvaf \
  codex/night-cad-manufacturing-symbols \
  codex/night-sheets-recalc-inspector \
  codex/night-slides-presenter-mode-pro \
  codex/night-sheets-data-quality-inspector \
  codex/night-cad-flow-health-panel \
  codex/night-sheets-approval-health-0629 \
  codex/night-slides-presentation-quality-audit \
  codex/night-cad-line-balance-command \
  codex/night-cad-warehouse-generator \
  codex/night-cad-command-line-hints \
  codex/night-cad-plot-package-metadata \
  codex/night-cad-validation-quickfixes \
  codex/night-cad-edge-clearance-dimensions \
  codex/night-cad-dxf-critical-label-preflight \
  claude/fase2-cad-integration \
  codex/night-cad-dxf-label-export \
  codex/night-sheets-capability-health \
  codex/night-cad-rack-row-generator \

# === recuperacion (SHA  rama) ===
#   e0dd7e9f  codex/night-mes-start-confirm
#   ab79afe5  codex/night-sheets-print-layout
#   882e171c  codex/night-sheets-transform-reshape-0629
#   b6c9f63a  codex/night-cad-kitting-supermarket-template
#   0a01a29d  codex/night-slides-image-readiness-tools
#   95077cee  claude/axos-night-integration-audit-w0yvaf
#   4f863170  codex/night-cad-manufacturing-symbols
#   f984bae3  codex/night-sheets-recalc-inspector
#   5f70d2bc  codex/night-slides-presenter-mode-pro
#   e776f8c9  codex/night-sheets-data-quality-inspector
#   89adbca7  codex/night-cad-flow-health-panel
#   f56e5e00  codex/night-sheets-approval-health-0629
#   904e5a3f  codex/night-slides-presentation-quality-audit
#   30116d10  codex/night-cad-line-balance-command
#   c6b43ce6  codex/night-cad-warehouse-generator
#   5e6227dc  codex/night-cad-command-line-hints
#   08edee60  codex/night-cad-plot-package-metadata
#   0226afb3  codex/night-cad-validation-quickfixes
#   c6152a7a  codex/night-cad-edge-clearance-dimensions
#   aeef5b6e  codex/night-cad-dxf-critical-label-preflight
#   e93460e5  claude/fase2-cad-integration
#   b36b9659  codex/night-cad-dxf-label-export
#   64b450ab  codex/night-sheets-capability-health
#   2004640a  codex/night-cad-rack-row-generator
