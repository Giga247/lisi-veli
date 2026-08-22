# -*- coding: utf-8 -*-
u"""ერთჯერადი მოქაჩვა: სამისამართო რეესტრის ქუჩები -> data/streets.geojson.

გაშვება:  python3 tools/fetch_streets.py
დათვლა:   python3 tools/fetch_streets.py --dry-run

წყარო — საჯარო რეესტრის (NAPR) სამისამართო ფენა `AR_LN_STREETS`, იგივე,
რასაც tas.ge / ms.gov.ge-ის რუკა ხატავს. სახელი და გეომეტრია იქიდანაა,
არა OSM-იდან: OSM-ს ჩვენს უბანში ორი ქუჩა არეული აქვს (იხ. docs).

**რატომ რასტრი.** ამ GeoServer-ზე WFS და GetFeatureInfo დაკეტილია (403),
ღიაა მხოლოდ WMS GetMap. ამიტომ თითო ქუჩა ცალკე იხატება — `CQL_FILTER`-ით
გაფილტრული, `SLD_BODY`-ით ერთპიქსელიან წითელ ხაზად და ლეიბლების გარეშე —
შემდეგ პიქსელები ითხელება (Zhang-Suen), გრაფად აიწყობა და პოლილინიად
გადაითარგმნება. ~0.10 მ/px-ზე ხაზის ცდომილება დეციმეტრის რიგისაა.

შედეგი რეპოში იკომიტება — ეს სნეპშოტია, არა ცოცხალი წყარო.
"""
import io
import json
import math
import os
import sys
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, u'data', u'streets.geojson')

WMS = u'https://nv.napr.gov.ge/geoserver/NGDB/wms'
LAYER = u'AR_LN_STREETS'
HEADERS = {u'User-Agent': u'lisi-veli-plan/1.0', u'Referer': u'https://ms.gov.ge/'}

# უბნის ჩარჩო — იგივე, რაც fetch_osm.py-ის BBOX, ოდნავ გაშლილი
AREA = (44.7150, 41.7415, 44.7240, 41.7495)  # W, S, E, N

STREETS = (
    u'კედრის ქუჩა',
    u'კედრის I გასასვლელი',
    u'კედრის II გასასვლელი',
    u'კედრის III გასასვლელი',
    u'კედრის IV გასასვლელი',
    u'კედრის I შესახვევი',
    u'კედრის I ჩიხი',
    u'ლეო კვაჭაძის ქუჩა',
)

# რომელი ქუჩა რა სისქით იხატება — `js/plan.js` ამ კლასს კითხულობს
CLASS = {u'ლეო კვაჭაძის ქუჩა': u'secondary'}
DEFAULT_CLASS = u'residential'

ATTRIBUTION = (u'ქუჩები: საჯარო რეესტრის ეროვნული სააგენტო — '
               u'სამისამართო რეესტრი (AR_LN_STREETS), tas.ge / ms.gov.ge')

# ხაზის მხოლოდ სისქეა სტილში ჩასწორებული; ფერი მარკერია, ლეიბლი გამორთული
SLD = (u'<?xml version="1.0" encoding="UTF-8"?>'
       u'<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld">'
       u'<NamedLayer><Name>%s</Name><UserStyle><FeatureTypeStyle><Rule>'
       u'<LineSymbolizer><Stroke>'
       u'<CssParameter name="stroke">#FF0000</CssParameter>'
       u'<CssParameter name="stroke-width">1</CssParameter>'
       u'</Stroke></LineSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer>'
       u'</StyledLayerDescriptor>') % LAYER

EARTH = 20037508.34
TARGET_MPP = 0.10       # სამიზნე გარჩევადობა მეტრი/პიქსელი
MAX_SIDE = 4000         # GeoServer დიდ სურათს არ გასცემს
MAX_PIXELS = 8000000
SIMPLIFY_M = 0.35       # RDP-ის ზღვარი — ქვევით ხმაურია, არა ფორმა
COORD_PRECISION = 7
LAT_MID = 41.745


def merc(lon, lat):
    return (lon * EARTH / 180.0,
            math.log(math.tan((90 + lat) * math.pi / 360.0))
            / (math.pi / 180.0) * EARTH / 180.0)


def unmerc(x, y):
    return (x / EARTH * 180.0,
            math.degrees(2 * math.atan(math.exp(y / EARTH * math.pi)) - math.pi / 2))


def metres(a, b):
    u"""უხეში, მაგრამ ამ განედზე საკმარისი მანძილი გრადუსებიდან."""
    return math.hypot((b[0] - a[0]) * 111320 * math.cos(math.radians(LAT_MID)),
                      (b[1] - a[1]) * 110574)


