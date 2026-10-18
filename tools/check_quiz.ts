// 自動檢查題目產生器：每一關 × 每一級各出 50 次，驗證題目沒有歧義。
// 用法：node tools/check_quiz.ts
import { readFileSync, readdirSync } from "node:fs";
import { makeQuiz, GRADES, type Classic, type Grade } from "../src/lib/quiz.ts";

const dir = new URL("../src/data/classics/", import.meta.url);
let errors = 0, total = 0;
const fail = (msg: string) => { errors++; if (errors <= 30) console.log("✗ " + msg); };

// 可重現的亂數
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
}
const PUNCT = /[，。；：？！、「」]/;

for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const book: Classic = JSON.parse(readFileSync(new URL(f, dir), "utf-8"));
  const flat = book.stages.flatMap((s) => s.clauses.map((c) => c.t));
  // 「詩云：」「子曰：」這類交代說話者的小句
  const speakers = new Set(book.stages.flatMap((s) => s.clauses.filter((c) => /[曰云]$/.test(c.t) && c.p.startsWith("：")).map((c) => c.t)));
  const noSpeaker = (where: string, ts: string[]) => ts.forEach((t) => speakers.has(t) && fail(`${where} 出現「${t}」`));
  const allTexts = new Set(flat);
  book.stages.forEach((st, si) => {
    for (const g of Object.keys(GRADES) as Grade[]) {
      const kinds: Record<string, number> = {};
      for (let run = 0; run < 50; run++) {
        const qs = makeQuiz(book, si, g, rng(run * 7919 + si * 31 + g.length));
        const where = `${st.name}/${GRADES[g].label}#${run}`;
        if (qs.length !== GRADES[g].count) fail(`${where} 題數 ${qs.length}`);
        for (const q of qs) {
          total++;
          kinds[q.kind] = (kinds[q.kind] || 0) + 1;
          if (q.kind === "next") {
            noSpeaker(where + " 選項", q.options.map((p) => p.t));
            if (q.prompt.every((p) => speakers.has(p.t))) fail(`${where} 題目沒有內文`);
          } else if (q.kind === "fill") noSpeaker(where + " 挖空句", [q.clause.t]);
          else {
            const n = q.pieces.filter((p) => speakers.has(p.t)).length;
            if (n > 1) fail(`${where} 排序有 ${n} 塊說話者`);
            if (speakers.has(q.pieces[q.pieces.length - 1].t)) fail(`${where} 排序最後一塊是說話者`);
          }
          if (q.kind === "next") {
            const texts = q.options.map((o) => o.t);
            if (new Set(texts).size !== texts.length) fail(`${where} 接句選項重複 ${texts}`);
            if (texts.length !== GRADES[g].nextOpts) fail(`${where} 接句選項數 ${texts.length}`);
            // 在全書找所有與題目相同的連續句，其下一句都必須是正解
            const seq = q.prompt.map((p) => p.t);
            for (let k = 0; k + seq.length < flat.length; k++) {
              if (seq.every((t, j) => flat[k + j] === t)) {
                const nx = flat[k + seq.length];
                texts.forEach((t, i) => { if (i !== q.answer && t === nx) fail(`${where} 干擾選項也是正解：${seq.join("，")}→${t}`); });
                if (texts[q.answer] !== nx) fail(`${where} 下一句不唯一：${seq.join("，")}`);
              }
            }
          } else if (q.kind === "fill") {
            if (q.blanks.length !== GRADES[g].fillBlanks) fail(`${where} 挖空數 ${q.blanks.length}`);
            q.blanks.forEach((b, i) => {
              const ch = q.clause.t[b];
              if (PUNCT.test(ch)) fail(`${where} 挖到標點`);
              const opts = q.options[i];
              if (opts.length !== GRADES[g].fillOpts) fail(`${where} 字卡數 ${opts.length}`);
              if (opts[q.answers[i]].t !== ch) fail(`${where} 正解字錯`);
              if (new Set(opts.map((o) => o.t)).size !== opts.length) fail(`${where} 字卡重複`);
              opts.forEach((o, k) => {
                if (k === q.answers[i]) return;
                const alt = q.clause.t.slice(0, b) + o.t + q.clause.t.slice(b + 1);
                if (allTexts.has(alt)) fail(`${where} 干擾字也通：${alt}`);
              });
            });
          } else {
            const orig = q.pieces.map((p) => p.t).join("|");
            const sh = q.shuffled.map((k) => q.pieces[k].t).join("|");
            if (orig === sh) fail(`${where} 打散後跟原順序一樣`);
            if (q.pieces.length < 3 || q.pieces.length > Math.max(...GRADES[g].orderPieces)) fail(`${where} 排序塊數 ${q.pieces.length}`);
            if ([...q.shuffled].sort().join() !== q.pieces.map((_, i) => i).join()) fail(`${where} 打散索引錯`);
          }
        }
      }
      const mix = ["next", "fill", "order"].map((k) => kinds[k] || 0);
      if (mix.some((x) => x === 0)) console.log(`△ ${st.name}/${GRADES[g].label} 題型分布 接句${mix[0]} 填空${mix[1]} 排序${mix[2]}`);
    }
  });
}
console.log(`共檢查 ${total} 題，錯誤 ${errors} 筆`);
process.exit(errors ? 1 : 0);
