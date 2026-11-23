// Isometric drawings, the way an engineering plan draws a machine: boxes and
// cylinders with shaded faces (the top lightest, the sides darker), one part
// lit in the accent, a callout with its spec, numbers and lists set on the
// faces in perspective. Each scene is built here and returned as SVG.

const C = Math.cos(Math.PI / 6);
const S = 0.5;
const f = (n: number) => Math.round(n * 10) / 10;

type Tone = "base" | "hi" | "dark";
type V3 = [number, number, number];

export class Scene {
  parts: string[] = [];
  /** The drawing's extent (not the callout's or the readout's). */
  box2 = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  track = true;
  /** Compact: no callout, no readout (small cards). */
  compact = false;
  /** The ground's height: solids standing on it cast a shadow onto it. */
  ground: number | null = null;
  /** A solid's shadow on the ground: its footprint and the footprint moved
   * by its height along the light (from the back right), as one shape. */
  shadow(foot: [number, number][], h: number) {
    if (this.ground === null) return;
    const g = this.ground;
    const lx = -0.25 * h;
    const ly = 0.8 * h;
    const pts: [number, number][] = [];
    this.track = false;
    for (const [x, y] of foot) {
      pts.push(this.p([x, y, g]));
      pts.push(this.p([x + lx, y + ly, g]));
    }
    this.track = true;
    // the outline round them all (monotone chain)
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo: number[][] = [];
    for (const q of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    const hi: number[][] = [];
    for (const q of [...pts].reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
    const hull = [...lo.slice(0, -1), ...hi.slice(0, -1)];
    this.add(`<polygon class="iso-cast" points="${hull.map((q) => q.map(f).join(",")).join(" ")}"/>`);
  }
  /** A plate with rounded corners, t thick, its top at z + t. */
  plateR(x: number, y: number, w: number, d: number, z: number, t: number, r = 14) {
    const pts: [number, number][] = [];
    const corner = (cx: number, cy: number, a0: number) => {
      for (let i = 0; i <= 6; i++) {
        const a = a0 + (i / 6) * (Math.PI / 2);
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    };
    corner(x + w - r, y + r, -Math.PI / 2);
    corner(x + w - r, y + d - r, 0);
    corner(x + r, y + d - r, Math.PI / 2);
    corner(x + r, y + r, Math.PI);
    this.add(`<g class="iso-plate" ${this.order()}>`);
    // its rim: a strip between the top's outline and the bottom's, the
    // front of it shown (the back is under the top)
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const [a0, b0] = pts[i];
      const [a1, b1] = pts[(i + 1) % n];
      // only where the edge faces you (toward +x or +y)
      if (b1 - b0 > 0.01 || a0 - a1 > 0.01) {
        const facing = b1 - b0 > a0 - a1 ? "iso-rim-r" : "iso-rim-l";
        this.poly([[a0, b0, z], [a1, b1, z], [a1, b1, z + t], [a0, b0, z + t]], facing);
      }
    }

    this.poly(pts.map(([a, b]) => [a, b, z + t] as V3), "iso-tk");
    this.add("</g>");
    this.ground = z + t;
    return this;
  }

  /** Each solid's place in the order it's built (its entrance delay). */
  k = 0;
  order() {
    return `style="--k:${Math.min(this.k++, 40)}"`;
  }
  constructor(public ox: number, public oy: number) {}

  p([x, y, z]: V3): [number, number] {
    const q: [number, number] = [this.ox + (x - y) * C, this.oy + (x + y) * S - z];
    if (this.track) {
      const b = this.box2;
      b.x0 = Math.min(b.x0, q[0]); b.x1 = Math.max(b.x1, q[0]);
      b.y0 = Math.min(b.y0, q[1]); b.y1 = Math.max(b.y1, q[1]);
    }
    return q;
  }
  /** The view round the drawing alone, with a margin. */
  tight(pad = 14) {
    const b = this.box2;
    return `${f(b.x0 - pad)} ${f(b.y0 - pad)} ${f(b.x1 - b.x0 + 2 * pad)} ${f(b.y1 - b.y0 + 2 * pad)}`;
  }
  pts(list: V3[]) {
    return list.map((v) => this.p(v).map(f).join(",")).join(" ");
  }
  add(s: string) {
    this.parts.push(s);
    return this;
  }
  poly(list: V3[], cls: string) {
    return this.add(`<polygon class="${cls}" points="${this.pts(list)}"/>`);
  }
  line(a: V3, b: V3, cls = "iso-ln") {
    const [x1, y1] = this.p(a);
    const [x2, y2] = this.p(b);
    return this.add(`<line class="${cls}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`);
  }
  path3(list: V3[], cls = "iso-ln") {
    return this.add(`<polyline class="${cls}" points="${this.pts(list)}"/>`);
  }

  /** A box at (x, y, z), w along x, d along y, h up; the visible faces. */
  box(x: number, y: number, z: number, w: number, d: number, h: number, tone: Tone = "base", extra = "") {
    const t = tone === "hi" ? "a" : tone === "dark" ? "k" : "";
    if (this.ground !== null && Math.abs(z - this.ground) < 0.6 && h > 3) this.shadow([[x, y], [x + w, y], [x + w, y + d], [x, y + d]], h);
    const g = `<g class="iso-box${tone === "hi" ? " iso-hi" : ""} ${extra}" ${this.order()}>`;
    this.add(g);
    // front-left face (y = y + d)
    this.poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], `iso-l${t}`);
    // front-right face (x = x + w)
    this.poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], `iso-r${t}`);
    // top
    this.poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], `iso-t${t}`);
    return this.add("</g>");
  }

  /** A vertical cylinder: its top ellipse, its side. */
  cyl(x: number, y: number, z: number, r: number, h: number, tone: Tone = "base", extra = "") {
    const t = tone === "hi" ? "a" : tone === "dark" ? "k" : "";
    if (this.ground !== null && Math.abs(z - this.ground) < 0.6 && h > 3)
      this.shadow(Array.from({ length: 16 }, (_, i) => [x + r * Math.cos((i / 16) * Math.PI * 2), y + r * Math.sin((i / 16) * Math.PI * 2)] as [number, number]), h);
    const [cx, cyTop] = this.p([x, y, z + h]);
    const [, cyBot] = this.p([x, y, z]);
    const rx = r * Math.SQRT2 * C;
    const ry = r * Math.SQRT2 * S;
    this.add(`<g class="iso-box${tone === "hi" ? " iso-hi" : ""} ${extra}" ${this.order()}>`);
    this.add(
      `<path class="iso-r${t}" d="M${f(cx - rx)} ${f(cyTop)}V${f(cyBot)}A${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(cyBot)}V${f(cyTop)}Z"/>`,
    );
    this.add(`<ellipse class="iso-t${t}" cx="${f(cx)}" cy="${f(cyTop)}" rx="${f(rx)}" ry="${f(ry)}"/>`);
    return this.add("</g>");
  }

  /** Text lying on a top face, reading along +x. */
  top(x: number, y: number, z: number, s: string, size = 9, cls = "iso-tx") {
    const [ex, ey] = this.p([x, y, z]);
    return this.add(`<text class="${cls}" font-size="${size}" transform="matrix(${f(C)} ${S} ${f(-C)} ${S} ${f(ex)} ${f(ey)})">${s}</text>`);
  }
  /** Text lying on a top face, reading along -y (up and to the right). */
  topY(x: number, y: number, z: number, s: string, size = 9, cls = "iso-tx") {
    const [ex, ey] = this.p([x, y, z]);
    return this.add(`<text class="${cls}" font-size="${size}" transform="matrix(${f(C)} ${-S} ${f(C)} ${S} ${f(ex)} ${f(ey)})">${s}</text>`);
  }
  /** Text on a front-right face (x fixed), reading up and to the right. */
  right(x: number, y: number, z: number, s: string, size = 9, cls = "iso-tx") {
    const [ex, ey] = this.p([x, y, z]);
    return this.add(`<text class="${cls}" font-size="${size}" transform="matrix(${f(C)} ${-S} 0 1 ${f(ex)} ${f(ey)})">${s}</text>`);
  }
  /** Text on a front-left face (y fixed), reading down and to the right. */
  left(x: number, y: number, z: number, s: string, size = 9, cls = "iso-tx") {
    const [ex, ey] = this.p([x, y, z]);
    return this.add(`<text class="${cls}" font-size="${size}" transform="matrix(${f(C)} ${S} 0 1 ${f(ex)} ${f(ey)})">${s}</text>`);
  }

  /** A line of bars on a top face (a window's content, a list's lengths). */
  bars(x: number, y: number, z: number, rows: number[], gap = 8, cls = "iso-bar") {
    rows.forEach((w, i) => {
      if (w > 0) this.line([x, y + i * gap, z], [x + w, y + i * gap, z], cls);
    });
    return this;
  }

  dot(v: V3, cls = "iso-dot", r = 3) {
    const [x, y] = this.p(v);
    return this.add(`<circle class="${cls}" cx="${f(x)}" cy="${f(y)}" r="${r}"/>`);
  }

  /** The lit part's pin (the spec's words were dropped: the drawing says it). */
  callout(v: V3, ..._rest: unknown[]) {
    this.track = false;
    const [px, py] = this.p(v);
    this.track = true;
    return this.add(`<circle class="iso-pin" cx="${f(px)}" cy="${f(py)}" r="3.5"/>`);
  }

  /** A band round a cylinder (a ring of its side): no top of its own. */
  band(x: number, y: number, z: number, r: number, h: number, tone: Tone = "hi", extra = "") {
    const t = tone === "hi" ? "a" : "";
    const [cx, top] = this.p([x, y, z + h]);
    const [, bot] = this.p([x, y, z]);
    const rx = r * Math.SQRT2 * C;
    const ry = r * Math.SQRT2 * S;
    this.add(`<g class="iso-box${tone === "hi" ? " iso-hi" : ""} ${extra}" ${this.order()}>`);
    this.add(`<path class="iso-r${t}" d="M${f(cx - rx)} ${f(top)}A${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(top)}V${f(bot)}A${f(rx)} ${f(ry)} 0 0 1 ${f(cx - rx)} ${f(bot)}Z"/>`);
    return this.add("</g>");
  }

  /** A circle standing on a front-left face (y fixed), as points. */
  ringY(cx: number, y: number, cz: number, r: number, n = 28): V3[] {
    return Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2;
      return [cx + r * Math.cos(t), y, cz + r * Math.sin(t)] as V3;
    });
  }
  /** A pie sector's top (angles in radians, on the xy plane), as points. */
  sector(cx: number, cy: number, z: number, r: number, a0: number, a1: number, n = 18): V3[] {
    const pts: V3[] = [[cx, cy, z]];
    for (let i = 0; i <= n; i++) {
      const t = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t), z]);
    }
    return pts;
  }
  /** A pie sector as a solid: its outer wall, its cut walls, its top. */
  wedge(cx: number, cy: number, z: number, r: number, h: number, a0: number, a1: number, tone: Tone = "base", extra = "") {
    const t = tone === "hi" ? "a" : tone === "dark" ? "k" : "";
    const n = 18;
    const arcTop: V3[] = [];
    const arcBot: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      arcTop.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z + h]);
      arcBot.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]);
    }
    this.add(`<g class="iso-box${tone === "hi" ? " iso-hi" : ""} ${extra}" ${this.order()}>`);
    this.poly([[cx, cy, z], [cx, cy, z + h], arcTop[0], arcBot[0]], `iso-l${t}`);
    this.poly([[cx, cy, z], [cx, cy, z + h], arcTop[n], arcBot[n]], `iso-l${t}`);
    this.poly([...arcTop, ...arcBot.reverse()], `iso-r${t}`);
    this.poly(this.sector(cx, cy, z + h, r, a0, a1, n), `iso-t${t}`);
    return this.add("</g>");
  }

  /** A big readout, flat (label over the number, a unit after it). */
  readout(x: number, y: number, label: string, value: string, unit = "", note = "") {
    if (this.compact) return this;
    this.add(`<g class="iso-read"><text class="iso-rl" x="${x}" y="${y}">${label}</text>`);
    this.add(`<text class="iso-rv" x="${x}" y="${y + 36}">${value}<tspan class="iso-ru" dx="4">${unit}</tspan></text>`);
    if (note) this.add(`<text class="iso-rn" x="${x}" y="${y + 52}">${note}</text>`);
    return this.add(`</g>`);
  }

  svg() {
    return this.parts.join("");
  }
}

