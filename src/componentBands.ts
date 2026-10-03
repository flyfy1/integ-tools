export const bandColors = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white', 'gold', 'silver'] as const;
export type BandColor = typeof bandColors[number];
export type ComponentType = 'resistor' | 'inductor' | 'inductor-mil';
export const colorHex: Record<BandColor, string> = {
  black: '#202020', brown: '#754321', red: '#c52c30', orange: '#ed7d25', yellow: '#f3d438', green: '#36804b', blue: '#3261ae', violet: '#824899', grey: '#808080', white: '#eeeeee', gold: '#b99742', silver: '#bdbdbd',
};
export const bandTolerances: Partial<Record<BandColor, number>> = { brown: 1, red: 2, green: .5, blue: .25, violet: .1, grey: .05, gold: 5, silver: 10 };
export type BandReading = { value: number; tolerance: number; colors: BandColor[]; reversed: boolean };

function decodeOne(colors: BandColor[], type: ComponentType): Omit<BandReading, 'reversed'> | null {
  const mil = type === 'inductor-mil';
  if (mil && (colors.length !== 5 || colors[0] !== 'silver')) return null;
  const bands = mil ? colors.slice(1) : colors;
  if (type === 'resistor' ? ![4, 5].includes(bands.length) : bands.length !== 4) return null;
  const tolerance = bandTolerances[bands.at(-1)!];
  if (tolerance === undefined || (type !== 'resistor' && !['gold', 'silver'].includes(bands.at(-1)!))) return null;
  const digits = bands.slice(0, -2).map(c => bandColors.indexOf(c));
  const multiplier = bandColors.indexOf(bands.at(-2)!);
  let value: number;
  if (mil && bands.slice(0, 2).includes('gold')) {
    const significant = bands.slice(0, 3).filter(c => c !== 'gold').map(c => bandColors.indexOf(c));
    if (significant.length !== 2 || significant.some(d => d > 9)) return null;
    value = (significant[0] * 10 + significant[1]) / (bands[0] === 'gold' ? 100 : 10);
  } else {
    if (digits.some(d => d > 9) || digits[0] === 0) return null;
    if (mil && multiplier > 3) return null;
    value = Number(`${digits.join('')}e${multiplier === 10 ? -1 : multiplier === 11 ? -2 : multiplier}`);
  }
  return { value, tolerance, colors };
}

// Both directions are retained when the code is valid in each direction.
export function decodeBands(colors: BandColor[], type: ComponentType): BandReading[] {
  const forward = decodeOne(colors, type);
  const reversed = decodeOne([...colors].reverse(), type);
  const readings: BandReading[] = forward ? [{ ...forward, reversed: false }] : [];
  if (reversed && (!forward || reversed.value !== forward.value || reversed.tolerance !== forward.tolerance)) readings.push({ ...reversed, reversed: true });
  return readings;
}

export function formatComponentValue(value: number, type: ComponentType) {
  const units = type === 'resistor' ? [[1e9, 'GΩ'], [1e6, 'MΩ'], [1e3, 'kΩ'], [1, 'Ω']] as const : [[1e6, 'H'], [1e3, 'mH'], [1, 'µH']] as const;
  const [scale, unit] = units.find(([scale]) => value >= scale) || units.at(-1)!;
  return `${Number((value / scale).toPrecision(6))} ${unit}`;
}

