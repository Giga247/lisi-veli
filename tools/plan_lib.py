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


def densify(coords, step_m, lat0):
    u"""მტეხილ ხაზს თანაბარი ბიჯით ავსებს — გრძელი მონაკვეთი მოკლეს
    ტოლფასი რომ არ იყოს გადაფარვის დათვლისას."""
    if len(coords) < 2:
        return list(coords)
    lon_m = meters_per_deg_lon(lat0)
    points = []
    for i in range(len(coords) - 1):
        a, b = coords[i], coords[i + 1]
        span = math.hypot((b[0] - a[0]) * lon_m, (b[1] - a[1]) * M_PER_DEG_LAT)
        steps = max(1, int(span / step_m))
        for k in range(steps):
            points.append([a[0] + (b[0] - a[0]) * k / steps,
                           a[1] + (b[1] - a[1]) * k / steps])
    points.append(list(coords[-1]))
    return points


def overlap_share(coords, lines, lat0, tol_m=6.0, step_m=4.0):
    u"""ხაზის რა წილი მიუყვება `lines`-იდან რომელიმეს `tol_m`-ის ფარგლებში.

    ორივე მხრიდან სინჯვა საჭირო არაა: გვაინტერესებს, ჩვენი გზა სრულად
    ხომ არ დევს რეესტრის ქუჩაზე — ანუ დუბლიკატი ხომ არაა.
    """
    if not lines:
        return 0.0
    points = densify(coords, step_m, lat0)
    if not points:
        return 0.0
    hits = sum(1 for p in points
               if min(distance_point_to_line_m(p, line, lat0)
                      for line in lines) <= tol_m)
    return hits / float(len(points))
