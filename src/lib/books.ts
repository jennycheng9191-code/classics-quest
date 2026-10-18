// 經典清單從資料夾讀出來：加一本新經典＝多放一份 json，程式不用改
import type { Classic } from "./quiz.ts";

const mods = import.meta.glob<Classic>("../data/classics/*.json", { eager: true, import: "default" });
export const BOOKS: Classic[] = Object.values(mods);