// A window lying on the canvas: its body slab, the header strip at the back,
// a few lines of content on its top; raised and lit when it's the one.
function win(s: Scene, x: number, y: number, w: number, d: number, title: string, rows: number[], opts: { hi?: boolean; lift?: number; prompt?: boolean } = {}) {
  const z = 10 + (opts.lift ?? 0);
  if (opts.lift) {
    // its shadow and drop lines on the canvas
    s.poly([[x, y, 10], [x + w, y, 10], [x + w, y + d, 10], [x, y + d, 10]], "iso-shadow");
    s.line([x + w, y + d, 10], [x + w, y + d, z], "iso-drop");
    s.line([x, y + d, 10], [x, y + d, z], "iso-drop");
    s.line([x + w, y, 10], [x + w, y, z], "iso-drop");
  }
  s.box(x, y, z, w, d, 5, opts.hi ? "hi" : "base", opts.hi ? "iso-lit" : "");
  s.poly([[x + 2, y + 2, z + 5.1], [x + w - 2, y + 2, z + 5.1], [x + w - 2, y + 14, z + 5.1], [x + 2, y + 14, z + 5.1]], opts.hi ? "iso-head-a" : "iso-head");
  s.top(x + 8, y + 11, z + 5.2, title, 7, opts.hi ? "iso-tx iso-tx-on" : "iso-tx");
  if (opts.prompt) {
    s.path3([[x + 10, y + 24, z + 5.2], [x + 16, y + 28, z + 5.2], [x + 10, y + 32, z + 5.2]], opts.hi ? "iso-bar-on" : "iso-bar");
    s.bars(x + 22, y + 32, z + 5.2, [24], 8, opts.hi ? "iso-bar-on" : "iso-bar");
    s.bars(x + 10, y + 44, z + 5.2, rows, 8, opts.hi ? "iso-bar-on iso-faint" : "iso-bar");
  } else s.bars(x + 10, y + 26, z + 5.2, rows, 8, opts.hi ? "iso-bar-on" : "iso-bar");
}

