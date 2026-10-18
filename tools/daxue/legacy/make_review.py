"""產生《大學》注音校對網頁（單檔，可直接雙擊開）。"""
import json, html

d = json.load(open('daxue.json', encoding='utf-8'))
review = json.load(open('review.json', encoding='utf-8'))
# (章, 小句, 位置) → 來源說明
src = {(c, t, k): s for c, t, k, ch, z, s in review}
TONES = 'ˊˇˋ'


def zy(z):
    tone = z[-1] if z and z[-1] in TONES else ''
    body = z[:-1] if tone else z
    return f'<span class="zy"><span class="b">{"".join(f"<i>{x}</i>" for x in body)}</span><span class="t">{tone}</span></span>'


parts = []
n_chg = 0
for st in d['stages']:
    rows = []
    for c in st['clauses']:
        chars = []
        for k, (ch, z) in enumerate(zip(c['t'], c['z'])):
            # 查來源：該句所屬章（合併關的 chapter 用頓號串接）
            s = next((src[(cn, c['t'], k)] for cn in st['chapter'].split('、') if (cn, c['t'], k) in src), '')
            cls = ''
            if '採通行讀法' in s:
                cls = 'alt'
            elif s.startswith('覆寫') or s == '改台灣讀音':
                cls = 'chg'
            if cls:
                n_chg += 1
            tip = html.escape(s) if cls else ''
            chars.append(f'<span class="c {cls}" title="{tip}"><span class="h">{ch}</span>{zy(z)}</span>')
        rows.append(''.join(chars) + f'<span class="p">{c["p"]}</span>')
    parts.append(f'<section><h2>第 {int(st["id"][-2:])} 關　{st["name"]}<small>{st["theme"]}</small></h2><div class="txt">{"".join(rows)}</div></section>')

page = f'''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>大學注音校對</title>
<style>
:root{{--bg:#fbf8f1;--fg:#222;--chg:#fff0a8;--alt:#ffc9a8;--muted:#777}}
body{{margin:0;padding:16px;background:var(--bg);color:var(--fg);font-family:"BiauKai","DFKai-SB","標楷體",serif}}
header{{position:sticky;top:0;background:var(--bg);padding:8px 0;border-bottom:1px solid #ddd;font-family:sans-serif;font-size:14px}}
.k{{display:inline-block;padding:0 6px;border-radius:4px}}
h2{{font-size:20px;margin:28px 0 8px}} h2 small{{font-size:14px;color:var(--muted);margin-left:8px}}
.txt{{line-height:1;display:flex;flex-wrap:wrap;row-gap:14px}}
.c{{display:inline-flex;align-items:center;padding:2px 1px;border-radius:4px}}
.c.chg{{background:var(--chg)}} .c.alt{{background:var(--alt)}}
.h{{font-size:34px}}
.zy{{display:inline-flex;align-items:center;margin-left:1px}}
.zy .b{{display:flex;flex-direction:column;font-size:11px;line-height:1.05}}
.zy .b i{{font-style:normal}} .zy .t{{font-size:11px;width:7px}}
.p{{font-size:30px;margin-right:4px;align-self:center}}
</style></head><body>
<header><b>《大學》注音校對</b>　來源：{d["source"]}　｜
<span class="k" style="background:var(--chg)">黃色</span> 破音字／已改台灣讀音（滑鼠停在字上看依據）
<span class="k" style="background:var(--alt)">橘色</span> 朱注古讀與通行讀法不同，目前採通行讀法，<b>請特別對課本</b>　｜　共標記 {n_chg} 處</header>
{"".join(parts)}
</body></html>'''
open('大學注音校對.html', 'w', encoding='utf-8').write(page)
print(n_chg)
