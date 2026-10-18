// 字＋注音。注音直排在字的右側、聲調在注音右邊、輕聲點在最上面，跟課本一樣。
import type { Piece } from "../lib/quiz.ts";

const TONES = "ˊˇˋ";

export function Bopomofo({ z }: { z: string }) {
  let body = z;
  let tone = "";
  let light = false;
  if (body.includes("˙")) {
    light = true;
    body = body.replace("˙", "");
  }
  if (TONES.includes(body.slice(-1))) {
    tone = body.slice(-1);
    body = body.slice(0, -1);
  }
  return (
    <span className="zy" aria-hidden="true">
      <span className="zy-col">
        {light && <span className="zy-light">˙</span>}
        {[...body].map((s, i) => (
          <span key={i}>{s}</span>
        ))}
      </span>
      <span className="zy-tone">{tone}</span>
    </span>
  );
}

export function Char({ ch, z, show }: { ch: string; z?: string; show: boolean }) {
  return (
    <span className="ch">
      <span className="han">{ch}</span>
      {show && (z ? <Bopomofo z={z} /> : <span className="zy zy-empty" />)}
    </span>
  );
}

// 一句（或一組字卡）；p 是句末標點
export function Zh({ piece, show, p = "" }: { piece: Piece; show: boolean; p?: string }) {
  return (
    <span className="zh">
      {[...piece.t].map((ch, i) => (
        <Char key={i} ch={ch} z={piece.z[i]} show={show} />
      ))}
      {[...p].map((ch, i) => (
        <Char key={"p" + i} ch={ch} show={show} />
      ))}
    </span>
  );
}
