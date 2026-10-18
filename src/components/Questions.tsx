// 三種題型的畫面。每題做完呼叫 onDone(答對與否)，由外層換下一題。
import { useEffect, useRef, useState } from "react";
import type { FillQ, NextQ, OrderQ, Piece, Question } from "../lib/quiz.ts";
import { ding, hush, speak } from "../lib/sound.ts";
import { Char, Zh } from "./Zh.tsx";

const RIGHT_MS = 900;
const WRONG_MS = 1500;
const WRONG_ORDER_MS = 2500; // 排序題正解比較長，多留一點時間看

// 答對叮咚一聲；答錯念出正確答案，念完才換下一題
function useFinish(onDone: (ok: boolean) => void, sound: boolean) {
  const t = useRef<number>(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(t.current);
      hush();
    };
  }, []);
  return (ok: boolean, ms: number, answer: Piece[]) => {
    const later = (wait: number) => {
      if (alive.current) t.current = window.setTimeout(() => onDone(ok), wait);
    };
    if (!sound) return later(ms);
    if (ok) {
      ding();
      return later(ms);
    }
    // 音檔載太久（網路慢）就不等了，遊戲不能卡住
    const slow = new Promise<number>((r) => setTimeout(() => r(-1), 3000));
    Promise.race([speak(answer), slow]).then(
      (sec) => {
        if (sec < 0) hush();
        later(Math.max(ms, sec * 1000 + 600));
      },
      () => later(ms),
    );
  };
}

type Props<Q> = { q: Q; show: boolean; sound: boolean; onDone: (ok: boolean) => void };

function Verdict({ ok }: { ok: boolean | null }) {
  if (ok === null) return <div className="h-14" />;
  return (
    <div className={"verdict " + (ok ? "verdict-ok" : "verdict-no")}>
      {ok ? "答對了！" : "再記一次正確答案"}
    </div>
  );
}

function NextView({ q, show, sound, onDone }: Props<NextQ>) {
  const [pick, setPick] = useState<number | null>(null);
  const finish = useFinish(onDone, sound);
  const ok = pick === null ? null : pick === q.answer;
  const choose = (i: number) => {
    if (pick !== null) return;
    setPick(i);
    finish(i === q.answer, i === q.answer ? RIGHT_MS : WRONG_MS, [q.options[q.answer]]);
  };
  return (
    <>
      <p className="q-hint">下一句是什麼？</p>
      <div className="q-card">
        {q.prompt.map((p, i) => (
          <Zh key={i} piece={p} show={show} p={p.p} />
        ))}
        <span className="q-blank-line" />
      </div>
      <div className="opts">
        {q.options.map((o, i) => {
          let cls = "opt";
          if (pick !== null && i === q.answer) cls += " opt-right";
          else if (pick === i) cls += " opt-wrong";
          return (
            <button key={i} className={cls} onClick={() => choose(i)} disabled={pick !== null && cls === "opt"}>
              <Zh piece={o} show={show} />
            </button>
          );
        })}
      </div>
      <Verdict ok={ok} />
    </>
  );
}

function FillView({ q, show, sound, onDone }: Props<FillQ>) {
  const [step, setStep] = useState(0); // 正在填第幾個空格
  const [miss, setMiss] = useState<number | null>(null); // 選錯的字卡
  const finish = useFinish(onDone, sound);
  const over = miss !== null || step >= q.blanks.length;
  const ok = !over ? null : miss === null;
  const choose = (k: number) => {
    if (over) return;
    if (k === q.answers[step]) {
      const n = step + 1;
      setStep(n);
      if (n >= q.blanks.length) finish(true, RIGHT_MS, []);
    } else {
      setMiss(k);
      finish(false, WRONG_MS, [q.clause]);
    }
  };
  return (
    <>
      <p className="q-hint">點下面的字，把空格填起來</p>
      <div className="q-card">
        {q.before && (
          <span className="q-before">
            <Zh piece={q.before} p={q.before.p} show={show} />
          </span>
        )}
        <span className="zh">
          {[...q.clause.t].map((ch, i) => {
            const b = q.blanks.indexOf(i);
            if (b < 0) return <Char key={i} ch={ch} z={q.clause.z[i]} show={show} />;
            const filled = b < step || miss !== null;
            const cls = "blank" + (b === step && !over ? " blank-now" : "") + (miss !== null && b >= step ? " blank-fix" : "");
            return (
              <span key={i} className={cls}>
                {filled ? <Char ch={ch} z={q.clause.z[i]} show={show} /> : <Char ch="　" show={show} />}
              </span>
            );
          })}
        </span>
      </div>
      <div className="cards">
        {!over &&
          q.options[step].map((o, k) => (
            <button key={step + "-" + k} className="card" onClick={() => choose(k)}>
              <Char ch={o.t} z={o.z[0]} show={show} />
            </button>
          ))}
        {miss !== null && (
          <button className="card opt-wrong" disabled>
            <Char ch={q.options[step][miss].t} z={q.options[step][miss].z[0]} show={show} />
          </button>
        )}
      </div>
      <Verdict ok={ok} />
    </>
  );
}

function OrderView({ q, show, sound, onDone }: Props<OrderQ>) {
  const [placed, setPlaced] = useState<number[]>([]); // 依序點進來的塊（存 shuffled 的位置）
  const [ok, setOk] = useState<boolean | null>(null);
  const finish = useFinish(onDone, sound);
  const n = q.pieces.length;
  const tap = (slot: number) => {
    if (ok !== null) return;
    const next = [...placed, slot];
    setPlaced(next);
    if (next.length === n) {
      // 比文字不比位置：全書有重複句時，兩塊對調也算對
      const good = next.map((s) => q.pieces[q.shuffled[s]].t).join("|") === q.pieces.map((p) => p.t).join("|");
      setOk(good);
      finish(good, good ? RIGHT_MS : WRONG_ORDER_MS, q.pieces);
    }
  };
  const undo = (i: number) => ok === null && setPlaced(placed.filter((_, k) => k !== i));
  return (
    <>
      <p className="q-hint">照經文的順序，一塊一塊點</p>
      <div className={"order-box" + (ok === false ? " order-bad" : "")}>
        {placed.length === 0 && <span className="order-empty">從第一句開始點 ↓</span>}
        {placed.map((s, i) => (
          <button key={s} className={"chip chip-placed" + (ok ? " opt-right" : "")} onClick={() => undo(i)}>
            <span className="chip-no">{i + 1}</span>
            <Zh piece={q.pieces[q.shuffled[s]]} show={show} />
          </button>
        ))}
      </div>
      {ok === false && (
        <div className="order-answer">
          {q.pieces.map((p, i) => (
            <span key={i} className="chip opt-right">
              <span className="chip-no">{i + 1}</span>
              <Zh piece={p} show={show} />
            </span>
          ))}
        </div>
      )}
      {ok === null && (
        <div className="cards">
          {q.shuffled.map((k, s) =>
            placed.includes(s) ? null : (
              <button key={s} className="chip" onClick={() => tap(s)}>
                <Zh piece={q.pieces[k]} show={show} />
              </button>
            ),
          )}
        </div>
      )}
      <Verdict ok={ok} />
    </>
  );
}

export function QuestionView(props: Props<Question>) {
  const { q } = props;
  if (q.kind === "next") return <NextView {...props} q={q} />;
  if (q.kind === "fill") return <FillView {...props} q={q} />;
  return <OrderView {...props} q={q} />;
}
