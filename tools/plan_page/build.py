#!/usr/bin/env python3
u"""უბნის გეგმის მონაცემი და ცალკე მდგომი გვერდი.

გაშვება პროექტის ფესვიდან:

    python3 tools/plan_page/build.py

შედეგი — ორი ფაილი:

  `data/plan-page.json`            საიტი კითხულობს (შესვლის ეკრანი + რუკის ტაბი)
  `tools/plan_page/kedri-plan.html`  ცალკე მდგომი გვერდი (არტიფაქტი) — თვითკმარი

წყარო: `კედრის_ქუჩა_ნაკვეთები.geojson` (კონტურები, მისამართები, ქუჩები),
`data/plan.geojson` (ქუჩების ღერძები OSM-იდან), `კედრის_ქუჩა_ხელმოწერები.xlsx`
(შეიპის გარეშე დარჩენილი კოდების მისამართი და ფართობი).

ცალკე მდგომი გვერდი იმავე `css/plan.css`-სა და `js/plan.js`-ს ინლაინავს,
რასაც საიტი იყენებს — დიზაინი ერთ ადგილას ცხოვრობს.
"""
import io
import json
import math
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).resolve().parent

PARCELS = ROOT / u'კედრის_ქუჩა_ნაკვეთები.geojson'
PLAN = ROOT / 'data' / 'plan.geojson'
XLSX = ROOT / u'კედრის_ქუჩა_ხელმოწერები.xlsx'
CSS = ROOT / 'css' / 'plan.css'
LIB = ROOT / 'js' / 'lib.js'
PLAN_JS = ROOT / 'js' / 'plan.js'
SHELL = HERE / 'shell.html'

OUT_JSON = ROOT / 'data' / 'plan-page.json'
OUT_HTML = HERE / 'kedri-plan.html'

# NAPR-ის საჯარო ფენაზე ამ კოდებს კონტური არ აქვთ — რუკაზე ვერ დაიხატება,
# სიაში კი ცალკე ჯგუფად ჩანს. იხ. docs/2026-08-21-tas-ge-shedareba.md
NO_SHAPE = [u'99.99.99.001', u'99.99.99.004', u'99.99.99.005', u'99.99.99.006']

# ამ ნიშნებით ვცნობთ tas.ge-ს გადამოწმებისას დამატებულ ნაკვეთს (წყვეტილი კონტური)
ADDED_MARKS = (u'tas.ge', u'უახლოესი მეზობლის მიხედვით')

# ამაზე დიდი ნაკვეთი ნაგულისხმევ ხედს არ განსაზღვრავს (პარკი, სასოფლო მასივი)
CORE_MAX_M2 = 5000


def read_json(path):
    return json.loads(io.open(str(path), encoding='utf-8').read())


def street_list(streets):
    u"""უნიკალური ქუჩები კოდპოინტური რიგით — იგივე წესი, რაც `WebLib.streetList`.

    `Intl.Collator('ka')` ამ ICU-ზე ლათინურსა და ქართულს არაპროგნოზირებადად
    ალაგებს, სუფთა კოდპოინტური შედარება კი ქართული ანბანისთვის სწორია.
    ფერების მინიჭება ამ რიგზეა დამოკიდებული, ამიტომ ორივე მხარეს ერთი
    წესი უნდა მოქმედებდეს.
    """
    return sorted({s.strip() for s in streets if s and s.strip()})


