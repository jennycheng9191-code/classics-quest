"""用 Azure 語音產生注音音節音檔：全書每個不同的注音錄一次，網站朗讀時照課本注音逐字接起來。

讀音用 SSML <phoneme alphabet="sapi" ph="注音"> 指定，破音字一定照課本念。
金鑰放在 repo 根目錄的 .env.local（.gitignore 已排除，不會進 git）：
    AZURE_SPEECH_KEY=...
    AZURE_SPEECH_REGION=eastasia
用法（在 repo 根目錄）：
    python tools/audio/make_syllables.py            # 只補還沒有的音節
    python tools/audio/make_syllables.py --all      # 全部重錄（換聲音時用）
    python tools/audio/make_syllables.py --sample   # 每個候選聲音念一句試聽，存到 tools/audio/samples/
"""
import glob, json, os, sys, time, urllib.request, urllib.error
from xml.sax.saxutils import escape

VOICE = 'zh-TW-HsiaoYuNeural'
CANDIDATES = ['zh-TW-HsiaoYuNeural', 'zh-TW-HsiaoChenNeural', 'zh-TW-YunJheNeural']
OUT = 'public/audio'
FORMAT = 'audio-24khz-48kbitrate-mono-mp3'


def env():
    vals = {}
    with open('.env.local', encoding='utf-8') as f:
        for line in f:
            if '=' in line and not line.lstrip().startswith('#'):
                k, v = line.strip().split('=', 1)
                vals[k.strip()] = v.strip()
    return vals['AZURE_SPEECH_KEY'], vals['AZURE_SPEECH_REGION']


def tts(key, region, ssml):
    req = urllib.request.Request(
        f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1',
        data=ssml.encode('utf-8'), method='POST',
        headers={'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
                 'X-Microsoft-OutputFormat': FORMAT, 'User-Agent': 'classics-quest'})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 4:  # 免費方案有每秒次數上限
                time.sleep(2 * (attempt + 1))
                continue
            raise


def ssml(voice, body):
    return (f"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-TW'>"
            f"<voice name='{voice}'>{body}</voice></speak>")


def phon(ch, z):
    return f"<phoneme alphabet='sapi' ph='{escape(z)}'>{escape(ch)}</phoneme>"


def syllables():
    # 注音 → 第一個用到它的字（只當 phoneme 的載體，讀音以注音為準）
    seen = {}
    for path in sorted(glob.glob('src/data/classics/*.json')):
        book = json.load(open(path, encoding='utf-8'))
        for st in book['stages']:
            for c in st['clauses']:
                for ch, z in zip(c['t'], c['z']):
                    seen.setdefault(z, ch)
    return seen


def main():
    key, region = env()
    if '--sample' in sys.argv:
        os.makedirs('tools/audio/samples', exist_ok=True)
        book = json.load(open('src/data/classics/daxue.json', encoding='utf-8'))
        cl = book['stages'][0]['clauses'][:4]
        body = "<break time='300ms'/>".join(''.join(phon(ch, z) for ch, z in zip(c['t'], c['z'])) for c in cl)
        for v in CANDIDATES:
            open(f'tools/audio/samples/{v}.mp3', 'wb').write(tts(key, region, ssml(v, body)))
            print('sample', v)
        return
    os.makedirs(f'{OUT}/syl', exist_ok=True)
    table_path = f'{OUT}/syllables.json'
    table = {} if '--all' in sys.argv or not os.path.exists(table_path) else json.load(open(table_path, encoding='utf-8'))
    syl = syllables()
    todo = [z for z in syl if z not in table or not os.path.exists(f'{OUT}/syl/{table[z]}')]
    used = set(table.values())
    n = len(used)
    for i, z in enumerate(todo):
        name = table.get(z)
        if not name:
            n += 1
            while f's{n:04d}.mp3' in used:
                n += 1
            name = f's{n:04d}.mp3'
            used.add(name)
        open(f'{OUT}/syl/{name}', 'wb').write(tts(key, region, ssml(VOICE, phon(syl[z], z))))
        table[z] = name
        if i % 20 == 0:
            json.dump(table, open(table_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
        time.sleep(0.25)
    json.dump(table, open(table_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
    with open('tools/audio/log.txt', 'w', encoding='utf-8') as f:
        f.write(f'voice={VOICE} total={len(table)} new={len(todo)}\n')


if __name__ == '__main__':
    main()
