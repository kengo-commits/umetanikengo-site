"""Publish today's KENGO'S SYNESTHESIA set to Instagram.

Runs on GitHub Actions every morning after scripts/make_instagram.py.
Uses the official Instagram API (Instagram API with Instagram Login) with the
long-lived access token in IG_POST_TOKEN (the posting account), falling back
to IG_TOKEN (the account shown on the site) when both are the same account.

Two stages, selected by the first argument:

  stage      copy ig-out/<date>/ into world/ig/<date>/ (JPEG + MP4) so the
             media is served from the site; prune sets older than 10 days
  publish    wait until the media is online, create the carousel
             (video + 6 images) and publish it; record the result in
             world/ig/<date>/posted.json so a day is never posted twice

Nothing is posted when IG_TOKEN is missing or the day was already posted.
"""
import io
import json
import os
import shutil
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'ig-out'
IG = ROOT / 'world' / 'ig'
SITE = 'https://www.kengo-umetani.com/synesthesia-world/ig/'
API = 'https://graph.instagram.com/v21.0'
KEEP_DAYS = 10
JST = timezone(timedelta(hours=9))


def log(msg):
    print(f'[post] {msg}', flush=True)


def today():
    return os.environ.get('IG_DATE') or datetime.now(JST).date().isoformat()


def stem(d):
    return f'kengos-synesthesia-{d}'


# ---------------------------------------------------------------- stage
def stage(d):
    src = OUT / d
    if not src.is_dir():
        sys.exit(f'no rendered set in {src}')
    dst = IG / d
    dst.mkdir(parents=True, exist_ok=True)
    for old in dst.glob('*.jpg'):
        old.unlink()
    for n in range(1, 11):           # Instagram allows up to 10 carousel items
        png = src / f'{stem(d)}-{n}.png'
        if png.exists():
            im = Image.open(png).convert('RGB')
            im.save(dst / f'{n}.jpg', 'JPEG', quality=92, optimize=True)
    mp4 = src / f'{stem(d)}-1.mp4'
    if mp4.exists():
        shutil.copyfile(mp4, dst / '1.mp4')
    shutil.copyfile(src / 'caption.txt', dst / 'caption.txt')
    # prune old sets (keep the posted.json receipts small: they stay with the folder)
    cutoff = (date.fromisoformat(d) - timedelta(days=KEEP_DAYS)).isoformat()
    for p in IG.iterdir():
        if p.is_dir() and p.name < cutoff:
            shutil.rmtree(p)
            log(f'pruned {p.name}')
    log(f'staged {d}: ' + ', '.join(sorted(x.name for x in dst.iterdir())))


# -------------------------------------------------------------- publish
def wait_online(urls, minutes=12):
    deadline = time.time() + minutes * 60
    pending = list(urls)
    while pending and time.time() < deadline:
        still = []
        for u in pending:
            try:
                r = requests.head(u, timeout=20, allow_redirects=True)
                if r.status_code != 200:
                    still.append(u)
            except requests.RequestException:
                still.append(u)
        pending = still
        if pending:
            time.sleep(20)
    return not pending


def api(method, path, token, **params):
    params['access_token'] = token
    r = requests.request(method, f'{API}/{path}', params=params if method == 'GET' else None,
                         data=None if method == 'GET' else params, timeout=60)
    body = r.json() if r.content else {}
    if not r.ok:
        raise RuntimeError(f'{method} {path}: {r.status_code} {body}')
    return body


def wait_container(cid, token, minutes=10):
    deadline = time.time() + minutes * 60
    while time.time() < deadline:
        s = api('GET', cid, token, fields='status_code,status')
        code = s.get('status_code')
        if code == 'FINISHED':
            return True
        if code in ('ERROR', 'EXPIRED'):
            log(f'container {cid}: {s}')
            return False
        time.sleep(10)
    return False


