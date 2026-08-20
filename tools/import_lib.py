# -*- coding: utf-8 -*-
"""სუფთა ფუნქციები იმპორტისთვის — ფაილებს არ ეხება, ამიტომ იტესტება."""
import json


def split_name(full):
    u"""'გვარი სახელი' -> (გვარი, სახელი). პირველი სიტყვა გვარია."""
    if not full:
        return (u'', u'')
    parts = str(full).split()
    if not parts:
        return (u'', u'')
    if len(parts) == 1:
        return (parts[0], u'')
    return (parts[0], u' '.join(parts[1:]))


def dedupe_by_cad(rows):
    u"""[{cad:..}] -> ({cad: row}, [გამეორებული კოდები]).

    პირველი ჩანაწერი რჩება. ცარიელი კოდი გამოირიცხება.
    """
    out = {}
    dups = []
    for row in rows:
        cad = (row.get(u'cad') or u'').strip()
        if not cad:
            continue
        if cad in out:
            if cad not in dups:
                dups.append(cad)
            continue
        out[cad] = row
    return (out, dups)


def geometry_string(feature):
    u"""GeoJSON Feature -> coordinates-ის კომპაქტური JSON სტრიქონი.

    ინახება მხოლოდ coordinates, არა სრული Feature — უჯრაში ადგილის
    დასაზოგად. Polygon-ის გარდა ყველა ტიპი იგნორირდება.
    """
    if not feature:
        return u''
    geom = feature.get(u'geometry') or {}
    if geom.get(u'type') != u'Polygon':
        return u''
    coords = geom.get(u'coordinates')
    if not coords:
        return u''
    return json.dumps(coords, separators=(u',', u':'))


def index_features_by_cad(features):
    u"""[GeoJSON Feature] -> ({cad: feature}, [გამეორებული კოდები], კოდის_გარეშე_რაოდენობა).

    პირველი feature რჩება. properties ან cad-ის არმქონე feature გამოირიცხება
    ინდექსიდან და ითვლება, მაგრამ არ ისროლება შეცდომა.
    """
    out = {}
    dups = []
    missing = 0
    for feature in features:
        props = (feature or {}).get(u'properties') or {}
        cad = (props.get(u'cad') or u'').strip()
        if not cad:
            missing += 1
            continue
        if cad in out:
            if cad not in dups:
                dups.append(cad)
            continue
        out[cad] = feature
    return (out, dups, missing)