// The roles: windows on one canvas, the lit one called out ---------------------
type RoleWin = { x: number; y: number; w: number; d: number; title: string; rows: number[]; hi?: boolean; prompt?: boolean };
type Role = { wins: RoleWin[]; call: [string, string, [string, string][]]; read: [string, string, string, string]; list: [string, string][] };

const roleDefs: Record<string, Role> = {
  engineers: {
    wins: [
      { x: 0, y: 0, w: 150, d: 180, title: "orders.ts", rows: [70, 100, 50, 86, 64, 90, 40, 76, 58, 96, 44, 80, 60, 70, 50, 90, 64] },
      { x: 170, y: 0, w: 150, d: 80, title: "api · main", rows: [90, 60, 110, 40, 80, 100] },
      { x: 170, y: 100, w: 150, d: 80, title: "zsh · npm run dev", rows: [96, 70, 110], hi: true, prompt: true },
    ],
    call: ["Terminal", "T-01", [["Role", "npm run dev"], ["Type", "zsh, This Mac"], ["Spec", "up 2 h 14 m"]]],
    read: ["Windows", "3", "", "one canvas, one project"],
    list: [["Editor", "orders.ts"], ["Git", "1 change"], ["Terminal", "live"]],
  },
  frontend: {
    wins: [
      { x: 0, y: 0, w: 190, d: 180, title: "localhost:5173", rows: [60, 150, 120, 0, 70, 70, 70, 0, 150, 120, 150, 90, 120, 60, 100, 80, 50], hi: true },
      { x: 210, y: 0, w: 110, d: 80, title: "styles.css", rows: [60, 80, 40, 70, 50, 74] },
      { x: 210, y: 100, w: 110, d: 80, title: "assets", rows: [40, 70, 50, 60, 76, 30] },
    ],
    call: ["Browser", "B-01", [["Role", "your app, live"], ["Type", "390 · 768 · 1440"], ["Spec", "reloads on save"]]],
    read: ["Viewport", "390", "px", "phone, beside the code"],
    list: [["Browser", "localhost"], ["Editor", "styles.css"], ["Explorer", "assets"]],
  },
  devops: {
    wins: [
      { x: 0, y: 0, w: 160, d: 180, title: "Containers · fra-1", rows: [120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120] },
      { x: 180, y: 0, w: 140, d: 80, title: "deploy@fra-1", rows: [90, 70, 110], hi: true, prompt: true },
      { x: 180, y: 100, w: 140, d: 80, title: "Activity", rows: [40, 90, 60, 110, 70, 96] },
    ],
    call: ["Terminal", "FRA-1", [["Role", "deploy, logs"], ["Type", "ssh, a server"], ["Spec", "keeps running"]]],
    read: ["Machines", "4", "", "every one you run"],
    list: [["api", "up 2 h"], ["web", "up 2 h"], ["worker", "restarting"]],
  },
  data: {
    wins: [
      { x: 0, y: 0, w: 170, d: 180, title: "Data — orders", rows: [150, 150, 150, 150, 150, 150, 150, 150, 150, 150, 150, 150, 150, 150, 150, 150, 150], hi: true },
      { x: 190, y: 0, w: 130, d: 80, title: "GET /orders", rows: [50, 90, 70, 100, 60, 86] },
      { x: 190, y: 100, w: 130, d: 80, title: "orders.ts", rows: [70, 100, 60, 84, 40, 90] },
    ],
    call: ["Postgres", "PG-1", [["Role", "orders, 18.2k rows"], ["Type", "PostgreSQL 17"], ["Spec", "query in 4 ms"]]],
    read: ["Rows", "18.2", "k", "next to the code"],
    list: [["Data", "postgres"], ["Requests", "200 OK"], ["Editor", "orders.ts"]],
  },
  agents: {
    wins: [
      { x: 0, y: 0, w: 150, d: 180, title: "agent · claude", rows: [110, 80, 120, 64, 96, 110, 70, 120, 90, 60, 110, 84, 100, 70], hi: true, prompt: true },
      { x: 170, y: 0, w: 150, d: 80, title: "tests", rows: [90, 90, 90, 60, 90, 90] },
      { x: 170, y: 100, w: 150, d: 80, title: "localhost:5173", rows: [50, 120, 90, 0, 110, 80] },
    ],
    call: ["Agent", "AG-1", [["Role", "edits orders.ts"], ["Type", "in a terminal"], ["Spec", "24 tests passed"]]],
    read: ["Watching", "3", "", "every window it touches"],
    list: [["Agent", "editing"], ["Tests", "24 passed"], ["Browser", "reloaded"]],
  },
};

