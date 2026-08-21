/**
 * ფრონტენდის სუფთა ლოგიკა — DOM-ს არ ეხება.
 * ბრაუზერში ხდება გლობალური `WebLib`, Node-ში იტესტება require-ით.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.WebLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  /**
   * HTML-ში ჩასასმელი ტექსტის escape.
   *
   * მონაცემები Sheet-იდან მოდის, ხელით ივსება და შეიძლება შეიცავდეს
   * ნებისმიერ სიმბოლოს — escape-ის გარეშე შენიშვნა ან მისამართი მარკაპს
   * გატეხს, ან attribute-იდან გამოაპარებს (შენახული injection).
   *
   * `&` ყოველთვის პირველი იცვლება: სხვა რიგში უკვე ჩასმული `&lt;`
   * მეორედ დამუშავდებოდა და `&amp;lt;`-ად გადაიქცეოდა.
   *
   * `'` -> `&#39;` დღეს ზედმეტია (ყველა attribute ორმაგ ბრჭყალშია), მაგრამ
   * ის ხსნის დამოკიდებულებას იმაზე, რომ ეს ასე დარჩება.
   */
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fullName(plot) {
    const name = [plot.last_name, plot.first_name]
      .filter(function (part) { return part && String(part).trim(); })
      .join(' ')
      .trim();
    return name || '—';
  }

  /** რუკაზე როგორ გამოჩნდება: პოლიგონით, მარკერით, ან არანაირად. */
  function mapStatus(plot) {
    if (plot.geometry && plot.geometry.length) return 'polygon';
    if (plot.lat != null && plot.lon != null && plot.lat !== '' && plot.lon !== '') {
      return 'marker';
    }
    return 'missing';
  }

  function streetList(plots) {
    const seen = {};
    plots.forEach(function (plot) {
      const street = String(plot.street || '').trim();
      if (street) seen[street] = true;
    });
    // მარტივი კოდპოინტური შედარება: Intl.Collator-ის 'ka' ლოკალის ტაილორინგი
    // ამ Node-ის ICU-ზე ლათინურ და ქართულ სიმბოლოებს არაპროგნოზირებადად ალაგებს
    // (და შედეგი დამოკიდებულია LANG/LC_ALL გარემოს ცვლადზეც), ხოლო წმინდა
    // კოდპოინტური შედარება ქართული ანბანისთვის უკვე სწორი თანმიმდევრობაა.
    return Object.keys(seen).sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
  }

  const SEARCH_FIELDS = ['cad', 'street', 'num', 'address',
    'first_name', 'last_name', 'phone', 'purpose', 'note'];

  function filterPlots(plots, options) {
    const query = String((options && options.query) || '').trim().toLowerCase();
    const street = String((options && options.street) || '').trim();
    return plots.filter(function (plot) {
      if (street && String(plot.street || '').trim() !== street) return false;
      if (!query) return true;
      return SEARCH_FIELDS.some(function (field) {
        return String(plot[field] == null ? '' : plot[field])
          .toLowerCase().indexOf(query) !== -1;
      });
    });
  }

  /** ცარიელი მნიშვნელობა ყოველთვის ბოლოშია, მიმართულების მიუხედავად. */
  function sortPlots(plots, key, direction) {
    const sign = direction === 'desc' ? -1 : 1;
    return plots.slice().sort(function (a, b) {
      const left = a[key];
      const right = b[key];
      const leftEmpty = left == null || left === '';
      const rightEmpty = right == null || right === '';
      if (leftEmpty && rightEmpty) return 0;
      if (leftEmpty) return 1;
      if (rightEmpty) return -1;
      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * sign;
      }
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      if (!isNaN(leftNumber) && !isNaN(rightNumber)) {
        return (leftNumber - rightNumber) * sign;
      }
      const leftStr = String(left);
      const rightStr = String(right);
      return (leftStr < rightStr ? -1 : leftStr > rightStr ? 1 : 0) * sign;
    });
  }

  // ── გეგმის გეომეტრია ──────────────────────────────────────────────
  //
  // ერთი შეთანხმება მთელ ამ ბლოკზე: **გეოგრაფიული** წერტილი არის
  // `[lon, lat]` მასივი (GeoJSON-ის რიგი), **პროექცირებული** კი
  // `{x, y}` ობიექტი. ასე კომპილატორის გარეშეც ჩანს, რომელ სივრცეშია
  // მონაცემი და შემთხვევით შერევა შეუძლებელია.

  /**
   * Web Mercator ერთეულოვან კვადრატში. `y` ქვევით იზრდება — SVG-ის
   * ღერძის მიმართულება, ანუ ჩრდილოეთი ზემოთაა.
   *
   * უბრალო lon/lat არ გამოდგება: 41.7° განედზე გრძედის გრადუსი
   * განედისაზე ~25%-ით მოკლეა და ნახაზი გაბრტყელებული გამოვიდოდა.
   */
  function projectPoint(lon, lat) {
    const rad = lat * Math.PI / 180;
    return {
      x: (lon + 180) / 360,
      y: (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2,
    };
  }

  /** ნებისმიერი GeoJSON გეომეტრია -> ბრტყელი [[lon, lat], ...]. */
  function flattenCoords(geometry) {
    if (!geometry || !geometry.coordinates) return [];
    const out = [];
    (function walk(node) {
      if (typeof node[0] === 'number') { out.push([node[0], node[1]]); return; }
      node.forEach(walk);
    })(geometry.coordinates);
    return out;
  }

  /**
   * ბადება პროექტორს, რომელიც მოცემულ წერტილებს `size`-ის სიგანის
   * ყუთში სვამს, პროპორციის შენარჩუნებით და თანაბარი ველით კიდეებზე.
   *
   * რატომ ცალკე პროექტორი და არა პირდაპირ Mercator-ის მნიშვნელობები:
   * უბანი ერთეულოვან კვადრატში ~1e-5-ის ტოლ მონაკვეთს იკავებს — ასეთი
   * რიცხვები SVG-ის `d` ატრიბუტში ან სიზუსტეს კარგავს, ან ათი ციფრით
   * იწერება. `size`-ზე გადაყვანა ორივე პრობლემას ხსნის.
   */
  function createProjector(points, size, padding) {
    const width = size || 1000;
    const ratio = padding == null ? 0.06 : padding;
    const pad = width * ratio;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(function (point) {
      const p = projectPoint(point[0], point[1]);
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    // ერთი წერტილი (ან საერთოდ არცერთი) — გაშლა ნულია, მასშტაბი
    // უსასრულო გამოვიდოდა
    const spanX = (maxX - minX) || 1e-9;
    const spanY = (maxY - minY) || 1e-9;
    const scale = width / spanX;

    const boxWidth = width + pad * 2;
    const boxHeight = spanY * scale + pad * 2;

    function project(lon, lat) {
      const p = projectPoint(lon, lat);
      return { x: (p.x - minX) * scale + pad, y: (p.y - minY) * scale + pad };
    }

    return {
      project: project, width: boxWidth, height: boxHeight,
      viewBox: '0 0 ' + boxWidth + ' ' + boxHeight,
    };
  }

  /**
   * ფართობით შეწონილი ცენტროიდი — წარწერის საყრდენი წერტილი.
   * გადაგვარებულ (ნულოვანფართობიან) რგოლზე წვეროების საშუალოს
   * აბრუნებს, თორემ ნულზე გაყოფა მოხდებოდა.
   */
  function polygonCentroid(ring) {
    const points = (ring.length > 1 &&
      ring[0].x === ring[ring.length - 1].x &&
      ring[0].y === ring[ring.length - 1].y) ? ring.slice(0, -1) : ring;
    const count = points.length;
    if (!count) return { x: 0, y: 0 };

    let area = 0, cx = 0, cy = 0;
    for (let i = 0; i < count; i++) {
      const a = points[i];
      const b = points[(i + 1) % count];
      const cross = a.x * b.y - b.x * a.y;
      area += cross;
      cx += (a.x + b.x) * cross;
      cy += (a.y + b.y) * cross;
    }

    if (Math.abs(area) < 1e-12) {
      let sx = 0, sy = 0;
      points.forEach(function (p) { sx += p.x; sy += p.y; });
      return { x: sx / count, y: sy / count };
    }

    area *= 0.5;
    return { x: cx / (6 * area), y: cy / (6 * area) };
  }

  /** ორნიშნა სიზუსტე — ქვეპიქსელური, ფაილს კი შესამჩნევად ამცირებს. */
  function round2(value) {
    return Math.round((value + 1e-10) * 100) / 100;
  }

  function pathFromLine(points) {
    if (!points || !points.length) return '';
    return points.map(function (p, index) {
      return (index === 0 ? 'M' : 'L') + round2(p.x) + ' ' + round2(p.y);
    }).join(' ');
  }

  function pathFromRings(rings) {
    if (!rings || !rings.length) return '';
    return rings.map(function (ring) {
      const line = pathFromLine(ring);
      return line ? line + ' Z' : '';
    }).filter(Boolean).join(' ');
  }

  return { escapeHtml: escapeHtml, fullName: fullName, mapStatus: mapStatus,
    streetList: streetList, filterPlots: filterPlots, sortPlots: sortPlots,
    projectPoint: projectPoint, flattenCoords: flattenCoords,
    createProjector: createProjector, polygonCentroid: polygonCentroid,
    pathFromLine: pathFromLine, pathFromRings: pathFromRings };
});