def build():
    geo = read_json(PARCELS)
    plan = read_json(PLAN)
    features = geo['features']

    pts = [p for f in features for p in f['geometry']['coordinates'][0]]
    lat0 = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2
    kx = 111320 * math.cos(math.radians(lat0))
    ky = 110540
    lon0 = min(p[0] for p in pts)
    lat_top = max(p[1] for p in pts)

    def prj(point):
        return ((point[0] - lon0) * kx, (lat_top - point[1]) * ky)

    def path(ring):
        return 'M' + ' L'.join('%.2f %.2f' % prj(p) for p in ring[:-1]) + ' Z'

    def centroid(ring):
        inner = ring[:-1]
        return prj((sum(p[0] for p in inner) / len(inner),
                    sum(p[1] for p in inner) / len(inner)))

    streets = street_list(f['properties']['street'] for f in features)
    index_of = {name: i for i, name in enumerate(streets)}

    parcels = []
    for feature in features:
        props = feature['properties']
        ring = feature['geometry']['coordinates'][0]
        cx, cy = centroid(ring)
        street = (props['street'] or '').strip()
        parcels.append({
            'cad': props['cad'],
            'tail': props['cad'].split('.')[-1],
            'num': props['adr_num'] or '',
            'street': street,
            'si': index_of.get(street, -1),
            'full': props['full'],
            'adr': props['address'],
            'area': float(props['area']),
            'purpose': props['purpose'],
            'src': props['street_src'],
            'note': props['note'],
            'state': 'added' if any(m in props['street_src'] for m in ADDED_MARKS)
                     else 'verified',
            'd': path(ring),
            'cx': round(cx, 1),
            'cy': round(cy, 1),
        })

    sheet = {}
    try:
        import openpyxl
        ws = openpyxl.load_workbook(str(XLSX))[u'ნაკვეთები']
        for row in ws.iter_rows(min_row=2, values_only=True):
            if row[0]:
                sheet[str(row[0]).strip()] = {
                    'full': row[3], 'area': row[4], 'purpose': row[5], 'addr': row[6],
                }
    except Exception as exc:                       # xlsx არ არის — გეგმა მაინც აიგება
        print(u'xlsx გამოტოვდა: %s' % exc, file=sys.stderr)

    noshape = []
    for cad in NO_SHAPE:
        entry = sheet.get(cad, {})
        noshape.append({
            'cad': cad, 'tail': cad.split('.')[-1], 'num': '', 'street': '', 'si': -1,
            'full': entry.get('full') or '', 'adr': entry.get('addr') or '',
            'area': float(entry.get('area') or 0),
            'purpose': entry.get('purpose') or '', 'state': 'noshape',
        })

    roads = [{
        'name': f['properties'].get('name') or '',
        'cls': f['properties'].get('class') or '',
        'd': 'M' + ' L'.join('%.2f %.2f' % prj(p) for p in f['geometry']['coordinates']),
    } for f in plan['features'] if f['properties'].get('layer') == 'road']

    projected = [prj(p) for p in pts]
    xs = [p[0] for p in projected]
    ys = [p[1] for p in projected]
    bbox = [round(min(xs) - 25, 1), round(min(ys) - 25, 1),
            round(max(xs) - min(xs) + 50, 1), round(max(ys) - min(ys) + 50, 1)]

    core = [f for f in features if float(f['properties']['area']) <= CORE_MAX_M2]
    core_pts = [prj(p) for f in core for p in f['geometry']['coordinates'][0]]
    cxs = [p[0] for p in core_pts]
    cys = [p[1] for p in core_pts]
    fit = [round(min(cxs) - 22, 1), round(min(cys) - 22, 1),
           round(max(cxs) - min(cxs) + 44, 1), round(max(cys) - min(cys) + 44, 1)]

    data = {'parcels': parcels, 'noshape': noshape, 'roads': roads,
            'streets': streets, 'bbox': bbox, 'fit': fit}
    blob = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    if '</script' in blob:
        raise SystemExit(u'მონაცემში `</script` აღმოჩნდა — ჩაშენება საშიშია')

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    io.open(str(OUT_JSON), 'w', encoding='utf-8').write(blob)

    # ცალკე მდგომ გვერდს იმავე CSS/JS სჭირდება, რასაც საიტს — ინლაინდება,
    # რომ არტიფაქტმა გარე ფაილი არ მოითხოვოს.
    shell = io.open(str(SHELL), encoding='utf-8').read()
    js = io.open(str(LIB), encoding='utf-8').read() + '\n' + \
        io.open(str(PLAN_JS), encoding='utf-8').read()
    html = (shell
            .replace('__CSS__', io.open(str(CSS), encoding='utf-8').read())
            .replace('__JS__', js)
            .replace('__DATA__', blob))
    io.open(str(OUT_HTML), 'w', encoding='utf-8').write(html)

    with_num = sum(1 for p in parcels if p['num'])
    print(u'%s  (%s ბაიტი)' % (OUT_JSON.relative_to(ROOT), format(len(blob), ',')))
    print(u'%s  (%s ბაიტი)' % (os.path.relpath(str(OUT_HTML), str(ROOT)),
                               format(len(html), ',')))
    print(u'ნაკვეთი: %d · მისამართით: %d · უმისამართოდ: %d · ქუჩა: %d · შეიპის გარეშე: %d'
          % (len(parcels), with_num, len(parcels) - with_num, len(streets), len(noshape)))
    no_street = [p['cad'] for p in parcels if p['si'] < 0]
    if no_street:
        print(u'ქუჩის გარეშე (ნაცრისფერი): %s' % ', '.join(no_street))


if __name__ == '__main__':
    build()
