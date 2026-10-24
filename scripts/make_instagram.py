"""Make the daily Instagram carousel for KENGO'S SYNESTHESIA.

Six 1080x1350 images (pictures only — the note, the headlines and the sources go in the caption) plus
a caption, written to ig-out/<date>/ :

  1 cover: that day's SYNESTHESIA DIGITAL ART by KENGO (world/signal.js), a different data artwork every day (also a 10 s MP4)
  2 the same artwork, full-bleed second cut
  3 Daily Masterwork: that day's public-domain / CC0 masterpiece (world/plates.json)
  4-6 three more public-domain / CC0 works for the day (The Met Open Access, The Cleveland Museum of Art Open Access),
      fetched once and cached in ig-out/<date>/plates/

The post is dated today (Asia/Tokyo); the text comes from the newest day in world/news.json on or before that date.
Usage:  python scripts/make_instagram.py [YYYY-MM-DD]
Needs Playwright with Chromium. Fonts are downloaded once into ig-out/fonts.
"""
import asyncio
import html
import io
import json
import random
import re
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORLD = ROOT / 'world'
OUT = ROOT / 'ig-out'
FONTS = OUT / 'fonts'
FONT_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/zenkakugothicnew/{}.ttf'
SERIF_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentserif/{}.ttf'

# The cover headline is the name of that day's artwork, set in a different way each day
# (the style follows the artwork number, so the sequence repeats only every 28 days):
# bold sans / serif italic / outlined / wide serif.
HEADLINES = (  # (css, base font size, rough width of one letter in em — long names are scaled to fit one line)
    ('line-height:1;font-weight:700;letter-spacing:.02em;text-transform:uppercase', 84, .72),
    ('font-family:Serif;font-style:italic;line-height:.9;font-weight:400;letter-spacing:-.01em', 112, .46),
    ('line-height:1;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:transparent;-webkit-text-stroke:2px #000', 84, .76),
    ('font-family:Serif;line-height:.95;font-weight:400;letter-spacing:.14em;text-transform:uppercase', 96, .78),
)
E = html.escape

