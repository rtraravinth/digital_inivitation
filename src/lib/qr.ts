/**
 * A minimal, real QR Code encoder — byte mode, error-correction level L,
 * versions 1–9, mask pattern 0.
 *
 * Why hand-rolled: the print code on /stats has to actually scan. A drawn
 * grid of squares that merely looks like a QR code would be a picture of a
 * feature rather than the feature, and the CSP on a published page rules out
 * pulling an encoder off a CDN.
 *
 * Why this narrow: a page address is short. Version 9 at level L carries 232
 * bytes, which is far more than "https://facet.page/<slug>" will ever need,
 * so the multi-size interleave of versions 10+ is deliberately not here —
 * encode() throws instead of guessing.
 *
 * Mask 0 is fixed rather than chosen by penalty score. Any of the eight masks
 * decodes; scoring only trades a little robustness, and the format bits below
 * carry mask 0 correctly, which is what makes the code valid.
 */

/* ── GF(256), primitive polynomial 0x11D ──────────────────────────────── */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  // Doubled so a product's exponent never needs a modulo.
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/** Coefficients of (x−α⁰)(x−α¹)… , highest power first, leading coeff 1. */
export function rsGenerator(degree: number): number[] {
  let result = [1];
  let root = 1;
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(result.length + 1).fill(0);
    for (let j = 0; j < result.length; j++) {
      next[j] ^= result[j];
      next[j + 1] ^= gfMul(result[j], root);
    }
    result = next;
    root = gfMul(root, 2);
  }
  return result;
}

/** The `degree` error-correction codewords for one block of data. */
export function rsRemainder(data: Uint8Array | number[], degree: number): number[] {
  const gen = rsGenerator(degree);
  const result = new Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let i = 0; i < degree; i++) result[i] ^= gfMul(gen[i + 1], factor);
  }
  return result;
}

/* ── version tables, error-correction level L ─────────────────────────── */

type VersionSpec = {
  /** Data codewords across the whole symbol. */
  data: number;
  /** Error-correction codewords per block. */
  ecPerBlock: number;
  blocks: number;
};

// Every level-L version from 1 to 9 has equally-sized blocks, which is what
// keeps the interleave below a single loop.
const VERSIONS: Record<number, VersionSpec> = {
  1: { data: 19, ecPerBlock: 7, blocks: 1 },
  2: { data: 34, ecPerBlock: 10, blocks: 1 },
  3: { data: 55, ecPerBlock: 15, blocks: 1 },
  4: { data: 80, ecPerBlock: 20, blocks: 1 },
  5: { data: 108, ecPerBlock: 26, blocks: 1 },
  6: { data: 136, ecPerBlock: 18, blocks: 2 },
  7: { data: 156, ecPerBlock: 20, blocks: 2 },
  8: { data: 194, ecPerBlock: 24, blocks: 2 },
  9: { data: 232, ecPerBlock: 30, blocks: 2 },
};

const ALIGNMENT: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
};

/** BCH(15,5) format bits for level L + mask 0, already XOR-masked. */
const FORMAT_L_MASK0 = 0x77c4;

/** Golay(18,6) version bits, needed from version 7 up. */
const VERSION_BITS: Record<number, number> = {
  7: 0x07c94,
  8: 0x085bc,
  9: 0x09a99,
};

/* ── encoding ─────────────────────────────────────────────────────────── */

function pickVersion(byteLength: number): number {
  for (let v = 1; v <= 9; v++) {
    // 4 mode bits + 8 count bits = 2 codewords of overhead below version 10.
    if (VERSIONS[v].data >= byteLength + 2) return v;
  }
  throw new Error(
    `QR: ${byteLength} bytes needs a version above 9, which this encoder does not build.`,
  );
}

