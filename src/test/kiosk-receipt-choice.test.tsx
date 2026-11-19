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
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("envoi confirmé"));
    expect(print).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Oui, imprimer" })).not.toBeInTheDocument();
  });

  it("une impression indisponible ne fait pas croire que le ticket est sorti", async () => {
    render(<KioskReceiptChoice onPrint={vi.fn().mockResolvedValue(false)} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Oui, imprimer" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("n’a pas pu être imprimé"));
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
  it("bloque les clics répétés jusqu’à la confirmation puis permet la relance d’un échec", async () => {
    let resolve: (ok: boolean) => void = () => {};
    const print = vi.fn().mockImplementationOnce(() => new Promise<boolean>((r) => { resolve = r; })).mockResolvedValueOnce(true);
    render(<KioskReceiptChoice onPrint={print} onFinish={vi.fn()} />);
    const yes = screen.getByRole("button", { name: "Oui, imprimer" });
    fireEvent.click(yes); fireEvent.click(yes);
    expect(print).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Impression…" })).toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    resolve(false);
    await waitFor(() => expect(screen.getByRole("button", { name: "Réessayer" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(print).toHaveBeenCalledTimes(2);
  });
});
