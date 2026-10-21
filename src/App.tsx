import { useEffect, useMemo, useRef, useState } from "react";

// 直式經文框打開時捲到最右邊（第一行）。scrollLeft 塞超大值：新版瀏覽器會夾到 0（最右），舊版 Chrome 則是最大值（也是最右）
const toFirstLine = (el: HTMLElement | null) => {
  if (el) el.scrollLeft = el.scrollWidth;
};
import { BOOKS } from "./lib/books.ts";
import { BOARD_ON, clock } from "./lib/board.ts";
import { getPref, getStars, saveRun, setPref, totals } from "./lib/progress.ts";
import { GRADES, makeQuiz, stars, type Classic, type Grade } from "./lib/quiz.ts";
import { QuestionView } from "./components/Questions.tsx";
import { preload } from "./lib/sound.ts";
import { Zh } from "./components/Zh.tsx";
import { BoardSheet, SubmitPanel } from "./components/Board.tsx";

type Screen =
  | { at: "home" }
  | { at: "grade"; book: Classic }
  | { at: "map"; book: Classic; grade: Grade; peek?: number }
  | { at: "play"; book: Classic; grade: Grade; stage: number; round: number }
  | { at: "result"; book: Classic; grade: Grade; stage: number; right: number; total: number; ms: number; record: boolean };

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

function TopBar(props: {
  onBack?: () => void; title: string; sub?: string; zhuyin?: boolean; onZhuyin?: () => void; sound?: boolean; onSound?: () => void;
}) {
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
      {props.onSound && (
        <button className={"tb-btn tb-sound" + (props.sound ? "" : " tb-sound-off")} onClick={props.onSound} aria-pressed={props.sound} aria-label="聲音">
          {props.sound ? "🔊" : "🔇"}
        </button>
      )}
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
        <div className="hero-v">
          <div className="seal">讀經</div>
          <h1 className="hero-title">讀經闖關</h1>
          <p className="hero-sub">一段一關，背熟了拿星星</p>
        </div>
      </div>
      <div className="shelf">
        {BOOKS.map((b) => (
          <button key={b.id} className="big-btn book-btn" onClick={() => go({ at: "grade", book: b })}>
            <span className="book-title">《{b.title}》</span>
            <span className="book-meta">{upright(`${b.stages.length} 關`)}</span>
          </button>
        ))}
      </div>
    </main>
  );
}

function GradePick({ book, go }: { book: Classic; go: (s: Screen) => void }) {
  return (
    <>
      <TopBar title="" onBack={() => go({ at: "home" })} />
      <main className="page">
        {/* 書名直寫放最右邊，難度按鈕接在左邊 */}
        <div className="shelf">
          <div className="shelf-head">
            <h1 className="shelf-title">《{book.title}》</h1>
            <p className="shelf-sub">選你的難度</p>
          </div>
          {GRADE_KEYS.map((g) => {
            const got = Object.values(getStars(book.id, g)).reduce((a, b) => a + b, 0);
            return (
              <button key={g} className={"big-btn grade-btn grade-" + g} onClick={() => go({ at: "map", book, grade: g })}>
                <span className="grade-icon">{GRADES[g].icon}</span>
                <span className="grade-text">
                  <span className="grade-label">{GRADES[g].label}</span>
                  <span className="grade-meta">{upright(`每關 ${GRADES[g].count} 題`)}</span>
                </span>
                <span className="grade-got">★{upright(String(got))}</span>
              </button>
            );
          })}
        </div>
      </main>
    </>
  );
}

