// ─────────────────────────────────────────────────────────────────────────────
// ZPL (Zebra) label generator for a GS1-128 logistics label carrying the SSCC.
// Pure: returns the ZPL II program text for a 4"x6" label at 203 dpi. The barcode
// encodes AI (00) + the 18-digit SSCC as GS1-128 (subset C + FNC1). Printing is
// done by sending this text to a Zebra printer; this module only renders it.
// ─────────────────────────────────────────────────────────────────────────────
import { ssccElementString } from "./packing.sscc";

export interface ZplLabelInput {
  sscc: string;
  shipToName?: string | null;
  shipToAddress?: string | null;
  fromName?: string | null;
  poNumber?: string | null;
  /** Short contents summary, e.g. "PN-1024 x120 · PN-2048 x60". */
  contents?: string | null;
  weightKg?: number | null;
  /** "2 / 5" style carton position within the shipment. */
  cartonOf?: string | null;
}

/** ZPL ^FD is delimited by ^ and ~; strip them from free text to avoid breakage. */
function zplSafe(text: string | null | undefined, max = 40): string {
  return (text ?? "").replace(/[\^~]/g, " ").slice(0, max);
}

/**
 * Render a GS1-128 SSCC logistics label as ZPL II (4"x6" @ 203 dpi). The bottom
 * zone is the SSCC barcode + human-readable "(00) …", the standard scan target
 * the warehouse uses to verify what's being shipped.
 */
export function ssccLabelZpl(input: ZplLabelInput): string {
  const sscc = (input.sscc ?? "").replace(/\D/g, "");
  const human = ssccElementString(sscc);
  const weight = input.weightKg != null ? `${input.weightKg} kg` : "";

  return [
    "^XA",
    "^CI28",
    "^PW812",
    "^LL1218",
    "^LH0,0",
    // FROM
    "^FO40,40^A0N,28,28^FDDE / FROM:^FS",
    `^FO40,76^A0N,34,34^FD${zplSafe(input.fromName, 38)}^FS`,
    // SHIP TO
    "^FO40,170^A0N,28,28^FDA / SHIP TO:^FS",
    `^FO40,206^A0N,44,44^FD${zplSafe(input.shipToName, 30)}^FS`,
    `^FO40,260^A0N,30,30^FD${zplSafe(input.shipToAddress, 44)}^FS`,
    // PO + carton + weight row
    `^FO40,360^A0N,30,30^FDP.O.: ${zplSafe(input.poNumber, 20)}^FS`,
    `^FO420,360^A0N,30,30^FDCAJA: ${zplSafe(input.cartonOf, 12)}^FS`,
    `^FO620,360^A0N,30,30^FD${zplSafe(weight, 12)}^FS`,
    // Contents
    "^FO40,430^A0N,26,26^FDCONTENIDO:^FS",
    `^FO40,462^A0N,28,28^FD${zplSafe(input.contents, 46)}^FS`,
    // Separator
    "^FO40,540^GB732,3,3^FS",
    // SSCC label + GS1-128 barcode (subset C, FNC1, AI 00 + 18 digits)
    "^FO40,560^A0N,30,30^FDSSCC^FS",
    "^FO40,600^BY3,2.5,220",
    `^BCN,220,N,N,N^FD>;>800${sscc}^FS`,
    `^FO40,840^A0N,40,40^FD${human}^FS`,
    "^XZ",
  ].join("\n");
}
