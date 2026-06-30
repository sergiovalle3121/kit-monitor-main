/** Pure CAD workbench chrome smoke tests. */
import { strict as assert } from "node:assert";
import {
  DEFAULT_CAD_WORKBENCH_CHROME_STATE,
  cadWorkbenchVisibleChrome,
  summarizeCadWorkbenchChrome,
  toggleCadWorkbenchFocusMode,
  toggleCadWorkbenchRail,
} from "./workbench-chrome";

const defaultVisible = cadWorkbenchVisibleChrome(
  DEFAULT_CAD_WORKBENCH_CHROME_STATE,
);
assert.equal(defaultVisible.leftRail, true, "default left rail is visible");
assert.equal(defaultVisible.rightInspector, true, "default inspector is visible");
assert.equal(defaultVisible.canvasMode, "standard", "default canvas is standard");

const leftHidden = toggleCadWorkbenchRail(
  DEFAULT_CAD_WORKBENCH_CHROME_STATE,
  "left",
);
assert.equal(
  cadWorkbenchVisibleChrome(leftHidden).canvasMode,
  "wide",
  "collapsing one rail creates wide canvas",
);
assert.equal(
  cadWorkbenchVisibleChrome(leftHidden).leftRail,
  false,
  "left rail toggle hides left rail",
);

const focus = toggleCadWorkbenchFocusMode(leftHidden, true);
assert.equal(focus.focusMode, true, "focus mode flag is set");
assert.equal(
  cadWorkbenchVisibleChrome(focus).hiddenRailCount,
  2,
  "focus hides both rails",
);
assert.equal(
  summarizeCadWorkbenchChrome(focus),
  "Canvas focus",
  "focus has explicit summary",
);

const restored = toggleCadWorkbenchFocusMode(focus, false);
assert.deepEqual(
  restored,
  DEFAULT_CAD_WORKBENCH_CHROME_STATE,
  "leaving focus restores the full workbench",
);

const rightFromFocus = toggleCadWorkbenchRail(focus, "right");
assert.equal(rightFromFocus.focusMode, false, "opening a rail exits focus");
assert.equal(
  cadWorkbenchVisibleChrome(rightFromFocus).rightInspector,
  true,
  "right rail opens from focus",
);
assert.equal(
  cadWorkbenchVisibleChrome(rightFromFocus).leftRail,
  false,
  "the opposite rail stays hidden from focus",
);

console.log("cad workbench chrome specs passed");
