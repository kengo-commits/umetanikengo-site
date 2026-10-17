"""Adds one public-domain / CC0 artwork a day to KENGO'S SYNESTHESIA (the "Plates" section).

Sources: The Met Open Access (public domain highlights) and The Cleveland Museum of Art Open Access (CC0 highlights).
Writes world/media/p-YYYY-MM-DD.webp and appends an entry to world/plates.json. Runs once per day (Asia/Tokyo); safe to re-run.
"""
import json, os, random, sys, io
from datetime import datetime, timedelta, timezone
from pathlib import Path
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PLATES = ROOT / 'world/plates.json'
MEDIA = ROOT / 'world/media'
JST = timezone(timedelta(hours=9))
today = datetime.now(JST).date().isoformat()
UA = {'User-Agent': 'KengosSynesthesia/1.0 (https://www.kengo-umetani.com/synesthesia-world/)'}
SKIP = ('photograph', 'photo', 'costume', 'arms', 'armor', 'musical')
TYPES = ('painting', 'sculpture', 'drawing', 'print', 'watercolor', 'woodblock', 'pastel')

plates = json.loads(PLATES.read_text(encoding='utf-8')) if PLATES.exists() else []
if any(p['date'] == today for p in plates):
    print('already added for', today); sys.exit(0)
seen = {(p['museum'], str(p['id'])) for p in plates}
rng = random.Random(today)


def ok_type(s):
    s = (s or '').lower()
    return any(t in s for t in TYPES) and not any(k in s for k in SKIP)


def from_met():
    r = requests.get('https://collectionapi.metmuseum.org/public/collection/v1.1/search',
                     params={'isHighlight': 'true', 'isPublicDomain': 'true', 'hasImages': 'true', 'q': rng.choice(['painting', 'sculpture', 'landscape', 'portrait', 'drawing', 'print']), 'limit': 200}, headers=UA, timeout=30).json()
    ids = r.get('objectIDs') or []
    rng.shuffle(ids)
    for oid in ids[:40]:
        if ('met', str(oid)) in seen:
            continue
        o = requests.get(f'https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}', headers=UA, timeout=30).json()
        if not (o.get('isPublicDomain') and o.get('primaryImageSmall') and ok_type(o.get('classification') or o.get('objectName')) and o.get('artistDisplayName')):
            continue
        return {'museum': 'met', 'id': oid, 'title': o['title'], 'artist': o.get('artistDisplayName') or o.get('culture') or 'Unknown',
                'when': o.get('objectDate') or '', 'medium': (o.get('classification') or o.get('objectName') or '').rstrip('s'),
                'credit': 'The Metropolitan Museum of Art', 'license': 'Public domain', 'url': o.get('objectURL') or f'https://www.metmuseum.org/art/collection/search/{oid}',
                'img': o.get('primaryImage') or o['primaryImageSmall']}   # full-size file, resized to 1400px below


def from_cma():
    r = requests.get('https://openaccess-api.clevelandart.org/api/artworks/',
                     params={'cc0': 1, 'has_image': 1, 'highlight': 1, 'limit': 300, 'fields': 'id,title,creators,creation_date,technique,type,url,images'}, headers=UA, timeout=30).json()
    data = r.get('data') or []
    rng.shuffle(data)
    for a in data:
        if ('cma', str(a['id'])) in seen or not ok_type(a.get('type')):
            continue
        img = (a.get('images') or {}).get('web', {}).get('url')
        if not img:
            continue
        artist = ', '.join(c['description'].split(' (')[0] for c in a.get('creators') or [])
        if not artist:
            continue
        return {'museum': 'cma', 'id': a['id'], 'title': a['title'], 'artist': artist, 'when': a.get('creation_date') or '',
                'medium': a.get('type') or '', 'credit': 'The Cleveland Museum of Art', 'license': 'CC0', 'url': a.get('url'), 'img': img}


order = [from_met, from_cma] if datetime.now(JST).toordinal() % 2 == 0 else [from_cma, from_met]
pick = None
for fn in order:
    try:
        pick = fn()
    except Exception as e:
        print('source failed:', fn.__name__, e)
    if pick:
        break
if not pick:
    print('no artwork found today'); sys.exit(0)

raw = requests.get(pick['img'], headers=UA, timeout=120).content
im = Image.open(io.BytesIO(raw)).convert('RGB')
im.thumbnail((1400, 1400), Image.LANCZOS)
MEDIA.mkdir(exist_ok=True)
fname = f'p-{today}.webp'
im.save(MEDIA / fname, 'WEBP', quality=86)
pick.pop('img')
pick.update({'date': today, 'file': fname, 'w': im.width, 'h': im.height})
plates.append(pick)
PLATES.write_text(json.dumps(plates, ensure_ascii=False, indent=1), encoding='utf-8')
print('added', today, pick['title'], '—', pick['artist'], f'({pick["credit"]})')
