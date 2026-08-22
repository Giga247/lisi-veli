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
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / 'data' / 'plan-page.json'
OUT = ROOT / 'assets' / 'plan-backdrop.svg'

# ქუჩების ფერები — `css/plan.css`-ის მუქი თემის პალიტრა. ფონი მუქია
# ორივე თემაზე (ზემოდან ბნელი ფარდაა), ამიტომ ერთი ნაკრები კმარა.
STREET = ['#3987e5', '#d95926', '#199e70', '#c98500',
          '#d55181', '#008300', '#9085e9', '#e66767']
ROAD = '#39444d'
EDGE = '#ffffff'


def r(value):
    """ორი ნიშანი მძიმის შემდეგ — float-ის კუდი ფაილს უაზროდ აწონებდა."""
    return ('%.2f' % value).rstrip('0').rstrip('.')


def road_width(cls):
    if cls == 'secondary':
        return 7
    if cls == 'residential':
        return 5
    return 3.4


NUM = re.compile(r'-?\d+(?:\.\d+)?')


def frame(parcels, pad=0.10):
    """ჩარჩო თვითონ ნაკვეთებზე.

    `bbox` მთელ ჩამოტვირთულ არეს მოიცავს — გზებსაც, მდინარესაც, ცარიელ
    მინდვრებსაც. ფონად აღებული, უბანი მასში პატარა ლაქად რჩებოდა ეკრანის
    კუთხეში. ვითვლით მხოლოდ იმ ნაკვეთებს, რომლებსაც ქუჩა აქვთ: უქუჩო
    დიდი ნაკვეთი (მდინარისპირა ზოლი) ჩარჩოს ისევ განზე სწევდა.
    """
    xs, ys = [], []
    for parcel in parcels:
        if parcel.get('si', -1) < 0:
            continue
        nums = [float(n) for n in NUM.findall(parcel['d'])]
        xs.extend(nums[0::2])
        ys.extend(nums[1::2])
    if not xs:
        return None
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    mx, my = (x1 - x0) * pad, (y1 - y0) * pad
    return x0 - mx, y0 - my, (x1 - x0) + mx * 2, (y1 - y0) + my * 2


def main():
    data = json.loads(DATA.read_text(encoding='utf-8'))
    x, y, w, h = frame(data['parcels']) or data['bbox']

    out = [
        '<svg xmlns="http://www.w3.org/2000/svg" '
        # `preserveAspectRatio` განზრახ არ იწერება: ნაგულისხმევი `meet`
        # ფაილს ბუნებრივ პროპორციას აძლევს და მოჭრას CSS-ის `cover`
        # წყვეტს. ორივეგან `slice` ნახაზს ორჯერ აახლოებდა და ეკრანზე
        # მხოლოდ რამდენიმე ნაკვეთი რჩებოდა.
        'viewBox="%s %s %s %s" role="presentation">'
        % (r(x), r(y), r(w), r(h)),
        '<g fill="none" stroke="%s" stroke-linecap="round" '
        'stroke-linejoin="round">' % ROAD,
    ]
    for road in data['roads']:
        out.append('<path d="%s" stroke-width="%s"/>'
                   % (road['d'], road_width(road.get('cls'))))
    out.append('</g>')

    # გამჭვირვალობა დაბალია განზრახ: ეს ფონია და არა რუკა — სრული
    # ფერით ნაკვეთები შესვლის ღილაკს ეცილებოდნენ ყურადღებაში.
    out.append('<g stroke="%s" stroke-width="1.1" stroke-opacity=".13">' % EDGE)
    for parcel in data['parcels']:
        si = parcel.get('si', -1)
        fill = STREET[si % len(STREET)] if si is not None and si >= 0 else ROAD
        out.append('<path d="%s" fill="%s" fill-opacity=".32"/>'
                   % (parcel['d'], fill))
    out.append('</g></svg>')

    OUT.write_text('\n'.join(out), encoding='utf-8')
    print('%s — %d ნაკვეთი, %d გზა, %.1f კბ'
          % (OUT.relative_to(ROOT), len(data['parcels']), len(data['roads']),
             OUT.stat().st_size / 1024))


if __name__ == '__main__':
    main()
