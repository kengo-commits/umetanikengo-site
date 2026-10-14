"""Make the daily Instagram carousel for KENGO'S SYNESTHESIA.

Reads the newest day in world/news.json and writes six 1080x1350 images plus
a caption to ig-out/<date>/ :

  1 cover: that day's SYNESTHESIA DIGITAL ART by KENGO (world/signal.js), a different data artwork every day
  2 Plate: that day's public-domain / CC0 masterpiece (world/plates.json)
  3 Kengo's Note
  4 Fashion  5 Music  6 Design
  7 link to the site, sources and what the cover was drawn from

Usage:  python scripts/make_instagram.py [YYYY-MM-DD]
Needs Playwright with Chromium. Fonts are downloaded once into ig-out/fonts.
"""
import asyncio
import html
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORLD = ROOT / 'world'
OUT = ROOT / 'ig-out'
FONTS = OUT / 'fonts'
FONT_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/zenkakugothicnew/{}.ttf'
E = html.escape

CSS = '''@font-face{font-family:Zen;src:url(../fonts/ZenKakuGothicNew-Regular.ttf)}
@font-face{font-family:Zen;font-weight:500;src:url(../fonts/ZenKakuGothicNew-Medium.ttf)}
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;background:#fff;color:#000;font-family:Inter,"Helvetica Neue",Helvetica,Arial,Zen,sans-serif;-webkit-font-smoothing:antialiased}
.s{width:1080px;height:1350px;padding:72px 80px;display:flex;flex-direction:column;overflow:hidden}
.hd{display:flex;justify-content:space-between;font-size:20px;letter-spacing:.2em;text-transform:uppercase;padding-bottom:22px;border-bottom:2px solid #000}
.hd b{font-weight:700}.hd span{color:#8c8c8c}
.ft{margin-top:auto;display:flex;justify-content:space-between;font-size:18px;letter-spacing:.18em;text-transform:uppercase;color:#8c8c8c;padding-top:22px;border-top:1px solid #e3e3e3}
.lab{font-size:22px;letter-spacing:.2em;text-transform:uppercase;font-weight:700;margin:44px 0 8px}
.it{padding:28px 0;border-bottom:1px solid #e3e3e3}
.it h3{font-size:30px;line-height:1.3;letter-spacing:.06em;text-transform:uppercase;font-weight:500}
.it p{font-family:Zen,sans-serif;font-size:25px;line-height:1.75;color:#555;margin-top:12px;letter-spacing:.02em}
.it i{display:block;font-style:normal;font-size:17px;letter-spacing:.18em;text-transform:uppercase;color:#8c8c8c;margin-top:12px}
.src{font-size:17px;letter-spacing:.18em;text-transform:uppercase;color:#8c8c8c;margin-top:22px}
'''


def fonts():
    FONTS.mkdir(parents=True, exist_ok=True)
    for name in ('ZenKakuGothicNew-Regular', 'ZenKakuGothicNew-Medium'):
        f = FONTS / f'{name}.ttf'
        if not f.exists():
            urllib.request.urlretrieve(FONT_URL.format(name), f)


def plates():
    page = (WORLD / 'index.html').read_text(encoding='utf-8')
    block = re.search(r'const PLATES=\[(.*?)\];', page, re.S).group(1)
    return [json.loads('[' + row + ']') for row in re.findall(r'\[("[^\]]*)\]', block)]


def frame(inner, n, total, stamp):
    return (f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="s">'
            f'<div class="hd"><b>Kengo\'s Synesthesia</b><span>{stamp}</span></div>{inner}'
            f'<div class="ft"><span>kengo-umetani.com</span><span>{n:02d} / {total:02d}</span></div></div></body></html>')


def plate_for(d):
    f = WORLD / 'plates.json'
    if not f.exists():
        return None
    L = [p for p in json.loads(f.read_text(encoding='utf-8')) if p['date'] <= d]
    return max(L, key=lambda p: p['date']) if L else None


