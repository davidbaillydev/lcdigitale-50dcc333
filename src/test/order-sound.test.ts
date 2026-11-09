import { describe, expect, it, vi } from "vitest";
import { ORDER_FILE_RINGTONES, ORDER_RINGTONE_CHOICES, ORDER_RINGTONES, orderSoundOf, playOrderSound } from "@/lib/order-sound";
describe("restaurant sound rules", () => {
  it("retires Carillon lumineux from every ringtone list", () => {
    expect(ORDER_RINGTONE_CHOICES.map((r) => r.id)).toEqual(["carillon", "kitchen", "welcome", "melody"]);
    expect(ORDER_RINGTONE_CHOICES.map((r) => r.id as string)).not.toContain("chime");
    expect(ORDER_RINGTONE_CHOICES.some((r) => r.label === "Carillon lumineux")).toBe(false);
    expect(ORDER_FILE_RINGTONES.some((ring) => ring.url.includes("carillon_lumineux"))).toBe(false);
  });
  it("keeps the recorded carillon as the default at full volume", () => {
    expect(orderSoundOf()).toEqual({ ringtone: "carillon", volume: 100, repeatSeconds: 5 });
    expect(orderSoundOf({ orderSound: { ringtone: "invalid", volume: 200 } })).toEqual({ ringtone: "carillon", volume: 100, repeatSeconds: 5 });
  });
  it("falls back to the recorded carillon for settings saved with the retired chime", () => {
    expect(orderSoundOf({ orderSound: { ringtone: "chime", volume: 40, repeatSeconds: 12 } })).toEqual({ ringtone: "carillon", volume: 40, repeatSeconds: 12 });
  });
  it("repeats every 5 seconds by default and keeps a custom interval", () => {
    expect(orderSoundOf().repeatSeconds).toBe(5);
    expect(orderSoundOf({ orderSound: { ringtone: "kitchen", volume: 50, repeatSeconds: 20 } }).repeatSeconds).toBe(20);
  });
  it("offers exactly two distinct synthesized melodies", () => {
    expect(ORDER_RINGTONES).toHaveLength(2);
    expect(new Set(ORDER_RINGTONES.map((r) => JSON.stringify(r.notes))).size).toBe(2);
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
    playOrderSound({ createGain } as unknown as AudioContext, { ringtone: "carillon", volume: 0, repeatSeconds: 5 });
    expect(createGain).not.toHaveBeenCalled();
  });
  it("calls back when a preview ends so the listen button can reset", () => {
    const onEnd = vi.fn();
    const oscillators: { onended: (() => void) | undefined }[] = [];
    const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
    const node = () => { const n = { connect: vi.fn(() => n), disconnect: vi.fn() }; return n; };
    const ctx = { currentTime: 0, destination: {}, createDynamicsCompressor: () => ({ ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }), createGain: () => ({ ...node(), gain: param() }), createOscillator: () => { const o = { ...node(), type: "sine", frequency: { value: 0 }, start: vi.fn(), stop: vi.fn(), onended: undefined as (() => void) | undefined }; oscillators.push(o); return o; } };
    playOrderSound(ctx as unknown as AudioContext, { ringtone: "welcome", volume: 100, repeatSeconds: 5 }, onEnd);
    expect(onEnd).not.toHaveBeenCalled();
    oscillators.forEach((o) => o.onended?.());
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
  it("calls back immediately when the volume is zero", () => {
    const onEnd = vi.fn();
    playOrderSound({} as unknown as AudioContext, { ringtone: "carillon", volume: 0, repeatSeconds: 5 }, onEnd);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
  it("makes every listed ringtone previewable", () => {
    for (const choice of ORDER_RINGTONE_CHOICES) {
      const playable = ORDER_RINGTONES.some((ring) => ring.id === choice.id) || ORDER_FILE_RINGTONES.some((ring) => ring.id === choice.id && ring.url.length > 0);
      expect(playable, choice.id).toBe(true);
    }
  });
});