type RGB = [number, number, number];
function lab(rgb: RGB): RGB {
  const [r, g, b] = rgb.map(v => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
  const f = (v: number) => v > .008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
  const x = f((r * .4124 + g * .3576 + b * .1805) / .95047), y = f(r * .2126 + g * .7152 + b * .0722), z = f((r * .0193 + g * .1192 + b * .9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const distance = (a: RGB, b: RGB) => Math.hypot(...a.map((v, i) => v - b[i]));
const references = bandColors.map(color => ({ color, lab: lab([1, 3, 5].map(i => parseInt(colorHex[color].slice(i, i + 2), 16)) as RGB) }));
function hsv([r, g, b]: RGB) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let h = delta === 0 ? 0 : max === r ? 60 * ((g - b) / delta % 6) : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);
  if (h < 0) h += 360;
  return { h, s: delta / Math.max(1, max), v: max / 255 };
}
const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
export function classifyBand(rgb: RGB): BandColor | null {
  const { h, s, v } = hsv(rgb);
  // Hue survives dim lighting better than the distance to a bright reference.
  // Very dark paint is black; colored tolerance bands remain reviewable below.
  if (v < .28) return 'black';
  if (s < .14) return v > .85 ? 'white' : v > .65 ? 'silver' : 'grey';
  if ((h < 15 || h > 325) && s > .2) return 'red';
  if (h >= 15 && h < 40 && v < .6) return 'brown';
  if (h >= 30 && h < 68 && v < .87 && s > .3) return 'gold';
  if (h >= 15 && h < 40) return 'orange';
  if (h >= 40 && h < 75) return 'yellow';
  if (h >= 75 && h < 165) return 'green';
  if (h >= 165 && h < 255) return 'blue';
  if (h >= 255 && h <= 325) return 'violet';
  const sample = lab(rgb);
  const ranked = references.map(ref => ({ color: ref.color, distance: distance(sample, ref.lab) })).sort((a, b) => a.distance - b.distance);
  return ranked[0].distance < 28 ? ranked[0].color : null;
}

export type DetectedBand = { color: BandColor; x: number; uncertain?: boolean };
// The input is an axis-aligned strip sampled from the located component. The
// dominant paint is treated as the body; narrow contrasting runs are bands.
export function detectBandStrip(data: Uint8ClampedArray, width: number, height: number, count: number): DetectedBand[] | null {
  if (width < 80 || height < 1 || data.length !== width * height * 4) return null;
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const columns: RGB[] = Array.from({ length: width }, (_, x) => [0, 1, 2].map(c => median(Array.from({ length: height }, (_, y) => data[(y * width + x) * 4 + c]))) as RGB);
  const buckets = new Map<string, RGB[]>();
  columns.forEach(rgb => {
    const c = hsv(rgb);
    // Bucket paint by hue, not absolute RGB: curved blue bodies have a broad
    // brightness gradient even in a single frame.
    const key = c.s > .2 && c.v > .32 ? `h${Math.round(c.h / 20) % 18}` : 'neutral';
    if (key !== 'neutral' || c.s < .14 && c.v > .45) buckets.set(key, [...(buckets.get(key) || []), rgb]);
  });
  const bodyPixels = [...buckets.values()].sort((a, b) => b.length - a.length)[0];
  if (!bodyPixels || bodyPixels.length < width * .18) return null;
  const bodyRGB = [0, 1, 2].map(c => median(bodyPixels.map(rgb => rgb[c]))) as RGB;
  const body = lab(bodyRGB), bodyHSV = hsv(bodyRGB);
  const bodyLike = columns.map(rgb => {
    const c = hsv(rgb);
    return c.v > bodyHSV.v * .65 && Math.abs(c.s - bodyHSV.s) < .22 && (bodyHSV.s < .14 || hueDistance(c.h, bodyHSV.h) < 22);
  });
  const first = bodyLike.indexOf(true), last = bodyLike.lastIndexOf(true);
  if (first < 0 || last - first < width * .45) return null;
  const bandMask = columns.map((rgb, x) => {
    if (x < first || x > last) return false;
    const c = hsv(rgb);
    const cue = c.v < bodyHSV.v * .7 || Math.abs(c.s - bodyHSV.s) > .22 || bodyHSV.s > .14 && hueDistance(c.h, bodyHSV.h) > 24;
    return cue && distance(lab(rgb), body) > 13;
  });
  // Repair single-column holes caused by glare without splitting one band into
  // several guessed colors. Classify only after the complete band is segmented.
  const filtered = bandMask.map((value, x) => x > 0 && x < width - 1 && bandMask[x - 1] === bandMask[x + 1] ? bandMask[x - 1] : value);
  const runs: { start: number; end: number }[] = [];
  for (let x = first; x <= last; x++) if (filtered[x]) {
    const start = x;
    while (x <= last && filtered[x]) x++;
    if (x - start >= Math.max(3, width * .015)) runs.push({ start, end: x });
  }
  if (runs.length !== count || runs.some(run => run.end - run.start > width * .18)) return null;
  const found: DetectedBand[] = [];
  for (const run of runs) {
    const inset = Math.floor((run.end - run.start) * .25);
    const core = columns.slice(run.start + inset, run.end - inset);
    const rgb = [0, 1, 2].map(c => median(core.map(v => v[c]))) as RGB;
    const color = classifyBand(rgb);
    if (!color) return null;
    const sampleHSV = hsv(rgb);
    found.push({ color, x: (run.start + run.end) / (2 * width), uncertain: color !== 'black' && sampleHSV.v < .42 });
  }
  return found;
}
