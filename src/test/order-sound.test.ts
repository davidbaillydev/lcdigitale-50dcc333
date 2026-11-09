import { describe, expect, it, vi } from "vitest";
import { ORDER_FILE_RINGTONES, ORDER_RINGTONE_CHOICES, ORDER_RINGTONES, orderSoundOf, playOrderSound } from "@/lib/order-sound";
describe("restaurant sound rules", () => {
  it("uses the improved recording for the existing default chime without adding a duplicate choice", () => {
    expect(ORDER_FILE_RINGTONES.find((ring) => ring.id === "chime")?.url).toContain("carillon_lumineux_ameliore.mp3");
    expect(ORDER_RINGTONE_CHOICES.filter((ring) => ring.id === "chime")).toHaveLength(1);
  });
  it("offers five ringtones including the two recorded ones", () => {
    expect(ORDER_RINGTONE_CHOICES.map((r) => r.id)).toEqual(["chime", "welcome", "melody", "kitchen", "carillon"]);
    expect(orderSoundOf({ orderSound: { ringtone: "kitchen", volume: 80 } })).toEqual({ ringtone: "kitchen", volume: 80, repeatSeconds: 5 });
  });
  it("repeats every 5 seconds by default and keeps a custom interval", () => {
    expect(orderSoundOf().repeatSeconds).toBe(5);
    expect(orderSoundOf({ orderSound: { ringtone: "chime", volume: 50, repeatSeconds: 20 } }).repeatSeconds).toBe(20);
  });
  it("offers exactly three distinct melodies", () => {
    expect(ORDER_RINGTONES).toHaveLength(3);
    expect(new Set(ORDER_RINGTONES.map((r) => JSON.stringify(r.notes))).size).toBe(3);
  });
  it("keeps the current chime as the default at full volume", () => {
    expect(orderSoundOf()).toEqual({ ringtone: "chime", volume: 100, repeatSeconds: 5 });
    expect(orderSoundOf({ orderSound: { ringtone: "invalid", volume: 200 } })).toEqual({ ringtone: "chime", volume: 100, repeatSeconds: 5 });
  });
  it("plays the selected melody louder than the former 0.55 × 0.22 gain", () => {
    const ramps: number[] = [];
    const oscillators: { frequency: { value: number }; onended: (() => void) | undefined }[] = [];
    const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: (v: number) => ramps.push(v), exponentialRampToValueAtTime: vi.fn() });
    const gains: { gain: ReturnType<typeof param> }[] = [];
    const node = () => { const n = { connect: vi.fn(() => n), disconnect: vi.fn() }; return n; };
    const ctx = { currentTime: 0, destination: {}, createDynamicsCompressor: () => ({ ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }), createGain: () => { const g = { ...node(), gain: param() }; gains.push(g); return g; }, createOscillator: () => { const o = { ...node(), type: "sine", frequency: { value: 0 }, start: vi.fn(), stop: vi.fn(), onended: undefined as (() => void) | undefined }; oscillators.push(o); return o; } };
    playOrderSound(ctx as unknown as AudioContext, { ringtone: "welcome", volume: 100, repeatSeconds: 5 });
    expect(oscillators).toHaveLength(10);
    expect(oscillators[0]?.frequency.value).toBe(659.25);
    expect((gains[0]?.gain.value ?? 0) * Math.max(...ramps)).toBeGreaterThan(0.55 * 0.22);
    oscillators.forEach((o) => o.onended?.());
  });
  it("respects zero volume", () => {
    const createGain = vi.fn();
    playOrderSound({ createGain } as unknown as AudioContext, { ringtone: "chime", volume: 0, repeatSeconds: 5 });
    expect(createGain).not.toHaveBeenCalled();
  });
});