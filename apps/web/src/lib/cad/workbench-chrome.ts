export interface CadWorkbenchChromeState {
  leftRailOpen: boolean;
  rightInspectorOpen: boolean;
  focusMode: boolean;
}

export type CadWorkbenchRail = "left" | "right";

export interface CadWorkbenchVisibleChrome {
  leftRail: boolean;
  rightInspector: boolean;
  canvasMode: "standard" | "wide" | "focus";
  hiddenRailCount: number;
}

export const DEFAULT_CAD_WORKBENCH_CHROME_STATE: CadWorkbenchChromeState = {
  leftRailOpen: true,
  rightInspectorOpen: true,
  focusMode: false,
};

export function normalizeCadWorkbenchChromeState(
  state: Partial<CadWorkbenchChromeState> | null | undefined,
): CadWorkbenchChromeState {
  return {
    ...DEFAULT_CAD_WORKBENCH_CHROME_STATE,
    ...state,
  };
}

export function cadWorkbenchVisibleChrome(
  state: Partial<CadWorkbenchChromeState> | null | undefined,
): CadWorkbenchVisibleChrome {
  const normalized = normalizeCadWorkbenchChromeState(state);
  const leftRail = !normalized.focusMode && normalized.leftRailOpen;
  const rightInspector = !normalized.focusMode && normalized.rightInspectorOpen;
  const hiddenRailCount = Number(!leftRail) + Number(!rightInspector);

  return {
    leftRail,
    rightInspector,
    hiddenRailCount,
    canvasMode: normalized.focusMode
      ? "focus"
      : hiddenRailCount > 0
        ? "wide"
        : "standard",
  };
}

export function toggleCadWorkbenchRail(
  state: CadWorkbenchChromeState,
  rail: CadWorkbenchRail,
): CadWorkbenchChromeState {
  const normalized = normalizeCadWorkbenchChromeState(state);
  if (normalized.focusMode) {
    return {
      leftRailOpen: rail === "left",
      rightInspectorOpen: rail === "right",
      focusMode: false,
    };
  }

  return rail === "left"
    ? { ...normalized, leftRailOpen: !normalized.leftRailOpen }
    : { ...normalized, rightInspectorOpen: !normalized.rightInspectorOpen };
}

export function toggleCadWorkbenchFocusMode(
  state: CadWorkbenchChromeState,
  next?: boolean,
): CadWorkbenchChromeState {
  const normalized = normalizeCadWorkbenchChromeState(state);
  const focusMode = next ?? !normalized.focusMode;

  if (focusMode) {
    return {
      leftRailOpen: false,
      rightInspectorOpen: false,
      focusMode: true,
    };
  }

  return {
    leftRailOpen: true,
    rightInspectorOpen: true,
    focusMode: false,
  };
}

export function summarizeCadWorkbenchChrome(
  state: Partial<CadWorkbenchChromeState> | null | undefined,
): string {
  const visible = cadWorkbenchVisibleChrome(state);
  if (visible.canvasMode === "focus") return "Canvas focus";
  if (visible.canvasMode === "wide") return `${visible.hiddenRailCount} rail hidden`;
  return "Workbench";
}
