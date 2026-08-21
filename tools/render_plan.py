# -*- coding: utf-8 -*-
u"""data/plan.geojson -> data/plan.svg — უბნის ნახაზი საარქიტექტორო სტილში.

გაშვება:  python3 tools/render_plan.py

შედეგი სტატიკური ფაილია, გვერდზე `<img>`-ით ჩაისმება. ბრაუზერში ხატვის
მოდული განზრახ არ არსებობს: ნახაზი გაფორმებაა, არა ინსტრუმენტი.
"""
import io
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, u'data', u'plan.geojson')
OUT = os.path.join(ROOT, u'data', u'plan.svg')

WIDTH = 1000.0      # ნახაზის სიგანე user unit-ებში
PADDING = 0.05      # ველი კიდეებზე, სიგანის წილად

PAPER = u'#f7f4ec'
INK = u'#1c1b18'
HAIRLINE = u'#a9a293'
BUILDING = u'#33302a'
ACCENT = u'#b4552d'

# გზის სისქე კლასის მიხედვით; დანარჩენს DEFAULT
ROAD_WIDTH = {u'secondary': 10, u'tertiary': 8, u'residential': 7,
              u'service': 5, u'track': 3, u'footway': 3, u'path': 3,
              u'steps': 3}
ROAD_WIDTH_DEFAULT = 5
DASHED = (u'track', u'footway', u'path', u'steps')

ADDRESS_FONT = 11
STREET_FONT = 12
MIN_STREET_PATH = 130   # ამაზე მოკლე გზაზე სახელი არ დაეტევა


def project(lon, lat):
    u"""Web Mercator ერთეულოვან კვადრატში, y ქვევით (SVG-ის მიმართულება).

    უბრალო lon/lat არ გამოდგება: 41.7° განედზე გრძედის გრადუსი განედისაზე
    ~25%-ით მოკლეა და ნახაზი გაბრტყელებული გამოვიდოდა.
    """
    rad = math.radians(lat)
    return ((lon + 180.0) / 360.0,
            (1.0 - math.log(math.tan(rad) + 1.0 / math.cos(rad)) / math.pi) / 2.0)


def flatten(geometry):
    out = []

    def walk(node):
        if isinstance(node[0], (int, float)):
            out.append((node[0], node[1]))
        else:
            for item in node:
                walk(item)

    if geometry and geometry.get(u'coordinates'):
        walk(geometry[u'coordinates'])
    return out


def make_projector(points):
    u"""ჩარჩო ნაკვეთებზე ეწყობა — OSM-ის გზები bbox-ის კიდემდე გრძელდება
    და მათზე მორგება უბანს შუაში პატარა ლაქად დატოვებდა. ზედმეტი გეომეტრია
    viewBox-ს გარეთ იჭრება, და ეს განზრახაა: ნახაზი კიდეებზე „გამოდის"."""
    xs, ys = [], []
    for lon, lat in points:
        x, y = project(lon, lat)
        xs.append(x)
        ys.append(y)
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    span_x = (max_x - min_x) or 1e-9
    span_y = (max_y - min_y) or 1e-9
    scale = WIDTH / span_x
    pad = WIDTH * PADDING

    def to_xy(lon, lat):
        x, y = project(lon, lat)
        return ((x - min_x) * scale + pad, (y - min_y) * scale + pad)

    return to_xy, WIDTH + pad * 2, span_y * scale + pad * 2


def ring_centroid_xy(ring):
    u"""ფართობით შეწონილი ცენტროიდი — მისამართის წარწერის საყრდენი."""
    points = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring
    count = len(points)
    if not count:
        return (0.0, 0.0)
    area = cx = cy = 0.0
    for i in range(count):
        ax, ay = points[i]
        bx, by = points[(i + 1) % count]
        cross = ax * by - bx * ay
        area += cross
        cx += (ax + bx) * cross
        cy += (ay + by) * cross
    if abs(area) < 1e-12:
        return (sum(p[0] for p in points) / count,
                sum(p[1] for p in points) / count)
    area *= 0.5
    return (cx / (6.0 * area), cy / (6.0 * area))


def path_of(points, close):
    parts = []
    for index, (x, y) in enumerate(points):
        parts.append(u'%s%.1f %.1f' % (u'M' if index == 0 else u'L', x, y))
    return u' '.join(parts) + (u' Z' if close else u'')


def line_length(points):
    return sum(math.hypot(points[i][0] - points[i - 1][0],
                          points[i][1] - points[i - 1][1])
               for i in range(1, len(points)))


def escape(text):
    return (text.replace(u'&', u'&amp;').replace(u'<', u'&lt;')
            .replace(u'>', u'&gt;'))


