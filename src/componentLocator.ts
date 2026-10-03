export type ComponentTarget = {
  cx: number; cy: number; length: number; thickness: number; angle: number;
  box: { x: number; y: number; width: number; height: number };
};
// Local visual detector: painted-body segmentation, connected regions, a principal
// axis and repeated band-edge evidence. No frames leave the browser.
export function locateComponent(data: Uint8ClampedArray, width: number, height: number, previous?: ComponentTarget | null): ComponentTarget | null {
  if (width < 80 || height < 40 || data.length !== width * height * 4) return null;
  const mask = new Uint8Array(width * height);
  for (let p = 0; p < mask.length; p++) {
    const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const saturation = (max - min) / Math.max(1, max);
    const coolPaint = (b > r * 1.18 && b > g * .92) || (g > r * 1.18 && g > b * .98);
    const warmPaint = r > g * 1.06 && g > b * 1.06;
    if (max > 45 && saturation > .23 && (coolPaint || warmPaint)) mask[p] = 1;
  }
  // Join paint separated by dark bands. This is a horizontal-placement detector,
  // with an estimated axis to handle modest tilt rather than a fixed scan line.
  const gapLimit = Math.max(3, Math.round(width * .018));
  for (let y = 0; y < height; y++) {
    let last = -gapLimit - 2;
    for (let x = 0; x < width; x++) if (mask[y * width + x]) {
      if (x - last <= gapLimit) for (let k = last + 1; k < x; k++) mask[y * width + k] = 1;
      last = x;
    }
  }
  const visited = new Uint8Array(mask.length), queue = new Int32Array(mask.length);
  let best: ComponentTarget | null = null, bestScore = 0;
  for (let seed = 0; seed < mask.length; seed++) {
    if (!mask[seed] || visited[seed]) continue;
    let tail = 1, head = 0;
    queue[0] = seed; visited[seed] = 1;
    let minX = width, maxX = 0, minY = height, maxY = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    while (head < tail) {
      const p = queue[head++], x = p % width, y = Math.floor(p / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
        const next = p + dy * width + dx;
        if (mask[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    if (tail < 45 || bw < 22 || bw > width * .78 || bh < 5 || bh > height * .22 || bw / bh < 1.5 || bw / bh > 12) continue;
    const cx = sx / tail, cy = sy / tail;
    const angle = .5 * Math.atan2(2 * (sxy / tail - cx * cy), sxx / tail - cx * cx - (syy / tail - cy * cy));
    if (Math.abs(angle) > Math.PI / 5) continue;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (let i = 0; i < tail; i++) {
      const dx = queue[i] % width - cx, dy = Math.floor(queue[i] / width) - cy;
      const u = dx * cos + dy * sin, v = -dx * sin + dy * cos;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    const length = maxU - minU + 1, thickness = maxV - minV + 1, aspect = length / thickness;
    if (aspect < 2 || aspect > 10 || tail / (length * thickness) < .3) continue;
    const midU = (minU + maxU) / 2, midV = (minV + maxV) / 2;
    const target: ComponentTarget = { cx: cx + midU * cos - midV * sin, cy: cy + midU * sin + midV * cos, length, thickness, angle, box: { x: minX / width, y: minY / height, width: bw / width, height: bh / height } };
    // A body-shaped colored region needs several narrow contrast transitions.
    // This rejects plain wires and most fingers instead of assigning a value.
    const strip = sampleComponentStrip(data, width, height, target, Math.round(length), 3);
    const profile = Array.from({ length: Math.round(length) }, (_, x) => {
      const p = (Math.round(length) + x) * 4;
      return [strip[p], strip[p + 1], strip[p + 2]];
    });
    let edges = 0;
    for (let x = 2; x < profile.length - 2; x++) {
      const diff = Math.hypot(...profile[x + 1].map((v, c) => v - profile[x - 1][c]));
      if (diff > 38) { edges++; x += 2; }
    }
    if (edges < 4) continue;
    const centrality = 1 - Math.min(1, Math.hypot(target.cx / width - .5, target.cy / height - .5));
    const tracking = previous ? Math.max(0, 1 - Math.hypot(target.cx - previous.cx, target.cy - previous.cy) / (width * .18)) : 0;
    const score = Math.min(edges, 12) + centrality * 2 + tracking * 2;
    if (score > bestScore) { best = target; bestScore = score; }
  }
  return best;
}

export function sampleComponentStrip(data: Uint8ClampedArray, width: number, height: number, target: ComponentTarget, outWidth = 420, outHeight = 9) {
  const result = new Uint8ClampedArray(outWidth * outHeight * 4);
  const cos = Math.cos(target.angle), sin = Math.sin(target.angle);
  for (let y = 0; y < outHeight; y++) for (let x = 0; x < outWidth; x++) {
    const u = ((x + .5) / outWidth - .5) * target.length;
    const v = ((y + .5) / outHeight - .5) * target.thickness * .28;
    const sx = Math.max(0, Math.min(width - 1, Math.round(target.cx + u * cos - v * sin)));
    const sy = Math.max(0, Math.min(height - 1, Math.round(target.cy + u * sin + v * cos)));
    const source = (sy * width + sx) * 4, dest = (y * outWidth + x) * 4;
    for (let c = 0; c < 4; c++) result[dest + c] = data[source + c];
  }
  return result;
}
