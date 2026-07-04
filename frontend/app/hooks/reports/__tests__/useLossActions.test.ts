// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mocks: aislamos el hook de RTK Query y de los toasts. Así NO se carga el store/baseApi
// real y testeamos solo la lógica del hook (decodificación, éxito/error, valor de retorno).
const createTrigger = vi.fn();
const updateTrigger = vi.fn();
const success = vi.fn();
const error = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: (...a: any[]) => success(...a), error: (...a: any[]) => error(...a) },
}));
vi.mock("~/store/api/reportsApi", () => ({
  useCreateLossMutation: () => [createTrigger, { isLoading: false }],
  useUpdateLossMutation: () => [updateTrigger, { isLoading: false }],
}));

import { useLossActions } from "../useLossActions";

beforeEach(() => vi.clearAllMocks());

describe("useLossActions.createLoss", () => {
  it("decodifica 'origin:productId', llama la mutación y devuelve true", async () => {
    createTrigger.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    const { result } = renderHook(() => useLossActions());

    let ok = false;
    await act(async () => {
      ok = await result.current.createLoss({
        date: "2026-06-01",
        product: "migrated:abc",
        quantity: 2,
        category: "daño",
        reason: "rota",
      });
    });

    expect(ok).toBe(true);
    expect(createTrigger).toHaveBeenCalledWith({
      date: "2026-06-01",
      origin: "migrated",
      productId: "abc",
      quantity: 2,
      category: "daño",
      reason: "rota",
    });
    expect(success).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  it("ante error muestra toast.error con el mensaje del backend y devuelve false", async () => {
    createTrigger.mockReturnValue({ unwrap: () => Promise.reject({ data: { error: "Sin stock" } }) });
    const { result } = renderHook(() => useLossActions());

    let ok = true;
    await act(async () => {
      ok = await result.current.createLoss({ date: "x", product: "native:1", quantity: 1, category: "robo", reason: "" });
    });

    expect(ok).toBe(false);
    expect(error).toHaveBeenCalledWith("Sin stock");
    expect(success).not.toHaveBeenCalled();
  });
});

describe("useLossActions.updateLoss", () => {
  it("envía id + metadatos y devuelve true", async () => {
    updateTrigger.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    const { result } = renderHook(() => useLossActions());

    let ok = false;
    await act(async () => {
      ok = await result.current.updateLoss("loss1", { date: "2026-06-02", category: "robo", reason: "" });
    });

    expect(ok).toBe(true);
    expect(updateTrigger).toHaveBeenCalledWith({ id: "loss1", date: "2026-06-02", category: "robo", reason: "" });
    expect(success).toHaveBeenCalledTimes(1);
  });
});
