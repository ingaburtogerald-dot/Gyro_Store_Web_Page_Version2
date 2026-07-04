// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const createTrigger = vi.fn();
const updateTrigger = vi.fn();
const success = vi.fn();
const error = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: (...a: any[]) => success(...a), error: (...a: any[]) => error(...a) },
}));
vi.mock("~/store/api/reportsApi", () => ({
  useCreateExpenseMutation: () => [createTrigger, { isLoading: false }],
  useUpdateExpenseMutation: () => [updateTrigger, { isLoading: false }],
}));

import { useExpenseActions } from "../useExpenseActions";

const sample = { date: "2026-06-01", amount: 500, currency: "C$" as const, group: "servicios", subcategory: "Internet", reason: "" };

beforeEach(() => vi.clearAllMocks());

describe("useExpenseActions.createExpense", () => {
  it("crea el gasto tal cual y devuelve true", async () => {
    createTrigger.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    const { result } = renderHook(() => useExpenseActions());

    let ok = false;
    await act(async () => {
      ok = await result.current.createExpense(sample);
    });

    expect(ok).toBe(true);
    expect(createTrigger).toHaveBeenCalledWith(sample);
    expect(success).toHaveBeenCalledTimes(1);
  });

  it("propaga el error del backend y devuelve false", async () => {
    createTrigger.mockReturnValue({ unwrap: () => Promise.reject({ data: { error: "Grupo inválido" } }) });
    const { result } = renderHook(() => useExpenseActions());

    let ok = true;
    await act(async () => {
      ok = await result.current.createExpense(sample);
    });

    expect(ok).toBe(false);
    expect(error).toHaveBeenCalledWith("Grupo inválido");
  });
});

describe("useExpenseActions.updateExpense", () => {
  it("envía id + datos y devuelve true", async () => {
    updateTrigger.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    const { result } = renderHook(() => useExpenseActions());

    let ok = false;
    await act(async () => {
      ok = await result.current.updateExpense("exp1", sample);
    });

    expect(ok).toBe(true);
    expect(updateTrigger).toHaveBeenCalledWith({ id: "exp1", ...sample });
    expect(success).toHaveBeenCalledTimes(1);
  });
});
