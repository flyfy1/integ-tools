import { assessBandDirection, detectBandStrip, type ComponentType, type DetectedBand } from './componentBands.ts';
import { sampleComponentStrip, type ComponentTarget } from './componentLocator.ts';

// Localization can use a small frame; colors must come from source pixels.
export function componentRegion(target: ComponentTarget, analysisWidth: number, analysisHeight: number, width: number, height: number) {
  const b = target.box;
  const x = Math.max(0, Math.floor((b.x - b.width * .16) * width));
  const y = Math.max(0, Math.floor((b.y - b.height * .55) * height));
  const w = Math.min(width - x, Math.ceil(b.width * 1.32 * width));
  const h = Math.min(height - y, Math.ceil(b.height * 2.1 * height));
  const sx = width / analysisWidth, sy = height / analysisHeight;
  const scale = Math.hypot(Math.cos(target.angle) * sx, Math.sin(target.angle) * sy);
  return { x, y, width: w, height: h, target: { ...target, cx: target.cx * sx - x, cy: target.cy * sy - y, length: target.length * scale, thickness: target.thickness * sy, angle: Math.atan2(Math.sin(target.angle) * sy, Math.cos(target.angle) * sx) } };
}

export function readComponentBands(data: Uint8ClampedArray, width: number, height: number, target: ComponentTarget, type: ComponentType) {
  if (target.length < 32) return null;
  const candidates: DetectedBand[][] = [];
  for (const offset of [0, -.2, .2]) {
    const strip = sampleComponentStrip(data, width, height, target, 420, 9, offset);
    const found = type === 'resistor' ? detectBandStrip(strip, 420, 9, 4) ?? detectBandStrip(strip, 420, 9, 5) : detectBandStrip(strip, 420, 9, type === 'inductor-mil' ? 5 : 4);
    if (found) candidates.push(found);
  }
  const central = candidates[0];
  const score = (bands: DetectedBand[]) => {
    const matches = candidates.filter(other => other.map(b => b.color).join() === bands.map(b => b.color).join()).length;
    return matches * 10 + (assessBandDirection(bands.map(b => b.color), type, bands).readings.length ? 100 : 0) + (bands === central ? 5 : 0) - bands.filter(b => b.uncertain).length * .1;
  };
  return candidates.sort((a, b) => score(b) - score(a))[0] ?? null;
}

export class BandConsensus {
  private recent: DetectedBand[][] = [];
  reset() { this.recent = []; }
  add(bands: DetectedBand[] | null) {
    this.recent.push(bands ?? []);
    this.recent = this.recent.slice(-5);
    if (!bands) return null;
    // Brightness warnings and gap estimates can fluctuate without changing digits.
    const key = bands.map(b => b.color).join();
    const matching = this.recent.filter(b => b.map(c => c.color).join() === key);
    if (matching.length < 3) return null;
    return bands.map((b, i) => ({ ...b, uncertain: matching.some(frame => frame[i].uncertain) }));
  }
}
