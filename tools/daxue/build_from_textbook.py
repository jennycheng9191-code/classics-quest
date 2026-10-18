"""以讀經班課本（textbook_zhuyin.md）為唯一來源，產生遊戲資料檔。

課本的字與注音一律照抄，不做異體字轉換、不自動補注音。
"""
import json, re

PUNCT = '，。；：？！、'
QUOTES = '「」『』《》'
CHAPTERS = {
    '經一章': ('經一章', '三綱領八條目'),
    '傳之首章': ('傳一章', '釋明明德'), '傳之二章': ('傳二章', '釋新民'),
    '傳之三章': ('傳三章', '釋止於至善'), '傳之四章': ('傳四章', '釋本末'),
    '傳之六章': ('傳六章', '釋誠意'),
    '傳之七章': ('傳七章', '釋正心脩身'), '傳之八章': ('傳八章', '釋脩身齊家'),
    '傳之九章': ('傳九章', '釋齊家治國'), '傳之十章': ('傳十章', '釋治國平天下'),
}
# 拆關點：該句開頭文字
SPLITS = {'傳十章': ['道得眾', '唯仁人放流之']}
# 太短的章併入前一章成同一關
MERGE_INTO_PREV: set = set()
RUBY = re.compile(r'<ruby>(.)<rt>([^<]*)</rt></ruby>')

src = open('textbook_zhuyin.md', encoding='utf-8').read()
plain = open('textbook_plain.md', encoding='utf-8').read()

chapters = []
for block in re.split(r'^## ', src, flags=re.M)[1:]:
    head, body = block.split('\n', 1)
    key = head.split('　')[0].strip()
    cname, theme = CHAPTERS[key]
    # 逐 token 掃：注音字 / 標點 / 引號
    toks = re.findall(r'<ruby>.<rt>[^<]*</rt></ruby>|[' + PUNCT + QUOTES + r']|\n', body)
    rest = re.sub(r'<ruby>.<rt>[^<]*</rt></ruby>|[' + PUNCT + QUOTES + r'\s]', '', body)
    assert not rest, (cname, rest)  # 不能有沒注音的字
    clauses, cur, curz = [], '', []
    for tk in toks:
        m = RUBY.fullmatch(tk)
        if m:
            cur += m.group(1); curz.append(m.group(2).strip())
        elif tk in PUNCT:
            if cur:
                clauses.append({'t': cur, 'p': tk, 'z': curz}); cur, curz = '', []
            elif clauses:
                clauses[-1]['p'] += tk
    assert not cur, (cname, cur)
    chapters.append((cname, theme, clauses))

# 與純文字版交叉核對
def han(t):
    return re.sub(r'[^一-鿿㐀-䶿]', '', t)
zh_text = ''.join(c['t'] for _, _, cl in chapters for c in cl)
pl_text = han(re.sub(r'^#.*$', '', plain, flags=re.M))
assert zh_text == pl_text, '注音版與純文字版經文不一致'
for _, _, cl in chapters:
    for c in cl:
        assert len(c['z']) == len(c['t']) and all(c['z']), c

stages = []
for cname, theme, cl in chapters:
    if cname in MERGE_INTO_PREV:
        prev = stages[-1]
        prev['chapter'] += '、' + cname
        prev['name'] += '・' + cname
        prev['theme'] += '、' + theme
        prev['clauses'] += cl
        continue
    cuts = [i for i, c in enumerate(cl) for s in SPLITS.get(cname, []) if c['t'].startswith(s)]
    assert len(cuts) == len(SPLITS.get(cname, [])), (cname, cuts)
    bounds = [0] + cuts + [len(cl)]
    parts = len(bounds) - 1
    for j in range(parts):
        label = cname + (['（上）', '（中）', '（下）'] if parts == 3 else ['（上）', '（下）'])[j] if parts > 1 else cname
        stages.append({'id': f'daxue-{len(stages) + 1:02d}', 'chapter': cname, 'name': label,
                       'theme': theme, 'clauses': cl[bounds[j]:bounds[j + 1]]})

data = {'id': 'daxue', 'title': '大學',
        'source': '讀經班課本（朱子《大學章句》經一章、傳十章正文）',
        'note': '字形與注音照課本，引號與書名號省略',
        'stages': stages}
json.dump(data, open('../../src/data/classics/daxue.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
with open('build_log.txt', 'w', encoding='utf-8') as f:
    for s in stages:
        f.write(f"{s['id']} {s['name']} {sum(len(c['t']) for c in s['clauses'])}字 {len(s['clauses'])}句\n")
