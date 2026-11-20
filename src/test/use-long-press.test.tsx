import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLongPress } from "@/hooks/use-long-press";

function Trigger({ onHold }: { onHold: () => void }) {
  const handlers = useLongPress(onHold);
  return <button {...handlers}>Logo</button>;
}

function pointer(type: string, x = 10, y = 10, pointerType = "touch", button = 0) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, pointerId: 1, pointerType, button });
  fireEvent(screen.getByRole("button", { name: "Logo" }), event);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("appui prolongé sur le logo de la borne", () => {
  it("ouvre une seule fois après 1,5 seconde sans exiger de numéro de borne", () => {
    const open = vi.fn();
    render(<Trigger onHold={open} />);
    pointer("pointerdown");
    act(() => vi.advanceTimersByTime(1499));
    expect(open).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(open).toHaveBeenCalledOnce();
    pointer("pointerup");
    act(() => vi.advanceTimersByTime(2000));
    expect(open).toHaveBeenCalledOnce();
  });

  it("un toucher bref n'ouvre pas les réglages", () => {
    const open = vi.fn();
    render(<Trigger onHold={open} />);
    pointer("pointerdown");
    pointer("pointerup");
    act(() => vi.advanceTimersByTime(1500));
    expect(open).not.toHaveBeenCalled();
  });

  it("tolère le tremblement du doigt mais annule un déplacement de plus de 12 pixels", () => {
    const open = vi.fn();
    render(<Trigger onHold={open} />);
    pointer("pointerdown");
    pointer("pointermove", 15, 15);
    act(() => vi.advanceTimersByTime(1500));
    expect(open).toHaveBeenCalledOnce();
    open.mockClear();
    pointer("pointerdown");
    pointer("pointermove", 23, 10);
    act(() => vi.advanceTimersByTime(1500));
    expect(open).not.toHaveBeenCalled();
  });

  it.each(["pointercancel", "lostpointercapture"])("annule sur %s", (type) => {
    const open = vi.fn();
    render(<Trigger onHold={open} />);
    pointer("pointerdown");
    pointer(type);
    act(() => vi.advanceTimersByTime(1500));
    expect(open).not.toHaveBeenCalled();
  });

  it("annule au démontage et ignore le clic droit", () => {
    const open = vi.fn();
    const { unmount } = render(<Trigger onHold={open} />);
    pointer("pointerdown", 10, 10, "mouse", 2);
    act(() => vi.advanceTimersByTime(1500));
    expect(open).not.toHaveBeenCalled();
    pointer("pointerdown");
    unmount();
    act(() => vi.advanceTimersByTime(1500));
    expect(open).not.toHaveBeenCalled();
  });
});