// 闖關地圖：像展開一卷書，第 1 關在最右邊，小路上下彎著往左走，左右滑動
function MapView({ book, grade, peek, go, zhuyin, toggle }: {
  book: Classic; grade: Grade; peek?: number; go: (s: Screen) => void; zhuyin: boolean; toggle: () => void;
}) {
  const rec = getStars(book.id, grade);
  const n = book.stages.length;
  const unlocked = (i: number) => i === 0 || (rec[book.stages[i - 1].id] ?? 0) >= 1;
  const total = Object.values(rec).reduce((a, b) => a + b, 0);
  const STEP = window.innerWidth < 500 ? 74 : 96; // 手機窄，關卡排密一點才看得到多幾關
  const W = STEP * (n - 1) + 120;
  // 地圖高度跟著螢幕，小路上下彎的幅度也跟著放大；最低點要留位置給直寫的關卡名
  const H = Math.max(380, Math.min(620, window.innerHeight - 180));
  const xs = book.stages.map((_, i) => W - 60 - i * STEP);
  const ys = book.stages.map((_, i) => 60 + ((H - 220) / 2) * (1 - Math.cos((i * Math.PI) / 2.2)));
  const path = xs.map((x, i) => (i ? "L" : "M") + x + " " + ys[i]).join(" ");
  const st = peek !== undefined ? book.stages[peek] : null;
  const [board, setBoard] = useState(false);

  // 打開地圖時捲到要玩的那一關（剛按「下一關」的那關，否則最新解鎖的那關）
  const scroller = useRef<HTMLDivElement>(null);
  let focus = peek ?? 0;
  if (peek === undefined) while (focus + 1 < n && unlocked(focus + 1)) focus++;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = xs[focus] - el.clientWidth / 2;
  }, [focus]);
  // 電腦滑鼠滾輪預設是上下捲，這裡轉成左右走：往下滾＝往後面的關卡（往左）
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft -= e.deltaY;
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  return (
    <>
      <TopBar title="" onBack={() => go({ at: "grade", book })} zhuyin={zhuyin} onZhuyin={toggle} />
      <main className="page map-page">
        {/* 書名、難度、星星直寫在最右邊，地圖接在左邊 */}
        <div className="map-head">
          <h1 className="shelf-title">《{book.title}》</h1>
          <p className="map-grade">
            {GRADES[grade].icon}{GRADES[grade].label}
            <span className="map-total">★{upright(String(total))}</span>
          </p>
          {BOARD_ON && (
            <button className="board-open" onClick={() => setBoard(true)}>🏆排行榜</button>
          )}
        </div>
        <div className="map-scroll" ref={scroller}>
        <div className="map" style={{ width: W, height: H }}>
          <svg className="map-path" viewBox={`0 0 ${W} ${H}`}>
            <path d={path} />
          </svg>
          {book.stages.map((s, i) => {
            const open = unlocked(i);
            const got = rec[s.id] ?? 0;
            return (
              <button
                key={s.id}
                className={"node" + (open ? "" : " node-lock") + (got ? " node-done" : "")}
                style={{ left: xs[i], top: ys[i] }}
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
        </div>
      </main>
      {st && peek !== undefined && (
        <div className="sheet-wrap" onClick={() => go({ at: "map", book, grade })}>
          <section className="sheet sheet-scripture" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <div>
                <div className="sheet-no">第 {peek + 1} 關</div>
                <h2 className="sheet-title">{st.name}</h2>
                <div className="sheet-theme">{st.theme}</div>
              </div>
              <Starline n={rec[st.id] ?? 0} />
            </div>
            {/* 經文在右、按鈕在左，跟直式書本一樣讀完往左走 */}
            <div className="sheet-body">
              <div className="sheet-text flow" key={peek} ref={toFirstLine}>
                {st.clauses.map((c, i) => (
                  <Zh key={i} piece={c} p={c.p} show={zhuyin} />
                ))}
              </div>
              <div className="sheet-actions">
                <button className="btn-main" onClick={() => go({ at: "play", book, grade, stage: peek, round: Date.now() })}>
                  開始闖關
                </button>
                <button className="btn-ghost" onClick={() => go({ at: "map", book, grade })}>先不要</button>
              </div>
            </div>
          </section>
        </div>
      )}
      {board && <BoardSheet book={book.id} grade={grade} stages={book.stages.length} onClose={() => setBoard(false)} />}
    </>
  );
}

function Play({ book, grade, stage, round, go, zhuyin, toggle, sound, toggleSound }: {
  book: Classic; grade: Grade; stage: number; round: number; go: (s: Screen) => void; zhuyin: boolean; toggle: () => void;
  sound: boolean; toggleSound: () => void;
}) {
  // round 變了才重新出題（重玩同一關會換題）
  const quiz = useMemo(() => makeQuiz(book, stage, grade), [book, stage, grade, round]);
  // 用時從出完題開始算，到最後一題結束（含答錯時看正解的時間）
  const startAt = useMemo(() => Date.now(), [round]);
  const [idx, setIdx] = useState(0);
  const [right, setRight] = useState(0);
  const st = book.stages[stage];
  useEffect(() => {
    if (sound) preload(st.clauses);
  }, [st, sound]);
  const done = (ok: boolean) => {
    const r = right + (ok ? 1 : 0);
    if (idx + 1 >= quiz.length) {
      const ms = Date.now() - startAt;
      const n = stars(r, quiz.length);
      const record = n > 0 && saveRun(book.id, grade, st.id, n, ms);
      go({ at: "result", book, grade, stage, right: r, total: quiz.length, ms, record });
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
        sound={sound}
        onSound={toggleSound}
      />
      <div className="progress">
        <div className="progress-bar" style={{ width: `${(idx / quiz.length) * 100}%` }} />
      </div>
      <main className="page play">
        <QuestionView key={round + "-" + idx} q={quiz[idx]} show={zhuyin} sound={sound} onDone={done} />
      </main>
    </>
  );
}

// 直式裡的數字一組一組轉正，中文字照常直排（「1分05秒」→ 1、05 各佔一格）
function upright(text: string) {
  return text.split(/(\d+)/).map((t, i) => (i % 2 ? <span key={i} className="tcy">{t}</span> : t));
}

function Result({ book, grade, stage, right, total, ms, record, go }: {
  book: Classic; grade: Grade; stage: number; right: number; total: number; ms: number; record: boolean; go: (s: Screen) => void;
}) {
  const n = stars(right, total);
  const hasNext = stage + 1 < book.stages.length;
  const sum = BOARD_ON ? totals(book.id, grade, book.stages.map((s) => s.id)) : null;
  return (
    <main className="page result">
      {/* 直式：由右往左讀，標題→星星→成績 */}
      <div className="result-card">
        <div className="result-emoji">{n === 3 ? "🏆" : n > 0 ? "🎉" : "💪"}</div>
        <h2 className="result-title">{n > 0 ? "過關了！" : "差一點點，再試一次"}</h2>
        <Starline n={n} size="stars-lg" />
        <p className="result-score">
          答對 <span className="tcy">{right}</span> 題（共 <span className="tcy">{total}</span> 題）
          <br />
          用時 {upright(clock(ms))}
          {record && <span className="result-record">這關新紀錄！</span>}
        </p>
      </div>
      {/* 按鈕放卡片下面，字直寫、第一顆在最右邊；放卡片裡手機會太寬 */}
      <div className="result-btns">
          {n > 0 && hasNext && (
            <button className="btn-main" onClick={() => go({ at: "map", book, grade, peek: stage + 1 })}>
              下一關
            </button>
          )}
          <button className={n > 0 ? "btn-ghost" : "btn-main"} onClick={() => go({ at: "play", book, grade, stage, round: Date.now() })}>
            再玩一次
          </button>
          <button className="btn-ghost" onClick={() => go({ at: "map", book, grade })}>回地圖</button>
      </div>
      {/* 輸入名字的表單維持橫式，直式輸入框不好打字 */}
      {sum && n > 0 && (
        <SubmitPanel book={book.id} grade={grade} stars={sum.stars} ms={sum.ms} stages={book.stages.length} />
      )}
    </main>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ at: "home" });
  const [zy, setZy] = useState<Partial<Record<Grade, boolean>>>({});
  const [sound, setSound] = useState(() => getPref("sound") !== "0");
  const toggleSound = () => {
    setSound(!sound);
    setPref("sound", sound ? "0" : "1");
  };
  const go = (s: Screen) => {
    // 地圖上開關說明卡不捲動，換畫面才回頂端
    if (s.at !== screen.at) window.scrollTo(0, 0);
    setScreen(s);
  };
  // 開發時讓測試腳本可以直接跳畫面；正式版會被整段拿掉
  if (import.meta.env.DEV) Object.assign(window, { __go: go, __books: BOOKS });
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
      return <Play {...screen} go={go} zhuyin={zhuyin} toggle={toggle} sound={sound} toggleSound={toggleSound} />;
    case "result":
      return <Result {...screen} go={go} />;
  }
}
