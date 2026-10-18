import { useMemo, useState } from "react";
import { BOOKS } from "./lib/books.ts";
import { getPref, getStars, saveStars, setPref } from "./lib/progress.ts";
import { GRADES, makeQuiz, stars, type Classic, type Grade } from "./lib/quiz.ts";
import { QuestionView } from "./components/Questions.tsx";
import { Zh } from "./components/Zh.tsx";

type Screen =
  | { at: "home" }
  | { at: "grade"; book: Classic }
  | { at: "map"; book: Classic; grade: Grade; peek?: number }
  | { at: "play"; book: Classic; grade: Grade; stage: number; round: number }
  | { at: "result"; book: Classic; grade: Grade; stage: number; right: number; total: number };

const GRADE_KEYS = Object.keys(GRADES) as Grade[];

function zhuyinDefault(g: Grade) {
  const v = getPref("zhuyin-" + g);
  return v === null ? GRADES[g].zhuyin : v === "1";
}

function Starline({ n, size = "" }: { n: number; size?: string }) {
  return (
    <span className={"stars " + size} aria-label={`${n} 顆星`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? "star-on" : "star-off"}>★</span>
      ))}
    </span>
  );
}

function TopBar(props: { onBack?: () => void; title: string; sub?: string; zhuyin?: boolean; onZhuyin?: () => void }) {
  return (
    <header className="topbar">
      {props.onBack ? (
        <button className="tb-btn" onClick={props.onBack} aria-label="返回">‹</button>
      ) : (
        <span className="tb-btn tb-ghost" />
      )}
      <div className="tb-title">
        <div className="tb-main">{props.title}</div>
        {props.sub && <div className="tb-sub">{props.sub}</div>}
      </div>
      {props.onZhuyin ? (
        <button className={"tb-zy" + (props.zhuyin ? " tb-zy-on" : "")} onClick={props.onZhuyin} aria-pressed={props.zhuyin}>
          ㄅㄆㄇ
          <span className="tb-zy-state">{props.zhuyin ? "開" : "關"}</span>
        </button>
      ) : (
        <span className="tb-btn tb-ghost" />
      )}
    </header>
  );
}

function Home({ go }: { go: (s: Screen) => void }) {
  return (
    <main className="page">
      <div className="hero">
        <div className="seal">讀經</div>
        <h1 className="hero-title">讀經闖關</h1>
        <p className="hero-sub">一章一關，背熟了拿星星</p>
      </div>
      <div className="stack">
        {BOOKS.map((b) => (
          <button key={b.id} className="big-btn book-btn" onClick={() => go({ at: "grade", book: b })}>
            <span className="book-title">《{b.title}》</span>
            <span className="book-meta">{b.stages.length} 關</span>
          </button>
        ))}
      </div>
    </main>
  );
}

function GradePick({ book, go }: { book: Classic; go: (s: Screen) => void }) {
  return (
    <>
      <TopBar title={`《${book.title}》`} sub="選你的年級" onBack={() => go({ at: "home" })} />
      <main className="page">
        <div className="stack">
          {GRADE_KEYS.map((g) => {
            const got = Object.values(getStars(book.id, g)).reduce((a, b) => a + b, 0);
            return (
              <button key={g} className={"big-btn grade-btn grade-" + g} onClick={() => go({ at: "map", book, grade: g })}>
                <span className="grade-icon">{GRADES[g].icon}</span>
                <span className="grade-text">
                  <span className="grade-label">{GRADES[g].label}</span>
                  <span className="grade-meta">每關 {GRADES[g].count} 題</span>
                </span>
                <span className="grade-got">★ {got}</span>
              </button>
            );
          })}
        </div>
      </main>
    </>
  );
}