function role(id: string) {
  const r = roleDefs[id];
  const s = new Scene(250, 110);
  // the canvas: a plate, its dot grid
  s.plateR(-30, -30, 380, 240, 0, 10, 18);
  s.ground = null;
  for (let gx = -20; gx <= 340; gx += 20) for (let gy = -20; gy <= 200; gy += 20) s.dot([gx, gy, 10.2], "iso-grid", 0.9);
  // the windows, back to front; the lit one raised
  for (const wn of r.wins) win(s, wn.x, wn.y, wn.w, wn.d, wn.title, wn.rows, { hi: wn.hi, lift: wn.hi ? 26 : 0, prompt: wn.prompt });
  // a list along the plate's front edge
  r.list.forEach(([k, v], i) => {
    s.left(-20 + i * 120, 210, 3, `<tspan class="iso-k">${k}</tspan> ${v}`, 8.5, "iso-tx iso-edge");
  });
  const lit = r.wins.find((w) => w.hi)!;
  s.callout([lit.x + lit.w * 0.6, lit.y + lit.d * 0.55, 10 + 26 + 5.2], 455, 40, r.call[0], r.call[1], r.call[2]);
  return { view: s.tight(18), svg: s.svg() };
}

// The plugins and built-ins, each a thing on a plate ---------------------------
function plate(s: Scene, w: number, d: number) {
  s.plateR(-20, -20, w, d, 0, 8, 16);
}

let compactNext = false;
const make = (ox: number, oy: number) => {
  const s = new Scene(ox, oy);
  s.compact = compactNext;
  return s;
};
const out = (s: Scene) => ({ view: s.tight(), svg: s.svg() });