def publish(d):
    token = (os.environ.get('IG_POST_TOKEN') or os.environ.get('IG_TOKEN') or '').strip()
    if not token:
        log('IG_POST_TOKEN is not set; nothing posted')
        return 0
    folder = IG / d
    receipt = folder / 'posted.json'
    if receipt.exists():
        log(f'{d} already posted: {json.loads(receipt.read_text()).get("permalink", "")}')
        return 0
    if not folder.is_dir():
        sys.exit(f'{folder} is missing — run the stage step first')
    base = SITE + d + '/'
    caption = (folder / 'caption.txt').read_text(encoding='utf-8').strip()[:2200]
    has_video = (folder / '1.mp4').exists()
    count = len(list(folder.glob('[0-9]*.jpg')))
    urls = [base + ('1.mp4' if has_video else '1.jpg')] + [base + f'{n}.jpg' for n in range(2, count + 1)]
    if not wait_online(urls):
        sys.exit('media is not online yet; try again later')

    me = api('GET', 'me', token, fields='user_id,username')
    uid = me.get('user_id') or me.get('id')
    log(f'posting as @{me.get("username")}')

    children = []
    first = {'media_type': 'VIDEO', 'video_url': urls[0]} if has_video else {'image_url': urls[0]}
    c = api('POST', f'{uid}/media', token, is_carousel_item='true', **first)['id']
    if not wait_container(c, token):
        if has_video:
            log('video item failed; using the still image instead')
            c = api('POST', f'{uid}/media', token, is_carousel_item='true', image_url=base + '1.jpg')['id']
            wait_container(c, token)
        else:
            sys.exit('first item failed')
    children.append(c)
    for u in urls[1:]:
        c = api('POST', f'{uid}/media', token, is_carousel_item='true', image_url=u)['id']
        children.append(c)
    for c in children[1:]:
        wait_container(c, token, minutes=3)

    carousel = api('POST', f'{uid}/media', token, media_type='CAROUSEL', children=','.join(children), caption=caption)['id']
    if not wait_container(carousel, token):
        sys.exit('carousel container failed')
    pub = api('POST', f'{uid}/media_publish', token, creation_id=carousel)
    mid = pub.get('id')
    info = api('GET', mid, token, fields='permalink,timestamp') if mid else {}
    receipt.write_text(json.dumps({'date': d, 'media_id': mid, 'permalink': info.get('permalink', ''),
                                   'posted_at': info.get('timestamp', '')}, ensure_ascii=False, indent=1) + '\n')
    log(f'published {info.get("permalink", mid)}')
    return 0


THREADS = 'https://graph.threads.net/v1.0'


def threads(d):
    """The same day on Threads (THREADS_TOKEN: a Threads API user token of the posting account): the cover image
    with a short text and the day's permalink. Skipped quietly when the token is not set."""
    token = (os.environ.get('THREADS_TOKEN') or '').strip()
    if not token:
        log('THREADS_TOKEN is not set; nothing posted to Threads')
        return 0
    folder = IG / d
    receipt = folder / 'threads.json'
    if receipt.exists():
        log(f'{d} already on Threads: {json.loads(receipt.read_text()).get("permalink", "")}')
        return 0
    base = SITE + d + '/'
    cap = (folder / 'caption.txt').read_text(encoding='utf-8').strip().split('\n')
    day_url = f"https://www.kengo-umetani.com/synesthesia-world/{d.replace('-', '/')}/"
    text = (cap[0] + '\n\n' + next((l for l in cap[1:] if l and not l.startswith(('Daily Masterwork:', 'Masterworks', '1.', '2.', '3.', '4.', '5.', '#', '—', 'Also', 'Sources', 'Cover', '元の', 'This day'))), '') + '\n\n' + day_url)[:500]
    r = requests.post(f'{THREADS}/me/threads', data={'media_type': 'IMAGE', 'image_url': base + '1.jpg', 'text': text, 'access_token': token}, timeout=60).json()
    cid = r.get('id')
    if not cid:
        log(f'Threads container failed: {r}')
        return 0
    time.sleep(20)
    pub = requests.post(f'{THREADS}/me/threads_publish', data={'creation_id': cid, 'access_token': token}, timeout=60).json()
    mid = pub.get('id')
    info = requests.get(f'{THREADS}/{mid}', params={'fields': 'permalink,timestamp', 'access_token': token}, timeout=60).json() if mid else {}
    receipt.write_text(json.dumps({'date': d, 'id': mid, 'permalink': info.get('permalink', ''), 'posted_at': info.get('timestamp', '')}, ensure_ascii=False, indent=1) + '\n')
    log(f'Threads: {info.get("permalink", mid)}')
    return 0


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'publish'
    d = today()
    if what == 'stage':
        stage(d)
    elif what == 'threads':
        sys.exit(threads(d))
    else:
        sys.exit(publish(d))
