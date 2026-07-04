import { describe, it, expect } from "vitest";
import { codeNum, sortProductsByCode } from "../inventorySorter";

describe("codeNum", () => {
  it("extrae el número del código", () => {
    expect(codeNum("IN12")).toBe(12);
    expect(codeNum("M-IN58")).toBe(58);
  });

  it("sin dígitos o undefined → al final del orden", () => {
    expect(codeNum("ABC")).toBe(Number.MAX_SAFE_INTEGER);
    expect(codeNum(undefined)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("sortProductsByCode", () => {
  const p = (code: string, origin: "native" | "migrated") => ({ code, origin });

  it("ordena por número de código ascendente", () => {
    const out = sortProductsByCode([p("IN10", "native"), p("IN2", "native"), p("IN1", "native")]);
    expect(out.map((x) => x.code)).toEqual(["IN1", "IN2", "IN10"]);
  });

  it("pone los nativos antes que los migrados", () => {
    const out = sortProductsByCode([p("M-IN1", "migrated"), p("IN99", "native")]);
    expect(out.map((x) => x.origin)).toEqual(["native", "migrated"]);
  });

  it("no muta el array de entrada", () => {
    const input = [p("IN2", "native"), p("IN1", "native")];
    const snapshot = [...input];
    sortProductsByCode(input);
    expect(input).toEqual(snapshot);
  });
});
