# 讀經闖關

讀經班小朋友（幼兒園～國小）用平板／手機闖關背經典。一章一關，三種題型（接下一句、填空選字、排順序），三個年級各自的難度與進度。

- 線上：https://jennycheng9191-code.github.io/classics-quest/
- 技術：React＋Vite＋Tailwind，GitHub Pages（`vite.config.ts` 的 `base` 不可拿掉）
- 進度存在訪客瀏覽器 localStorage（key 前綴 `classics-`）

## 經文資料

- 正本是讀經班課本：`tools/daxue/textbook_zhuyin.md`（字＋注音）與 `textbook_plain.md`（純文字，用來交叉核對）
- 轉檔：`cd tools/daxue && python build_from_textbook.py` → 產生 `src/data/classics/daxue.json`
- 字形與注音一律照課本，不自動補、不改異體字
- `tools/daxue/legacy/` 是課本到手前用 pypinyin 自動注音的舊版，已停用

## 加一本新經典

1. 照 `textbook_zhuyin.md` 的格式（`## 章名` ＋ `<ruby>字<rt>注音</rt></ruby>`）放課本檔
2. 仿 `build_from_textbook.py` 轉成 `src/data/classics/<id>.json`
3. `node tools/check_quiz.ts` 檢查題目沒有歧義
4. push — 首頁會自動多一本，程式不用改

## 指令

```
npx --yes pnpm@10 install
npx --yes pnpm@10 dev       # 本機開發
npx --yes pnpm@10 build
node tools/check_quiz.ts    # 每關×每級出 50 次題目做檢查
```
