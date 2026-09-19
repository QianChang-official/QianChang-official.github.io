/* ========== Shared Audio Visualization (koharu palette) ========== */
/* Input spectrum  : pink   (--color-pink #ed6ea0 → #e91e63)
   Output spectrum : blue   (shoka blue → deep blue)
   Response curve  : pink                                     */

export const CANVAS_BG = '#21252b';
const GRID_LINE = 'rgba(255,255,255,0.06)';
const GRID_LABEL = 'rgba(255,255,255,0.25)';

export function drawSpectrum(
  canvas: HTMLCanvasElement | null,
  data: Uint8Array | null,
  colors: [string, string] = ['#ed6ea0', '#e91e63'],
) {
  if (!canvas || !data) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = CANVAS_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const bars = 90;
  const step = Math.floor(data.length / bars);
  let x = 0;
  const barW = (canvas.width / bars) * 0.85;
  for (let i = 0; i < bars; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
    const h = (sum / step / 255) * canvas.height;
    const g = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - h);
    g.addColorStop(0, colors[1]);
    g.addColorStop(1, colors[0]);
    ctx.fillStyle = g;
    ctx.fillRect(x, canvas.height - h, barW, h);
    x += barW + 2;
  }
}

export function drawResponseCurve(canvas: HTMLCanvasElement | null, filters: BiquadFilterNode[]) {
  if (!canvas || filters.length === 0 || filters.some((f) => !f)) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = CANVAS_BG;
  ctx.fillRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = GRID_LINE;
  ctx.lineWidth = 1;
  for (let db = -24; db <= 24; db += 6) {
    const y = h / 2 - (db / 24) * (h / 2);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.fillStyle = GRID_LABEL;
    ctx.font = '10px monospace';
    ctx.fillText(db + 'dB', 4, y - 2);
  }
  for (let i = 0; i <= 10; i++) {
    const freq = 20 * 1000 ** (i / 10);
    const x = (i / 10) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.fillStyle = GRID_LABEL;
    ctx.font = '10px monospace';
    const label = freq >= 1000 ? (freq / 1000).toFixed(0) + 'k' : freq.toFixed(0);
    ctx.fillText(label, x + 2, h - 4);
  }

  // Compute response
  const freqs = new Float32Array(512);
  const totalMag = new Float32Array(512).fill(1.0);
  const mag = new Float32Array(512);
  const phase = new Float32Array(512);
  for (let i = 0; i < 512; i++) {
    freqs[i] = 20 * 1000 ** (i / 511);
  }

  try {
    filters.forEach((filter) => {
      if (!filter) return;
      filter.getFrequencyResponse(freqs, mag, phase);
      for (let i = 0; i < 512; i++) {
        totalMag[i] *= mag[i];
      }
    });

    // Draw curve
    ctx.beginPath();
    ctx.strokeStyle = '#ed6ea0';
    ctx.lineWidth = 2;
    for (let i = 0; i < 512; i++) {
      const x = (i / 511) * w;
      const db = 20 * Math.log10(Math.max(totalMag[i], 0.0001));
      const y = h / 2 - (db / 24) * (h / 2);
      if (i === 0) ctx.moveTo(x, Math.max(0, Math.min(h, y)));
      else ctx.lineTo(x, Math.max(0, Math.min(h, y)));
    }
    ctx.stroke();

    // Fill
    ctx.lineTo(w, h / 2);
    ctx.lineTo(0, h / 2);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(237,110,160,0.15)');
    grad.addColorStop(0.5, 'rgba(237,110,160,0.02)');
    grad.addColorStop(1, 'rgba(237,110,160,0.15)');
    ctx.fillStyle = grad;
    ctx.fill();
  } catch {
    // getFrequencyResponse may fail if context not running
  }
}
