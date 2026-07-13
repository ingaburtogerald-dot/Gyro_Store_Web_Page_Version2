// @vitest-environment jsdom
// Verifica la paginación opt-in del DataTable (P2). El resto del runner corre en
// entorno "node" (capa de dominio pura); este archivo pide jsdom vía el docblock.
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../DataTable";

beforeAll(() => {
  // framer-motion (useReducedMotion) consulta matchMedia; jsdom no lo trae.
  if (!window.matchMedia) {
    window.matchMedia = (q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    });
  }
});

afterEach(cleanup);

type Row = { id: number; name: string };
const rows: Row[] = Array.from({ length: 120 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
const columns: ColumnDef<Row, any>[] = [{ accessorKey: "name", header: "Nombre" }];

// El bloque de tabla (desktop) es el único <table> del componente; la vista móvil
// son <div>. Contamos filas ahí para no duplicar con las tarjetas móviles.
const desktopBody = () => document.querySelector("table tbody") as HTMLElement;

describe("DataTable · paginación", () => {
  it("sin `paginated` renderiza TODAS las filas (comportamiento previo intacto)", () => {
    render(<DataTable columns={columns} data={rows} />);
    expect(desktopBody().querySelectorAll("tr").length).toBe(120);
  });

  it("con `paginated` limita al pageSize y navega entre páginas", () => {
    render(<DataTable columns={columns} data={rows} paginated pageSize={50} />);

    // Página 1: 50 filas, Item 1 visible, Item 51 aún no.
    expect(desktopBody().querySelectorAll("tr").length).toBe(50);
    expect(within(desktopBody()).getByText("Item 1")).toBeTruthy();
    expect(within(desktopBody()).queryByText("Item 51")).toBeNull();

    // Avanzar de página.
    fireEvent.click(screen.getByLabelText("Página siguiente"));

    // Página 2: sigue con 50 filas, ahora Item 51 visible e Item 1 fuera.
    expect(desktopBody().querySelectorAll("tr").length).toBe(50);
    expect(within(desktopBody()).getByText("Item 51")).toBeTruthy();
    expect(within(desktopBody()).queryByText("Item 1")).toBeNull();
  });

  it("deshabilita 'anterior' en la primera página", () => {
    render(<DataTable columns={columns} data={rows} paginated pageSize={50} />);
    expect((screen.getByLabelText("Página anterior") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Página siguiente") as HTMLButtonElement).disabled).toBe(false);
  });
});
