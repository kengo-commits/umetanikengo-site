import json, os, shutil, html
from pathlib import Path

ROOT = Path(__file__).resolve().parent

D = json.load(open(ROOT / 'data/content.json', encoding='utf-8'))
META = json.load(open(ROOT / 'data/imgmeta.json'))
SITE = json.load(open(ROOT / 'data/site-settings.json', encoding='utf-8'))
import hashlib
ASSET_V = hashlib.sha1((ROOT / 'assets/site.css').read_bytes() + (ROOT / 'assets/site.js').read_bytes()).hexdigest()[:8]
IGDATA = json.load(open(ROOT / 'data/instagram.json', encoding='utf-8'))
for _p in IGDATA['posts']:
    META[_p['image']] = {'ws': _p['ws'], 'fw': _p['fw'], 'fh': _p['fh']}
OUT = str(ROOT / 'dist')
WORKS = {w['id']: w for w in D['WORKS']}
ORDER = ['aquasense', 'peaks', 'island', 'synesthesia', 'fufusel', 'glamday', 'grandmer', 'tsurutontan', 'nomado']  # same order as the current CREATIVE page

MAIN_SIZES = '(max-width: 480px) 100vw, (max-width: 900px) 560px, (max-width: 1024px) and (orientation: portrait) 560px, min(44vw, 820px)'


def esc(t):
    return html.escape(t, quote=True)


def pic(name, alt, root, sizes=MAIN_SIZES, lazy=True, hidden=False, cls='ph', prio=False):
    m = META[name]
    ss = ', '.join(f'{root}images/{name}-{w}.webp {w}w' for w in m['ws'])
    attrs = f'class="{cls}" src="{root}images/{name}.jpg" alt="{esc(alt)}" width="{m["fw"]}" height="{m["fh"]}" decoding="async"'
    if prio:
        attrs += ' fetchpriority="high"'
    elif lazy:
        attrs += ' loading="lazy"'
    if m['fh'] > m['fw'] * 1.1:
        attrs += ' data-tall'
    h = ' hidden' if hidden else ''
    return f'<picture{h}><source type="image/webp" srcset="{ss}" sizes="{sizes}"><img {attrs}></picture>'


def show(names, alt, root, first_lazy=True, prio=False):
    """A slideshow: all slides are real <picture> elements; only the first is visible until JS advances."""
    slides = ''.join(pic(n, f'{alt} {i+1}' if len(names) > 1 else alt, root, lazy=(first_lazy or i > 0), hidden=i > 0, prio=(prio and i == 0)) for i, n in enumerate(names))
    counter = ''
    if len(names) > 1:
        counter = f'<div class="counter"><span class="num">01 / {len(names):02d}</span><button type="button" data-d="-1">PREV</button><button type="button" data-d="1">NEXT</button></div>'
    return f'<div class="show" data-count="{len(names)}"><div class="frame">{slides}</div>{counter}</div>'


def P(lines, cls='txt', lang=None):
    l = f' lang="{lang}"' if lang else ''
    return f'<div class="{cls}"{l}>' + ''.join(f'<p>{t}</p>' for t in lines) + '</div>'


def bi(jp, en):
    return P(en, 'txt en', 'en') + P(jp, 'txt ja second', 'ja')


FB = 'https://www.facebook.com/umetani'
IG = 'https://www.instagram.com/kengo_umetani/'
NAV = [('HOME', 'index.html'), ('PROFILE', 'profile/index.html'), ('CREATIVE', 'creative/index.html'), ('MODEL', 'model/index.html'), ('VISION', 'vision/index.html')]


import re
CJK = r'[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]'
def en_first(h):
    # headings: <h1|h2 class="...">JP<span>EN</span>
    h = re.sub(r'(<h[12] class="[^"]*">)([^<]*)<span>([^<]*)</span>',
               lambda m: f'{m.group(1)}{m.group(3)}<span lang="ja">{m.group(2)}</span>' if re.search(CJK, m.group(2)) and not re.search(CJK, m.group(3)) else m.group(0), h)
    # list items: <span>JP<span class="sub" lang="en">EN</span></span>  (JP never contains another span)
    h = re.sub(r'<span( class="b")?>((?:(?!<span|</span>).)*?)<span class="sub" lang="en">((?:(?!</span>).)*)</span>',
               lambda m: f'<span{m.group(1) or ""}>{m.group(3)}<span class="sub" lang="ja">{m.group(2)}</span>' if re.search(CJK, m.group(2)) else m.group(0), h)
    # lead statement
    h = re.sub(r'<p class="lead">(.*?)</p><p class="lead en" lang="en">(.*?)</p>', r'<p class="lead en" lang="en">\2</p><p class="lead ja" lang="ja">\1</p>', h)
    # locations: 沖縄 恩納村 / ONNA, OKINAWA
    h = re.sub(r'<div class="loc">([^<]*?) / ([^<]*)</div>', r'<div class="loc">\2 / \1</div>', h)
    return h