def render(bbox, width, name):
    u"""bbox მერკატორში; აბრუნებს (mask, height)."""
    x0, y0, x1, y1 = bbox
    height = int(round(width * (y1 - y0) / (x1 - x0)))
    query = urllib.parse.urlencode({
        u'SERVICE': u'WMS', u'VERSION': u'1.1.1', u'REQUEST': u'GetMap',
        u'LAYERS': LAYER, u'SRS': u'EPSG:3857',
        u'BBOX': u'%f,%f,%f,%f' % (x0, y0, x1, y1),
        u'WIDTH': width, u'HEIGHT': height,
        u'FORMAT': u'image/png', u'TRANSPARENT': u'true',
        u'SLD_BODY': SLD, u'CQL_FILTER': u"NAME = '%s'" % name,
    })
    request = urllib.request.Request(WMS + u'?' + query, headers=HEADERS)
    body = urllib.request.urlopen(request, timeout=180).read()
    if body[:4] != b'\x89PNG':
        raise SystemExit(u'WMS-მა სურათის ნაცვლად ეს დააბრუნა:\n%s'
                         % body[:400].decode(u'utf-8', u'replace'))
    pixels = np.array(Image.open(io.BytesIO(body)).convert(u'RGBA'))
    mask = ((pixels[:, :, 3] > 40) & (pixels[:, :, 0] > 120) & (pixels[:, :, 1] < 120))
    return mask, height


NEIGHBOURS = ((-1, -1), (-1, 0), (-1, 1), (0, -1),
              (0, 1), (1, -1), (1, 0), (1, 1))


def thin(mask):
    u"""Zhang-Suen — ხაზს ერთპიქსელიან ჩონჩხამდე ათხელებს.

    ანტი-ალიასინგის გამო 1px-იანი შტრიხიც კი ორპიქსელიანი გამოდის, გრაფად
    აწყობა კი მხოლოდ ჩონჩხზე მუშაობს."""
    img = mask.astype(np.uint8).copy()
    while True:
        changed = False
        for step in (0, 1):
            ring = [np.roll(np.roll(img, dy, 0), dx, 1) for dy, dx in
                    ((-1, 0), (-1, -1), (0, -1), (1, -1),
                     (1, 0), (1, 1), (0, 1), (-1, 1))]
            count = sum(ring)
            loop = ring + [ring[0]]
            transitions = sum(((loop[i] == 0) & (loop[i + 1] == 1)).astype(np.uint8)
                              for i in range(8))
            if step == 0:
                first, second = ring[0] * ring[2] * ring[4], ring[2] * ring[4] * ring[6]
            else:
                first, second = ring[0] * ring[2] * ring[6], ring[0] * ring[4] * ring[6]
            kill = ((img == 1) & (count >= 2) & (count <= 6)
                    & (transitions == 1) & (first == 0) & (second == 0))
            if kill.any():
                img[kill] = 0
                changed = True
        if not changed:
            return img.astype(bool)


def trace(mask):
    u"""ჩონჩხს პიქსელების ჯაჭვებად შლის."""
    points = {(int(y), int(x)) for y, x in zip(*np.nonzero(thin(mask)))}
    nbrs = {p: [(p[0] + dy, p[1] + dx) for dy, dx in NEIGHBOURS
                if (p[0] + dy, p[1] + dx) in points] for p in points}
    seen = set()
    paths = []

    def walk(start, first):
        path = [start, first]
        seen.update({(start, first), (first, start)})
        prev, cur = start, first
        while len(nbrs[cur]) == 2:
            step = [q for q in nbrs[cur] if q != prev and (cur, q) not in seen]
            if not step:
                break
            seen.update({(cur, step[0]), (step[0], cur)})
            prev, cur = cur, step[0]
            path.append(cur)
        return path

    for point in [p for p in points if len(nbrs[p]) != 2] + sorted(points):
        for other in nbrs[point]:
            if (point, other) not in seen:
                paths.append(walk(point, other))
    return paths


def stitch(paths, gap_pixels=4, min_pixels=12):
    u"""ჩონჩხის ნატეხებს ერთ ხაზად აკერავს; ხმაურის ტოტებს ჭრის.

    ითხელების შემდეგ ხაზი ხანდახან ერთ-ორ პიქსელს კარგავს, ამიტომ ბოლოები
    `gap_pixels`-ის სიშორემდე მაინც იკერება."""
    paths = [list(p) for p in paths if len(p) >= 2]
    merged = True
    while merged:
        merged = False
        best = None
        for i, first in enumerate(paths):
            for j, second in enumerate(paths):
                if i >= j:
                    continue
                for at_start, head in ((0, first[0]), (1, first[-1])):
                    for at_end, tail in ((0, second[0]), (1, second[-1])):
                        gap = math.hypot(head[0] - tail[0], head[1] - tail[1])
                        if gap <= gap_pixels and (best is None or gap < best[0]):
                            best = (gap, i, j, at_start, at_end)
        if best:
            _, i, j, at_start, at_end = best
            head = paths[i][::-1] if at_start == 0 else paths[i]
            tail = paths[j][::-1] if at_end == 1 else paths[j]
            paths[i] = head + (tail[1:] if head[-1] == tail[0] else tail)
            paths[j] = []
            paths = [p for p in paths if p]
            merged = True
    kept = [p for p in paths if len(p) >= min_pixels]
    return kept or paths


