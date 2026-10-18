// 題目產生器：給「經典資料＋關卡＋年級」就出一整關題目。
// 只用可被 Node 直接剝除的型別語法，tools/check_quiz.ts 才能不經編譯直接跑。

export type Clause = { t: string; p: string; z: string[] };
export type Stage = { id: string; chapter: string; name: string; theme: string; clauses: Clause[] };
export type Classic = { id: string; title: string; source: string; note: string; stages: Stage[] };
export type Grade = "k" | "low" | "high";

export type Piece = { t: string; z: string[]; p?: string };
export type NextQ = { kind: "next"; prompt: Piece[]; options: Piece[]; answer: number };
export type FillQ = { kind: "fill"; before?: Piece; clause: Piece; blanks: number[]; options: Piece[][]; answers: number[] };
export type OrderQ = { kind: "order"; pieces: Piece[]; shuffled: number[] };
export type Question = NextQ | FillQ | OrderQ;

export const GRADES: Record<Grade, {
  label: string; icon: string; count: number; nextOpts: number;
  fillBlanks: number; fillOpts: number; orderPieces: number[]; zhuyin: boolean;
}> = {
  k: { label: "幼兒園", icon: "🌱", count: 5, nextOpts: 3, fillBlanks: 1, fillOpts: 3, orderPieces: [3], zhuyin: true },
  low: { label: "低年級", icon: "🌿", count: 8, nextOpts: 4, fillBlanks: 2, fillOpts: 4, orderPieces: [4], zhuyin: true },
  high: { label: "高年級", icon: "🌳", count: 10, nextOpts: 4, fillBlanks: 3, fillOpts: 4, orderPieces: [5, 6], zhuyin: false },
};

type Rng = () => number;
type Loc = { s: number; c: number };

function shuffle<T>(a: T[], r: Rng): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
const piece = (c: Clause): Piece => ({ t: c.t, z: c.z });

// 「詩云：」「子曰：」「康誥曰：」這類只交代誰說的小句：不當正解、不挖空、不當干擾選項，
// 只在接句題題目裡跟著顯示、排序題最多出現一塊。重點是經文內文
export const isSpeaker = (c: Clause) => /[曰云]$/.test(c.t) && c.p.startsWith("：");

// 全書攤平成一條，方便跨章找「同一段文字後面接什麼」
function flatten(book: Classic) {
  const all: { cl: Clause; loc: Loc }[] = [];
  book.stages.forEach((st, s) => st.clauses.forEach((cl, c) => all.push({ cl, loc: { s, c } })));
  return all;
}

// ---------- 接下一句 ----------
// 正解一定是內文；題目句與正解之間隔著「詩云：」之類時，把它接在題目後面一起顯示。
// 題目在全書重複出現（如「故君子必慎其獨也」）時，往前多帶一句直到下一句唯一；
// 正解靠位置決定，干擾選項不得是任何一處相同題目的下一句。
function makeNext(book: Classic, si: number, g: Grade, r: Rng, used: Set<string>): NextQ | null {
  const flat = flatten(book);
  const stage = book.stages[si];
  const cl = stage.clauses;
  const base = flat.findIndex((x) => x.loc.s === si && x.loc.c === 0);
  const nOpts = GRADES[g].nextOpts;
  const answers = shuffle(cl.map((_, j) => j).filter((j) => j > 0 && !isSpeaker(cl[j])), r);
  for (const j of answers) {
    const key = "n" + si + ":" + j;
    if (used.has(key)) continue;
    const nextText = cl[j].t;
    // 題目至少要有一句內文
    let p0 = j - 1;
    while (p0 >= 0 && isSpeaker(cl[p0])) p0--;
    if (p0 < 0) continue;
    let nexts: Set<string> = new Set();
    for (let body = 1; body <= 3 && p0 >= 0; body++) {
      const seq = flat.slice(base + p0, base + j).map((x) => x.cl.t);
      nexts = new Set();
      for (let k = 0; k + seq.length < flat.length; k++) {
        if (seq.every((t, m) => flat[k + m].cl.t === t)) nexts.add(flat[k + seq.length].cl.t);
      }
      if (nexts.size === 1) break;
      // 不唯一：再往前多帶一句內文（中間的「誰說的」一起帶）
      p0--;
      while (p0 >= 0 && isSpeaker(cl[p0])) p0--;
    }
    if (nexts.size !== 1 || p0 < 0) continue;
    const prompt = cl.slice(p0, j).map((c) => ({ ...piece(c), p: c.p }));

    const L = nextText.length;
    const pool = flat.filter((x) => !isSpeaker(x.cl) && !nexts.has(x.cl.t));
    let cand: Clause[];
    if (g === "k") cand = pool.filter((x) => x.loc.s !== si && Math.abs(x.cl.t.length - L) >= 2).map((x) => x.cl);
    else if (g === "low") cand = pool.filter((x) => x.loc.s !== si && Math.abs(x.cl.t.length - L) <= 1).map((x) => x.cl);
    else {
      cand = pool.filter((x) => x.loc.s === si && x.cl.t.length === L).map((x) => x.cl);
      if (new Set(cand.map((c) => c.t)).size < nOpts - 1)
        cand = cand.concat(pool.filter((x) => x.loc.s === si && Math.abs(x.cl.t.length - L) <= 1).map((x) => x.cl));
      if (new Set(cand.map((c) => c.t)).size < nOpts - 1)
        cand = cand.concat(pool.filter((x) => Math.abs(x.cl.t.length - L) <= 1).map((x) => x.cl));
    }
    const distinct = [...new Map(cand.map((c) => [c.t, c])).values()];
    if (distinct.length < nOpts - 1) continue;
    const wrong = shuffle(distinct, r).slice(0, nOpts - 1).map(piece);
    const options = shuffle([piece(cl[j]), ...wrong], r);
    used.add(key);
    return { kind: "next", prompt, options, answer: options.findIndex((o) => o.t === nextText) };
  }
  return null;
}

