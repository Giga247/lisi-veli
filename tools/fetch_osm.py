# -*- coding: utf-8 -*-
u"""ერთჯერადი მოქაჩვა: OSM + ჩვენი ნაკვეთები -> data/plan.geojson.

გაშვება:  python3 tools/fetch_osm.py
დათვლა:   python3 tools/fetch_osm.py --dry-run

შედეგი რეპოში იკომიტება — ეს სნეპშოტია, არა ცოცხალი წყარო. განახლება
ნიშნავს ამ სკრიპტის ხელახლა გაშვებას.
"""
import io
import json
import os
import sys
import time

try:
    from urllib.request import urlopen, Request
    from urllib.parse import urlencode
    from urllib.error import HTTPError, URLError
except ImportError:  # Python 2
    from urllib2 import urlopen, Request, HTTPError, URLError
    from urllib import urlencode

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plan_lib import assign_street_names

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLOTS_GEOJSON = os.path.join(ROOT, u'კედრის_ქუჩა_ნაკვეთები.geojson')
OUT_DIR = os.path.join(ROOT, u'data')
OUT = os.path.join(OUT_DIR, u'plan.geojson')

OVERPASS = u'https://overpass-api.de/api/interpreter'
BBOX = (41.7430, 44.7165, 41.7480, 44.7225)  # S, W, N, E

# არარსებული გზები — ნახაზზე ტყუილი იქნებოდა
SKIP_ROAD_CLASSES = {u'construction', u'proposed'}

# თეთრი სია: მხოლოდ ეს ველები ხვდება საჯარო ფაილში. შავი სია აქ
# საშიში იქნებოდა — Sheet-ს ხვალ ახალი სვეტი დაემატება და ჩუმად გაჟონავს.
PLOT_FIELDS = (u'cad', u'adr_num', u'street', u'area')

COORD_PRECISION = 6  # ~0.1 მ — ფაილს ამცირებს, ნახაზზე უხილავია


def query():
    south, west, north, east = BBOX
    box = u'%s,%s,%s,%s' % (south, west, north, east)
    return (u'[out:json][timeout:100];('
            u'way["building"](%s);'
            u'way["highway"](%s);'
            u');out geom;' % (box, box))


def _request(url, data=None):
    request = Request(url, data=data,
                      headers={u'User-Agent': u'lisi-veli-plan/1.0'})
    response = urlopen(request, timeout=180)
    body = response.read().decode(u'utf-8')
    return json.loads(body)


def fetch_osm():
    u"""Overpass-ს პასუხს ითხოვს. POST ხანდახან უარყოფილია (rate-limit) —
    ამ შემთხვევაში სცადე ხელახლა, და თუ მაინც არ გამოვიდა, გადადი GET-ზე
    შეკითხვით URL-ში."""
    q = query()
    post_data = urlencode({u'data': q}).encode(u'utf-8')

    last_error = None
    for attempt in range(2):
        try:
            return _request(OVERPASS, data=post_data)
        except (HTTPError, URLError, ValueError) as exc:
            last_error = exc
            sys.stderr.write(u'POST მცდელობა %d ვერ შესრულდა: %s\n'
                             % (attempt + 1, exc))
            time.sleep(2)

    sys.stderr.write(u'POST ვერ შესრულდა, ვცდი GET-ს...\n')
    get_url = OVERPASS + u'?' + urlencode({u'data': q})
    try:
        return _request(get_url)
    except (HTTPError, URLError, ValueError) as exc:
        raise RuntimeError(u'Overpass-იდან წაკითხვა ვერ მოხერხდა: %s '
                           u'(ბოლო POST შეცდომა: %s)' % (exc, last_error))


def round_point(lon, lat):
    return [round(lon, COORD_PRECISION), round(lat, COORD_PRECISION)]


def load_plots():
    with io.open(PLOTS_GEOJSON, encoding='utf-8') as handle:
        source = json.load(handle)
    plots = []
    for feature in source[u'features']:
        properties = feature.get(u'properties') or {}
        geometry = feature.get(u'geometry') or {}
        if geometry.get(u'type') != u'Polygon':
            continue
        plots.append({
            u'props': dict((key, properties.get(key, u''))
                           for key in PLOT_FIELDS),
            u'rings': geometry[u'coordinates'],
        })
    return plots


