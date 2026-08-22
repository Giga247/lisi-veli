#!/usr/bin/env python3
"""შესვლის ეკრანის ფონი — სტატიკური SVG უბნის გეგმიდან.

გვერდზე ცოცხალი `PlanView` იდგა და ის ინტერაქტიული იყო: ღილაკები,
ლეგენდა, ზუმი, ნაკვეთის არჩევა. შესვლამდე ეს ყველაფერი ზედმეტია —
ნახაზი იქ ფაქტურაა და არა ხელსაწყო.

ფაილი ერთხელ იგება და `background-image`-ად ეყრება. ასეთი სურათი
თავისთავად მკვდარია: არც კლიკი აქვს, არც ფოკუსი, არც JavaScript.

PNG-ის ნაცვლად SVG: იგივე ერთი ფაილია, მაგრამ ხუთჯერ მსუბუქი და
ნებისმიერ ეკრანზე მკვეთრი. ნომრები და ქუჩების წარწერები არ გადმოდის —
ჩამქრალ ფონზე ისინი მხოლოდ ხმაური იყო.

გაშვება:  python3 tools/make_backdrop.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / 'data' / 'plan-page.json'
OUT = ROOT / 'assets' / 'plan-backdrop.svg'

# ქუჩების ფერები — `css/plan.css`-ის მუქი თემის პალიტრა. ფონი მუქია
# ორივე თემაზე (ზემოდან ბნელი ფარდაა), ამიტომ ერთი ნაკრები კმარა.
STREET = ['#3987e5', '#d95926', '#199e70', '#c98500',
          '#d55181', '#008300', '#9085e9', '#e66767']
ROAD = '#39444d'
EDGE = '#ffffff'


def road_width(cls):
    if cls == 'secondary':
        return 7
    if cls == 'residential':
        return 5
    return 3.4


def main():
    data = json.loads(DATA.read_text(encoding='utf-8'))
    x, y, w, h = data['bbox']

    out = [
        '<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="{x} {y} {w} {h}" preserveAspectRatio="xMidYMid slice" '
        'role="presentation">',
        '<g fill="none" stroke="%s" stroke-linecap="round" '
        'stroke-linejoin="round">' % ROAD,
    ]
    for road in data['roads']:
        out.append('<path d="%s" stroke-width="%s"/>'
                   % (road['d'], road_width(road.get('cls'))))
    out.append('</g>')

    out.append('<g stroke="%s" stroke-width="1.1" stroke-opacity=".22">' % EDGE)
    for parcel in data['parcels']:
        si = parcel.get('si', -1)
        fill = STREET[si % len(STREET)] if si is not None and si >= 0 else ROAD
        out.append('<path d="%s" fill="%s" fill-opacity=".55"/>'
                   % (parcel['d'], fill))
    out.append('</g></svg>')

    OUT.write_text('\n'.join(out), encoding='utf-8')
    print('%s — %d ნაკვეთი, %d გზა, %.1f კბ'
          % (OUT.relative_to(ROOT), len(data['parcels']), len(data['roads']),
             OUT.stat().st_size / 1024))


if __name__ == '__main__':
    main()