def page(key, title, desc, body, root, skeleton=True):
    body = en_first(body)
    nav = ''.join(f'<a href="{root}{href}"{" class=\"on\" aria-current=\"page\"" if k == key else ""}>{k}</a>' for k, href in NAV)
    head = f'''<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">{'\n<meta name="robots" content="noindex, nofollow">' if SITE.get('noindex') else ''}
<meta property="og:title" content="{esc(title)}">
<meta property="og:site_name" content="KENGO UMETANI OFFICIAL">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;700&amp;display=swap">
<link rel="stylesheet" href="{root}assets/site.css?v={ASSET_V}">'''
    content = f'''<header class="top">
  <a class="mark" href="{root}index.html">KENGO UMETANI OFFICIAL</a>
  <nav class="nav" aria-label="Main">{nav}</nav>
</header>
<main>
{body}
</main>
<footer class="foot">
  <nav class="nav-foot" aria-label="Footer">{nav}</nav>
  <nav class="nav-foot" aria-label="SNS"><a href="{FB}" target="_blank" rel="noopener">FACEBOOK ↗</a><a href="{IG}" target="_blank" rel="noopener">INSTAGRAM ↗</a></nav>
  <nav class="nav-foot" aria-label="Legal"><a href="{root}about/index.html"{" class=\"on\"" if key=="ABOUT" else ""}>ABOUT / 概要</a><a href="{root}privacy/index.html"{" class=\"on\"" if key=="PRIVACY" else ""}>PRIVACY POLICY / プライバシーポリシー</a><a href="{root}cookie/index.html"{" class=\"on\"" if key=="COOKIE" else ""}>COOKIE POLICY / COOKIE 設定</a></nav>
  <span>© KENGO UMETANI</span>
</footer>
<script src="{root}assets/site.js?v={ASSET_V}" defer></script>'''
    if not skeleton:
        return head + '\n' + content
    return f'''<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{head}
</head>
<body>
{content}
</body>
</html>
'''


def row(left, right, cls=''):
    return f'<section class="row {cls}"><div class="l">{left}</div><div class="r">{right}</div></section>'


def more(href, label='VIEW MORE / 詳しく見る'):
    return f'<a class="more" href="{href}">{label} →</a>'

# ---------- PROFILE TEXT (shared by HOME and PROFILE) ----------
BIO_JP = ['1985年大阪府生まれ。趣味は芸術鑑賞。近畿大学理工学部建築学科卒業。',
          '2001年、16歳でモデル活動を開始し、elite、bark in style、FOLIO MANAGEMENTに所属。海外に活動の拠点を置き、ARMANI、HERMÈS、GUCCI、KENZO、ETRO、MARC JACOBSをはじめとするハイブランドのコレクションショーを中心に、モデルとして活動する。世界最高峰のクリエイティブの現場に身を置きながら、並行して建築とデザインを学ぶ。',
          '大学卒業後は設計事務所DEJAVUに勤務。2011年に独立して株式会社VIDAを設立し、代表取締役に就任。同年、有限会社オガワジュンゾウ・クリエイツの取締役に就任。2013年には故・堺屋太一氏のもとで総合調整局補佐として多角的なプロジェクトに携わり、クリエイティブの知見を養う。',
          '2016年にカトープレジャーグループに入社し、2020年にグループ全体のクリエイティブディレクターに就任。同年、株式会社U&amp;K CREATIVE VISIONS 代表取締役CEOに就任する。']
BIO_EN = ['Born in Osaka in 1985. In his free time, he enjoys appreciating art. Graduated from the Department of Architecture, Faculty of Science and Engineering, Kindai University.',
          'He began modeling in 2001, at the age of 16, and was represented by elite, bark in style and FOLIO MANAGEMENT. Based overseas, he worked primarily on the runway, walking in collection shows for leading luxury brands including ARMANI, HERMÈS, GUCCI, KENZO, ETRO and MARC JACOBS. While immersed in the world\'s foremost creative environments, he studied architecture and design in parallel.',
          'After graduating, he worked at the architectural design firm DEJAVU. In 2011, he went independent and founded VIDA Inc., serving as its CEO. In the same year, he became a director of Ogawa Junzo Creates Ltd. In 2013, he served as an assistant in the General Coordination Bureau under the late Taichi Sakaiya, where he was involved in a diverse range of projects and broadened his creative insight.',
          'He joined Kato Pleasure Group in 2016 and was appointed Creative Director of the entire group in 2020. In the same year, he became Representative Director and CEO of U&amp;K CREATIVE VISIONS Inc.']