def split_osm(elements):
    buildings = []
    roads = []
    for element in elements:
        tags = element.get(u'tags') or {}
        geometry = element.get(u'geometry') or []
        if len(geometry) < 2:
            continue
        points = [round_point(node[u'lon'], node[u'lat']) for node in geometry]

        if u'building' in tags:
            if points[0] != points[-1]:
                points.append(points[0])
            if len(points) < 4:
                continue
            buildings.append({u'osm_id': element[u'id'], u'ring': points})
        elif u'highway' in tags:
            road_class = tags[u'highway']
            if road_class in SKIP_ROAD_CLASSES:
                continue
            roads.append({u'osm_id': element[u'id'],
                          u'name': tags.get(u'name', u''),
                          u'class': road_class,
                          u'coords': points})
    return buildings, roads


def feature(layer, properties, geometry_type, coordinates):
    props = {u'layer': layer}
    props.update(properties)
    return {u'type': u'Feature', u'properties': props,
            u'geometry': {u'type': geometry_type, u'coordinates': coordinates}}


def build(plots, buildings, roads):
    features = []
    for plot in plots:
        features.append(feature(u'plot', plot[u'props'], u'Polygon',
                                plot[u'rings']))
    for item in buildings:
        features.append(feature(u'building', {u'osm_id': item[u'osm_id']},
                                u'Polygon', [item[u'ring']]))
    for road in roads:
        features.append(feature(u'road', {
            u'osm_id': road[u'osm_id'], u'name': road[u'name'],
            u'name_src': road[u'name_src'], u'class': road[u'class'],
        }, u'LineString', road[u'coords']))
    return {u'type': u'FeatureCollection',
            u'attribution': u'გზები და ნაგებობები: © OpenStreetMap-ის '
                            u'მონაწილეები (ODbL)',
            u'features': features}


def main():
    dry_run = u'--dry-run' in sys.argv
    # 40 მ სცადეს დროებით — ამ მჭიდრო უბანში ერთ სახელს რამდენიმე
    # ცალკეულ service-გზაზე აწერდა ("კედრის I გასასვლელი" x3 დამატებით
    # საკუთარ osm-ტეგიან სეგმენტს). 25 მ სუფთა 1:1 შესატყვისობას იძლევა.
    radius_m = 25.0
    for arg in sys.argv[1:]:
        if arg.startswith(u'--radius='):
            radius_m = float(arg.split(u'=', 1)[1])

    plots = load_plots()
    print(u'ნაკვეთი: %d' % len(plots))

    osm = fetch_osm()
    buildings, roads = split_osm(osm.get(u'elements') or [])
    print(u'შენობა: %d' % len(buildings))
    print(u'გზა: %d' % len(roads))

    vote_plots = [{u'cad': p[u'props'][u'cad'],
                   u'street': p[u'props'][u'street'],
                   u'ring': p[u'rings'][0]} for p in plots]
    roads = assign_street_names(roads, vote_plots, radius_m=radius_m)

    named = [r for r in roads if r[u'name']]
    print(u'\nსახელიანი გზა (radius_m=%s): %d / %d' % (radius_m, len(named), len(roads)))
    for road in named:
        print(u'  %-10s %s  (%s)' % (road[u'class'], road[u'name'],
                                     road[u'name_src']))

    if dry_run:
        print(u'\n--dry-run — ფაილი არ ჩაწერილა')
        return

    if not os.path.isdir(OUT_DIR):
        os.makedirs(OUT_DIR)
    collection = build(plots, buildings, roads)
    with io.open(OUT, 'w', encoding='utf-8') as handle:
        handle.write(json.dumps(collection, ensure_ascii=False,
                                separators=(u',', u':')))
    size_kb = os.path.getsize(OUT) / 1024.0
    print(u'\nჩაიწერა %s — %d ობიექტი, %.0f KB'
          % (OUT, len(collection[u'features']), size_kb))


if __name__ == '__main__':
    main()