// 闖關地圖：一條左右彎的小路，關卡點沿路排
function MapView({ book, grade, peek, go, zhuyin, toggle }: {
  book: Classic; grade: Grade; peek?: number; go: (s: Screen) => void; zhuyin: boolean; toggle: () => void;
}) {
  const rec = getStars(book.id, grade);
  const n = book.stages.length;
  const unlocked = (i: number) => i === 0 || (rec[book.stages[i - 1].id] ?? 0) >= 1;
  const total = Object.values(rec).reduce((a, b) => a + b, 0);
  const STEP = 108;
  const H = STEP * (n - 1) + 120;
  const xs = book.stages.map((_, i) => 50 + 30 * Math.sin((i * Math.PI) / 2.2));
  const ys = book.stages.map((_, i) => 60 + i * STEP);
  const path = xs.map((x, i) => (i ? "L" : "M") + x + " " + ys[i]).join(" ");
  const st = peek !== undefined ? book.stages[peek] : null;

  return (
    <>
      <TopBar
        title={`《${book.title}》${GRADES[grade].icon}${GRADES[grade].label}`}
        sub={`★ ${total} / ${n * 3}`}
        onBack={() => go({ at: "grade", book })}
        zhuyin={zhuyin}
        onZhuyin={toggle}
      />
      <main className="page">
        <div className="map" style={{ height: H }}>
          <svg className="map-path" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none">
            <path d={path} vectorEffect="non-scaling-stroke" />
          </svg>
          {book.stages.map((s, i) => {
            const open = unlocked(i);
            const got = rec[s.id] ?? 0;
            return (
              <button
                key={s.id}
                className={"node" + (open ? "" : " node-lock") + (got ? " node-done" : "")}
                style={{ left: `${xs[i]}%`, top: ys[i] }}
                disabled={!open}
                onClick={() => go({ at: "map", book, grade, peek: i })}
              >
                <span className="node-dot">{open ? i + 1 : "🔒"}</span>
                <span className="node-name">{s.name}</span>
                {got > 0 && <Starline n={got} size="stars-sm" />}
              </button>
            );
          })}
        </div>
      </main>
      {st && peek !== undefined && (
        <div className="sheet-wrap" onClick={() => go({ at: "map", book, grade })}>
          <section className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <div>
                <div className="sheet-no">第 {peek + 1} 關</div>
                <h2 className="sheet-title">{st.name}</h2>
                <div className="sheet-theme">{st.theme}</div>
              </div>
              <Starline n={rec[st.id] ?? 0} />
            </div>
            <div className="sheet-text">
              {st.clauses.map((c, i) => (
                <Zh key={i} piece={c} p={c.p} show={zhuyin} />
              ))}
            </div>
            <div className="sheet-actions">
              <button className="btn-ghost" onClick={() => go({ at: "map", book, grade })}>先不要</button>
              <button className="btn-main" onClick={() => go({ at: "play", book, grade, stage: peek, round: Date.now() })}>
                開始闖關
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Play({ book, grade, stage, round, go, zhuyin, toggle }: {
  book: Classic; grade: Grade; stage: number; round: number; go: (s: Screen) => void; zhuyin: boolean; toggle: () => void;
}) {
  // round 變了才重新出題（重玩同一關會換題）
  const quiz = useMemo(() => makeQuiz(book, stage, grade), [book, stage, grade, round]);
  const [idx, setIdx] = useState(0);
  const [right, setRight] = useState(0);
  const st = book.stages[stage];
  const done = (ok: boolean) => {
    const r = right + (ok ? 1 : 0);
    if (idx + 1 >= quiz.length) {
      saveStars(book.id, grade, st.id, stars(r, quiz.length));
      go({ at: "result", book, grade, stage, right: r, total: quiz.length });
    } else {
      setRight(r);
      setIdx(idx + 1);
    }
  };
  return (
    <>
      <TopBar
        title={st.name}
        sub={`第 ${idx + 1} / ${quiz.length} 題`}
        onBack={() => go({ at: "map", book, grade })}
        zhuyin={zhuyin}
        onZhuyin={toggle}
      />
      <div className="progress">
        <div className="progress-bar" style={{ width: `${(idx / quiz.length) * 100}%` }} />
      </div>
      <main className="page play">
        <QuestionView key={round + "-" + idx} q={quiz[idx]} show={zhuyin} onDone={done} />
      </main>
    </>
  );
}

function Result({ book, grade, stage, right, total, go }: {
  book: Classic; grade: Grade; stage: number; right: number; total: number; go: (s: Screen) => void;
}) {
  const n = stars(right, total);
  const hasNext = stage + 1 < book.stages.length;
  return (
    <main className="page result">
      <div className="result-card">
        <div className="result-emoji">{n === 3 ? "🏆" : n > 0 ? "🎉" : "💪"}</div>
        <h2 className="result-title">{n > 0 ? "過關了！" : "差一點點，再試一次"}</h2>
        <Starline n={n} size="stars-lg" />
        <p className="result-score">答對 {right} / {total} 題</p>
        <div className="stack">
          {n > 0 && hasNext && (
            <button className="btn-main" onClick={() => go({ at: "map", book, grade, peek: stage + 1 })}>
              下一關 ›
            </button>
          )}
          <button className={n > 0 ? "btn-ghost" : "btn-main"} onClick={() => go({ at: "play", book, grade, stage, round: Date.now() })}>
            再玩一次
          </button>
          <button className="btn-ghost" onClick={() => go({ at: "map", book, grade })}>回地圖</button>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ at: "home" });
  const [zy, setZy] = useState<Partial<Record<Grade, boolean>>>({});
  const go = (s: Screen) => {
    // 地圖上開關說明卡不捲動，換畫面才回頂端
    if (s.at !== screen.at) window.scrollTo(0, 0);
    setScreen(s);
  };
  const grade = "grade" in screen ? screen.grade : null;
  const zhuyin = grade ? (zy[grade] ?? zhuyinDefault(grade)) : true;
  const toggle = () => {
    if (!grade) return;
    setZy({ ...zy, [grade]: !zhuyin });
    setPref("zhuyin-" + grade, zhuyin ? "0" : "1");
  };

  switch (screen.at) {
    case "home":
      return <Home go={go} />;
    case "grade":
      return <GradePick book={screen.book} go={go} />;
    case "map":
      return <MapView {...screen} go={go} zhuyin={zhuyin} toggle={toggle} />;
    case "play":
      return <Play {...screen} go={go} zhuyin={zhuyin} toggle={toggle} />;
    case "result":
      return <Result {...screen} go={go} />;
  }
}
