#!/usr/bin/env bash
# Delete the 60 CLOSE (stale/duplicate) Office branches confirmed by the
# convergence audit. KEEPS the 8 QUARANTINE branches (entity/migration) intact.
# Run locally with your own GitHub credentials (the agent proxy blocks ref deletion).
# Each deletion is recoverable via RESTORE_deleted_office_branches.sh (SHAs recorded).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git push origin --delete \
  codex/add-approval-signoff-foundation-for-workbooks \
  codex/add-axos-data-panel-in-sheets \
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
  codex/improve-chart-builder-for-sheets \
  codex/integrate-persistent-comments-in-docs \
  codex/integrate-persistent-review-comments-in-docs \
  codex/integrate-persistent-review-comments-in-docs-zeuss3 \
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
  codex/night-slides-reuse-search-correction \
  codex/night-slides-smartart-industrial-diagrams \
  codex/night-slides-smartart-industrial-presets \
  codex/night-slides-sorter-search \
  rebase/753-approval-signoff
echo "Deleted 60 CLOSE Office branches. Quarantine branches were left intact."