const things: Record<string, () => { view: string; svg: string }> = {
  terminal() {
    // one shell, wired to the machines it runs on; no keyboard needed
    const s = make(200, 40);
    plate(s, 220, 220);
    // cables run from the terminal's foot out to each machine
    s.path3([[16, 70, 8.2], [60, 70, 8.2], [60, 48, 8.2], [96, 48, 8.2]], "iso-cable");
    s.path3([[16, 130, 8.2], [70, 130, 8.2], [70, 150, 8.2], [110, 150, 8.2]], "iso-cable");
    // the terminal: a tall slab of screen
    s.box(-4, 30, 8, 26, 140, 6, "dark");
    s.box(0, 20, 14, 12, 160, 114);
    s.poly([[12.2, 172, 122], [12.2, 28, 122], [12.2, 28, 22], [12.2, 172, 22]], "iso-screen");
    s.right(12.4, 164, 104, "~/api ❯ npm run dev", 10, "iso-tx iso-tx-on");
    s.right(12.4, 164, 88, "VITE v7 ready in 284 ms", 9, "iso-tx");
    s.right(12.4, 164, 74, "➜ localhost:5173", 9, "iso-tx");
    s.right(12.4, 164, 60, "hmr update /src/App.tsx", 9, "iso-tx");
    s.poly([[12.4, 164, 34], [12.4, 156, 34], [12.4, 156, 46], [12.4, 164, 46]], "iso-cursor");
    // a server, its drive bays
    s.box(96, 26, 8, 54, 44, 52);
    for (let i = 0; i < 3; i++) s.poly([[150.2, 32, 18 + i * 14], [150.2, 64, 18 + i * 14], [150.2, 64, 26 + i * 14], [150.2, 32, 26 + i * 14]], "iso-face");
    s.dot([150.4, 60, 54], "iso-led", 2.2);
    // the machine the shell is on right now
    s.box(110, 126, 8, 54, 44, 34, "hi", "iso-lit");
    s.poly([[164.2, 132, 18], [164.2, 164, 18], [164.2, 164, 30], [164.2, 132, 30]], "iso-head-a");
    return out(s);
  },
  editor() {
    const s = make(190, 60);
    plate(s, 220, 170);
    s.box(30, 10, 8, 130, 110, 4, "dark");
    s.box(20, 0, 12, 130, 110, 4, "dark");
    s.box(10, -10, 16, 130, 110, 4);
    // the gutter, the lines, the one being edited
    s.poly([[10, -10, 20.1], [26, -10, 20.1], [26, 100, 20.1], [10, 100, 20.1]], "iso-head");
    for (let i = 0; i < 11; i++) s.line([14, 4 + i * 8, 20.2], [20, 4 + i * 8, 20.2], "iso-bar");
    s.bars(32, 4, 20.2, [40, 80, 60, 0, 90, 70, 50, 84, 30, 64, 46]);
    s.box(30, 33, 20.2, 92, 6, 1.2, "hi", "iso-lit");
    s.box(124, 31, 20.2, 3, 10, 7, "hi");
    return out(s);
  },
  explorer() {
    // a filing cabinet, one drawer out with its folders
    const s = make(170, 50);
    plate(s, 200, 180);
    s.box(0, 20, 8, 80, 120, 150);
    for (let d = 0; d < 4; d++) {
      if (d === 2) continue;
      s.poly([[80.2, 28, 18 + d * 36], [80.2, 132, 18 + d * 36], [80.2, 132, 48 + d * 36], [80.2, 28, 48 + d * 36]], "iso-face");
      s.box(80.2, 70, 30 + d * 36, 4, 20, 5, "dark");
    }
    s.poly([[80.2, 28, 90], [80.2, 132, 90], [80.2, 132, 120], [80.2, 28, 120]], "iso-unit");
    s.box(80, 30, 90, 80, 100, 28, "hi", "iso-lit");
    for (let k = 0; k < 6; k++) s.box(92 + k * 11, 38, 118, 6, 84, 10 + (k % 3) * 3, k === 3 ? "hi" : "base");
    s.box(160, 72, 98, 4, 16, 5, "dark");
    return out(s);
  },
  git() {
    // rails: main, and a branch that leaves it and comes back, a train on it
    const s = make(170, 50);
    plate(s, 300, 170);
    // Two rails, 5 either side of the path, offset square to it (mitred at bends).
    const rail = (pts: [number, number][], cls = "iso-rail") => {
      const side = (sgn: number) =>
        pts.map(([x, y], i) => {
          const n = (a: [number, number], b: [number, number]) => {
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];
            const l = Math.hypot(dx, dy) || 1;
            return [-dy / l, dx / l];
          };
          const n0 = i > 0 ? n(pts[i - 1], pts[i]) : n(pts[i], pts[i + 1]);
          const n1 = i < pts.length - 1 ? n(pts[i], pts[i + 1]) : n0;
          let mx = n0[0] + n1[0];
          let my = n0[1] + n1[1];
          const ml = Math.hypot(mx, my) || 1;
          mx /= ml; my /= ml;
          const k = 5 / Math.max(0.35, mx * n1[0] + my * n1[1]);
          return [x + sgn * mx * k, y + sgn * my * k, 8.3] as V3;
        });
      s.path3(side(-1), cls);
      s.path3(side(1), cls);
    };
    for (let x = -10; x <= 270; x += 12) s.line([x, 32, 8.2], [x, 48, 8.2], "iso-sleeper");
    rail([[-10, 40], [270, 40]]);
    for (let x = 60; x <= 200; x += 12) s.line([x, 102, 8.2], [x, 118, 8.2], "iso-sleeper");
    rail([[30, 40], [60, 110], [200, 110], [230, 40]], "iso-rail-a");
    // a signal at the switch
    s.box(20, 20, 8, 6, 6, 60, "dark");
    s.box(16, 16, 68, 14, 8, 16, "base");
    s.dot([30.3, 20, 76], "iso-led", 2.6);
    // the train: three cars, the engine lit
    s.box(80, 102, 8, 34, 16, 16, "base");
    s.box(118, 102, 8, 34, 16, 16, "base");
    s.box(156, 102, 8, 38, 16, 20, "hi", "iso-lit");
    s.box(184, 104, 28, 8, 12, 8, "hi");
    return out(s);
  },
  browser() {
    // the same page at three sizes: a desktop, a tablet, a phone
    const s = make(150, 30);
    plate(s, 230, 230);
    const screen = (x: number, y0: number, y1: number, z0: number, z1: number, lit = false) => {
      s.poly([[x, y1, z1], [x, y0, z1], [x, y0, z0], [x, y1, z0]], lit ? "iso-face-a" : "iso-screen");
      const w = y1 - y0;
      s.poly([[x + 0.2, y1 - 4, z1 - 4], [x + 0.2, y0 + 4, z1 - 4], [x + 0.2, y0 + 4, z1 - 10], [x + 0.2, y1 - 4, z1 - 10]], lit ? "iso-head-a" : "iso-face");
      s.poly([[x + 0.2, y0 + w * 0.7, z1 - 18], [x + 0.2, y0 + w * 0.3, z1 - 18], [x + 0.2, y0 + w * 0.3, z1 - 18 - (z1 - z0) * 0.22], [x + 0.2, y0 + w * 0.7, z1 - 18 - (z1 - z0) * 0.22]], lit ? "iso-head-a" : "iso-face");
    };
    // the stand sits behind the screen: a foot under it, the neck at its back
    s.box(0, 60, 8, 34, 50, 6, "dark");
    s.box(6, 80, 14, 8, 10, 32, "dark");
    s.box(14, 10, 44, 10, 150, 96);
    screen(24.2, 16, 154, 50, 134);
    s.box(70, 40, 8, 24, 70, 4, "dark");
    s.box(80, 44, 12, 6, 62, 82);
    screen(86.2, 48, 102, 16, 90);
    s.box(140, 100, 8, 16, 34, 3, "dark");
    s.box(146, 104, 11, 4, 26, 52, "hi", "iso-lit");
    screen(150.2, 106, 128, 15, 60, true);
    return out(s);
  },
  data() {
    // a tank farm: postgres, piped to redis and an s3 store
    const s = make(200, 70);
    plate(s, 250, 190);
    s.box(70, 50, 30, 110, 8, 8, "dark");
    s.box(70, 128, 30, 70, 8, 8, "dark");
    s.cyl(60, 70, 8, 46, 92, "base");
    for (const z of [30, 54, 78]) {
      const [cx, cy] = s.p([60, 70, z]);
      const rx = 46 * Math.SQRT2 * C;
      const ry = 46 * Math.SQRT2 * S;
      s.add(`<path class="iso-ring" d="M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(cy)}"/>`);
    }
    s.band(60, 70, 50, 47, 14, "hi", "iso-lit");
    s.cyl(60, 70, 100, 18, 10, "base");
    s.cyl(196, 50, 8, 24, 54, "base");
    s.cyl(140, 132, 28, 9, 12, "hi");
    s.box(160, 110, 8, 60, 60, 38);
    for (let i = 0; i < 3; i++) s.box(166 + i * 18, 116, 46, 14, 48, 8, "dark");
    return out(s);
  },
  requests() {
    // pneumatic post between your desk and the api
    const s = make(150, 50);
    plate(s, 290, 160);
    const tower = (x: number, y: number, w: number, d: number, h: number) => {
      s.box(x, y, 8, w, d, h);
      for (let fl = 0; fl < Math.floor((h - 10) / 18); fl++)
        for (let k = 0; k < Math.floor(d / 14); k++)
          s.poly([[x + w + 0.2, y + 5 + k * 14, 16 + fl * 18], [x + w + 0.2, y + 13 + k * 14, 16 + fl * 18], [x + w + 0.2, y + 13 + k * 14, 26 + fl * 18], [x + w + 0.2, y + 5 + k * 14, 26 + fl * 18]], "iso-face");
    };
    // the tube leaves your desk's front face and enters the api's back one,
    // so the api tower is drawn last and hides where it goes in
    tower(0, 40, 50, 56, 70);
    s.box(44, 58, 52, 8, 20, 24, "dark");
    s.box(50, 62, 58, 146, 12, 12, "base", "iso-glass");
    s.box(80, 63, 60, 24, 10, 8, "hi", "iso-lit iso-move");
    tower(196, 20, 64, 84, 130);
    return out(s);
  },
  containers() {
    // a gantry crane lifting one container off the stack
    const s = make(190, 30);
    plate(s, 250, 220);
    s.box(-6, 10, 8, 8, 8, 150, "dark");
    s.box(194, 10, 8, 8, 8, 150, "dark");
    s.box(-6, 10, 158, 208, 8, 10);
    s.box(20, 40, 8, 80, 50, 34);
    s.box(110, 40, 8, 80, 50, 34);
    s.box(20, 100, 8, 80, 50, 34);
    s.box(110, 100, 8, 80, 50, 34);
    s.box(20, 40, 42, 80, 50, 34);
    s.line([105, 70, 158], [105, 70, 116], "iso-cable");
    s.line([105, 86, 168], [105, 86, 116], "iso-cable");
    // a painted mark on each container's long side (u along x, v up)
    const mark = (x: number, yf: number, z: number, kind: number, cls = "iso-face") => {
      const at = (u: number, v: number): V3 => [x + u, yf + 0.2, z + v];
      const shape = (pts: [number, number][]) => s.poly(pts.map(([u, v]) => at(u, v)), cls);
      if (kind === 0) {
        // a cube
        shape([[40, 26], [50, 21], [50, 11], [40, 6], [30, 11], [30, 21]]);
      } else if (kind === 1) {
        // a stack of three discs
        for (const v of [7, 14, 21]) shape([[30, v], [50, v], [50, v + 5], [30, v + 5]]);
      } else if (kind === 2) {
        // a bolt
        shape([[44, 28], [32, 15], [40, 15], [36, 4], [48, 18], [40, 18]]);
      } else {
        // a ring of four squares
        for (const [u, v] of [[32, 7], [42, 7], [32, 17], [42, 17]] as const) shape([[u, v], [u + 7, v], [u + 7, v + 7], [u, v + 7]]);
      }
    };
    mark(20, 90, 42, 1);
    mark(20, 150, 8, 0);
    mark(110, 150, 8, 3);
    s.box(64, 52, 82, 80, 50, 34, "hi", "iso-lit");
    mark(64, 102, 82, 2, "iso-head-a");
    for (let i = 0; i < 5; i++) s.line([72 + i * 16, 102.1, 86], [72 + i * 16, 102.1, 112], "iso-rib");
    s.box(92, 10, 168, 30, 160, 10, "base");
    s.box(-6, 170, 8, 8, 8, 150, "dark");
    s.box(194, 170, 8, 8, 8, 150, "dark");
    s.box(-6, 170, 158, 208, 8, 10);
    return out(s);
  },
  tunnels() {
    // a bridge from your machine's island to the open internet's
    const s = make(150, 40);
    s.plateR(-20, 30, 90, 110, 0, 26, 14);
    s.plateR(180, 10, 110, 140, 0, 26, 14);
    s.ground = 26;
    s.box(0, 50, 26, 50, 50, 40);
    s.poly([[50.2, 58, 54], [50.2, 92, 54], [50.2, 92, 58], [50.2, 58, 58]], "iso-face-a");
    s.box(70, 72, 24, 110, 16, 6, "hi", "iso-lit");
    for (let x = 70; x + 22 <= 180; x += 22) {
      s.line([x, 72, 30], [x + 11, 72, 52], "iso-truss");
      s.line([x + 11, 72, 52], [x + 22, 72, 30], "iso-truss");
      s.line([x, 88, 30], [x + 11, 88, 52], "iso-truss");
      s.line([x + 11, 88, 52], [x + 22, 88, 30], "iso-truss");
    }
    s.line([81, 72, 52], [169, 72, 52], "iso-truss");
    s.line([81, 88, 52], [169, 88, 52], "iso-truss");
    s.cyl(240, 70, 26, 30, 50, "base");
    s.box(236, 66, 76, 8, 8, 46, "dark");
    s.dot([240, 70, 124], "iso-led", 3);
    return out(s);
  },
  activity() {
    // a mixing desk: a fader and a meter for each of CPU, memory, disk, net
    const s = make(170, 60);
    plate(s, 250, 170);
    s.box(0, 0, 8, 210, 130, 18);
    for (let c = 0; c < 5; c++) {
      const x = 16 + c * 40;
      const lvl = [5, 9, 3, 7, 6][c];
      for (let k = 0; k < 10; k++) s.box(x, 8, 26 + k * 7, 22, 10, 5, k < lvl ? (c === 1 && k >= 7 ? "hi" : "base") : "dark");
      s.box(x + 8, 30, 26.2, 6, 80, 1.5, "dark");
      s.box(x + 2, 40 + ((c * 23) % 60), 27, 18, 12, 8, c === 1 ? "hi" : "base", c === 1 ? "iso-lit" : "");
    }
    return out(s);
  },
  env() {
    // a vault: its round door, the wheel, the lock lit
    const s = make(180, 60);
    plate(s, 220, 180);
    s.box(20, 20, 8, 140, 110, 130);
    s.poly(s.ringY(90, 130.2, 73, 54), "iso-face");
    s.poly(s.ringY(90, 130.4, 73, 44), "iso-unit");
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      s.line([90 + 12 * Math.cos(a), 130.5, 73 + 12 * Math.sin(a)], [90 + 36 * Math.cos(a), 130.5, 73 + 36 * Math.sin(a)], "iso-spoke");
    }
    s.poly(s.ringY(90, 130.6, 73, 12), "iso-face-a");
    s.box(158, 40, 30, 8, 14, 80, "dark");
    s.box(160, 60, 70, 10, 6, 12, "hi", "iso-lit");
    return out(s);
  },
  codestats() {
    // the code as a pie: TypeScript, JSON, Dockerfile, Git; one slice out
    const s = make(170, 70);
    plate(s, 220, 200);
    const cx = 90, cy = 90, r = 70;
    const tau = Math.PI * 2;
    const turn = -0.6;
    const parts: [number, number][] = [[0, 0.65], [0.65, 0.82], [0.82, 0.93], [0.93, 1]];
    s.cyl(cx, cy, 8, r, 22, "base");
    // where the slice came out, darker; the slices' edges on the top
    const [a, b] = parts[1];
    s.poly(s.sector(cx, cy, 30.1, r, a * tau + turn, b * tau + turn), "iso-hole");
    for (const [p0] of parts) s.line([cx, cy, 30.2], [cx + r * Math.cos(p0 * tau + turn), cy + r * Math.sin(p0 * tau + turn), 30.2], "iso-ln");
    const mid = ((a + b) / 2) * tau + turn;
    s.wedge(cx + 22 * Math.cos(mid), cy + 22 * Math.sin(mid), 34, r, 22, a * tau + turn, b * tau + turn, "hi", "iso-lit");
    return out(s);
  },
  pets() {
    // a voxel cat curled up asleep on the window you're working in
    const s = make(190, 80);
    plate(s, 200, 150);
    // the window: a slab with its header bar and three lights
    s.box(10, 20, 8, 180, 120, 8, "dark");
    s.box(10, 20, 16, 180, 16, 2, "base");
    for (let i = 0; i < 3; i++) s.box(18 + i * 10, 25, 18, 5, 5, 1.2, "base", "iso-faint");
    // the tail: round the back, then along the near side
    s.box(44, 60, 16, 10, 40, 7, "hi");
    // the body, lying long
    s.box(54, 54, 16, 58, 38, 20, "hi", "iso-lit");
    s.box(54, 92, 16, 54, 8, 7, "hi");
    // the head, big and resting low, ears up
    s.box(112, 50, 16, 34, 46, 32, "hi", "iso-lit");
    s.box(114, 52, 48, 10, 10, 11, "hi");
    s.box(114, 84, 48, 10, 10, 11, "hi");
    // the paws tucked out in front, a nose between them
    s.box(146, 54, 16, 12, 12, 6, "hi");
    s.box(146, 80, 16, 12, 12, 6, "hi");
    s.box(146, 68, 24, 4, 10, 7, "hi");
    // its eyes, shut: two dark strokes on the face
    for (const y of [56, 82]) s.poly([[146.2, y, 38], [146.2, y + 8, 38], [146.2, y + 8, 40.5], [146.2, y, 40.5]], "iso-screen");
    s.cyl(170, 40, 18, 10, 6, "base");
    s.top(150, 40, 70, "z", 12, "iso-tx iso-z");
    s.top(160, 30, 86, "z", 9, "iso-tx iso-z iso-z2");
    return out(s);
  },
  download() {
    // the conveyor: builds come out of the press, ride the belt, drop into your machine
    const s = make(150, 90);
    s.plateR(-96, 26, 400, 124, 0, 8, 16);
    const len = 220;
    // legs under the belt
    for (const x of [14, 104, 194]) for (const y of [62, 102]) s.box(x, y, 8, 8, 8, 32, "dark");
    // the press the builds come out of, its mouth on the near face
    s.box(-70, 46, 8, 70, 78, 86);
    s.poly([[0.2, 64, 48], [0.2, 106, 48], [0.2, 106, 78], [0.2, 64, 78]], "iso-screen");
    for (let i = 0; i < 3; i++) s.poly([[-60 + i * 20, 124.2, 70], [-48 + i * 20, 124.2, 70], [-48 + i * 20, 124.2, 80], [-60 + i * 20, 124.2, 80]], "iso-face");
    // the belt: its bed, the far rail, the moving surface
    s.box(0, 60, 40, len, 52, 6, "dark");
    s.box(0, 58, 46, len, 3, 8, "dark");
    for (const y of [70, 86, 102]) s.line([2, y, 46.3], [len - 2, y, 46.3], "iso-belt");
    // the builds, each riding the belt on its own loop
    const dx = len * C;
    const dy = len * S;
    for (let i = 0; i < 3; i++) {
      s.add(`<g class="iso-ride" style="--dx:${f(dx)}px;--dy:${f(dy)}px;--at:${(i + 0.3) / 3.4};animation-delay:${-(i + 0.3) * 2.2}s">`);
      const lit = i === 1;
      s.box(-4, 68, 46, 34, 34, 22, lit ? "hi" : "base", lit ? "iso-lit" : "");
      s.box(9, 68, 68, 8, 34, 1, lit ? "hi" : "base", "iso-faint");
      s.add(`</g>`);
    }
    // the near rail, in front of what rides
    s.box(0, 110, 46, len, 3, 8, "dark");
    // your machine, taking them in
    s.box(len, 46, 8, 62, 78, 64);
    s.poly([[len + 62.2, 60, 54], [len + 62.2, 110, 54], [len + 62.2, 110, 62], [len + 62.2, 60, 62]], "iso-head-a");
    s.dot([len + 62.4, 66, 30], "iso-led", 2.4);
    return out(s);
  },
  agent() {
    return role("agents");
  },
};