NOW_JP = ['モデルとして世界の現場で培ったグローバルな審美眼と、建築・デザイン・イベントプロデュースの経験を融合させ、高級温泉旅館「ふふ」シリーズをはじめとするラグジュアリーリゾートの開発、商業空間のデザイン統括、企業ブランディングまで、幅広いトータルクリエイティブを指揮している。']
NOW_EN = ['Combining the global aesthetic sense he cultivated as a model with his experience in architecture, design and event production, he leads comprehensive creative direction across a wide range of fields: from the development of luxury resorts, including the FUFU series of high-end hot spring ryokan, to design supervision for commercial spaces, and corporate branding.']
CURRENT = [('カトープレジャーグループ', 'Kato Pleasure Group', 'クリエイティブディレクター', 'CREATIVE DIRECTOR'),
           ('株式会社U&amp;K CREATIVE VISIONS', 'U&amp;K CREATIVE VISIONS Inc.', '取締役 兼 COO', 'DIRECTOR &amp; COO')]


def current_block():
    li = ''.join(f'<li><span>{oj}<span class="sub" lang="en">{oe}</span></span><span class="b">{rj}<span class="sub" lang="en">{re_}</span></span></li>' for oj, oe, rj, re_ in CURRENT)
    return f'<ul class="list norm gap">{li}</ul>' + bi(NOW_JP, NOW_EN).replace('<div class="txt en" lang="en">', '<div class="txt en" lang="en" style="margin-top:22px">', 1)


# ---------- HOME (same sections and order as the current top page) ----------
CREATIVE_LEDE = (['企画・開発、設計からデジタルマーケティング、グラフィックデザインまで幅広く携わるクリエイティブディレクター。国内の大型ホテルや宿泊施設、飲食店から、アートディレクション、プロモーション計画、ブランディングまで、ボーダレスに携わる。'],
                 ['A creative director whose work spans planning and development, architectural design, digital marketing and graphic design. He works across boundaries on projects ranging from large hotels, accommodation facilities and restaurants in Japan to art direction, promotional planning and branding.'])
MODEL_TEXT = (['学生時代からモデルとして活動し、海外ではHERMÈS、GUCCI、ARMANI、KENZOなどのコレクションに出演。国内では東京コレクションをはじめ、数多くの広告・雑誌に出演。'],
              ['Active as a model since his student days, he has walked in collections for HERMÈS, GUCCI, ARMANI, KENZO and others overseas. In Japan, he has appeared in Tokyo Collection shows and in numerous advertisements and magazines.'])
VISION_FIRST = (['日本から世界に届くよう、クリエイティブ業界の持続可能な成長を目指し、常に新進気鋭の外部プロフェッショナルとも協力しながら、新たな挑戦に取り組み続けています。'],
                ['With the aim of reaching the world from Japan and supporting the sustainable growth of the creative industry, we continue to take on new challenges, always working alongside talented, up-and-coming professionals from outside our team.'])
VISION_LEAD = '<p class="lead">クリエイティブな視点で、<br>新しい価値を創造する。</p><p class="lead en" lang="en">Creating new value from a creative perspective.</p>'
APPROACH = (['最新の技術を取り入れたプロジェクトに積極的に取り組み、市場のニーズに即応するフレキシビリティを保っています。革新的なアプローチを通じてデザイン設計とクリエイティブな発想の融合を実現し、数々のプロジェクトで高い評価をいただいております。',
             '常に新しいアイデアや技術を取り入れ、それを踏まえた実用的なデザインを構築することに重点を置いています。これにより、従来の枠にとどまらない新たな表現方法を生み出し続けています。'],
            ['We actively take on projects that incorporate the latest technologies, keeping the flexibility to respond quickly to market needs. Through innovative approaches, we fuse design planning with creative ideas, and our work has been highly regarded across numerous projects.',
             'We place emphasis on constantly incorporating new ideas and technologies and building practical designs based on them. In this way, we continue to create new forms of expression that go beyond conventional boundaries.'])
KPG_INTRO = (['カトープレジャーグループは「日本のレジャーをもっと楽しく！」をテーマとし、ホテル、リゾート、レストラン、エンターテインメント、リバークルーズなど、多岐にわたる事業の開発や運営を行うトータルプロデュースカンパニーです。'],
             ['Under the theme "Making leisure in Japan more fun!", Kato Pleasure Group handles everything from planning to operation, developing and running a wide range of businesses, including hotels, resorts, restaurants, entertainment and river cruises.'])
KPG_GLC = (['私たちカトープレジャーグループは、「日本のレジャーをもっと楽しく！」をテーマとし、お客さまに感動のひとときをお届けします。',
            '私たちはグッドレジャークリエイターとして、時代、地、人と新しい価値を掛け合わせ、最高のホスピタリティマインドを持って、お客さまの「楽しい」を創造します。'],
           ['Under the theme "Making leisure in Japan more fun!", we at Kato Pleasure Group bring our guests moments that move them.',
            'As Good Leisure Creators, we bring together the times, places and people with new value, and with the highest standard of hospitality, we create "fun" for our guests.'])