def main():
    with io.open(SRC, encoding='utf-8') as handle:
        data = json.load(handle)

    features = data[u'features']
    by_layer = {u'plot': [], u'building': [], u'road': []}
    for feature in features:
        layer = feature[u'properties'].get(u'layer')
        if layer in by_layer:
            by_layer[layer].append(feature)

    frame = []
    for feature in by_layer[u'plot']:
        frame.extend(flatten(feature[u'geometry']))
    to_xy, width, height = make_projector(frame)

    defs, roads_casing, roads_fill = [], [], []
    plots, buildings, addresses, streets = [], [], [], []

    for index, feature in enumerate(by_layer[u'road']):
        points = [to_xy(lon, lat) for lon, lat in
                  feature[u'geometry'][u'coordinates']]
        if len(points) < 2:
            continue
        road_class = feature[u'properties'].get(u'class') or u''
        stroke = ROAD_WIDTH.get(road_class, ROAD_WIDTH_DEFAULT)
        dash = u' stroke-dasharray="7 5"' if road_class in DASHED else u''
        d = path_of(points, False)
        roads_casing.append(
            u'<path d="%s" stroke="%s" stroke-width="%.1f"%s/>'
            % (d, HAIRLINE, stroke + 1.6, dash))
        roads_fill.append(
            u'<path d="%s" stroke="%s" stroke-width="%.1f"%s/>'
            % (d, PAPER, stroke, dash))

        name = feature[u'properties'].get(u'name') or u''
        if name and line_length(points) >= MIN_STREET_PATH:
            # textPath ტექსტს ხაზის მიმართულებით წერს — მარჯვნიდან
            # მარცხნივ მიმავალ გზაზე თავდაყირა გამოვიდოდა
            ordered = points[::-1] if points[-1][0] < points[0][0] else points
            ident = u'r%d' % index
            defs.append(u'<path id="%s" d="%s"/>' % (ident, path_of(ordered, False)))
            streets.append(
                u'<text dy="-4"><textPath href="#%s" startOffset="50%%" '
                u'text-anchor="middle">%s</textPath></text>'
                % (ident, escape(name)))

    for feature in by_layer[u'plot']:
        rings = feature[u'geometry'][u'coordinates']
        xy_rings = [[to_xy(lon, lat) for lon, lat in ring] for ring in rings]
        if not xy_rings or not xy_rings[0]:
            continue
        plots.append(u'<path d="%s"/>'
                     % u' '.join(path_of(r, True) for r in xy_rings))
        number = (feature[u'properties'].get(u'adr_num') or u'').strip()
        if number:
            cx, cy = ring_centroid_xy(xy_rings[0])
            addresses.append(u'<text x="%.1f" y="%.1f">%s</text>'
                             % (cx, cy, escape(number)))

    for feature in by_layer[u'building']:
        rings = feature[u'geometry'][u'coordinates']
        xy_rings = [[to_xy(lon, lat) for lon, lat in ring] for ring in rings]
        if xy_rings and xy_rings[0]:
            buildings.append(u'<path d="%s"/>'
                             % u' '.join(path_of(r, True) for r in xy_rings))

    svg = u'''<svg xmlns="http://www.w3.org/2000/svg" \
xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 %.1f %.1f" \
width="%.0f" height="%.0f" role="img">
<title>ლისი ველი — უბნის გეგმა</title>
<desc>რვა ქუჩა, 66 საკადასტრო ნაკვეთი ნაგებობების კონტურებით და მისამართებით.</desc>
<style>
  text { font-family: "Noto Sans Georgian", "DejaVu Sans", sans-serif; fill: %s; }
  /* ნომერი ხშირად შენობის მუქ ლაქაზე ხვდება — ქაღალდისფერი შარავანდი
     ტექსტის ქვეშ ისე კითხვადს ხდის, რომ წარწერის გადატანა არ სჭირდება */
  .adr, .str { paint-order: stroke; stroke: %s; stroke-width: 3px;
               stroke-linejoin: round; }
  .adr { font-size: %dpx; text-anchor: middle; dominant-baseline: central; }
  .str { font-size: %dpx; letter-spacing: .07em; }
</style>
<defs>%s</defs>
<rect width="100%%" height="100%%" fill="%s"/>
<g fill="none" stroke-linecap="round" stroke-linejoin="round">%s</g>
<g fill="none" stroke-linecap="round" stroke-linejoin="round">%s</g>
<g fill="none" stroke="%s" stroke-width="0.8">%s</g>
<g fill="%s">%s</g>
<g class="adr">%s</g>
<g class="str">%s</g>
<rect x="0.5" y="0.5" width="%.1f" height="%.1f" fill="none" \
stroke="%s" stroke-width="1"/>
</svg>
''' % (width, height, width, height,
       INK, PAPER, ADDRESS_FONT, STREET_FONT,
       u''.join(defs), PAPER,
       u''.join(roads_casing), u''.join(roads_fill),
       HAIRLINE, u''.join(plots),
       BUILDING, u''.join(buildings),
       u''.join(addresses), u''.join(streets),
       width - 1, height - 1, ACCENT)

    with io.open(OUT, 'w', encoding='utf-8') as handle:
        handle.write(svg)

    print(u'ჩაიწერა %s' % OUT)
    print(u'  %d ნაკვეთი, %d შენობა, %d გზა' % (
        len(plots), len(buildings), len(roads_fill)))
    print(u'  %d მისამართის წარწერა, %d ქუჩის სახელი' % (
        len(addresses), len(streets)))
    print(u'  %.0f×%.0f, %.0f KB' % (width, height,
                                     os.path.getsize(OUT) / 1024.0))


if __name__ == '__main__':
    main()