// The always-on scene: a laptop whose lid closes, a server that keeps going --
function always() {
  const s = new Scene(300, 70);
  s.plateR(-60, -40, 520, 260, 0, 8, 20);
  // the cable
  s.path3([[150, 120, 8.2], [250, 120, 8.2], [250, 60, 8.2], [300, 60, 8.2]], "iso-cable");
  // the laptop: base, keys, the lid open and closed
  s.box(0, 60, 8, 150, 110, 8);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) s.box(10 + k * 15, 66 + r * 14, 16, 11, 9, 1.5, "dark");
  s.add(`<g class="lid-open">`);
  s.box(0, 52, 16, 150, 8, 110);
  s.poly([[6, 60.2, 118], [144, 60.2, 118], [144, 60.2, 24], [6, 60.2, 24]], "iso-screen");
  s.poly([[14, 60.3, 110], [70, 60.3, 110], [70, 60.3, 70], [14, 60.3, 70]], "iso-face");
  s.poly([[78, 60.3, 110], [136, 60.3, 110], [136, 60.3, 84], [78, 60.3, 84]], "iso-face-a");
  s.poly([[78, 60.3, 78], [136, 60.3, 78], [136, 60.3, 32], [78, 60.3, 32]], "iso-face");
  s.poly([[14, 60.3, 62], [70, 60.3, 62], [70, 60.3, 32], [14, 60.3, 32]], "iso-face");
  s.add(`</g><g class="lid-shut">`);
  s.box(0, 60, 16, 150, 110, 5, "base");
  s.top(50, 120, 21.2, "closed", 9, "iso-tx");
  s.add(`</g>`);
  // the server rack
  s.box(300, 20, 8, 110, 90, 170);
  for (let u = 0; u < 5; u++) {
    s.poly([[304, 110.2, 22 + u * 32], [406, 110.2, 22 + u * 32], [406, 110.2, 44 + u * 32], [304, 110.2, 44 + u * 32]], "iso-unit");
    s.dot([314, 110.4, 33 + u * 32], "iso-led", 2.6);
    s.line([326, 110.4, 33 + u * 32], [380, 110.4, 33 + u * 32], "iso-bar");
  }
  s.right(410, 100, 150, `<tspan class="iso-rl2">Build</tspan>`, 11, "iso-tx");
  s.right(410, 100, 112, `<tspan class="iso-big" data-pct>0</tspan><tspan class="iso-unit-t" dx="3">%</tspan>`, 40, "iso-tx");
  s.right(410, 100, 92, `<tspan data-left>running · 0:00</tspan>`, 10, "iso-tx");
  s.callout([360, 110, 154], 560, 20, "Build", "BLD-412", [["Role", "npm run build"], ["Type", "fra-1, 16 cores"], ["Spec", "keeps running"]], "right");
  s.left(-54, 220, 4, `<tspan class="iso-k">app</tspan> <tspan data-app>open</tspan>`, 10, "iso-tx iso-edge");
  s.left(300, 220, 4, `<tspan class="iso-k">server</tspan> fra-1 · up 41 days`, 10, "iso-tx iso-edge");
  return { view: "0 0 760 380", svg: s.svg() };
}

export function drawing(kind: string, compact = false): { view: string; svg: string } {
  if (kind === "always") return always();
  if (kind.startsWith("role-")) return role(kind.slice(5));
  compactNext = compact;
  const d = (things[kind] ?? things.terminal)();
  compactNext = false;
  return d;
}