def ig_grid(root):
    def igcap(t):
        return esc(t).replace('\n', '<br>')
    return '<div class="ig-grid">' + ''.join(
        f'<a class="ig-post" href="{p["permalink"]}" target="_blank" rel="noopener">'
        f'<span class="ig-tile">' + pic(p['image'], 'Instagram: ' + (p['title'].splitlines() or [''])[0], root, sizes='(max-width: 480px) 50vw, (max-width: 900px) 25vw, 200px') + '</span>'
        + (f'<span class="ig-title">{igcap(p["title"])}</span>' if p['title'] else '')
        + (f'<span class="ig-text">{igcap(p["text"])}</span>' if p['text'] else '') + '</a>'
        for p in IGDATA['posts']) + '</div>'


# ---------- HOME: one screen, minimal ----------
# One photo per CREATIVE work, in the CREATIVE page order
HOME_SLIDES = [('aquasense-1', 'AQUASENSE Hotel & Resort — Onna, Okinawa', 'アクアセンス ホテル＆リゾート'),
               ('peaks-6', 'PEAKS — Shinsaibashi, Osaka', 'PEAKS 大阪 心斎橋'),
               ('island-1', 'i+Land nagasaki — Iojima, Nagasaki', 'アイランド ナガサキ'),
               ('synesthesia-1', 'SYNESTHESIA HILLS — Nantan, Kyoto', 'シナスタジアヒルズ'),
               ('glamday-1', 'GLAMDAY STYLE', 'グランデイスタイル'),
               ('grandmer-2', 'OKINAWA GRAND MER RESORT — Okinawa City, Okinawa', '沖縄グランメールリゾート')]


def home(root, skeleton=True):
    n = len(HOME_SLIDES)
    slides = ''.join(pic(img, f'{cap} / {ja}', root, lazy=False, hidden=i > 0, prio=i == 0, sizes='(max-width: 900px) 100vw, min(80vw, 1200px)')
                     for i, (img, cap, ja) in enumerate(HOME_SLIDES))
    caps = json.dumps([esc(c) for _, c, _ in HOME_SLIDES])
    hero = (f'<section class="hero show" data-count="{n}" data-auto="8000" data-caps=\'{caps}\' aria-label="Photographs">'
            f'<div class="frame">{slides}</div>'
            f'<div class="hero-cap"><span class="cap">{esc(HOME_SLIDES[0][1])}</span><span class="num">01 / {n:02d}</span></div></section>')
    ig = ('<section class="home-ig wide" aria-label="Instagram">'
          '<div class="ig-head"><h2 class="h2">INSTAGRAM<span>@KENGO_UMETANI</span></h2>'
          f'<nav class="nav-foot"><a href="{IG}" target="_blank" rel="noopener">INSTAGRAM ↗</a><a href="{FB}" target="_blank" rel="noopener">FACEBOOK ↗</a></nav></div>'
          + ig_grid(root).replace("sizes='(max-width: 480px) 50vw, (max-width: 900px) 25vw, 200px'", "") + '</section>')
    h1 = '<h1 class="visually-hidden">KENGO UMETANI OFFICIAL / 梅谷憲吾 公式サイト</h1>'
    return page('HOME', 'KENGO UMETANI OFFICIAL',
                '梅谷 憲吾 KENGO UMETANI. KATO PLEASURE GROUP CREATIVE DIRECTOR / U&K CREATIVE VISIONS COO', h1 + '<div class="home-col">' + hero + '\n' + ig + '</div>', root, skeleton)