CSS = '''@font-face{font-family:Zen;src:url(../fonts/ZenKakuGothicNew-Regular.ttf)}
@font-face{font-family:Zen;font-weight:500;src:url(../fonts/ZenKakuGothicNew-Medium.ttf)}
@font-face{font-family:Serif;src:url(../fonts/InstrumentSerif-Regular.ttf)}
@font-face{font-family:Serif;font-style:italic;src:url(../fonts/InstrumentSerif-Italic.ttf)}
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
    for name in ('InstrumentSerif-Regular', 'InstrumentSerif-Italic'):
        f = FONTS / f'{name}.ttf'
        if not f.exists():
            urllib.request.urlretrieve(SERIF_URL.format(name), f)


def plates():
    page = (WORLD / 'index.html').read_text(encoding='utf-8')
    block = re.search(r'const PLATES=\[(.*?)\];', page, re.S).group(1)
    return [json.loads('[' + row + ']') for row in re.findall(r'\[("[^\]]*)\]', block)]


def frame(inner, n, total, stamp):
    return (f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="s">'
            f'<div class="hd"><b>Kengo\'s Synesthesia</b><span>{stamp}</span></div>{inner}'
            f'<div class="ft"><span>kengo-umetani.com</span></div></div></body></html>')


def short_title(s):
    """Museum titles for the slide: drop parentheses, join parts with a slash."""
    s = re.sub(r'\s*\([^)]*\)', '', s)
    return ' / '.join(x.strip() for x in s.split(';') if x.strip())


def plate_for(d):
    f = WORLD / 'plates.json'
    if not f.exists():
        return None
    L = [p for p in json.loads(f.read_text(encoding='utf-8')) if p['date'] <= d]
    return max(L, key=lambda p: p['date']) if L else None


# --- three more public-domain / CC0 works a day (same sources and filters as scripts/add_plate.py) ---
UA = {'User-Agent': 'KengosSynesthesia/1.0 (https://www.kengo-umetani.com/synesthesia-world/)'}
SKIP = ('photograph', 'photo', 'costume', 'arms', 'armor', 'musical')
TYPES = ('painting', 'sculpture', 'drawing', 'print', 'watercolor', 'woodblock', 'pastel')
JP_QUERIES = ['ukiyo-e', 'Japan', 'Edo period', 'woodblock print', 'Hokusai', 'Hiroshige', 'Utamaro', 'Japanese painting', 'screen', 'handscroll', 'Momoyama period', 'Kamakura period']


def ok_type(s):
    s = (s or '').lower()
    return any(t in s for t in TYPES) and not any(k in s for k in SKIP)


def met_pick(rng, seen, japan):
    import requests
    params = {'isPublicDomain': 'true', 'hasImages': 'true', 'limit': 200}
    if japan:
        params.update({'departmentId': 6, 'q': rng.choice(JP_QUERIES)})
    else:
        params.update({'isHighlight': 'true', 'q': rng.choice(['painting', 'sculpture', 'landscape', 'portrait', 'drawing', 'print'])})
    ids = requests.get('https://collectionapi.metmuseum.org/public/collection/v1.1/search', params=params, headers=UA, timeout=30).json().get('objectIDs') or []
    rng.shuffle(ids)
    for oid in ids[:40]:
        if ('met', str(oid)) in seen:
            continue
        o = requests.get(f'https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}', headers=UA, timeout=30).json()
        if not (o.get('isPublicDomain') and o.get('primaryImageSmall') and ok_type(o.get('classification') or o.get('objectName')) and o.get('artistDisplayName')):
            continue
        if japan and 'japan' not in (o.get('culture') or '').lower():
            continue
        return {'museum': 'met', 'id': oid, 'title': o['title'], 'artist': o['artistDisplayName'], 'when': o.get('objectDate') or '',
                'medium': (o.get('classification') or o.get('objectName') or '').rstrip('s'), 'credit': 'The Metropolitan Museum of Art',
                'license': 'Public domain', 'url': o.get('objectURL') or f'https://www.metmuseum.org/art/collection/search/{oid}', 'img': o.get('primaryImage') or o['primaryImageSmall']}


def cma_pick(rng, seen, japan):
    import requests
    params = {'cc0': 1, 'has_image': 1, 'limit': 300, 'fields': 'id,title,creators,creation_date,technique,type,url,images'}
    if japan:
        params.update({'department': 'Japanese Art', 'skip': rng.randrange(0, 2900)})
    else:
        params['highlight'] = 1
    data = requests.get('https://openaccess-api.clevelandart.org/api/artworks/', params=params, headers=UA, timeout=30).json().get('data') or []
    rng.shuffle(data)
    for a in data:
        img = (a.get('images') or {}).get('web', {}).get('url')
        artist = ', '.join(c['description'].split(' (')[0] for c in a.get('creators') or [])
        if ('cma', str(a['id'])) in seen or not ok_type(a.get('type')) or not img or not artist:
            continue
        return {'museum': 'cma', 'id': a['id'], 'title': a['title'], 'artist': artist, 'when': a.get('creation_date') or '',
                'medium': a.get('type') or '', 'credit': 'The Cleveland Museum of Art', 'license': 'CC0', 'url': a.get('url'), 'img': img}


def extra_plates(d, outdir, n=3):
    """n more works for the day, deterministic per date, cached in <outdir>/plates/ so a rerun does not refetch."""
    import requests
    from PIL import Image
    cache = outdir / 'plates' / 'plates.json'
    if cache.exists():
        return json.loads(cache.read_text(encoding='utf-8'))
    cache.parent.mkdir(parents=True, exist_ok=True)
    f = WORLD / 'plates.json'
    seen = {(p['museum'], str(p['id'])) for p in (json.loads(f.read_text(encoding='utf-8')) if f.exists() else [])}
    rng = random.Random(d + '|ig')
    out = []
    for k in range(n):
        japan = (date.fromisoformat(d).toordinal() + k) % 3 != 0          # two in three Japanese, like the Daily Masterwork
        order = (met_pick, cma_pick) if k % 2 == 0 else (cma_pick, met_pick)
        im = None
        for attempt in range(4):          # handscrolls and other very wide works do not fit a phone screen: try again
            pick = None
            for fn in order:
                for jp in ((japan, False) if japan else (False,)):
                    try:
                        pick = fn(rng, seen, jp)
                    except Exception as e:
                        print('source failed:', fn.__name__, e)
                    if pick:
                        break
                if pick:
                    break
            if not pick:
                break
            seen.add((pick['museum'], str(pick['id'])))
            try:
                im = Image.open(io.BytesIO(requests.get(pick['img'], headers=UA, timeout=120).content)).convert('RGB')
            except Exception as e:
                print('image failed:', pick['title'], e)
                im = None
                continue
            if im.width / im.height <= 2.2:
                break
            im = None
        if im is None:
            continue
        im.thumbnail((1400, 1400), Image.LANCZOS)
        name = f'x{k + 1}.jpg'
        im.save(cache.parent / name, 'JPEG', quality=90)
        pick.pop('img')
        pick.update({'file': str(cache.parent / name), 'w': im.width, 'h': im.height})
        out.append(pick)
    cache.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    return out


def art_slide(p, lab, sub):
    """One artwork, as large as the page allows: the image area is 900 px tall, caption below."""
    meta = ', '.join(x for x in (p.get('artist'), p.get('when')) if x)
    img = Path(p['file']).as_uri() if '/' in p['file'] else (WORLD / 'media' / p['file']).as_uri()
    wide = p.get('w', 1) / p.get('h', 1) > 1.4        # a wide work is shown as a detail that fills the frame, and says so
    fit = 'cover' if wide else 'contain'
    return f'''<div class="lab" style="margin-top:32px;display:flex;justify-content:space-between"><span>{lab}</span><span style="color:#8c8c8c;font-weight:400">{sub}</span></div>
