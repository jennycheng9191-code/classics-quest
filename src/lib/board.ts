// 排行榜：成績送到 Google 試算表（tools/leaderboard/Code.gs），三個年級各一張榜。
import { BOARD_URL } from "../config.ts";
import type { Grade } from "./quiz.ts";

export type Entry = { name: string; stars: number; ms: number };
export type Score = { book: string; grade: Grade; name: string; stars: number; ms: number; stages: number };

const MOCK = !BOARD_URL && import.meta.env.DEV;
export const BOARD_ON = !!BOARD_URL || MOCK;

const rank = (a: Entry, b: Entry) => b.stars - a.stars || a.ms - b.ms;

export function clock(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}分${String(s % 60).padStart(2, "0")}秒`;
}

// ---- 本機假排行榜（只在開發時用，邏輯跟 Code.gs 一樣） ----
type MockRow = Entry & { book: string; grade: string };
function mockRows(): MockRow[] {
  try {
    return JSON.parse(localStorage.getItem("classics-mockboard") || "[]");
  } catch {
    return [];
  }
}
function mockTop(book: string, grade: string) {
  return mockRows().filter((r) => r.book === book && r.grade === grade).sort(rank).slice(0, 10);
}
function mockSubmit(s: Score) {
  const rows = mockRows();
  const i = rows.findIndex((r) => r.book === s.book && r.grade === s.grade && r.name === s.name);
  const row = { book: s.book, grade: s.grade, name: s.name, stars: s.stars, ms: s.ms };
  let updated = true;
  if (i < 0) rows.push(row);
  else if (rank(row, rows[i]) < 0) rows[i] = row;
  else updated = false;
  localStorage.setItem("classics-mockboard", JSON.stringify(rows));
  return { ok: true, updated, top: mockTop(s.book, s.grade) };
}

export async function fetchTop(book: string, grade: Grade): Promise<Entry[]> {
  if (MOCK) return mockTop(book, grade);
  const r = await fetch(`${BOARD_URL}?book=${encodeURIComponent(book)}&grade=${grade}`);
  const d = await r.json();
  if (!d.ok) throw new Error(d.error);
  return d.top;
}

export async function submitScore(s: Score): Promise<{ updated: boolean; top: Entry[] }> {
  if (MOCK) return mockSubmit(s);
  // text/plain 才不會觸發跨網域預檢，Apps Script 不支援預檢
  const r = await fetch(BOARD_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(s) });
  const d = await r.json();
  if (!d.ok) throw new Error(d.error);
  return d;
}