# ---------- PROFILE (same items as the current PROFILE page) ----------
def profile(root):
    tl = [('2001', '16歳でモデル活動を開始。元所属：elite、bark in style、FOLIO MANAGEMENT', 'Began his career as a model at the age of 16. Former agencies: elite, bark in style, FOLIO MANAGEMENT'),
          ('2008', '大学卒業後、設計事務所<a class="u" href="https://dejavu-d.com/" target="_blank" rel="noopener">DEJAVU</a>に勤務', 'Joined the architectural design firm <a class="u" href="https://dejavu-d.com/" target="_blank" rel="noopener">DEJAVU</a> after graduating'),
          ('2011', '株式会社VIDA 設立、代表取締役', 'Founded VIDA Inc. and became its CEO'),
          ('2011', '有限会社<a class="u" href="http://www.ogawajunzo.jp/" target="_blank" rel="noopener">オガワジュンゾウ・クリエイツ</a> 取締役', 'Director, Ogawa Junzo Creates Ltd.'),
          ('2013', '故 堺屋太一氏（経済企画庁長官〈第55・56・57代〉、内閣特別顧問、内閣官房参与などを歴任）のもと、総合調整局補佐として従事', 'Served as an assistant in the General Coordination Bureau under the late Taichi Sakaiya, former Director-General of the Economic Planning Agency (55th–57th), Special Advisor to the Cabinet and Special Advisor to the Cabinet Secretariat'),
          ('2016', '<a class="u" href="https://www.kpg.gr.jp/" target="_blank" rel="noopener">カトープレジャーグループ</a>（KPG）に入社', 'Joined Kato Pleasure Group (KPG)'),
          ('2020', 'カトープレジャーグループ全体のクリエイティブディレクターに就任', 'Appointed Creative Director of the entire Kato Pleasure Group'),
          ('2020', '株式会社U&amp;K CREATIVE VISIONS 代表取締役CEOに就任', 'Appointed Representative Director and CEO of U&amp;K CREATIVE VISIONS Inc.')]
    career = ''.join(f'<li><span>{j}<span class="sub" lang="en">{e}</span></span><span class="b">{y}</span></li>' for y, j, e in tl)
    direction = ''.join(f'<li><span>{esc(n)}<span class="sub">{esc(r)}</span></span></li>' for n, r in D['DIRECTION'])
    kpg = ''.join(f'<li><a class="row-a" href="{u}" target="_blank" rel="noopener"><span>{esc(n)}</span><span>SITE ↗</span></a></li>' for n, u in D['KPGWORKS'])
    b = []
    portrait = '<div class="frame mono" style="margin-top:24px">' + pic('top-model', '梅谷 憲吾 / KENGO UMETANI', root, lazy=False, prio=True) + '</div>'
    b.append(row('<h1 class="label big">PROFILE<span>梅谷 憲吾 / KENGO UMETANI</span></h1>' + portrait, bi(BIO_JP, BIO_EN), 'text first'))
    b.append(row('<h2 class="label">現職<span>CURRENT POSITION</span></h2>', current_block(), 'text'))
    b.append(row('<h2 class="label">次代のクリエイティブへのアプローチ<span>AN APPROACH TO THE NEXT GENERATION OF CREATIVITY</span></h2>', bi(*APPROACH), 'text'))
    b.append(row('<h2 class="label">学歴<span>EDUCATION</span></h2>',
                 '<ul class="list norm"><li><span>近畿大学理工学部建築学科 卒業<span class="sub" lang="en">Graduated from the Department of Architecture, Faculty of Science and Engineering, Kindai University</span></span></li></ul>', 'text'))
    b.append(row('<h2 class="label">職歴<span>CAREER</span></h2>', f'<ul class="list norm gap">{career}</ul>', 'text'))
    b.append(row('<h2 class="label">MODEL WORKS</h2>',
                 '<ul class="list norm gap"><li><span>HERMÈS, GUCCI, ARMANI, KENZO, ETRO, MARC JACOBS and more<span class="sub" lang="ja">HERMÈS、GUCCI、ARMANI、KENZO、ETRO、MARC JACOBS 等</span></span><span class="b">OVERSEAS<span class="sub" lang="ja">海外</span></span></li><li><span>Tokyo Collection, advertisements for Johnson &amp; Johnson and others, TV commercials for AOKI and others, various magazines, and more<span class="sub" lang="ja">東京コレクション、ジョンソン・エンド・ジョンソンなどの広告、AOKIなどのテレビCM、各種雑誌 等</span></span><span class="b">JAPAN<span class="sub" lang="ja">国内</span></span></li></ul>', 'text'))
    b.append(row('<h2 class="label">CREATIVE DIRECTION WORKS</h2>', f'<ul class="list gap">{direction}<li><span>ETC.</span></li></ul>', 'text'))
    b.append(row('<h2 class="label">KATO PLEASURE GROUP WORKS</h2>', f'<ul class="list">{kpg}<li><span>ETC.</span></li></ul>', 'text'))
    return page('PROFILE', 'PROFILE | KENGO UMETANI OFFICIAL', '梅谷 憲吾 プロフィール。1985年大阪府生まれ。近畿大学理工学部建築学科卒業。カトープレジャーグループ クリエイティブディレクター。', '\n'.join(b), root)


# ---------- CREATIVE (same seven works, four photos each) ----------
def creative(root):
    b = [row('<h1 class="label big">CREATIVE WORKS</h1>', bi(*CREATIVE_LEDE), 'text first')]
    for i, k in enumerate(ORDER):
        w = WORKS[k]
        name = esc(w['name'])
        sub = f'<span>{esc(w["nameEn"])}</span>' if w.get('nameEn') else ''
        label = 'ONLINE SHOP' if k in ('tsurutontan', 'fufusel') else 'OFFICIAL HP'
        role = (f'<div class="role">{" / ".join(esc(r) for r in w["role"])}<span class="sub" lang="ja">{esc(w.get("roleJa", ""))}</span></div>' if w.get('role') else '')
        right = (f'<h2 class="h2">{name}{sub}</h2><div class="loc">{esc(w["loc"])} / {esc(w["locEn"])}</div>' + role
                 + bi(w['jp'], [esc(t) for t in w['en']])
                 + (f'<a class="more" href="{w["url"]}" target="_blank" rel="noopener">{label} ↗</a>' if w.get('url') else ''))
        photos = {'peaks': [f'peaks-{n}' for n in range(1, 7)], 'tsurutontan': [f'tsurutontan-k{n}' for n in (3, 1, 2, 4, 5)], 'fufusel': [f'fufusel-{n}' for n in (3, 1, 2, 4, 5, 6, 7)]}.get(k, [f'{k}-{n}' for n in range(1, 5)])
        b.append(row(show(photos, w['name'], root), right, '' if i else ''))
    return page('CREATIVE', 'CREATIVE | KENGO UMETANI OFFICIAL', 'CREATIVE WORKS — AQUASENSE Hotel & Resort, i+Land nagasaki, SYNESTHESIA HILLS, GLAMDAY STYLE, OKINAWA GRAND MER RESORT, つるとんたん, 呑窓', '\n'.join(b), root)


