"""Weekly report of KENGO'S SYNESTHESIA: traffic, Instagram and what the site added, as one Markdown page.

Writes reports/<ISO week>.md and keeps reports/stats.json (one row a week) so the next report can show the change.
Every source is optional — a missing token just leaves that part out:
  CF_API_TOKEN + CF_SITE_TAG   Cloudflare Web Analytics (Account Analytics → Read); the site tag is in the beacon snippet
  IG_TOKEN                     Instagram @kengo_umetani (followers, posts)
  IG_POST_TOKEN                Instagram @kengo_diary (followers, posts)
Run: python3 scripts/weekly_report.py
"""
import json, os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / 'reports'
JST = timezone(timedelta(hours=9))
today = datetime.now(JST).date()
week_end = today - timedelta(days=1) if today.weekday() == 0 else today   # on Monday: the week that ended yesterday
week_start = week_end - timedelta(days=6)
prev_start, prev_end = week_start - timedelta(days=7), week_start - timedelta(days=1)
WEEK = week_end.isocalendar()
WID = f'{WEEK[0]}-W{WEEK[1]:02d}'


def cloudflare():
    tok, tag = os.environ.get('CF_API_TOKEN', '').strip(), os.environ.get('CF_SITE_TAG', '').strip()
    if not tok or not tag:
        return None
    import requests
    q = '''query($tag:String!,$a:Date!,$b:Date!,$c:Date!,$d:Date!){ viewer { accounts(filter:{}) {
      cur: rumPageloadEventsAdaptiveGroups(filter:{siteTag:$tag,date_geq:$a,date_leq:$b},limit:1){count sum{visits}}
      prev: rumPageloadEventsAdaptiveGroups(filter:{siteTag:$tag,date_geq:$c,date_leq:$d},limit:1){count sum{visits}}
      paths: rumPageloadEventsAdaptiveGroups(filter:{siteTag:$tag,date_geq:$a,date_leq:$b},limit:12,orderBy:[count_DESC]){count dimensions{requestPath}}
      refs: rumPageloadEventsAdaptiveGroups(filter:{siteTag:$tag,date_geq:$a,date_leq:$b},limit:10,orderBy:[count_DESC]){count dimensions{refererHost}}
      countries: rumPageloadEventsAdaptiveGroups(filter:{siteTag:$tag,date_geq:$a,date_leq:$b},limit:8,orderBy:[count_DESC]){count dimensions{countryName}}
    } } }'''
    v = {'tag': tag, 'a': str(week_start), 'b': str(week_end), 'c': str(prev_start), 'd': str(prev_end)}
    try:
        r = requests.post('https://api.cloudflare.com/client/v4/graphql', json={'query': q, 'variables': v}, headers={'Authorization': f'Bearer {tok}'}, timeout=60).json()
        acc = r['data']['viewer']['accounts'][0]
    except Exception as e:
        return {'error': str(e)}
    g = lambda k: (acc.get(k) or [{}])[0]
    return {'views': g('cur').get('count', 0), 'visits': (g('cur').get('sum') or {}).get('visits', 0),
            'views_prev': g('prev').get('count', 0), 'visits_prev': (g('prev').get('sum') or {}).get('visits', 0),
            'paths': [(x['dimensions']['requestPath'], x['count']) for x in acc.get('paths', [])],
            'refs': [(x['dimensions']['refererHost'] or '(direct)', x['count']) for x in acc.get('refs', [])],
            'countries': [(x['dimensions']['countryName'], x['count']) for x in acc.get('countries', [])]}


def instagram(env):
    tok = os.environ.get(env, '').strip()
    if not tok:
        return None
    import requests
    try:
        r = requests.get('https://graph.instagram.com/v21.0/me', params={'fields': 'username,followers_count,media_count', 'access_token': tok}, timeout=60).json()
        return {'username': r.get('username'), 'followers': r.get('followers_count'), 'posts': r.get('media_count')}
    except Exception as e:
        return {'error': str(e)}