<div style="margin:12px -80px 0;height:900px;background:#f4f4f4"><img src="{img}" style="width:100%;height:100%;object-fit:{fit};display:block"></div>
<div style="margin-top:26px;font-size:27px;letter-spacing:.05em;text-transform:uppercase;font-weight:500;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">{E(short_title(p["title"]))}{' (detail)' if wide else ''}</div>
<div style="margin-top:8px;font-size:20px;letter-spacing:.04em;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{E(meta)} · <span style="color:#8c8c8c;letter-spacing:.14em;text-transform:uppercase;font-size:16px">{E(p.get("license", ""))} · {E(p.get("credit", ""))}</span></div>'''


def build(day, sig, post, extras):
    note = day.get('note')
    plate = plate_for(post)
    stamp = date.fromisoformat(post).strftime('%d %b %Y').upper()
    weekday = date.fromisoformat(post).strftime('%A').upper()
    no = f'No. {int(sig["no"]):03d}'
    css, base, em = HEADLINES[int(sig['no']) % len(HEADLINES)]
    word = sig['id'] if 'uppercase' in css else sig['id'].capitalize()
    style = f'{css};font-size:{min(base, int(900 / (len(word) * em)))}px'
    js = (WORLD / 'signal.js').as_uri()
    sday = json.dumps(dict(day, date=post), ensure_ascii=False)   # the artwork is the post day's recipe, drawn from the day's stories
    works = ([plate] if plate else []) + extras
    slides = [f'''<canvas id="sig" width="2160" height="1520" style="display:block;margin:44px -80px 0;width:1080px;height:760px;background:#000"></canvas>
<script src="{js}"></script><script>const c=document.getElementById("sig").getContext("2d");c.scale(2,2);const DAY={sday};window.drawFrame=t=>SIGNAL.draw(c,1080,760,DAY,t,{{}});drawFrame(0);</script>
<div style="margin-top:40px;{style}">{E(word)}</div>
<div style="margin-top:16px;font-size:17px;letter-spacing:.14em;text-transform:uppercase;color:#8c8c8c">Synesthesia Digital Art by Kengo — {E(no)} · {weekday}</div>
<div style="margin-top:22px;font-size:24px;letter-spacing:.2em;text-transform:uppercase;color:#8c8c8c">Digital Art / {len(works)} Masterworks</div>
<div style="margin-top:10px;font-family:Zen;font-size:24px;color:#8c8c8c">今日のデジタルアートと名作{len(works)}点 — ノートと世界のニュースはキャプションに</div>''']
    # 2: the same artwork again, full-bleed, a few seconds in
    slides.append(f'''<canvas id="sig2" width="2160" height="2700" style="position:absolute;left:0;top:0;width:1080px;height:1350px;background:#000"></canvas>
<script src="{js}"></script><script>const c2=document.getElementById("sig2").getContext("2d");c2.scale(2,2);SIGNAL.draw(c2,1080,1350,{sday},7.3,{{}});</script>
<div style="position:absolute;left:80px;right:80px;bottom:72px;color:#fff;mix-blend-mode:difference">
<div style="font-size:17px;letter-spacing:.16em;text-transform:uppercase">Synesthesia Digital Art by Kengo — {E(no)} · {E(sig["id"])}</div>
<div style="margin-top:10px;font-family:Zen;font-size:22px;color:#fff">{E(sig.get("ja", ""))}</div></div>''')
    for k, p in enumerate(works, 1):
        slides.append(art_slide(p, 'Daily Masterwork' if k == 1 else 'Masterworks', f'{k} / {len(works)}'))
    sources = sorted({i['source'] for i in day['items']} | ({note['source']} if note and note.get('source') else set()))
    credit = f'Cover: {sig["label"]}, drawn from {sig["data"]}'
    total = len(slides)
    pages = [frame(s, k, total, stamp) for k, s in enumerate(slides, 1)]

    others = [i['title'] for i in day['items'] if not (note and i['url'] == note.get('url'))][:6]
    cap = [f'{no} {sig["id"]} — {weekday}, {stamp}', '']
    if works:
        cap += ['Masterworks / 今日の名作:'] + [f"{k}. {short_title(p['title'])} — {', '.join(x for x in (p.get('artist'), p.get('when')) if x)} ({p.get('license', '')}, {p.get('credit', '')})"
                                               for k, p in enumerate(works, 1)] + ['']
    if note:
        cap += [note.get('en', ''), '', note['ja'], '']
    cap += ['Also today / ほかに今日のニュース:'] + [f'— {t}' for t in others]
    day_url = f"https://www.kengo-umetani.com/synesthesia-world/{day['date'].replace('-', '/')}/"
    cap += ['', '元の記事へのリンクと過去のニュースは、プロフィールのリンクから。', f"This day's page / この日のページ: {day_url}", '',
            f'Sources: {" / ".join(sources)}', f'Artworks: {" / ".join(sorted({p["credit"] for p in works}))} — public domain / CC0', credit, '',
            '#kengossynesthesia #fashion #music #design #architecture #art #ukiyoe #museum #建築 #アート #浮世絵 #名画']
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


