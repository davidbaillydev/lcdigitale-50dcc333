import { describe, expect, it, vi } from "vitest";
import { ORDER_RINGTONES, orderSoundOf, playOrderSound } from "@/lib/order-sound";
describe("restaurant sound rules", () => {
  it("offers exactly three distinct melodies", () => {
    expect(ORDER_RINGTONES).toHaveLength(3);
    expect(new Set(ORDER_RINGTONES.map((r) => JSON.stringify(r.notes))).size).toBe(3);
  });
  it("keeps the current chime as the default at full volume", () => {
    expect(orderSoundOf()).toEqual({ ringtone: "chime", volume: 100 });
    expect(orderSoundOf({ orderSound: { ringtone: "invalid", volume: 200 } })).toEqual({ ringtone: "chime", volume: 100 });
  });
  it("plays the selected melody louder than the former 0.55 × 0.22 gain", () => {
    const ramps: number[] = [];
    const oscillators: { frequency: { value: number }; onended?: () => void }[] = [];
    const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: (v: number) => ramps.push(v), exponentialRampToValueAtTime: vi.fn() });
    const gains: { gain: ReturnType<typeof param> }[] = [];
    const node = () => { const n = { connect: vi.fn(() => n), disconnect: vi.fn() }; return n; };
    const ctx = { currentTime: 0, destination: {}, createDynamicsCompressor: () => ({ ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }), createGain: () => { const g = { ...node(), gain: param() }; gains.push(g); return g; }, createOscillator: () => { const o = { ...node(), type: "sine", frequency: { value: 0 }, start: vi.fn(), stop: vi.fn(), onended: undefined as (() => void) | undefined }; oscillators.push(o); return o; } };
    playOrderSound(ctx as unknown as AudioContext, { ringtone: "welcome", volume: 100 });
    expect(oscillators).toHaveLength(10);
    expect(oscillators[0]?.frequency.value).toBe(659.25);
    expect((gains[0]?.gain.value ?? 0) * Math.max(...ramps)).toBeGreaterThan(0.55 * 0.22);
    oscillators.forEach((o) => o.onended?.());
  });
  it("respects zero volume", () => {
    const createGain = vi.fn();
    playOrderSound({ createGain } as unknown as AudioContext, { ringtone: "chime", volume: 0 });
    expect(createGain).not.toHaveBeenCalled();
  });
});