def site_additions():
    N = json.load(open(ROOT / 'world/news.json', encoding='utf-8'))
    days = [d for d in N.get('days', []) if str(week_start) <= d['date'] <= str(week_end)]
    plates = [p for p in json.load(open(ROOT / 'world/plates.json', encoding='utf-8')) if str(week_start) <= p['date'] <= str(week_end)]
    posted = sorted(p.parent.name for p in (ROOT / 'world/ig').glob('*/posted.json') if str(week_start) <= p.parent.name <= str(week_end))
    objects = sum(len(d.get('objects') or ([d['object']] if d.get('object') else [])) for d in days)
    japan = sum(1 for d in days for i in d.get('items', []) if i.get('japan'))
    return {'days': len(days), 'stories': sum(len(d.get('items', [])) for d in days), 'notes': sum(1 for d in days if d.get('note')), 'plates': len(plates), 'posted': posted, 'objects': objects, 'japan': japan,
            'titles': [(d['date'], (d.get('note') or {}).get('title', '')) for d in days]}


def delta(a, b):
    if a is None or b is None:
        return ''
    d = a - b
    return f' ({"+" if d >= 0 else ""}{d})'


def main():
    REPORTS.mkdir(exist_ok=True)
    stats_f = REPORTS / 'stats.json'
    stats = json.loads(stats_f.read_text(encoding='utf-8')) if stats_f.exists() else []
    prev = next((s for s in reversed(stats) if s['week'] != WID), None) or {}
    cf, ig1, ig2, site = cloudflare(), instagram('IG_TOKEN'), instagram('IG_POST_TOKEN'), site_additions()
    L = [f"# KENGO'S SYNESTHESIA — Weekly report {WID}", f'{week_start} → {week_end}', '']
    L += ['## Site', '']
    if cf and 'error' not in cf:
        L += [f'- Page views: {cf["views"]}{delta(cf["views"], cf["views_prev"])} · Visits: {cf["visits"]}{delta(cf["visits"], cf["visits_prev"])} (vs the week before)',
              '- Top pages: ' + ', '.join(f'{p} ({n})' for p, n in cf['paths'][:8]),
              '- Referrers: ' + ', '.join(f'{p} ({n})' for p, n in cf['refs'][:6]),
              '- Countries: ' + ', '.join(f'{p} ({n})' for p, n in cf['countries'][:6])]
    elif cf:
        L += [f'- Analytics not read: {cf["error"]}']
    else:
        L += ['- Analytics: not connected yet (set CF_API_TOKEN and CF_SITE_TAG in the repository secrets, and cf_beacon_token in data/site-settings.json).']
    L += ['', '## Published this week', '',
          f'- {site["days"]} daily issues · {site["stories"]} stories · {site["notes"]} notes · {site["plates"]} plates · {site["objects"]} objects · {site["japan"]} From Japan stories',
          f'- Instagram sets posted automatically: {", ".join(site["posted"]) or "none (IG_POST_TOKEN not set)"}']
    L += [f'  - {d} — {t}' for d, t in site['titles']]
    L += ['', '## Instagram', '']
    row = {'week': WID, 'from': str(week_start), 'to': str(week_end), 'views': cf.get('views') if cf and 'error' not in cf else None, 'visits': cf.get('visits') if cf and 'error' not in cf else None}
    for key, ig in (('kengo_umetani', ig1), ('kengo_diary', ig2)):
        if ig and 'error' not in ig:
            pf = (prev.get(key) or {}).get('followers')
            L.append(f'- @{ig["username"]}: {ig["followers"]} followers{delta(ig["followers"], pf)} · {ig["posts"]} posts')
            row[key] = {'followers': ig['followers'], 'posts': ig['posts']}
        elif ig:
            L.append(f'- @{key}: not read ({ig["error"]})')
        else:
            L.append(f'- @{key}: token not set')
    L += ['', '## Next', '', '- Keep the morning updates running; share each day\'s permalink from the Instagram caption.', '']
    (REPORTS / f'{WID}.md').write_text('\n'.join(L), encoding='utf-8')
    stats = [s for s in stats if s['week'] != WID] + [row]
    stats_f.write_text(json.dumps(stats, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(REPORTS / f'{WID}.md')


if __name__ == '__main__':
    main()
