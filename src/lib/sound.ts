// 音效與朗讀。答對：瀏覽器即時合成「叮咚」；答錯：照課本注音逐字拼出正確答案，一字一拍。
// 音節音檔放在 public/audio/syl/，對照表 public/audio/syllables.json（注音 → 檔名），
// 由 tools/audio/make_syllables.py 用 Azure 語音產生。音檔還沒產生時朗讀自動略過，不影響遊戲。
import type { Piece } from "./quiz.ts";

const BEAT = 0.55; // 每字一拍（秒）
const PAUSE: Record<string, number> = { "，": 1, "、": 1, "；": 1, "：": 1, "。": 2, "？": 2, "！": 2 };
const BASE = import.meta.env.BASE_URL + "audio/";

let ctx: AudioContext | null = null;
function audio(): AudioContext {
  ctx ??= new AudioContext();
  // iPad 要在使用者點擊後才放得出聲音；每次點擊都會呼叫到這裡
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function ding() {
  const a = audio();
  const t0 = a.currentTime + 0.01;
  // 門鈴的「叮～咚～」：先高（E5）後低（C5），每個音疊兩個泛音才像鈴聲，尾音慢慢消失
  [
    [659.3, 0],
    [523.3, 0.38],
  ].forEach(([f, dt]) => {
    [
      [1, 0.22],
      [2, 0.07],
      [3, 0.03],
    ].forEach(([mul, vol]) => {
      const o = a.createOscillator();
      const g = a.createGain();
      const at = t0 + dt;
      o.type = "sine";
      o.frequency.value = f * mul;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(vol, at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, at + (mul === 1 ? 1.1 : 0.5));
      o.connect(g).connect(a.destination);
      o.start(at);
      o.stop(at + 1.2);
    });
  });
}

// ---------- 音節 ----------
type Clip = { buf: AudioBuffer; start: number; end: number };
let table: Promise<Record<string, string>> | null = null;
const clips = new Map<string, Promise<Clip | null>>();

function loadTable() {
  table ??= fetch(BASE + "syllables.json")
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return table;
}

// 去掉 TTS 前後的靜音，才對得準拍子
function trim(buf: AudioBuffer): Clip {
  const d = buf.getChannelData(0);
  const th = 0.02;
  let s = 0;
  let e = d.length - 1;
  while (s < e && Math.abs(d[s]) < th) s++;
  while (e > s && Math.abs(d[e]) < th) e--;
  return { buf, start: s / buf.sampleRate, end: (e + 1) / buf.sampleRate };
}

function clip(z: string): Promise<Clip | null> {
  let p = clips.get(z);
  if (!p) {
    p = loadTable().then(async (t) => {
      if (!t[z]) return null;
      try {
        const r = await fetch(BASE + "syl/" + t[z]);
        if (!r.ok) return null;
        return trim(await audio().decodeAudioData(await r.arrayBuffer()));
      } catch {
        return null;
      }
    });
    clips.set(z, p);
  }
  return p;
}

// 進關卡時先把這關會用到的音節載好，答錯時才不會等
export function preload(pieces: Piece[]) {
  pieces.forEach((pc) => pc.z.forEach((z) => void clip(z)));
}

let playing: AudioBufferSourceNode[] = [];
let turn = 0; // 每次 hush 換一輪；載完音檔時已經換輪（換題了）就不念
export function hush() {
  turn++;
  playing.forEach((s) => {
    try {
      s.stop();
    } catch {
      /* 已經停了 */
    }
  });
  playing = [];
}

// 依序念一串句子，回傳總長度（秒）；沒有音檔就回 0
export async function speak(pieces: Piece[]): Promise<number> {
  hush();
  const mine = turn;
  const all = await Promise.all(pieces.map((pc) => Promise.all(pc.z.map(clip))));
  if (mine !== turn || !all.some((cs) => cs.some(Boolean))) return 0;
  const a = audio();
  const t0 = a.currentTime + 0.05;
  let beat = 0;
  pieces.forEach((pc, i) => {
    all[i].forEach((c) => {
      if (c) {
        const src = a.createBufferSource();
        const g = a.createGain();
        src.buffer = c.buf;
        const len = Math.min(c.end - c.start, BEAT * 0.95);
        const at = t0 + beat * BEAT;
        // 收尾淡出，切掉的地方才不會有爆音
        g.gain.setValueAtTime(1, at + len - 0.04);
        g.gain.linearRampToValueAtTime(0, at + len);
        src.connect(g).connect(a.destination);
        src.start(at, c.start, len);
        playing.push(src);
      }
      beat++;
    });
    // 句與句之間：照標點停，排序題沒標點就停一拍
    const p = [...(pc.p ?? "")].reduce((m, ch) => Math.max(m, PAUSE[ch] ?? 0), 0);
    if (i < pieces.length - 1) beat += p || 1;
  });
  return beat * BEAT;
}
