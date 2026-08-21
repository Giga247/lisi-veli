# -*- coding: utf-8 -*-
u"""სუფთა გეომეტრია გეგმისთვის — ქსელს და ფაილებს არ ეხება, ამიტომ იტესტება.

მანძილები ლოკალურ ბრტყელ მიახლოებაშია: ამ განედზე (41.7°) და ამ მასშტაბზე
(უბანი ~350 მ) დედამიწის სიმრუდე სანტიმეტრებს ცვლის, ჩვენ კი ათეულ მეტრზე
ვმსჯელობთ.
"""
import math

M_PER_DEG_LAT = 111320.0


def meters_per_deg_lon(lat):
    u"""გრძედის ერთი გრადუსი მეტრებში მოცემულ განედზე."""
    return M_PER_DEG_LAT * math.cos(math.radians(lat))


def ring_centroid(ring):
    u"""[[lon, lat], ...] -> (lon, lat), ფართობით შეწონილი.

    გადაგვარებულ (ნულოვანფართობიან) რგოლზე წვეროების საშუალოს აბრუნებს —
    სხვაგვარად ნულზე გაყოფა მოხდებოდა.
    """
    points = list(ring)
    if len(points) > 1 and points[0] == points[-1]:
        points = points[:-1]
    if not points:
        return (0.0, 0.0)

    area = 0.0
    cx = 0.0
    cy = 0.0
    count = len(points)
    for i in range(count):
        ax, ay = points[i][0], points[i][1]
        bx, by = points[(i + 1) % count][0], points[(i + 1) % count][1]
        cross = ax * by - bx * ay
        area += cross
        cx += (ax + bx) * cross
        cy += (ay + by) * cross

    if abs(area) < 1e-14:
        return (sum(p[0] for p in points) / count,
                sum(p[1] for p in points) / count)

    area *= 0.5
    return (cx / (6.0 * area), cy / (6.0 * area))


def _to_meters(point, origin, lat0):
    u"""[lon, lat] -> (x, y) მეტრებში, origin-ის მიმართ."""
    return ((point[0] - origin[0]) * meters_per_deg_lon(lat0),
            (point[1] - origin[1]) * M_PER_DEG_LAT)


def point_segment_distance_m(p, a, b, lat0):
    u"""წერტილიდან [a, b] მონაკვეთამდე უმოკლესი მანძილი, მეტრებში."""
    px, py = _to_meters(p, a, lat0)
    bx, by = _to_meters(b, a, lat0)
    seg_sq = bx * bx + by * by
    if seg_sq == 0.0:
        return math.hypot(px, py)
    t = (px * bx + py * by) / seg_sq
    t = max(0.0, min(1.0, t))
    return math.hypot(px - t * bx, py - t * by)


def distance_point_to_line_m(p, coords, lat0):
    u"""წერტილიდან მტეხილ ხაზამდე უმოკლესი მანძილი, მეტრებში."""
    if not coords:
        return float('inf')
    if len(coords) == 1:
        return point_segment_distance_m(p, coords[0], coords[0], lat0)
    return min(point_segment_distance_m(p, coords[i], coords[i + 1], lat0)
               for i in range(len(coords) - 1))


def assign_street_names(roads, plots, radius_m=40.0, min_votes=3, min_share=0.6):
    u"""გზებს ქუჩის სახელს აწერს ახლომდებარე ნაკვეთების ხმებით.

    OSM-ის საკუთარი სახელი ყოველთვის იმარჯვებს (`name_src='osm'`).
    დანარჩენებზე: `radius_m`-ში მოხვედრილი ნაკვეთები ხმას აძლევენ თავიანთ
    `street`-ს; გამარჯვებულს სჭირდება `min_votes` ხმა **და** ხმების
    `min_share` წილი. ვერ გადალახა — გზა უსახელო რჩება.

    მცდარი ქუჩის სახელი ნახაზზე უარესია, ვიდრე ცარიელი გზა: მეზობელი მას
    ენდობა. ამიტომ ზღვარი მკაცრია და ეჭვის შემთხვევაში არაფერი იწერება.

    შემომავალ სიას არ ცვლის — ახალ სიას აბრუნებს.
    """
    voters = []
    for plot in plots:
        street = (plot.get(u'street') or u'').strip()
        ring = plot.get(u'ring') or []
        if street and ring:
            voters.append((ring_centroid(ring), street))

    lat0 = (sum(c[1] for c, _ in voters) / len(voters)) if voters else 41.745

    result = []
    for source in roads:
        road = dict(source)
        name = (road.get(u'name') or u'').strip()
        if name:
            road[u'name'] = name
            road[u'name_src'] = u'osm'
            result.append(road)
            continue

        votes = {}
        for centroid, street in voters:
            if distance_point_to_line_m(centroid, road.get(u'coords') or [],
                                        lat0) <= radius_m:
                votes[street] = votes.get(street, 0) + 1

        road[u'name'] = u''
        road[u'name_src'] = u''
        total = sum(votes.values())
        if total:
            # ხმების რაოდენობით, ტოლობისას სახელით — რომ შედეგი
            # გაშვებიდან გაშვებამდე ერთი და იგივე იყოს
            best, count = sorted(votes.items(),
                                 key=lambda kv: (-kv[1], kv[0]))[0]
            if count >= min_votes and count >= min_share * total:
                road[u'name'] = best
                road[u'name_src'] = u'დაშვებული'
        result.append(road)

    return result
