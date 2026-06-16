import {
  buildSscc,
  isValidSscc,
  normalizePrefix,
  PLACEHOLDER_PREFIX,
  ssccCheckDigit,
  ssccElementString,
} from "./packing.sscc";

describe("packing.sscc", () => {
  it("computes a valid check digit and 18-digit SSCC", () => {
    const { sscc } = buildSscc("0614141", 1);
    expect(sscc).toHaveLength(18);
    expect(/^\d{18}$/.test(sscc)).toBe(true);
    expect(isValidSscc(sscc)).toBe(true);
  });

  it("17 zeros → check digit 0", () => {
    expect(ssccCheckDigit("0".repeat(17))).toBe(0);
    const { sscc } = buildSscc("0000000", 0);
    expect(sscc).toBe("0".repeat(18));
    expect(isValidSscc(sscc)).toBe(true);
  });

  it("detects an invalid SSCC when a digit is altered", () => {
    const { sscc } = buildSscc("0614141", 42);
    const lastDigit = Number(sscc[17]);
    const tampered = sscc.slice(0, 17) + ((lastDigit + 1) % 10);
    expect(isValidSscc(tampered)).toBe(false);
  });

  it("flags the placeholder prefix until a real GS1 prefix is configured", () => {
    expect(buildSscc(undefined, 1).placeholder).toBe(true);
    expect(buildSscc("", 1).placeholder).toBe(true);
    expect(buildSscc(PLACEHOLDER_PREFIX, 1).placeholder).toBe(true);
    expect(buildSscc("0614141", 1).placeholder).toBe(false);
  });

  it("serials stay unique within the available width and remain valid", () => {
    const a = buildSscc("0614141", 1).sscc;
    const b = buildSscc("0614141", 2).sscc;
    expect(a).not.toBe(b);
    expect(isValidSscc(a)).toBe(true);
    expect(isValidSscc(b)).toBe(true);
  });

  it("normalizePrefix accepts 6–10 digit prefixes, else placeholder", () => {
    expect(normalizePrefix("12345")).toEqual({ prefix: PLACEHOLDER_PREFIX, placeholder: true });
    expect(normalizePrefix("061414")).toEqual({ prefix: "061414", placeholder: false });
    expect(normalizePrefix("06141412345")).toEqual({ prefix: PLACEHOLDER_PREFIX, placeholder: true });
  });

  it("renders the GS1 element string", () => {
    expect(ssccElementString("000000000000000000")).toBe("(00) 000000000000000000");
  });
});
