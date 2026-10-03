export const bandColors = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white', 'gold', 'silver'] as const;
export type BandColor = typeof bandColors[number];
export type ComponentType = 'resistor' | 'inductor' | 'inductor-mil';
export const colorHex: Record<BandColor, string> = {
  black: '#202020', brown: '#754321', red: '#c52c30', orange: '#ed7d25', yellow: '#f3d438', green: '#36804b', blue: '#3261ae', violet: '#824899', grey: '#808080', white: '#eeeeee', gold: '#b99742', silver: '#bdbdbd',
};
const tolerances: Partial<Record<BandColor, number>> = { brown: 1, red: 2, green: .5, blue: .25, violet: .1, grey: .05, gold: 5, silver: 10 };
export type BandReading = { value: number; tolerance: number; colors: BandColor[]; reversed: boolean };

function decodeOne(colors: BandColor[], type: ComponentType): Omit<BandReading, 'reversed'> | null {
  const mil = type === 'inductor-mil';
  if (mil && (colors.length !== 5 || colors[0] !== 'silver')) return null;
  const bands = mil ? colors.slice(1) : colors;
  if (type === 'resistor' ? ![4, 5].includes(bands.length) : bands.length !== 4) return null;
  const tolerance = tolerances[bands.at(-1)!];
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
export function classifyBand(rgb: RGB): BandColor | null {
  const sample = lab(rgb);
  const ranked = references.map(ref => ({ color: ref.color, distance: distance(sample, ref.lab) })).sort((a, b) => a.distance - b.distance);
  return ranked[0].distance < 28 && ranked[1].distance - ranked[0].distance > 3 ? ranked[0].color : null;
}

export type DetectedBand = { color: BandColor; x: number };
// The input is the narrow horizontal strip shown by the camera guide. The
// dominant paint is treated as the body; narrow contrasting runs are bands.
export function detectBandStrip(data: Uint8ClampedArray, width: number, height: number, count: number): DetectedBand[] | null {
  if (width < 80 || height < 1 || data.length !== width * height * 4) return null;
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const columns: RGB[] = Array.from({ length: width }, (_, x) => [0, 1, 2].map(c => median(Array.from({ length: height }, (_, y) => data[(y * width + x) * 4 + c]))) as RGB);
  const buckets = new Map<string, RGB[]>();
  columns.forEach(rgb => { const key = rgb.map(v => Math.round(v / 24)).join(','); buckets.set(key, [...(buckets.get(key) || []), rgb]); });
  const bodyPixels = [...buckets.values()].sort((a, b) => b.length - a.length)[0];
  if (bodyPixels.length < width * .18) return null;
  const body = lab([0, 1, 2].map(c => median(bodyPixels.map(rgb => rgb[c]))) as RGB);
  const colors = columns.map(rgb => distance(lab(rgb), body) > 16 ? classifyBand(rgb) : null);
  // A three-column vote removes isolated sensor noise without joining bands.
  const filtered = colors.map((color, x) => x > 0 && x < width - 1 && colors[x - 1] === colors[x + 1] ? colors[x - 1] : color);
  const runs: { color: BandColor | null; start: number; end: number }[] = [];
  filtered.forEach((color, x) => { const last = runs.at(-1); if (last?.color === color) last.end = x + 1; else runs.push({ color, start: x, end: x + 1 }); });
  const found = runs.filter(run => run.color && run.end - run.start >= Math.max(3, width * .015));
  if (found.length !== count || found.some(run => run.end - run.start > width * .18 || run.start < width * .02 || run.end > width * .98)) return null;
  return found.map(run => ({ color: run.color!, x: (run.start + run.end) / (2 * width) }));
}