async def render_video(page_html, outdir, stem, seconds=10, fps=30, speed=2.0):
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
            await pg.evaluate(f'drawFrame({k / fps * speed:.4f})')
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
    post = sys.argv[1] if len(sys.argv) > 1 else datetime.now(timezone(timedelta(hours=9))).date().isoformat()
    day = max((d for d in news['days'] if d['date'] <= post), key=lambda d: d['date'], default=None)
    if not day:
        sys.exit(f'no news on or before {post}')
    if day['date'] != post:
        print(f'note: newest news is {day["date"]}, posting as {post}')
    fonts()
    sig = asyncio.run(signal_meta(post))
    outdir = OUT / post
    outdir.mkdir(parents=True, exist_ok=True)
    extras = extra_plates(post, outdir)
    pages, caption = build(day, sig, post, extras)
    files = asyncio.run(render(pages, outdir, f'kengos-synesthesia-{post}'))
    (outdir / 'caption.txt').write_text(caption, encoding='utf-8')
    story = WORLD / "art" / f"{post}-story.png"
    if story.exists():
        import shutil
        shutil.copy(story, outdir / 'story.png')
        print(outdir / 'story.png', 'ok (Stories, 1080x1920)')
    try:
        print(asyncio.run(render_video(pages[0], outdir, f"kengos-synesthesia-{post}")), 'video ok')
    except Exception as e:
        print('video skipped:', e)
    for f, over in files:
        print(f, 'TOO LONG' if over else 'ok')
    print(outdir / 'caption.txt')


if __name__ == '__main__':
    main()
