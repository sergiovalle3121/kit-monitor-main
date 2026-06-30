import { strict as assert } from "node:assert";
// @ts-expect-error Node strip-types executes the colocated .ts module directly.
import { isProtectedVisualAidUrl, resolveAidUrl, visualAidMode } from "./work-instruction-panel.utils.ts";

const apiBase = "https://api.axos.test/api";

assert.equal(resolveAidUrl(null, apiBase), null);
assert.equal(
  resolveAidUrl(
    { id: "va-1", kind: "pdf", fileUrl: "/visual-aids/file/wi-10.pdf" },
    apiBase,
  ),
  "https://api.axos.test/api/visual-aids/file/wi-10.pdf",
);
assert.equal(
  resolveAidUrl(
    { id: "va-2", kind: "image", fileUrl: "https://cdn.axos.test/wi.png" },
    apiBase,
  ),
  "https://cdn.axos.test/wi.png",
);

assert.equal(visualAidMode(null, null), "empty");
assert.equal(
  visualAidMode({ id: "va-3", kind: "pdf" }, `${apiBase}/visual-aids/file/a.pdf`),
  "pdf",
);
assert.equal(
  visualAidMode({ id: "va-4", kind: "image" }, `${apiBase}/visual-aids/file/a.webp`),
  "image",
);
assert.equal(
  visualAidMode({ id: "va-5", kind: "video" }, `${apiBase}/visual-aids/file/a.mp4`),
  "video",
);
assert.equal(
  visualAidMode({ id: "va-6", kind: "cad" }, `${apiBase}/visual-aids/file/a.dxf`),
  "cad",
);
assert.equal(
  visualAidMode({ id: "doc-1", kind: "office" }, `${apiBase}/office-documents/doc-1`),
  "office",
);

assert.equal(isProtectedVisualAidUrl(`${apiBase}/visual-aids/file/wi-10.pdf`), true);
assert.equal(isProtectedVisualAidUrl(`${apiBase}/office-documents/doc-1`), false);
assert.equal(isProtectedVisualAidUrl(null), false);

console.log("work-instruction-panel.utils: URL and mode resolution passed");
