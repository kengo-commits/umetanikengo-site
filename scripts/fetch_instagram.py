"""Fetch the latest Instagram posts and save them for the site.

Runs on GitHub Actions on a schedule. Uses the official Instagram API
(Instagram API with Instagram Login) with a long-lived access token in the
IG_TOKEN environment variable.

Writes:
  data/instagram.json      posts in display order (pinned posts first)
  images/instagram/*.jpg   fallback images
  images/instagram/*.webp  web images
  .ig_token_new            a refreshed token, if Instagram returned a new one

If anything fails, the current posts are kept so the site still builds.
"""
import io
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

import requests
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data' / 'instagram.json'
SETTINGS = ROOT / 'data' / 'instagram-settings.json'
IMG_DIR = ROOT / 'images' / 'instagram'
API = 'https://graph.instagram.com'
FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp'
WIDTHS = [480, 800]


def log(msg):
    print(f'[instagram] {msg}', flush=True)


def split_caption(caption):
    """First paragraph = title, second paragraph = text. Hashtag-only paragraphs are dropped."""
    paras = [p.strip() for p in re.split(r'\n\s*\n', caption or '')]
    paras = [p for p in paras if p and not p.startswith('#')]
    return (paras[0] if paras else ''), (paras[1] if len(paras) > 1 else '')


def shortcode(permalink):
    m = re.search(r'/(?:p|reel|tv)/([^/?#]+)', permalink or '')
    return m.group(1) if m else None


def fetch_media(token, limit):
    items, url = [], f'{API}/me/media'
    params = {'fields': FIELDS, 'limit': 50, 'access_token': token}
    while url and len(items) < limit:
        r = requests.get(url, params=params, timeout=30)
        r.raise_for_status()
        body = r.json()
        items += body.get('data', [])
        url, params = body.get('paging', {}).get('next'), None
    return items


def order_posts(items, pinned, count):
    by_code = {shortcode(i.get('permalink')): i for i in items}
    first = [by_code[c] for c in pinned if c in by_code]
    rest = [i for i in items if shortcode(i.get('permalink')) not in pinned]
    return (first + rest)[:count]


def save_image(url, code):
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(r.content))).convert('RGB')
    W, H = im.size
    ws = sorted({w for w in WIDTHS if w < W} | {min(W, max(WIDTHS))})
    for w in ws:
        out = im if w == W else im.resize((w, round(H * w / W)), Image.LANCZOS)
        out.save(IMG_DIR / f'{code}-{w}.webp', 'WEBP', quality=85, method=6)
    fw = min(W, 640)
    fb = im if fw == W else im.resize((fw, round(H * fw / W)), Image.LANCZOS)
    fb.save(IMG_DIR / f'{code}.jpg', 'JPEG', quality=86, optimize=True, progressive=True)
    return {'ws': ws, 'fw': fw, 'fh': fb.size[1]}


def refresh_token(token):
    """Long-lived tokens last 60 days; refreshing extends them. Instagram only allows it once a token is 24h old."""
    try:
        r = requests.get(f'{API}/refresh_access_token', params={'grant_type': 'ig_refresh_token', 'access_token': token}, timeout=30)
        if r.ok:
            new = r.json().get('access_token')
            if new and new != token:
                (ROOT / '.ig_token_new').write_text(new)
                log('token refreshed (new token issued)')
            else:
                log('token refreshed')
        else:
            log(f'token refresh skipped: {r.status_code}')
    except requests.RequestException as e:
        log(f'token refresh skipped: {e}')


def main():
    token = os.environ.get('IG_TOKEN', '').strip()
    if not token:
        log('IG_TOKEN is not set; keeping current posts')
        return 0
    settings = json.loads(SETTINGS.read_text(encoding='utf-8'))
    pinned, count = settings.get('pinned', []), int(settings.get('count', 12))
    current = json.loads(DATA.read_text(encoding='utf-8')) if DATA.exists() else {'posts': []}
    known = {p['id']: p for p in current.get('posts', [])}
    try:
        items = fetch_media(token, max(count + len(pinned), 30))
    except requests.RequestException as e:
        log(f'could not reach Instagram ({e}); keeping current posts')
        return 0
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    posts = []
    for it in order_posts(items, pinned, count):
        code = shortcode(it.get('permalink'))
        if not code:
            continue
        src = it.get('thumbnail_url') if it.get('media_type') == 'VIDEO' else it.get('media_url')
        title, text = split_caption(it.get('caption'))
        old = known.get(code)
        try:
            img = {k: old[k] for k in ('ws', 'fw', 'fh')} if old and (IMG_DIR / f'{code}.jpg').exists() else save_image(src, code)
        except Exception as e:  # skip a post whose image cannot be read
            log(f'skipped {code}: {e}')
            continue
        posts.append({'id': code, 'permalink': it['permalink'], 'timestamp': (it.get('timestamp') or '')[:10],
                      'title': title, 'text': text, 'image': f'instagram/{code}', **img})
    if not posts:
        log('no posts returned; keeping current posts')
        return 0
    keep = {p['id'] for p in posts}
    for f in IMG_DIR.iterdir():
        mine = any(f.name == f'{k}.jpg' or re.fullmatch(re.escape(k) + r'-\d+\.webp', f.name) for k in keep)
        if not mine:
            f.unlink()
    changed = [p['id'] for p in posts] != [p['id'] for p in current.get('posts', [])] or posts != current.get('posts')
    if changed:
        DATA.write_text(json.dumps({'updated': date.today().isoformat(), 'posts': posts}, ensure_ascii=False, indent=1), encoding='utf-8')
        log(f'updated {len(posts)} posts')
    else:
        log('no changes')
    refresh_token(token)
    return 0


if __name__ == '__main__':
    sys.exit(main())