def build(day, sig):
    note = day.get('note')
    plate = plate_for(day['date'])
    stamp = date.fromisoformat(day['date']).strftime('%d %b %Y').upper()
    js = (WORLD / 'signal.js').as_uri()
    slides = [f'''<canvas id="sig" width="2160" height="1520" style="display:block;margin:44px -80px 0;width:1080px;height:760px;background:#000"></canvas>
<script src="{js}"></script><script>const c=document.getElementById("sig").getContext("2d");c.scale(2,2);const DAY={json.dumps(day, ensure_ascii=False)};window.drawFrame=t=>SIGNAL.draw(c,1080,760,DAY,t,{{}});drawFrame(0);</script>
<div style="margin-top:44px;display:flex;justify-content:space-between;align-items:baseline;gap:20px"><div style="font-size:76px;line-height:1.02;font-weight:700;letter-spacing:.02em;text-transform:uppercase">Today</div><div style="font-size:17px;letter-spacing:.14em;text-transform:uppercase;color:#8c8c8c;text-align:right;max-width:520px">{E(sig["label"])}</div></div>
<div style="margin-top:18px;font-size:24px;letter-spacing:.2em;text-transform:uppercase;color:#8c8c8c">Synesthesia Digital Art{' / Plate' if plate else ''}{' / Note' if note else ''} / Fashion / Music / Design</div>
<div style="margin-top:10px;font-family:Zen;font-size:24px;color:#8c8c8c">今日のデジタルアート{'、名作' if plate else ''}{'、ノート' if note else ''}と、世界のファッション・音楽・デザイン</div>''']
    if plate:
        meta = ', '.join(x for x in (plate.get('artist'), plate.get('when')) if x) + (' — ' + plate['medium'].lower() if plate.get('medium') else '')
        img = (WORLD / 'media' / plate['file']).as_uri()
        slides.append(f'''<div class="lab">Plate</div>
<div style="margin-top:14px;height:820px;display:flex;align-items:center;justify-content:center;background:#f4f4f4"><img src="{img}" style="max-width:100%;max-height:100%;display:block"></div>
<div style="margin-top:30px;font-size:30px;letter-spacing:.06em;text-transform:uppercase;font-weight:500;line-height:1.3">{E(plate["title"])}</div>
<div style="margin-top:10px;font-size:22px;letter-spacing:.04em;color:#555">{E(meta)}</div>
<div class="src" style="margin-top:14px">{E(plate.get("license", ""))} · {E(plate.get("credit", ""))}</div>''')
    if note:
        slides.append(f'''<div class="lab">Kengo's Note</div><div style="font-size:30px;letter-spacing:.08em;text-transform:uppercase;font-weight:500">{E(note.get("title", ""))}</div>
<p style="font-size:27px;line-height:1.6;margin-top:34px;letter-spacing:.01em">{E(note.get("en", ""))}</p>
<p style="font-family:Zen;font-size:26px;line-height:1.85;margin-top:30px;color:#555;letter-spacing:.02em">{E(note["ja"])}</p>
<div class="src">Source: {E(note.get("source", ""))}</div>''')
    for cat, lab in (('fashion', 'Fashion'), ('music', 'Music'), ('design', 'Design')):
        items = [i for i in day['items'] if i['cat'] == cat]
        if items:
            slides.append(f'<div class="lab">{lab}</div>' + ''.join(
                f'<div class="it"><h3>{E(i["title"])}</h3><p>{E(i["ja"])}</p><i>{E(i["source"])}</i></div>' for i in items))
    sources = sorted({i['source'] for i in day['items']} | ({note['source']} if note and note.get('source') else set()))
    credit = f'Cover: {sig["label"]}, drawn from {sig["data"]}'
    slides.append(f'''<div style="margin-top:auto;margin-bottom:auto">
<div style="font-size:64px;line-height:1.08;font-weight:700;letter-spacing:.02em;text-transform:uppercase">Every story,<br>every morning.</div>
<div style="font-family:Zen;font-size:28px;line-height:1.8;color:#555;margin-top:30px">元の記事へのリンクと過去のニュースは<br>プロフィールのリンクから。</div>
<div style="font-size:26px;letter-spacing:.12em;margin-top:40px;text-transform:uppercase">kengo-umetani.com/synesthesia-world</div>
<div style="font-size:17px;letter-spacing:.16em;text-transform:uppercase;color:#8c8c8c;margin-top:60px;line-height:1.8">Sources: {E(" / ".join(sources))}<br>{E(credit)}</div></div>''')
    total = len(slides)
    pages = [frame(s, k, total, stamp) for k, s in enumerate(slides, 1)]

    others = [i['title'] for i in day['items'] if not (note and i['url'] == note.get('url'))][:6]
    cap = [f'TODAY — {stamp}', '']
    if plate:
        cap += [f"Plate: {plate['title']} — {', '.join(x for x in (plate.get('artist'), plate.get('when')) if x)} ({plate.get('license', '')}, {plate.get('credit', '')})", '']
    if note:
        cap += [note.get('en', ''), '', note['ja'], '']
    cap += ['Also today / ほかに今日のニュース:'] + [f'— {t}' for t in others]
    cap += ['', '元の記事へのリンクと過去のニュースは、プロフィールのリンクから。', '',
            f'Sources: {" / ".join(sources)}', credit, '',
            '#kengossynesthesia #fashion #music #design #architecture #art #建築 #アート']
    return pages, '\n'.join(cap)