# ---------- MODEL (same eight photos) ----------
def model(root):
    names = ['model-sts1', 'model-sts2', 'model-8'] + [f'model-{n}' for n in range(2, 8)] + ['model-1']
    thumbs = ''.join(f'<button type="button" class="thumb{" on" if i == 0 else ""}" data-go="{i}" aria-label="写真 {i+1} / Photo {i+1}">{pic(n, "", root, sizes="120px")}</button>' for i, n in enumerate(names))
    b = [row(show(names, '梅谷憲吾 モデル / Kengo Umetani, model', root, first_lazy=False, prio=True),
             f'<h1 class="h2">MODEL<span>KENGO UMETANI</span></h1><div class="thumbs">{thumbs}</div>'
             + '<div style="margin-top:28px">' + bi(*MODEL_TEXT) + '</div>'
             + '<div class="h">FORMER AGENCIES<span class="sub" lang="ja" style="display:inline;margin-left:8px;font-weight:400">過去所属</span></div><ul class="list"><li><span>ELITE</span></li><li><span>BARK IN STYLE</span></li><li><span>FOLIO MANAGEMENT</span></li></ul>', 'first gallery')]
    return page('MODEL', 'MODEL | KENGO UMETANI OFFICIAL', '梅谷 憲吾 モデル作品。HERMÈS、GUCCI、ARMANI、KENZO などのコレクションに出演。', '\n'.join(b), root)


# ---------- VISION (same text and photo) ----------
def vision(root):
    b = [row(show(['vision-1'], '夕暮れの水辺の風景 / Waterside at dusk', root, first_lazy=False, prio=True),
             '<h1 class="h2">VISION</h1>' + VISION_LEAD + bi(*VISION_FIRST) + '<div style="margin-top:22px">' + bi(
                 ['ブランドコンセプト設計からマーケティング、クリエイティブ、プロモーションまでを一気通貫で担い、総合的なクリエイティブディレクションを行います。',
                  '革新的なアプローチとクリエイティブな視点を持ち、クリエイティブチームや外部の専門家と協力しながら、常に新たな挑戦に取り組んでいます。',
                  'そして業界の持続可能な成長のために、新しい価値を創造し続けます。'],
                 ['We provide comprehensive creative direction, handling everything from brand concept design to marketing, creative and promotion in one seamless process.',
                  'With innovative approaches and a creative perspective, we work alongside our creative team and outside experts, always taking on new challenges.',
                  'And we will continue to create new value for the sustainable growth of the industry.']) + '</div>', 'first')]
    return page('VISION', 'VISION | KENGO UMETANI OFFICIAL', 'VISION. ブランドコンセプト設計からマーケティング、クリエイティブ、プロモーションまでを一気通貫で担い、総合的なクリエイティブディレクションを行います。', '\n'.join(b), root)


# ---------- LEGAL ----------
def sec(label_jp, label_en, jp, en):
    return row(f'<h2 class="label">{label_jp}<span>{label_en}</span></h2>', bi(jp, en), 'text')


