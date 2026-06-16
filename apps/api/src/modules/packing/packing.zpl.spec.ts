import { ssccLabelZpl } from "./packing.zpl";

describe("packing.zpl", () => {
  const zpl = ssccLabelZpl({
    sscc: "000000000000000000",
    shipToName: "Cliente A",
    shipToAddress: "Guadalajara, MX",
    fromName: "AXOS Plant 1",
    poNumber: "PO-2026-000123",
    contents: "PN-1024 x120",
    weightKg: 42.5,
    cartonOf: "2 / 5",
  });

  it("emits a complete ZPL program", () => {
    expect(zpl.startsWith("^XA")).toBe(true);
    expect(zpl.trimEnd().endsWith("^XZ")).toBe(true);
  });

  it("encodes the SSCC as GS1-128 (FNC1 + AI 00) and human-readable", () => {
    expect(zpl).toContain(">;>800000000000000000000"); // >8 FNC1 + 00 + 18 digits
    expect(zpl).toContain("(00) 000000000000000000");
    expect(zpl).toContain("^BCN,220,N,N,N");
  });

  it("includes ship-to / from / contents", () => {
    expect(zpl).toContain("Cliente A");
    expect(zpl).toContain("AXOS Plant 1");
    expect(zpl).toContain("PN-1024 x120");
  });

  it("sanitizes ^ and ~ from free text", () => {
    const out = ssccLabelZpl({ sscc: "000000000000000000", shipToName: "A^B~C" });
    expect(out).toContain("A B C");
    expect(out).not.toContain("A^B");
  });
});
