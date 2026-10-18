// 排行榜畫面：前 10 名清單＋全部過關後輸入名字上榜
import { useEffect, useState } from "react";
import { clock, fetchTop, submitScore, type Entry } from "../lib/board.ts";
import { getPref, setPref } from "../lib/progress.ts";
import { GRADES, type Grade } from "../lib/quiz.ts";

const MEDAL = ["🥇", "🥈", "🥉"];

export function BoardList({ top, me }: { top: Entry[] | null | "error"; me?: string }) {
  if (top === "error") return <p className="board-msg">排行榜暫時連不上，等一下再試</p>;
  if (top === null) return <p className="board-msg">載入中…</p>;
  if (top.length === 0) return <p className="board-msg">還沒有人上榜，你來當第一名！</p>;
  return (
    <ol className="board">
      {top.map((e, i) => (
        <li key={e.name} className={"board-row" + (e.name === me ? " board-me" : "")}>
          <span className="board-rank">{MEDAL[i] ?? i + 1}</span>
          <span className="board-name">{e.name}</span>
          <span className="board-stars">★ {e.stars}</span>
          <span className="board-time">{clock(e.ms)}</span>
        </li>
      ))}
    </ol>
  );
}

// 地圖上的「排行榜」按鈕打開的那張
export function BoardSheet({ book, grade, onClose }: { book: string; grade: Grade; onClose: () => void }) {
  const [top, setTop] = useState<Entry[] | null | "error">(null);
  useEffect(() => {
    fetchTop(book, grade).then(setTop, () => setTop("error"));
  }, [book, grade]);
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <section className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">🏆 {GRADES[grade].icon}{GRADES[grade].label}排行榜</h2>
        <p className="sheet-theme">12 關全部過關就能上榜，重玩刷星、刷時間可以往前衝</p>
        <div className="board-scroll">
          <BoardList top={top} me={getPref("name-" + grade) ?? undefined} />
        </div>
        <button className="btn-main" onClick={onClose}>關閉</button>
      </section>
    </div>
  );
}

// 結算畫面：全部過關時出現，輸入名字送出，送完列出前 10 名
export function SubmitPanel({ book, grade, stars, ms, stages }: {
  book: string; grade: Grade; stars: number; ms: number; stages: number;
}) {
  const sig = `${stars}|${ms}`;
  const [name, setName] = useState(() => getPref("name-" + grade) ?? "");
  // 這個成績已經用這個名字送過，就直接顯示榜單
  const [sent, setSent] = useState(() => getPref("sent-" + grade) === `${sig}|${name}`);
  const [busy, setBusy] = useState(false);
  const [top, setTop] = useState<Entry[] | null | "error">(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (sent) fetchTop(book, grade).then(setTop, () => setTop("error"));
  }, [sent, book, grade]);

  const send = async () => {
    const n = name.trim().replace(/\s+/g, " ").slice(0, 12);
    if (!n || busy) return;
    setBusy(true);
    try {
      const r = await submitScore({ book, grade, name: n, stars, ms, stages });
      setPref("name-" + grade, n);
      setPref("sent-" + grade, `${sig}|${n}`);
      setName(n);
      setNote(r.updated ? "上榜了！" : "你之前的紀錄比這次好，榜上保留那一筆");
      setTop(r.top);
      setSent(true);
    } catch {
      setNote("送不出去，檢查一下網路再按一次");
    }
    setBusy(false);
  };

  return (
    <div className="board-panel">
      <div className="board-total">
        <div className="board-total-title">🎊 12 關全部過關！</div>
        <div className="board-total-num">
          總成績 <b>★ {stars}</b> ・ <b>{clock(ms)}</b>
        </div>
      </div>
      {!sent ? (
        <div className="board-form">
          <label className="board-label" htmlFor="board-name">輸入名字上排行榜（用暱稱就好）</label>
          <input
            id="board-name"
            className="board-input"
            value={name}
            maxLength={12}
            placeholder="例如：小明"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button className="btn-main" onClick={send} disabled={busy || !name.trim()}>
            {busy ? "送出中…" : "送出上榜"}
          </button>
          {note && <p className="board-msg">{note}</p>}
        </div>
      ) : (
        <>
          {note && <p className="board-note">{note}</p>}
          <BoardList top={top} me={name} />
          <button className="btn-link" onClick={() => setSent(false)}>換名字再送一次</button>
        </>
      )}
    </div>
  );
}