async def signal_meta(d):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        await pg.add_script_tag(path=str(WORLD / 'signal.js'))
        m = await pg.evaluate(f'SIGNAL.meta("{d}")')
        await b.close()
    return m


async def render(pages, outdir, stem):
    from playwright.async_api import async_playwright
    files = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1080, 'height': 1350})
        for k, doc in enumerate(pages, 1):
            h = outdir / f'.s{k}.html'
            h.write_text(doc, encoding='utf-8')
            await pg.goto(h.as_uri())
            await pg.wait_for_timeout(400)
            over = await pg.evaluate('(()=>{const s=document.querySelector(".s"),f=document.querySelector(".ft");return f.getBoundingClientRect().bottom>1350-60})()')
            f = outdir / f'{stem}-{k}.png'
            await pg.screenshot(path=str(f))
            h.unlink()
            files.append((f, over))
        await b.close()
    return files


async def render_video(page_html, outdir, stem, seconds=10, fps=30):
    """Slide 1 as a 10-second MP4: the same page, with the artwork stepped frame by frame."""
    import subprocess, shutil
    from playwright.async_api import async_playwright
    frames = outdir / '.frames'
    frames.mkdir(exist_ok=True)
    h = outdir / '.v.html'
    h.write_text(page_html, encoding='utf-8')
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1080, 'height': 1350})
        await pg.goto(h.as_uri())
        await pg.wait_for_timeout(400)
        for k in range(seconds * fps):
            await pg.evaluate(f'drawFrame({k / fps:.4f})')
            await pg.screenshot(path=str(frames / f'f{k:04d}.jpg'), type='jpeg', quality=92)
        await b.close()
    h.unlink()
    out = outdir / f'{stem}-1.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', str(frames / 'f%04d.jpg'),
                    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-shortest',
                    '-movflags', '+faststart', str(out)], check=True)
    shutil.rmtree(frames)
    return out


def main():
    news = json.loads((WORLD / 'news.json').read_text(encoding='utf-8'))
    want = sys.argv[1] if len(sys.argv) > 1 else None
    day = next((d for d in news['days'] if d['date'] == want), None) if want else news['days'][0]
    if not day:
        sys.exit(f'no news for {want}')
    fonts()
    sig = asyncio.run(signal_meta(day['date']))
    pages, caption = build(day, sig)
    outdir = OUT / day['date']
    outdir.mkdir(parents=True, exist_ok=True)
    files = asyncio.run(render(pages, outdir, f'kengos-synesthesia-{day["date"]}'))
    (outdir / 'caption.txt').write_text(caption, encoding='utf-8')
    try:
        print(asyncio.run(render_video(pages[0], outdir, f'kengos-synesthesia-{day["date"]}')), 'video ok')
    except Exception as e:
        print('video skipped:', e)
    for f, over in files:
        print(f, 'TOO LONG' if over else 'ok')
    print(outdir / 'caption.txt')


if __name__ == '__main__':
    main()