def about(root):
    b = [row('<h1 class="label big">概要<span>ABOUT THIS SITE</span></h1>', '', 'text first')]
    b.append(row('<h2 class="label">運営者情報<span>SITE OPERATOR</span></h2>', f"""<ul class="list norm gap">
<li><span>サイト名<span class="sub" lang="en">Site name</span></span><span>KENGO UMETANI OFFICIAL<span class="sub">梅谷憲吾 公式サイト</span></span></li>
<li><span>URL</span><span>https://www.umetanikengo.com</span></li>
<li><span>運営者<span class="sub" lang="en">Operator</span></span><span>梅谷 憲吾<span class="sub" lang="en">Kengo Umetani</span></span></li>
<li><span>所属<span class="sub" lang="en">Affiliation</span></span><span>Creative Director, Kato Pleasure Group<span class="sub" lang="ja">カトープレジャーグループ クリエイティブディレクター</span>Director and COO, U&amp;K CREATIVE VISIONS Inc.<span class="sub" lang="ja">株式会社U&amp;K CREATIVE VISIONS 取締役 兼 COO</span></span></li>
<li><span>お問い合わせ<span class="sub" lang="en">Contact</span></span><span><a class="u" href="{FB}" target="_blank" rel="noopener">Facebook</a> / <a class="u" href="{IG}" target="_blank" rel="noopener">Instagram</a></span></li>
</ul>""", 'text'))
    b.append(sec('このサイトについて', 'ABOUT', [
        '本サイトは、クリエイティブディレクター・梅谷憲吾の活動、実績、ビジョンを紹介する個人サイトです。',
        '掲載している施設・ブランドの情報は紹介時点のものです。最新の情報は、各施設・ブランドの公式サイトをご確認ください。'], [
        'This is the personal website of creative director Kengo Umetani, introducing his work, projects and vision.',
        'Information on the facilities and brands featured here is current as of publication. Please refer to each official website for the latest information.']))
    b.append(sec('著作権について', 'COPYRIGHT', [
        '本サイトに掲載している文章・写真・画像などの著作権は、梅谷憲吾または各権利者に帰属します。権利者の許可なく、複製・転載・改変・再配布することを禁じます。'], [
        'Copyright in the text, photographs and images on this site belongs to Kengo Umetani or the respective rights holders. Reproduction, republication, modification or redistribution without permission is prohibited.']))
    b.append(sec('リンクについて', 'LINKS', [
        '本サイトへのリンクは原則自由です。ただし、本サイトの内容を誤解させるような方法や、フレーム内での表示はお控えください。',
        '本サイトから外部サイトへのリンク先の内容について、当サイトは責任を負いません。'], [
        'You are generally free to link to this site. However, please do not link in a way that misrepresents its content, or display it within frames on another site.',
        'This site is not responsible for the content of external websites linked from it.']))
    return page('ABOUT', '概要 | KENGO UMETANI OFFICIAL', '梅谷憲吾 公式サイトの運営者情報。', '\n'.join(b), root)


def privacy(root):
    b = [row('<h1 class="label big">プライバシーポリシー<span>PRIVACY POLICY</span></h1>',
             bi(['梅谷憲吾（以下「当サイト運営者」）は、本サイト（https://www.umetanikengo.com）における個人情報の取り扱いについて、以下のとおり定めます。'], ['Kengo Umetani (the "Site Operator") sets out the following policy on the handling of personal information on this website (https://www.umetanikengo.com).']), 'text first')]
    b.append(sec('1. 取得する情報', '1. INFORMATION WE COLLECT', [
        '本サイトには、お問い合わせフォームや会員登録の機能はありません。',
        'SNSなどを通じてお問い合わせをいただいた場合、お名前、連絡先、お問い合わせ内容など、ご本人が提供された情報を取得します。',
        '本サイトを置いているサーバーでは、安全な運用のため、IPアドレス、ブラウザの種類、アクセス日時などのアクセスログが自動的に記録される場合があります。'], [
        'This site has no contact form or registration feature.',
        'When you contact us via social media or other means, we receive the information you provide, such as your name, contact details and the content of your inquiry.',
        'For secure operation, the server hosting this site may automatically record access logs such as IP address, browser type and time of access.']))
    b.append(sec('2. 利用目的', '2. PURPOSE OF USE', [
        '取得した情報は、お問い合わせへの回答とご連絡、本サイトの安全な運用と改善のためにのみ利用します。'], [
        'Information we receive is used only to respond to and communicate about your inquiry, and to operate and improve this site securely.']))
    b.append(sec('3. 第三者への提供', '3. DISCLOSURE TO THIRD PARTIES', [
        '法令に基づく場合を除き、ご本人の同意なく個人情報を第三者に提供することはありません。'], [
        'We do not disclose personal information to third parties without your consent, except where required by law.']))
    b.append(sec('4. 外部サービスについて', '4. EXTERNAL SERVICES', [
        '本サイトは、文字の表示にGoogle Fontsを利用しています。ページの表示時に、ご利用のブラウザからGoogleのサーバーへ接続し、IPアドレスなどの情報がGoogleに送信されます。詳しくはGoogleのプライバシーポリシーをご確認ください。',
        '本サイトには、Facebook、Instagramなど外部サイトへのリンクがあります。リンク先での情報の取り扱いは、各サービスのプライバシーポリシーに従います。',
        '本サイトでは、アクセス解析ツールや広告配信サービスは利用していません。'], [
        'This site uses Google Fonts to display text. When a page loads, your browser connects to Google\'s servers, and information such as your IP address is sent to Google. For details, please see Google\'s privacy policy.',
        'This site contains links to external services such as Facebook and Instagram. Information on those sites is handled under each service\'s own privacy policy.',
        'This site does not use analytics tools or advertising services.']))
    b.append(sec('5. Cookieについて', '5. COOKIES', [
        '本サイトはCookieを使用していません。詳しくは「COOKIE 設定」のページをご覧ください。'], [
        'This site does not use cookies. For details, please see the Cookie Policy page.']))
    b.append(sec('6. 開示・訂正・削除のご請求', '6. YOUR RIGHTS', [
        'ご本人から個人情報の開示・訂正・利用停止・削除のご請求があった場合は、ご本人であることを確認したうえで、法令に従い速やかに対応します。'], [
        'If you request disclosure, correction, suspension of use or deletion of your personal information, we will respond promptly in accordance with the law after confirming your identity.']))
    b.append(sec('7. 改定', '7. CHANGES', [
        '本ポリシーの内容は、必要に応じて変更することがあります。変更後の内容は、本ページに掲載した時点から効力を生じます。'], [
        'This policy may be revised as necessary. Revisions take effect when they are posted on this page.']))
    b.append(row('<h2 class="label">8. お問い合わせ<span>8. CONTACT</span></h2>',
                 f'<div class="txt en" lang="en"><p>For inquiries about this policy, please send a message via <a class="u" href="{FB}" target="_blank" rel="noopener">Facebook</a> or <a class="u" href="{IG}" target="_blank" rel="noopener">Instagram</a>.</p></div><div class="txt ja second" lang="ja"><p>本ポリシーに関するお問い合わせは、<a class="u" href="{FB}" target="_blank" rel="noopener">Facebook</a> または <a class="u" href="{IG}" target="_blank" rel="noopener">Instagram</a> のメッセージからご連絡ください。</p></div><p class="note">制定日：2026年10月10日 / Established: October 10, 2026</p>', 'text'))
    return page('PRIVACY', 'プライバシーポリシー | KENGO UMETANI OFFICIAL', '梅谷憲吾 公式サイトのプライバシーポリシー。', '\n'.join(b), root)


