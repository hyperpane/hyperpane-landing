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
    const g = `<g class="iso-box${tone === "hi" ? " iso-hi" : ""} ${extra}">`;
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
    const [cx, cyTop] = this.p([x, y, z + h]);
    const [, cyBot] = this.p([x, y, z]);
    const rx = r * Math.SQRT2 * C;
    const ry = r * Math.SQRT2 * S;
    this.add(`<g class="iso-box${tone === "hi" ? " iso-hi" : ""} ${extra}">`);
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

  /** The callout: a dot on the part, a leader to a label block (flat). */
  callout(v: V3, lx: number, ly: number, title: string, code: string, rows: [string, string][], side: "left" | "right" = "right") {
    if (this.compact) return this;
    this.track = false;
    const [px, py] = this.p(v);
    this.track = true;
    const w = 170;
    const x0 = side === "right" ? lx : lx - w;
    const under = ly + 14 + rows.length * 15;
    const ex = side === "right" ? x0 : x0 + w;
    this.add(`<g class="iso-call">`);
    this.add(`<path class="iso-lead" d="M${f(px)} ${f(py)}L${f(ex)} ${f(under)}H${f(side === "right" ? x0 + w : x0)}"/>`);
    this.add(`<circle class="iso-pin" cx="${f(px)}" cy="${f(py)}" r="3.5"/>`);
    this.add(`<text class="iso-ct" x="${x0}" y="${ly}">${title}<tspan class="iso-code" dx="7">${code}</tspan></text>`);
    rows.forEach(([k, val], i) => {
      this.add(`<text class="iso-ck" x="${x0}" y="${ly + 17 + i * 15}">${k}</text><text class="iso-cv" x="${x0 + 44}" y="${ly + 17 + i * 15}">${val}</text>`);
    });
    return this.add(`</g>`);
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
      { x: 0, y: 0, w: 150, d: 120, title: "orders.ts", rows: [70, 100, 50, 86, 64, 90, 40, 76, 58] },
      { x: 170, y: 0, w: 150, d: 70, title: "api · main", rows: [90, 60, 110, 40] },
      { x: 170, y: 90, w: 150, d: 90, title: "zsh · npm run dev", rows: [96, 70, 110, 84], hi: true, prompt: true },
    ],
    call: ["Terminal", "T-01", [["Role", "npm run dev"], ["Type", "zsh, This Mac"], ["Spec", "up 2 h 14 m"]]],
    read: ["Windows", "3", "", "one canvas, one project"],
    list: [["Editor", "orders.ts"], ["Git", "1 change"], ["Terminal", "live"]],
  },
  frontend: {
    wins: [
      { x: 0, y: 0, w: 190, d: 130, title: "localhost:5173", rows: [60, 150, 120, 0, 70, 70, 70], hi: true },
      { x: 210, y: 0, w: 110, d: 80, title: "styles.css", rows: [60, 80, 40, 70, 50] },
      { x: 210, y: 100, w: 110, d: 80, title: "assets", rows: [40, 70, 50, 60] },
    ],
    call: ["Browser", "B-01", [["Role", "your app, live"], ["Type", "390 · 768 · 1440"], ["Spec", "reloads on save"]]],
    read: ["Viewport", "390", "px", "phone, beside the code"],
    list: [["Browser", "localhost"], ["Editor", "styles.css"], ["Explorer", "assets"]],
  },
  devops: {
    wins: [
      { x: 0, y: 0, w: 160, d: 110, title: "Containers · fra-1", rows: [120, 120, 120, 120, 120] },
      { x: 180, y: 0, w: 140, d: 80, title: "deploy@fra-1", rows: [90, 70, 110], hi: true, prompt: true },
      { x: 180, y: 100, w: 140, d: 80, title: "Activity", rows: [40, 90, 60, 110] },
    ],
    call: ["Terminal", "FRA-1", [["Role", "deploy, logs"], ["Type", "ssh, a server"], ["Spec", "keeps running"]]],
    read: ["Machines", "4", "", "every one you run"],
    list: [["api", "up 2 h"], ["web", "up 2 h"], ["worker", "restarting"]],
  },
  data: {
    wins: [
      { x: 0, y: 0, w: 170, d: 130, title: "Data — orders", rows: [150, 150, 150, 150, 150, 150, 150], hi: true },
      { x: 190, y: 0, w: 130, d: 80, title: "GET /orders", rows: [50, 90, 70, 100] },
      { x: 190, y: 100, w: 130, d: 80, title: "orders.ts", rows: [70, 100, 60, 84] },
    ],
    call: ["Postgres", "PG-1", [["Role", "orders, 18.2k rows"], ["Type", "PostgreSQL 17"], ["Spec", "query in 4 ms"]]],
    read: ["Rows", "18.2", "k", "next to the code"],
    list: [["Data", "postgres"], ["Requests", "200 OK"], ["Editor", "orders.ts"]],
  },
  agents: {
    wins: [
      { x: 0, y: 0, w: 150, d: 110, title: "agent · claude", rows: [110, 80, 120, 64, 96], hi: true, prompt: true },
      { x: 170, y: 0, w: 150, d: 80, title: "tests", rows: [90, 90, 90, 60] },
      { x: 170, y: 100, w: 150, d: 80, title: "localhost:5173", rows: [50, 120, 90] },
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
  s.box(-30, -30, 0, 380, 240, 10, "dark");
  for (let gx = -10; gx <= 330; gx += 30) for (let gy = -10; gy <= 200; gy += 30) s.dot([gx, gy, 10.2], "iso-grid", 0.9);
  // the windows, back to front; the lit one raised
  for (const wn of r.wins) win(s, wn.x, wn.y, wn.w, wn.d, wn.title, wn.rows, { hi: wn.hi, lift: wn.hi ? 26 : 0, prompt: wn.prompt });
  // a list along the plate's front edge
  r.list.forEach(([k, v], i) => {
    s.left(-24 + i * 118, 210, 4, `<tspan class="iso-k">${k}</tspan> ${v}`, 8.5, "iso-tx iso-edge");
  });
  const lit = r.wins.find((w) => w.hi)!;
  s.callout([lit.x + lit.w * 0.6, lit.y + lit.d * 0.55, 10 + 26 + 5.2], 455, 40, r.call[0], r.call[1], r.call[2]);
  s.readout(20, 318, r.read[0], r.read[1], r.read[2], r.read[3]);
  return { view: "0 0 640 380", svg: s.svg() };
}

// The plugins and built-ins, each a thing on a plate ---------------------------
function plate(s: Scene, w: number, d: number) {
  s.box(-20, -20, 0, w, d, 8, "dark");
}

let compactNext = false;
const make = (ox: number, oy: number) => {
  const s = new Scene(ox, oy);
  s.compact = compactNext;
  return s;
};
const out = (s: Scene, view: string) => ({ view: s.compact ? s.tight() : view, svg: s.svg() });

const things: Record<string, () => { view: string; svg: string }> = {
  terminal() {
    const s = make(170, 70);
    plate(s, 220, 170);
    s.box(10, 70, 8, 160, 70, 6); // keyboard
    for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) s.box(18 + k * 17, 76 + r * 15, 14, 12, 10, 2, "dark");
    s.box(10, 30, 8, 160, 10, 95); // the screen, standing
    s.right(170, 38, 85, "~/api ❯ npm run dev", 8, "iso-tx iso-tx-on");
    s.right(170, 38, 70, "VITE ready in 284 ms", 7.5, "iso-tx");
    s.right(170, 38, 58, "➜ localhost:5173", 7.5, "iso-tx");
    s.poly([[170.2, 38, 30], [170.2, 30, 30], [170.2, 30, 42], [170.2, 38, 42]], "iso-cursor");
    s.callout([170, 34, 36], 286, 28, "Shell", "SH-1", [["Role", "any machine"], ["Spec", "keeps running"]]);
    return out(s, "0 0 470 250");
  },
  editor() {
    const s = make(190, 60);
    plate(s, 220, 170);
    s.box(30, 10, 8, 130, 110, 4, "dark");
    s.box(20, 0, 12, 130, 110, 4, "dark");
    s.box(10, -10, 16, 130, 110, 4);
    s.bars(22, 4, 20.1, [40, 80, 60, 0, 90, 70, 50, 84, 30, 64]);
    s.line([34, 36, 20.2], [110, 36, 20.2], "iso-bar-lit");
    s.callout([90, 36, 20], 300, 28, "Line 4", "ED-1", [["Role", "find, replace"], ["Spec", "many cursors"]]);
    return out(s, "0 0 470 250");
  },
  explorer() {
    const s = make(170, 60);
    plate(s, 220, 170);
    const nodes: [number, number, string, boolean?][] = [
      [0, 0, "src"], [40, 30, "routes"], [80, 60, "orders.ts", true], [80, 90, "products.ts"], [40, 120, "server.ts"],
    ];
    s.path3([[8, 6, 8.2], [8, 126, 8.2]], "iso-ln");
    s.path3([[48, 36, 8.2], [48, 96, 8.2]], "iso-ln");
    nodes.forEach(([x, y, n, hi]) => {
      s.box(x, y, 8, 60, 18, 7, hi ? "hi" : "base", hi ? "iso-lit" : "");
      s.top(x + 6, y + 12, 15.2, n, 7, hi ? "iso-tx iso-tx-on" : "iso-tx");
    });
    s.callout([110, 69, 15], 300, 30, "orders.ts", "1.2 KB", [["Role", "open, rename"], ["Spec", "drag to move"]]);
    return out(s, "0 0 470 250");
  },
  git() {
    const s = make(170, 60);
    plate(s, 260, 150);
    s.path3([[0, 40, 8.2], [220, 40, 8.2]], "iso-rail");
    s.path3([[60, 40, 8.2], [80, 90, 8.2], [160, 90, 8.2], [180, 40, 8.2]], "iso-rail-a");
    [0, 30, 60, 120, 180, 210].forEach((x) => s.cyl(x, 40, 8, 7, 6, x === 180 ? "hi" : "base", x === 180 ? "iso-lit" : ""));
    [100, 140].forEach((x) => s.cyl(x, 90, 8, 6, 5, "base"));
    s.topY(0, 30, 8.5, "main", 8, "iso-tx");
    s.top(100, 104, 8.5, "feature/orders", 7.5, "iso-tx");
    s.callout([180, 40, 14], 300, 22, "Merge", "a3f9c1", [["Role", "feature → main"], ["Type", "+12 −3, 2 files"], ["Spec", "synced"]]);
    return out(s, "0 0 470 250");
  },
  browser() {
    const s = make(160, 60);
    plate(s, 240, 160);
    s.box(70, 70, 8, 40, 30, 12, "dark"); // stand
    s.box(84, 80, 20, 12, 10, 40, "dark");
    s.box(30, 75, 50, 130, 12, 100); // screen (facing front-right)
    // the page on its front-left face (y = 87)
    s.poly([[36, 87.2, 136], [154, 87.2, 136], [154, 87.2, 128], [36, 87.2, 128]], "iso-face");
    s.poly([[56, 87.2, 115], [134, 87.2, 115], [134, 87.2, 98], [56, 87.2, 98]], "iso-face-a");
    s.poly([[70, 87.2, 90], [120, 87.2, 90], [120, 87.2, 84], [70, 87.2, 84]], "iso-face");
    [40, 82, 124].forEach((x) => s.poly([[x, 87.2, 76], [x + 30, 87.2, 76], [x + 30, 87.2, 58], [x, 87.2, 58]], "iso-face"));
    s.callout([95, 87, 106], 310, 28, "localhost", "5173", [["Role", "your app, live"], ["Type", "phone · tablet"], ["Spec", "reloads on save"]]);
    return out(s, "0 0 470 250");
  },
  data() {
    const s = make(190, 70);
    plate(s, 220, 170);
    s.cyl(80, 60, 8, 50, 22, "base");
    s.cyl(80, 60, 34, 50, 22, "base");
    s.cyl(80, 60, 60, 50, 22, "hi", "iso-lit");
    s.left(30, 110, 18, "redis", 8, "iso-tx");
    s.left(30, 110, 44, "s3", 8, "iso-tx");
    s.callout([80, 60, 82], 300, 22, "orders", "PG-1", [["Role", "18.2k rows"], ["Type", "PostgreSQL 17"], ["Spec", "query 4 ms"]]);
    return out(s, "0 0 470 250");
  },
  requests() {
    const s = make(150, 70);
    plate(s, 280, 140);
    s.box(0, 30, 8, 50, 50, 60);
    s.box(190, 30, 8, 50, 50, 90);
    s.left(4, 80, 30, "you", 8, "iso-tx");
    s.left(194, 80, 50, "api", 8, "iso-tx");
    s.box(50, 50, 48, 140, 10, 3, "dark");
    s.box(90, 46, 51, 26, 18, 10, "hi", "iso-lit iso-move");
    s.callout([103, 55, 61], 320, 24, "GET /orders", "200", [["Role", "saved request"], ["Type", "JSON, 1.2 KB"], ["Spec", "84 ms"]]);
    return out(s, "0 0 490 250");
  },
  containers() {
    const s = make(180, 70);
    plate(s, 220, 170);
    s.box(0, 40, 8, 80, 50, 40);
    s.box(90, 40, 8, 80, 50, 40);
    s.box(0, 100, 8, 80, 50, 40);
    s.box(90, 100, 8, 80, 50, 40);
    s.box(40, 70, 48, 80, 50, 40, "hi", "iso-lit");
    for (let i = 0; i < 5; i++) s.line([46 + i * 15, 120.1, 52], [46 + i * 15, 120.1, 84], "iso-rib");
    s.callout([80, 95, 88], 300, 22, "api", "C-01", [["Role", "up 2 hours"], ["Type", "node:22"], ["Spec", "cpu 42%"]]);
    return out(s, "0 0 470 250");
  },
  tunnels() {
    const s = make(150, 70);
    plate(s, 280, 140);
    s.box(0, 40, 8, 60, 50, 40);
    s.left(6, 90, 20, ":8080", 8, "iso-tx");
    s.box(60, 58, 26, 150, 14, 14, "hi", "iso-lit");
    s.cyl(230, 65, 8, 26, 60, "base");
    s.top(214, 70, 68.2, "a link", 8, "iso-tx");
    s.callout([150, 65, 40], 320, 24, "Tunnel", "quiet-fox", [["Role", "share a port"], ["Type", "HTTPS link"], ["Spec", "open 3 h"]]);
    return out(s, "0 0 490 250");
  },
  activity() {
    const s = make(170, 60);
    plate(s, 230, 170);
    const h = [[30, 46, 22, 60], [38, 70, 52, 30], [64, 92, 40, 54], [28, 50, 76, 44]];
    h.forEach((row, j) => row.forEach((v, i) => s.box(i * 44, j * 36, 8, 32, 26, v, i === 2 && j === 2 ? "hi" : "base", i === 2 && j === 2 ? "iso-lit" : "")));
    s.callout([104, 85, 48], 300, 22, "Core 7", "CPU", [["Role", "38% now"], ["Spec", "peak 92%"]]);
    return out(s, "0 0 470 250");
  },
  env() {
    const s = make(180, 70);
    plate(s, 220, 170);
    s.box(20, 30, 8, 130, 100, 110);
    s.poly([[40, 130.2, 30], [130, 130.2, 30], [130, 130.2, 100], [40, 130.2, 100]], "iso-face");
    s.cyl(85, 131, 58, 14, 5, "hi", "iso-lit");
    s.left(44, 130.3, 108, "DATABASE_URL  ••••••", 7.5, "iso-tx");
    s.callout([85, 131, 63], 300, 24, ".env", "4 values", [["Role", "settings, secrets"], ["Spec", "hidden until you look"]]);
    return out(s, "0 0 470 250");
  },
  codestats() {
    const s = make(170, 70);
    plate(s, 250, 140);
    const langs: [string, number][] = [["TypeScript", 96], ["JSON", 25], ["Dockerfile", 16], ["Git", 10]];
    langs.forEach(([n, v], i) => {
      s.box(i * 50, 40, 8, 36, 36, v, i === 0 ? "hi" : "base", i === 0 ? "iso-lit" : "");
      s.left(i * 50, 76.3, 4, n, 7, "iso-tx");
    });
    s.callout([18, 58, 104], 300, 22, "TypeScript", "65%", [["Role", "3,904 lines"], ["Spec", "by folder too"]]);
    return out(s, "0 0 470 250");
  },
  pets() {
    const s = make(190, 80);
    plate(s, 200, 150);
    s.box(20, 30, 8, 140, 90, 8, "dark"); // the window it naps on
    // a voxel cat
    s.box(60, 60, 16, 50, 28, 22, "hi", "iso-lit");
    s.box(100, 62, 16, 26, 24, 30, "hi", "iso-lit");
    s.box(102, 62, 46, 6, 6, 8, "hi");
    s.box(118, 62, 46, 6, 6, 8, "hi");
    s.box(40, 70, 16, 22, 6, 6, "hi");
    s.top(130, 40, 70, "z", 12, "iso-tx iso-z");
    s.top(140, 30, 86, "z", 9, "iso-tx iso-z iso-z2");
    s.callout([90, 74, 38], 300, 26, "Cat", "PX-1", [["Role", "naps on your window"], ["Spec", "purrs when tests pass"]]);
    return out(s, "0 0 470 250");
  },
  agent() {
    return role("agents");
  },
};

// The always-on scene: a laptop whose lid closes, a server that keeps going --
function always() {
  const s = new Scene(300, 70);
  s.box(-60, -40, 0, 520, 260, 8, "dark");
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