// ---------- 填空選字 ----------
function makeFill(book: Classic, si: number, g: Grade, r: Rng, used: Set<string>): FillQ | null {
  const { fillBlanks: nb, fillOpts: no } = GRADES[g];
  const stage = book.stages[si];
  const body = stage.clauses.filter((c) => !isSpeaker(c));
  const allTexts = new Set(flatten(book).map((x) => x.cl.t));
  // 干擾字取同一關內文出現過的字（帶各自的注音）
  const charPool = new Map<string, string>();
  body.forEach((c) => [...c.t].forEach((ch, i) => charPool.has(ch) || charPool.set(ch, c.z[i])));
  const minLen = nb + 2;
  const cands = shuffle(body.filter((c) => c.t.length >= minLen && !used.has("f" + c.t)), r);
  for (const cl of cands) {
    const blanks = shuffle([...cl.t].map((_, i) => i), r).slice(0, nb).sort((a, b) => a - b);
    const options: Piece[][] = [];
    const answers: number[] = [];
    let ok = true;
    for (const b of blanks) {
      const right = cl.t[b];
      const wrongs = shuffle([...charPool.keys()].filter((ch) => {
        if (ch === right) return false;
        const alt = cl.t.slice(0, b) + ch + cl.t.slice(b + 1);
        return !allTexts.has(alt); // 換成干擾字後不可剛好也是一句經文
      }), r).slice(0, no - 1);
      if (wrongs.length < no - 1) { ok = false; break; }
      const opts = shuffle([right, ...wrongs], r).map((ch) => ({ t: ch, z: [ch === right ? cl.z[b] : charPool.get(ch)!] }));
      options.push(opts);
      answers.push(opts.findIndex((o) => o.t === right));
    }
    if (!ok) continue;
    used.add("f" + cl.t);
    // 前一句當提示（可能是「詩云」），小句太短時才猜得出來
    const prev = stage.clauses[stage.clauses.indexOf(cl) - 1];
    const before = prev ? { ...piece(prev), p: prev.p } : undefined;
    return { kind: "fill", before, clause: piece(cl), blanks, options, answers };
  }
  return null;
}

// ---------- 排順序 ----------
// 從句號／分號後開頭取連續 n 句；全書重複句會讓兩種排法都對，所以比對用文字順序。
function makeOrder(book: Classic, si: number, g: Grade, r: Rng, used: Set<string>): OrderQ | null {
  const stage = book.stages[si];
  const cl = stage.clauses;
  // 章太短排不出規定塊數時，退一步少一塊（最少 3 塊）
  const want = GRADES[g].orderPieces;
  const fallback = Array.from({ length: Math.max(0, Math.min(...want) - 3) }, (_, k) => Math.min(...want) - 1 - k);
  for (const n of [...shuffle(want, r), ...fallback]) {
    const maxChars = g === "k" ? 24 : g === "low" ? 36 : 54;
    const starts = cl.map((_, i) => i).filter((i) => i + n <= cl.length && !used.has("o" + si + ":" + i));
    const good = starts.filter((i) => i === 0 || /[。；？！]/.test(cl[i - 1].p));
    for (const i of [...shuffle(good, r), ...shuffle(starts.filter((x) => !good.includes(x)), r)]) {
      const seg = cl.slice(i, i + n);
      if (seg.reduce((a, c) => a + c.t.length, 0) > maxChars) continue;
      if (new Set(seg.map((c) => c.t)).size < 2) continue;
      // 「詩云」之類最多一塊，也不能是最後一塊（句子會停在半空）
      if (seg.filter(isSpeaker).length > 1 || isSpeaker(seg[n - 1])) continue;
      let sh: number[] = [];
      for (let tries = 0; tries < 20; tries++) {
        sh = shuffle(seg.map((_, k) => k), r);
        if (sh.map((k) => seg[k].t).join("|") !== seg.map((c) => c.t).join("|")) break;
      }
      if (sh.map((k) => seg[k].t).join("|") === seg.map((c) => c.t).join("|")) continue;
      used.add("o" + si + ":" + i);
      return { kind: "order", pieces: seg.map(piece), shuffled: sh };
    }
  }
  return null;
}

const MAKERS = { next: makeNext, fill: makeFill, order: makeOrder };

export function makeQuiz(book: Classic, si: number, g: Grade, r: Rng = Math.random): Question[] {
  const n = GRADES[g].count;
  const kinds = (["next", "fill", "order"] as const);
  // 三種題型輪流，起點隨機，順序再打散
  const off = Math.floor(r() * 3);
  const plan = shuffle(Array.from({ length: n }, (_, i) => kinds[(i + off) % 3]), r);
  const used = new Set<string>();
  const out: Question[] = [];
  for (const k of plan) {
    let q: Question | null = MAKERS[k](book, si, g, r, used);
    // 這一章出不了這種題（例如太短）就換別的題型
    for (const alt of kinds) if (!q) q = MAKERS[alt](book, si, g, r, used);
    // 章太短、題目出完了（如傳一章內文只有 4 句），才允許重複出同一句、選項重抽
    for (const alt of [k, ...kinds]) if (!q) q = MAKERS[alt](book, si, g, r, new Set());
    if (q) out.push(q);
  }
  return out;
}

export function stars(correct: number, total: number): number {
  const p = total ? correct / total : 0;
  return p >= 1 ? 3 : p >= 0.8 ? 2 : p >= 0.6 ? 1 : 0;
}
