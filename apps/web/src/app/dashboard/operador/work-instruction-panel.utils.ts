export interface VisualAid {
  kind: "image" | "pdf" | "office" | "video" | "cad";
  id: string;
  title?: string;
  fileUrl?: string;
  documentUrl?: string;
  version?: string;
  revision?: string;
  updatedAt?: string;
}

export type VisualAidMode = "empty" | "video" | "image" | "pdf" | "cad" | "office";

export function resolveAidUrl(aid: VisualAid | null, apiBase: string) {
  if (!aid) return null;
  const url = aid.fileUrl || aid.documentUrl || null;
  if (!url) return null;
  return url.startsWith("http") ? url : `${apiBase}${url}`;
}

export function visualAidMode(aid: VisualAid | null, href: string | null): VisualAidMode {
  const url = href?.toLowerCase() ?? "";
  if (!aid) return "empty";
  if (aid.kind === "video" || /\.(mp4|webm|mov)(\?|$)/.test(url)) return "video";
  if (aid.kind === "image" || /\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(url)) return "image";
  if (aid.kind === "pdf" || /\.pdf(\?|$)/.test(url)) return "pdf";
  if (
    aid.kind === "cad" ||
    /\.(step|stp|iges|igs|dxf|dwg|stl|obj)(\?|$)/.test(url)
  ) {
    return "cad";
  }
  return "office";
}

export function isProtectedVisualAidUrl(href: string | null) {
  return Boolean(href && /\/visual-aids\/file\//.test(href));
}
