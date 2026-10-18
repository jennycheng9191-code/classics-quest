// 用假的試算表跑 Code.gs，驗證上榜、取代、驗證規則與排名。用法：node tools/leaderboard/test_code.mjs
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("./Code.gs", import.meta.url), "utf-8");
const data = [];
const sheet = {
  appendRow: (r) => data.push(r.map((v) => (typeof v === "string" && v.startsWith("'") ? v.slice(1) : v))),
  setFrozenRows() {},
  getLastRow: () => data.length,
  getRange: (row, col, n, w) => ({
    getValues: () => data.slice(row - 1, row - 1 + n).map((r) => r.slice(col - 1, col - 1 + w)),
    setValues: (vs) => vs.forEach((v, i) => (data[row - 1 + i] = v.map((x) => (typeof x === "string" && x.startsWith("'") ? x.slice(1) : x)))),
  }),
};
let made = false;
const env = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => (made ? sheet : null), insertSheet: () => ((made = true), sheet) }) },
  ContentService: { createTextOutput: (s) => ({ setMimeType: () => JSON.parse(s) }), MimeType: { JSON: 1 } },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
};
const api = new Function(...Object.keys(env), src + "; return { doGet, doPost };")(...Object.values(env));
const post = (o) => api.doPost({ postData: { contents: JSON.stringify(o) } });
const base = { book: "daxue", grade: "k", stages: 12 };
let fail = 0;
const expect = (c, m) => { if (!c) { fail++; console.log("✗ " + m); } };

expect(post({ ...base, name: "小明", stars: 24, ms: 800000 }).ok, "上榜");
expect(post({ ...base, name: "阿寶", stars: 24, ms: 500000 }).ok, "上榜2");
expect(post({ ...base, name: "小華", stars: 30, ms: 900000 }).ok, "上榜3");
let r = post({ ...base, name: "小明", stars: 20, ms: 300000 });
expect(r.ok && r.updated === false, "比較差的成績不取代");
r = post({ ...base, name: "小明", stars: 24, ms: 400000 });
expect(r.updated === true, "同星數更快要取代");
expect(r.top.map((e) => e.name).join() === "小華,小明,阿寶", "排名：星數高優先、同星時間短優先 " + r.top.map((e) => e.name));
expect(data.filter((d) => d[2] === "小明").length === 1, "同名只留一筆");
expect(!post({ ...base, name: "作弊", stars: 37, ms: 900000 }).ok, "擋超過滿分");
expect(!post({ ...base, name: "作弊", stars: 24, ms: 1000 }).ok, "擋快到不可能");
expect(!post({ ...base, name: "  ", stars: 24, ms: 900000 }).ok, "擋空白名字");
expect(!post({ ...base, grade: "x", name: "a", stars: 24, ms: 900000 }).ok, "擋不存在的年級");
r = post({ ...base, name: "=HYPERLINK(1)", stars: 13, ms: 900000 });
expect(r.ok, "公式開頭的名字照收（存成文字）");
post({ ...base, grade: "high", name: "高手", stars: 36, ms: 1500000 });
expect(api.doGet({ parameter: { book: "daxue", grade: "high" } }).top.length === 1, "年級分榜");
for (let i = 0; i < 15; i++) post({ ...base, name: "p" + i, stars: 12 + i, ms: 900000 });
expect(api.doGet({ parameter: { book: "daxue", grade: "k" } }).top.length === 10, "只列前 10");
console.log(fail ? `失敗 ${fail} 項` : "Code.gs 全部通過");
process.exit(fail ? 1 : 0);
