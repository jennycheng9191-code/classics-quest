// 進度存在訪客瀏覽器；key 前綴 classics-，不跟同網域 good-mood 的 goodmood- 衝突。
// 私密視窗或被封鎖時 localStorage 會丟例外，一律吞掉，遊戲照玩只是不記。
import type { Grade } from "./quiz.ts";

// 每關最佳一次：s 星數、ms 用時（舊版只記星數，ms 為 null，要重玩一次才算得進排行榜時間）
export type Best = { s: number; ms: number | null };
type Progress = Record<string, Partial<Record<Grade, Record<string, Best>>>>;

const KEY = "classics-progress-v2";
const OLD_KEY = "classics-progress-v1";

function load(): Progress {
  try {
    const v2 = localStorage.getItem(KEY);
    if (v2) return JSON.parse(v2);
    // v1 只有星數：{ 書: { 年級: { 關: 星數 } } }
    const v1 = JSON.parse(localStorage.getItem(OLD_KEY) || "{}");
    const out: Progress = {};
    for (const [book, grades] of Object.entries(v1 as Record<string, Record<string, Record<string, number>>>)) {
      out[book] = {};
      for (const [g, rec] of Object.entries(grades)) {
        out[book][g as Grade] = Object.fromEntries(Object.entries(rec).map(([k, s]) => [k, { s, ms: null }]));
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function getBest(book: string, g: Grade): Record<string, Best> {
  return load()[book]?.[g] ?? {};
}

export function getStars(book: string, g: Grade): Record<string, number> {
  return Object.fromEntries(Object.entries(getBest(book, g)).map(([k, b]) => [k, b.s]));
}

const better = (a: Best, b: Best | undefined) =>
  !b || a.s > b.s || (a.s === b.s && a.ms !== null && (b.ms === null || a.ms < b.ms));

// 記一次闖關；星數多優先、同星數用時短優先。回傳是否刷新了這關紀錄
export function saveRun(book: string, g: Grade, stage: string, s: number, ms: number): boolean {
  const p = load();
  const rec = ((p[book] ??= {})[g] ??= {});
  const run = { s, ms };
  if (!better(run, rec[stage])) return false;
  rec[stage] = run;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* 存不了就算了 */
  }
  return true;
}

// 全部過關才有總成績：星數加總、用時加總；還沒全過或有舊紀錄缺用時就回 null
export function totals(book: string, g: Grade, stageIds: string[]): { stars: number; ms: number } | null {
  const rec = getBest(book, g);
  let stars = 0;
  let ms = 0;
  for (const id of stageIds) {
    const b = rec[id];
    if (!b || b.s < 1 || b.ms === null) return null;
    stars += b.s;
    ms += b.ms;
  }
  return { stars, ms };
}

export function getPref(name: string): string | null {
  try {
    return localStorage.getItem("classics-" + name);
  } catch {
    return null;
  }
}

export function setPref(name: string, v: string) {
  try {
    localStorage.setItem("classics-" + name, v);
  } catch {
    /* 同上 */
  }
}
