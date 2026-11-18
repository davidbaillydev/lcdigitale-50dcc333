import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KioskReceiptChoice } from "@/components/KioskReceiptChoice";

afterEach(cleanup);

describe("ticket client de la borne", () => {
  it("n'imprime jamais sans choix du client", () => {
    const print = vi.fn().mockResolvedValue(true);
    render(<KioskReceiptChoice onPrint={print} onFinish={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Oui, imprimer" })).toBeInTheDocument();
    expect(print).not.toHaveBeenCalled();
  });

  it("non merci termine sans imprimer", () => {
    const print = vi.fn().mockResolvedValue(true);
    const finish = vi.fn();
    render(<KioskReceiptChoice onPrint={print} onFinish={finish} />);
    fireEvent.click(screen.getByRole("button", { name: "Non, merci" }));
    expect(print).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledOnce();
  });

  it("oui imprime une seule fois puis permet de terminer", async () => {
    const print = vi.fn().mockResolvedValue(true);
    render(<KioskReceiptChoice onPrint={print} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Oui, imprimer" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("en cours d’impression"));
    expect(print).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Oui, imprimer" })).not.toBeInTheDocument();
  });

  it("une impression indisponible ne fait pas croire que le ticket est sorti", async () => {
    render(<KioskReceiptChoice onPrint={vi.fn().mockResolvedValue(false)} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Oui, imprimer" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("n’a pas pu être imprimé"));
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
