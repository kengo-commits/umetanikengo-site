"""Renders each day's SYNESTHESIA DIGITAL ART by KENGO to still images (world/art/):

  <date>.png         1200x630  — the share image (OGP) of that day's page, and the Pin for Pinterest
  <date>-story.png   1080x1920 — the vertical version for Instagram Stories / Threads

Only days without a file are rendered, so the folder grows by two images a day. Uses the same
world/signal.js the page uses, so the still is exactly what the page shows at t = 0.
Run: python3 scripts/render_art.py [--all]
"""
import asyncio, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORLD = ROOT / 'world'
ART = WORLD / 'art'
SIZES = {'': (1200, 630), '-story': (1080, 1920)}


def page_html(day, w, h, story):
    cap = ''
    if story:
        cap = ('<div style="position:absolute;left:0;right:0;bottom:0;padding:72px 64px;color:#ecece8;font:500 26px/1.5 Inter,\'Helvetica Neue\',Helvetica,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase">'
               f'<div style="font-size:20px;opacity:.6;margin-bottom:10px">{day["date"]}</div>SYNESTHESIA DIGITAL ART by KENGO<div style="font-size:18px;opacity:.6;margin-top:14px;letter-spacing:.16em">kengo-umetani.com/synesthesia-world</div></div>')
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>html,body{{margin:0;background:#000}}canvas{{display:block}}</style></head>
<body><canvas id="c" width="{w * 2}" height="{h * 2}" style="width:{w}px;height:{h}px"></canvas>{cap}
<script src="{(WORLD / 'signal.js').as_uri()}"></script>
<script>const c=document.getElementById("c").getContext("2d");c.scale(2,2);const DAY={json.dumps(day, ensure_ascii=False)};SIGNAL.draw(c,{w},{h},DAY,0,{{}});window.done=true;</script></body></html>'''


async def main(force=False):
    from playwright.async_api import async_playwright
    N = json.load(open(WORLD / 'news.json', encoding='utf-8'))
    days = sorted(N.get('days', []), key=lambda d: d['date'], reverse=True)
    ART.mkdir(exist_ok=True)
    todo = [(d, suf) for d in days for suf in SIZES if force or not (ART / f'{d["date"]}{suf}.png').exists()]
    if not todo:
        print('art: nothing to render')
        return
    exe = '/opt/pw-browsers/chromium' if Path('/opt/pw-browsers/chromium').exists() else None
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=exe) if exe else await p.chromium.launch()
        for day, suf in todo:
            w, h = SIZES[suf]
            pg = await b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1)
            f = ART / f'_{day["date"]}{suf}.html'
            f.write_text(page_html(day, w, h, suf == '-story'), encoding='utf-8')
            await pg.goto(f.as_uri())
            await pg.wait_for_function('window.done===true')
            await pg.screenshot(path=str(ART / f'{day["date"]}{suf}.png'), full_page=False)
            await pg.close()
            f.unlink()
            print('rendered', f'{day["date"]}{suf}.png')
        await b.close()


if __name__ == '__main__':
    asyncio.run(main('--all' in sys.argv))
