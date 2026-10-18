// 進度存在訪客瀏覽器；key 前綴 classics-，不跟同網域 good-mood 的 goodmood- 衝突。
// 私密視窗或被封鎖時 localStorage 會丟例外，一律吞掉，遊戲照玩只是不記。
import type { Grade } from "./quiz.ts";

const KEY = "classics-progress-v1";
type Progress = Record<string, Partial<Record<Grade, Record<string, number>>>>;

function load(): Progress {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function getStars(book: string, g: Grade): Record<string, number> {
  return load()[book]?.[g] ?? {};
}

export function saveStars(book: string, g: Grade, stage: string, n: number) {
  const p = load();
  const byGrade = (p[book] ??= {});
  const rec = (byGrade[g] ??= {});
  rec[stage] = Math.max(rec[stage] ?? 0, n); // 重玩取最高
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* 存不了就算了 */
  }
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