def rdp(points, eps):
    if len(points) < 3:
        return points
    (ax, ay), (bx, by) = points[0], points[-1]
    dx, dy = bx - ax, by - ay
    norm = math.hypot(dx, dy)
    worst, index = -1.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        gap = (math.hypot(px - ax, py - ay) if norm == 0
               else abs(dy * px - dx * py + bx * ay - by * ax) / norm)
        if gap > worst:
            worst, index = gap, i
    if worst <= eps:
        return [points[0], points[-1]]
    return rdp(points[:index + 1], eps)[:-1] + rdp(points[index:], eps)


def clip(line):
    u"""ხაზს უბნის ჩარჩოში ჭრის — გრძელი ქუჩა უბნის გარეთაც აგრძელებს და
    გეგმას საზღვრებს უფართოებს. მიჯნის წერტილი ინტერპოლაციით ჯდება."""
    west, south, east, north = AREA

    def inside(p):
        return west <= p[0] <= east and south <= p[1] <= north

    def cut(a, b):
        lo, hi = 0.0, 1.0
        for _ in range(40):
            mid = (lo + hi) / 2
            point = (a[0] + (b[0] - a[0]) * mid, a[1] + (b[1] - a[1]) * mid)
            if inside(point):
                lo = mid
            else:
                hi = mid
        return [round(a[0] + (b[0] - a[0]) * lo, COORD_PRECISION),
                round(a[1] + (b[1] - a[1]) * lo, COORD_PRECISION)]

    pieces, current = [], []
    for i, point in enumerate(line):
        if inside(point):
            if not current and i:
                current.append(cut(point, line[i - 1]))
            current.append(point)
        else:
            if current:
                current.append(cut(line[i - 1], point))
                pieces.append(current)
                current = []
    if current:
        pieces.append(current)
    return [p for p in pieces if len(p) >= 2]


def street_lines(name):
    u"""ერთი ქუჩის ხაზები lon/lat-ში. ორ გავლად: ჯერ ვპოულობთ, სად არის,
    მერე მხოლოდ იმ ჩარჩოს ვხატავთ სამიზნე გარჩევადობით."""
    area = merc(AREA[0], AREA[1]) + merc(AREA[2], AREA[3])
    coarse, height = render(area, 1600, name)
    rows, cols = np.nonzero(coarse)
    if not len(cols):
        return [], 0.0

    x0, y0, x1, y1 = area
    step_x = (x1 - x0) / 1599.0
    step_y = (y1 - y0) / (height - 1.0)
    pad = 20
    fx0 = x0 + (cols.min() - pad) * step_x
    fx1 = x0 + (cols.max() + pad) * step_x
    fy1 = y1 - (rows.min() - pad) * step_y
    fy0 = y1 - (rows.max() + pad) * step_y

    span = (fx1 - fx0) * math.cos(math.radians(LAT_MID))
    ratio = (fy1 - fy0) / (fx1 - fx0)
    width = min(int(span / TARGET_MPP), MAX_SIDE,
                int(MAX_SIDE / ratio) if ratio > 1 else MAX_SIDE,
                int(math.sqrt(MAX_PIXELS / ratio)))
    width = max(width, 400)
    fine, fine_height = render((fx0, fy0, fx1, fy1), width, name)
    mpp = span / width

    lines = []
    for path in stitch(trace(fine)):
        simple = rdp([(float(col), float(row)) for row, col in path], SIMPLIFY_M / mpp)
        lines.extend(clip([[round(v, COORD_PRECISION) for v in unmerc(
            fx0 + col * (fx1 - fx0) / (width - 1.0),
            fy1 - row * (fy1 - fy0) / (fine_height - 1.0))] for col, row in simple]))
    return lines, mpp


def build(dry_run=False):
    features = []
    for name in STREETS:
        lines, mpp = street_lines(name)
        if not lines:
            sys.stderr.write(u'%s — რეესტრში ვერ მოიძებნა\n' % name)
            continue
        length = sum(metres(line[i], line[i + 1])
                     for line in lines for i in range(len(line) - 1))
        sys.stderr.write(u'%-24s %d ხაზი · %3d წვერო · %4.0f მ · %.2f მ/px\n'
                         % (name, len(lines), sum(len(l) for l in lines), length, mpp))
        geometry = ({u'type': u'LineString', u'coordinates': lines[0]} if len(lines) == 1
                    else {u'type': u'MultiLineString', u'coordinates': lines})
        features.append({
            u'type': u'Feature',
            u'properties': {u'name': name,
                            u'class': CLASS.get(name, DEFAULT_CLASS),
                            u'name_src': u'napr',
                            u'length_m': round(length)},
            u'geometry': geometry,
        })

    collection = {u'type': u'FeatureCollection',
                  u'attribution': ATTRIBUTION,
                  u'features': features}
    if dry_run:
        sys.stderr.write(u'--dry-run — ფაილი არ ჩაწერილა\n')
        return collection

    with io.open(OUT, u'w', encoding=u'utf-8') as handle:
        handle.write(json.dumps(collection, ensure_ascii=False))
    sys.stderr.write(u'-> %s (%d ქუჩა)\n'
                     % (os.path.relpath(OUT, ROOT), len(features)))
    return collection


if __name__ == u'__main__':
    build(dry_run=u'--dry-run' in sys.argv)