function toCodewords(bytes: Uint8Array, version: number): number[] {
  const spec = VERSIONS[version];
  const bits: number[] = [];
  const push = (value: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, 8); // count indicator is 8 bits below version 10
  for (const b of bytes) push(b, 8);

  const capacity = spec.data * 8;
  // Terminator: up to four zero bits, then round out the final byte.
  for (let i = 0; i < 4 && bits.length < capacity; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  // Alternating pad codewords fill the rest of the data capacity.
  for (let i = 0; codewords.length < spec.data; i++) {
    codewords.push(i % 2 === 0 ? 0xec : 0x11);
  }
  return codewords;
}

function interleave(codewords: number[], version: number): number[] {
  const { ecPerBlock, blocks } = VERSIONS[version];
  const perBlock = codewords.length / blocks;

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  for (let b = 0; b < blocks; b++) {
    const chunk = codewords.slice(b * perBlock, (b + 1) * perBlock);
    dataBlocks.push(chunk);
    ecBlocks.push(rsRemainder(chunk, ecPerBlock));
  }

  const out: number[] = [];
  for (let i = 0; i < perBlock; i++) for (const b of dataBlocks) out.push(b[i]);
  for (let i = 0; i < ecPerBlock; i++) for (const b of ecBlocks) out.push(b[i]);
  return out;
}

/* ── module placement ─────────────────────────────────────────────────── */

type Grid = {
  size: number;
  modules: boolean[][];
  reserved: boolean[][];
};

function blank(size: number): Grid {
  return {
    size,
    modules: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
    reserved: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
  };
}

function setFunction(g: Grid, row: number, col: number, dark: boolean) {
  if (row < 0 || col < 0 || row >= g.size || col >= g.size) return;
  g.modules[row][col] = dark;
  g.reserved[row][col] = true;
}

function drawFinder(g: Grid, row: number, col: number) {
  // The 7×7 eye plus its one-module separator, clipped at the symbol edge.
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
      setFunction(g, row + r, col + c, ring !== 2 && ring <= 3);
    }
  }
}

function drawAlignment(g: Grid, row: number, col: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      setFunction(g, row + r, col + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
    }
  }
}

function drawFunctionPatterns(g: Grid, version: number) {
  const { size } = g;

  drawFinder(g, 0, 0);
  drawFinder(g, 0, size - 7);
  drawFinder(g, size - 7, 0);

  // Timing patterns run between the finders on row 6 and column 6.
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    setFunction(g, 6, i, dark);
    setFunction(g, i, 6, dark);
  }

  const centers = ALIGNMENT[version];
  for (const r of centers) {
    for (const c of centers) {
      // The three corners already carry finder patterns.
      const atFinder =
        (r === 6 && c === 6) ||
        (r === 6 && c === size - 7) ||
        (r === size - 7 && c === 6);
      if (!atFinder) drawAlignment(g, r, c);
    }
  }

  // Format information, twice, plus the module that is always dark.
  for (let i = 0; i < 15; i++) {
    const bit = ((FORMAT_L_MASK0 >> i) & 1) === 1;
    if (i <= 5) setFunction(g, i, 8, bit);
    else if (i === 6) setFunction(g, 7, 8, bit);
    else if (i === 7) setFunction(g, 8, 8, bit);
    else if (i === 8) setFunction(g, 8, 7, bit);
    else setFunction(g, 8, 14 - i, bit);

    if (i < 8) setFunction(g, 8, size - 1 - i, bit);
    else setFunction(g, size - 15 + i, 8, bit);
  }
  setFunction(g, size - 8, 8, true);

  const versionBits = VERSION_BITS[version];
  if (versionBits !== undefined) {
    for (let i = 0; i < 18; i++) {
      const bit = ((versionBits >> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunction(g, b, a, bit);
      setFunction(g, a, b, bit);
    }
  }
}

function placeData(g: Grid, codewords: number[]) {
  const { size } = g;
  const total = codewords.length * 8;
  let bit = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    // Column 6 is the vertical timing pattern; the pairing steps over it.
    const col = right <= 6 ? right - 1 : right;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (let c = 0; c < 2; c++) {
        const x = col - c;
        if (g.reserved[row][x]) continue;
        // Anything past the last codeword is a remainder bit: left light,
        // and masked along with everything else below.
        if (bit < total) {
          g.modules[row][x] = ((codewords[bit >> 3] >> (7 - (bit & 7))) & 1) === 1;
        }
        bit++;
      }
    }
    upward = !upward;
  }
}

/** Mask 0: invert every data module where (row + column) is even. */
function applyMask(g: Grid) {
  for (let r = 0; r < g.size; r++) {
    for (let c = 0; c < g.size; c++) {
      if (!g.reserved[r][c] && (r + c) % 2 === 0) g.modules[r][c] = !g.modules[r][c];
    }
  }
}

/**
 * Encode `text` as a matrix of modules, `true` being dark. Row-major, and
 * without a quiet zone — the renderer adds that.
 */
export function qrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const version = pickVersion(bytes.length);
  const g = blank(17 + 4 * version);

  drawFunctionPatterns(g, version);
  placeData(g, interleave(toCodewords(bytes, version), version));
  applyMask(g);

  return g.modules;
}

/** An SVG path covering every dark module, for a 1-unit-per-module viewBox. */
export function qrPath(matrix: boolean[][]): string {
  const parts: string[] = [];
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix.length; c++) {
      if (matrix[r][c]) parts.push(`M${c} ${r}h1v1h-1z`);
    }
  }
  return parts.join("");
}

/** The quiet zone the spec asks for, in modules, on every side. */
export const QUIET_ZONE = 4;