def cookie(root):
    b = [row('<h1 class="label big">COOKIE 設定<span>COOKIE POLICY</span></h1>', '', 'text first')]
    b.append(sec('Cookieの使用について', 'USE OF COOKIES', [
        '本サイトはCookieを使用していません。アクセス解析、広告、行動追跡のためのCookieも、SNSの埋め込みによるCookieも設定されません。',
        'そのため、Cookieの同意・設定の操作は必要ありません。'], [
        'This site does not use cookies. No cookies are set for analytics, advertising or tracking, and no cookies are set by embedded social media content.',
        'As a result, there are no cookie consent settings to manage.']))
    b.append(sec('外部サイトでのCookie', 'COOKIES ON EXTERNAL SITES', [
        '本サイトからリンクしているFacebook、Instagramなどの外部サイトに移動した場合、移動先のサイトがCookieを使用することがあります。その取り扱いは各サービスのポリシーに従います。',
        'Cookieの保存はお使いのブラウザの設定で拒否・削除できます。'], [
        'If you follow a link from this site to an external service such as Facebook or Instagram, that site may use cookies. Their handling follows each service\'s own policy.',
        'You can block or delete cookies in your browser settings.']))
    b.append(sec('変更について', 'CHANGES', [
        '今後、アクセス解析などのためにCookieを使用する場合は、本ページと「プライバシーポリシー」を更新し、必要に応じて同意の設定を設けます。'], [
        'If cookies are introduced in the future, for example for analytics, we will update this page and the Privacy Policy and provide consent settings where required.']))
    return page('COOKIE', 'COOKIE 設定 | KENGO UMETANI OFFICIAL', '梅谷憲吾 公式サイトのCookieポリシー。', '\n'.join(b), root)


if __name__ == '__main__':
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT + '/assets')
    shutil.copytree(ROOT / 'images', OUT + '/images')
    shutil.copy(ROOT / 'assets/site.css', OUT + '/assets/site.css')
    shutil.copy(ROOT / 'assets/site.js', OUT + '/assets/site.js')
    open(OUT + '/robots.txt', 'w').write('User-agent: *\nDisallow: /\n' if SITE.get('noindex') else 'User-agent: *\nAllow: /\n')
    open(OUT + '/.nojekyll', 'w').write('')
    open(OUT + '/index.html', 'w', encoding='utf-8').write(home(''))
    for name, fn in [('profile', profile), ('creative', creative), ('model', model), ('vision', vision), ('about', about), ('privacy', privacy), ('cookie', cookie)]:
        os.makedirs(f'{OUT}/{name}')
        open(f'{OUT}/{name}/index.html', 'w', encoding='utf-8').write(fn('../'))
    # artifact entry page: same HOME, without the document skeleton (the Artifact host adds it)
    if os.environ.get('ARTIFACT_OUT'):
        open(os.environ['ARTIFACT_OUT'], 'w', encoding='utf-8').write(home('', skeleton=False))
    print('built')
    # old Jimdo addresses → new pages
    for old, new in [('概要', 'about'), ('プライバシーポリシー', 'privacy'), ('cookie-設定', 'cookie')]:
        os.makedirs(f'{OUT}/{old}', exist_ok=True)
        open(f'{OUT}/{old}/index.html', 'w', encoding='utf-8').write(f'<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>Redirect</title><meta name="robots" content="noindex"><link rel="canonical" href="../{new}/index.html"><meta http-equiv="refresh" content="0; url=../{new}/index.html"></head><body><a href="../{new}/index.html">../{new}/</a></body></html>\n')
