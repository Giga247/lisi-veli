/**
 * უბნის გეგმა — SVG რენდერერი, ერთი წყარო ორ ადგილას:
 * შესვლის ეკრანის ჰერო-ნახაზი და აპლიკაციის „რუკა" ტაბი.
 *
 * ნაკვეთის ფერი ქუჩას მიჰყვება (`si` — ქუჩის ინდექსი, -1 = უცნობი),
 * წარწერა კი მისამართს: სადაც სახლის ნომერი ვიცით, ნომერი წერია,
 * სადაც არა — საკადასტრო კოდის ბოლო სეგმენტი.
 *
 * DOM-ს ეხება, მაგრამ არც `UI`-ზეა დამოკიდებული და არც `Auth`-ზე —
 * მონაცემი და დამატებითი ბლოკები პარამეტრებით შემოდის, რომ შესვლის
 * ეკრანმა (სადაც მფლობელების მონაცემი არ არსებობს) იგივე კოდი
 * გამოიყენოს.
 */
const PlanView = (function () {
  'use strict';

  const SVGNS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    const node = document.createElementNS(SVGNS, name);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    return node;
  }

  function fmt(value) {
    return Number(value).toLocaleString('ka-GE', { maximumFractionDigits: 0 });
  }

  /** `d`-ატრიბუტიდან წერტილების უკან ამოღება — ქუჩის წარწერის დასაყრდნობად. */
  /** `mark` ერთ კოდსაც იღებს და სიასაც — ორივე ერთ სიად. */
  function markList(value) {
    const many = Array.isArray(value) ? value : [value];
    return many
      .map(function (item) { return String(item == null ? '' : item).trim(); })
      .filter(Boolean);
  }

  function pointsOf(d) {
    return d.slice(1).replace(' Z', '').split(' L')
      .map(function (pair) { return pair.split(' ').map(Number); });
  }

  /**
   * @param {HTMLElement} root  კონტეინერი — შიგთავსი გადაიწერება
   * @param {object} data       build.py-ს ნაშენი `data/plan-page.json`
   * @param {object} [opts]
   *   `opts.sidebar`  ნაგულისხმევად true; false — მხოლოდ ნახაზი (ჰერო)
   *   `opts.extra`    fn(record) -> HTML, დეტალების პანელში დამატებით
   *   `opts.onSelect` fn(cad|null)
   *   `opts.label`    fn(cad) -> ნაკვეთის წარწერა; ცარიელზე გეგმის
   *                   ფაილის ნომერი, მის გარეშე კი კოდის ბოლო სეგმენტი
   *   `opts.tint`     fn(cad) -> კლასის სუფიქსი ან null. თუ მოცემულია,
   *                   ნაკვეთი ქუჩის ფერის ნაცვლად ამ კლასს იღებს —
   *                   პროექტის გვერდზე ფერი პასუხს ნიშნავს, არა ქუჩას.
   *   `opts.legend`   მზა HTML ლეგენდისთვის; ცვლის ქუჩების ნუსხას.
   *   `opts.mark`     გამოსაყოფი ნაკვეთის კოდი ან კოდების სია —
   *                   მაცხოვრებლის „ჩემი" ან ადმინის პანელში ახლა
   *                   მიბმული. კანტი ცალკე ფენაშია, რომ მეზობელმა
   *                   ნაკვეთმა არ გადაფაროს.
   *   `opts.markLabel` ლეგენდის წარწერა ამ კანტისთვის; მის გარეშე
   *                   ლეგენდაში არაფერი ემატება.
   */
  function create(root, data, opts) {
    const options = opts || {};
    const withSidebar = options.sidebar !== false;
    const outer = data.bbox;
    const initial = data.fit || data.bbox;

    root.textContent = '';
    root.className = 'plan-view' + (withSidebar ? '' : ' is-hero');

    const mapBox = document.createElement('div');
    mapBox.className = 'plan-map';
    // ღილაკები ნახაზის ფენაშია, ლეგენდა მის ქვეშ — თორემ `position:absolute`
    // ლეგენდის ზოლსაც გადაეფარებოდა.
    mapBox.innerHTML =
      '<div class="plan-canvas">' +
      '<svg class="plan-svg" role="img" aria-label="უბნის საკადასტრო გეგმა">' +
      '<g class="g-road"></g><g class="g-plot"></g><g class="g-mark"></g>' +
      '<g class="g-street"></g><g class="g-tag"></g></svg>' +
      '<div class="plan-tools">' +
      '<button type="button" data-zoom="in" title="მოახლოება" aria-label="მოახლოება">+</button>' +
      '<button type="button" data-zoom="out" title="დაშორება" aria-label="დაშორება">−</button>' +
      '<button type="button" data-zoom="fit" title="სრულად" aria-label="სრულად ჩვენება">⤢</button>' +
      '</div></div>' +
      '<div class="plan-legend"></div>';
    root.appendChild(mapBox);

    let side = null;
    if (withSidebar) {
      side = document.createElement('aside');
      side.className = 'plan-side';
      side.innerHTML =
        '<input class="plan-search" type="search" placeholder="ძებნა — კოდი, მისამართი, ქუჩა" ' +
        'aria-label="ძებნა კოდით, მისამართით ან ქუჩით">' +
        '<div class="plan-detail"></div><div class="plan-list"></div>';
      root.appendChild(side);
    }

    const svg = mapBox.querySelector('.plan-svg');
    const gRoad = mapBox.querySelector('.g-road');
    const gPlot = mapBox.querySelector('.g-plot');
    const gMark = mapBox.querySelector('.g-mark');
    const gStreet = mapBox.querySelector('.g-street');
    const gTag = mapBox.querySelector('.g-tag');

    /* ── გზები ─────────────────────────────────────────────── */
    data.roads.forEach(function (road) {
      const width = road.cls === 'secondary' ? 7 : (road.cls === 'residential' ? 5 : 3.4);
      gRoad.appendChild(el('path', { d: road.d, class: 'road', 'stroke-width': width }));
    });

    // ქუჩის სახელი უგრძეს მონაკვეთზე ჯდება და მას მიჰყვება კუთხითაც —
    // შუა წერტილი ხშირად ნაკვეთზე ხვდებოდა და ორი წარწერა ერთმანეთს ფარავდა.
    const longest = {};
    data.roads.forEach(function (road) {
      if (!road.name) return;
      const pts = pointsOf(road.d);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (!longest[road.name] || len > longest[road.name].len) {
          longest[road.name] = { len: len, a: a, b: b };
        }
      }
    });
    Object.keys(longest).forEach(function (name) {
      const seg = longest[name];
      if (seg.len < 18) return;
      const mx = (seg.a[0] + seg.b[0]) / 2;
      const my = (seg.a[1] + seg.b[1]) / 2;
      let angle = Math.atan2(seg.b[1] - seg.a[1], seg.b[0] - seg.a[0]) * 180 / Math.PI;
      if (angle > 90) angle -= 180; else if (angle < -90) angle += 180;
      const text = el('text', {
        x: mx, y: my, class: 'streetlab', 'font-size': 7, dy: '-.5em',
        transform: 'rotate(' + angle.toFixed(1) + ' ' + mx + ' ' + my + ')',
      });
      text.textContent = name;
      gStreet.appendChild(text);
    });

    /* ── ნაკვეთები ─────────────────────────────────────────── */
    const nodes = {};
    data.parcels.forEach(function (parcel) {
      const cls = 'plot st-' + (parcel.si >= 0 ? parcel.si : 'x') +
        (parcel.state === 'added' ? ' is-new' : '');
      // კოდი თვითონ ელემენტზე: `pointerup`-ს ნაკვეთი ატრიბუტით უნდა
      // ცნობდეს, რადგან ჩაკეტილი ფუნქცია აღარ ახსოვს.
      const path = el('path', {
        d: parcel.d, class: cls, 'data-cad': parcel.cad,
        'vector-effect': 'non-scaling-stroke',
      });
      const title = el('title');
      title.textContent = parcel.cad + (parcel.full ? ' · ' + parcel.full : '');
      path.appendChild(title);
      gPlot.appendChild(path);

      // ნომერი ბაზიდან უნდა მოვიდეს და არა გეგმის ფაილიდან: ფაილი
      // გეომეტრიაა და ერთხელ აიგო, ნომერს კი მოდერატორი ასწორებს.
      // მათ გარეშე რუკა სამუდამოდ ძველ წარწერას აჩვენებდა.
      const given = options.label ? options.label(parcel.cad) : '';
      const shown = String(given || parcel.num || parcel.tail);
      const tag = el('text', {
        x: parcel.cx, y: parcel.cy, dy: '.34em',
        class: 'tag ' + ((given || parcel.num) ? 't-num' : 't-code'),
      });
      tag.textContent = shown;
      gTag.appendChild(tag);

      nodes[parcel.cad] = { path: path, tag: tag, parcel: parcel };
    });

    /* ── ლეგენდა ───────────────────────────────────────────── */
    const legend = mapBox.querySelector('.plan-legend');
    legend.innerHTML = options.legend != null ? options.legend :
      data.streets.map(function (street, index) {
      return '<span class="lg"><i class="st-' + index + '"></i>' +
        WebLib.escapeHtml(street) + '</span>';
    }).join('') +
      (data.parcels.some(function (p) { return p.si < 0; })
        ? '<span class="lg"><i class="st-x"></i>ქუჩა უცნობია</span>' : '') +
      '<span class="lg-note">ნაკვეთში სახლის ნომერია; სადაც ნომერი არ ვიცით — ' +
      'საკადასტრო კოდის ბოლო სეგმენტი.</span>';

    if (options.markLabel && markList(options.mark).some(function (code) {
      return nodes[code];
    })) {
      legend.insertAdjacentHTML('afterbegin',
        '<span class="lg"><i class="mine"></i>' +
        WebLib.escapeHtml(options.markLabel) + '</span>');
    }

    /* ── გადაადგილება და მასშტაბი ──────────────────────────── */
    const view = { x: initial[0], y: initial[1], w: initial[2], h: initial[3] };

    function apply() {
      svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h);
      const rect = svg.getBoundingClientRect();
      const perPx = view.w / (rect.width || 1);
      gTag.style.display = perPx > 1.15 ? 'none' : '';
      for (const cad in nodes) {
        nodes[cad].tag.setAttribute('font-size', (nodes[cad].parcel.num ? 11 : 8.5) * perPx);
      }
      gStreet.querySelectorAll('text').forEach(function (text) {
        text.setAttribute('font-size', 11 * perPx);
      });
    }

    function fit() {
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const k = Math.min(rect.width / initial[2], rect.height / initial[3]);
      view.w = rect.width / k;
      view.h = rect.height / k;
      view.x = initial[0] + (initial[2] - view.w) / 2;
      view.y = initial[1] + (initial[3] - view.h) / 2;
      apply();
    }

    function zoomAt(factor, cx, cy) {
      const width = Math.min(Math.max(view.w * factor, 22), outer[2] * 2.2);
      const k = width / view.w;
      view.x = cx - (cx - view.x) * k;
      view.y = cy - (cy - view.y) * k;
      view.w = width;
      view.h *= k;
      apply();
    }

    function toUser(event) {
      const rect = svg.getBoundingClientRect();
      return {
        x: view.x + (event.clientX - rect.left) / rect.width * view.w,
        y: view.y + (event.clientY - rect.top) / rect.height * view.h,
      };
    }

    svg.addEventListener('wheel', function (event) {
      event.preventDefault();
      const point = toUser(event);
      zoomAt(event.deltaY > 0 ? 1.16 : 1 / 1.16, point.x, point.y);
    }, { passive: false });

    /*
     * გადათრევას ზღურბლი აქვს და არჩევა `pointerup`-ზე ხდება.
     *
     * აქამდე ნაკვეთი `click`-ით ირჩეოდა, გადათრევა კი პირველივე
     * `pointermove`-ზე იწყებოდა. თითით ეს მუშაობდა — შეხებას მოძრაობა
     * არ ახლავს. მაუსით კი დაჭერასა და აშვებას შორის ხელი ყოველთვის
     * ირხევა ერთი-ორი პიქსელით: რუკა ოდნავ იწევდა, ნაკვეთი თითის
     * ქვეშიდან იძვროდა და ბრაუზერი `click`-ს უკვე საერთო წინაპარს —
     * თვითონ `svg`-ს — უგზავნიდა. ღილაკი დესკტოპზე მკვდარი იყო.
     *
     * `setPointerCapture`-იც ზღურბლის შემდეგაა: დაჭერისთანავე რომ
     * ვიჭერდეთ, `pointerup`-ის სამიზნე ისევ `svg` იქნებოდა და ნაკვეთს
     * ვერ ვიცნობდით.
     */
    const DRAG_SLOP = 4;
    let drag = null;
    let pressed = null;

    svg.addEventListener('pointerdown', function (event) {
      const path = event.target.closest && event.target.closest('path.plot');
      pressed = {
        x: event.clientX, y: event.clientY,
        cad: path ? path.getAttribute('data-cad') : null,
        moved: false,
      };
      drag = toUser(event);
    });

    svg.addEventListener('pointermove', function (event) {
      if (!drag || !pressed) return;
      if (!pressed.moved) {
        const far = Math.abs(event.clientX - pressed.x) > DRAG_SLOP ||
          Math.abs(event.clientY - pressed.y) > DRAG_SLOP;
        if (!far) return;
        pressed.moved = true;
        svg.setPointerCapture(event.pointerId);
        svg.classList.add('is-drag');
      }
      const point = toUser(event);
      view.x -= point.x - drag.x;
      view.y -= point.y - drag.y;
      apply();
    });

    svg.addEventListener('pointerup', function () {
      const clicked = pressed && !pressed.moved;
      endDrag();
      // გადათრევის შემდეგ არჩევანს არ ვცვლით: რუკის წაწევა ნაკვეთის
      // დახურვას არ უნდა ნიშნავდეს. ცარიელ ადგილას დაჭერა კი ხსნის.
      if (clicked) select(pressed.cad);
      pressed = null;
    });

    function endDrag() {
      if (drag) { svg.classList.remove('is-drag'); drag = null; }
    }
    svg.addEventListener('pointercancel', function () {
      endDrag();
      pressed = null;
    });

    mapBox.querySelector('.plan-tools').addEventListener('click', function (event) {
      const kind = event.target.getAttribute('data-zoom');
      if (kind === 'in') zoomAt(1 / 1.4, view.x + view.w / 2, view.y + view.h / 2);
      else if (kind === 'out') zoomAt(1.4, view.x + view.w / 2, view.y + view.h / 2);
      else if (kind === 'fit') fit();
    });

    /* ── სია და დეტალები ───────────────────────────────────── */
    const records = data.parcels.concat(data.noshape || []);
    const GROUPS = [
      { key: 'added', label: 'ახლად დამატებული — tas.ge' },
      { key: 'verified', label: 'გადამოწმებული — ემთხვევა tas.ge-ს' },
      { key: 'noshape', label: 'შეიპის გარეშე — რუკაზე არ არის' },
    ];

    let selected = null;
    let query = '';

    function matches(record) {
      if (!query) return true;
      return (record.cad + ' ' + (record.full || '') + ' ' + (record.adr || '') +
        ' ' + (record.street || '')).toLowerCase().indexOf(query) !== -1;
    }

    function renderList() {
      if (!side) return;
      const list = side.querySelector('.plan-list');
      list.textContent = '';
      const visible = records.filter(matches);
      let shown = 0;
      GROUPS.forEach(function (group) {
        const rows = visible
          .filter(function (r) { return r.state === group.key; })
          .sort(function (a, b) { return a.cad < b.cad ? -1 : a.cad > b.cad ? 1 : 0; });
        if (!rows.length) return;
        const head = document.createElement('div');
        head.className = 'grouphd';
        head.textContent = group.label + ' · ' + rows.length;
        list.appendChild(head);
        rows.forEach(function (record) {
          shown++;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'row st-' + (record.si >= 0 ? record.si : 'x') +
            (selected === record.cad ? ' is-sel' : '');
          button.dataset.cad = record.cad;
          button.innerHTML = '<span class="bar"></span><span class="body">' +
            '<span class="cad"></span><span class="sub"></span></span>' +
            '<span class="m2"></span>';
          button.querySelector('.cad').textContent =
            record.num ? (record.street || '') + ' N' + record.num : record.cad;
          button.querySelector('.sub').textContent =
            record.num ? record.cad : (record.full || record.adr || 'მისამართი უცნობია');
          button.querySelector('.m2').textContent =
            record.area ? fmt(record.area) + ' მ²' : '—';
          button.addEventListener('click', function () { select(record.cad); });
          list.appendChild(button);
        });
      });
      if (!shown) {
        const empty = document.createElement('div');
        empty.className = 'plan-empty';
        empty.textContent = 'ვერაფერი მოიძებნა.';
        list.appendChild(empty);
      }
    }

    function renderDetail() {
      if (!side) return;
      const box = side.querySelector('.plan-detail');
      const record = selected && records.filter(function (r) { return r.cad === selected; })[0];
      if (!record) {
        box.innerHTML = '<p class="hint">აირჩიე ნაკვეთი გეგმაზე ან სიიდან — ' +
          'აქ გამოჩნდება მისამართი, საკადასტრო კოდი, ფართობი და წყარო.</p>';
        return;
      }
      const head = record.num
        ? (record.street || '') + ' N' + record.num
        : (record.full || record.adr || 'მისამართი უცნობია');
      const rows = [];
      rows.push(['საკადასტრო', record.cad]);
      if (record.adr && record.adr !== head) rows.push(['ამონაწერით', record.adr]);
      rows.push(['ფართობი', record.area ? fmt(record.area) + ' მ²' : '—']);
      if (record.purpose) rows.push(['დანიშნულება', record.purpose]);
      if (record.src) rows.push(['წყარო', record.src]);
      if (record.note) rows.push(['შენიშვნა', record.note]);
      if (record.state === 'noshape') {
        rows.push(['სტატუსი', 'NAPR-ის საჯარო ფენაზე კონტური არ აქვს']);
      }
      box.innerHTML = '<span class="head"></span><dl>' + rows.map(function (pair) {
        return '<dt>' + WebLib.escapeHtml(pair[0]) + '</dt>' +
          '<dd>' + WebLib.escapeHtml(pair[1]) + '</dd>';
      }).join('') + '</dl>' +
        (options.extra ? options.extra(record) : '');
      box.querySelector('.head').textContent = head;
    }

    /**
     * ნაკვეთის ფერი პროექტის რეჟიმში.
     *
     * ქუჩის კლასი (`st-N`) ჩამოიხსნება და ნაცვლად `tint-*` ედება — თორემ
     * ორი ფერადი კლასი ერთდროულად იქნებოდა და რომელი მოიგებდა, CSS-ის
     * რიგზე იქნებოდა დამოკიდებული.
     */
    function applyTint() {
      if (!options.tint) return;
      for (const cad in nodes) {
        const path = nodes[cad].path;
        const parcel = nodes[cad].parcel;
        path.classList.remove('st-' + (parcel.si >= 0 ? parcel.si : 'x'));
        Array.prototype.slice.call(path.classList).forEach(function (name) {
          if (name.indexOf('tint-') === 0) path.classList.remove(name);
        });
        path.classList.add('tint-' + (options.tint(cad) || 'none'));
      }
    }

    /**
     * გამოყოფილი ნაკვეთები.
     *
     * კანტი ნაკვეთის თავის `path`-ს კი არ ედება, არამედ ცალკე ასლს
     * ყველა ნაკვეთის ზემოთ: მიჯნა ორ ნაკვეთს საერთო აქვს და მეზობელი,
     * რომელიც მოგვიანებით დაიხატა, გამოყოფის ნახევარს ფარავდა.
     *
     * ერთი კოდიც მიიღება და სიაც: ერთ კაცს რამდენიმე ნაკვეთი აქვს.
     */
    function applyMark(cad) {
      gMark.textContent = '';
      markList(cad).forEach(function (code) {
        const node = nodes[code];
        if (!node) return;
        gMark.appendChild(el('path', {
          d: node.parcel.d, class: 'plot-mark', 'vector-effect': 'non-scaling-stroke',
        }));
      });
    }

    function paint() {
      const active = {};
      records.filter(matches).forEach(function (r) { active[r.cad] = true; });
      for (const cad in nodes) {
        const node = nodes[cad];
        const dim = !!query && !active[cad];
        node.path.classList.toggle('is-dim', dim);
        node.tag.classList.toggle('is-dim', dim);
        node.path.classList.toggle('is-sel', cad === selected);
      }
    }

    function select(cad) {
      selected = selected === cad ? null : cad;
      renderList();
      renderDetail();
      paint();
      if (selected && nodes[selected]) {
        const parcel = nodes[selected].parcel;
        const outside = parcel.cx < view.x || parcel.cx > view.x + view.w ||
          parcel.cy < view.y || parcel.cy > view.y + view.h;
        if (outside) {
          view.x = parcel.cx - view.w / 2;
          view.y = parcel.cy - view.h / 2;
          apply();
        }
        if (side) {
          const row = side.querySelector('.row[data-cad="' + selected + '"]');
          if (row) row.scrollIntoView({ block: 'nearest' });
        }
      }
      if (options.onSelect) options.onSelect(selected);
    }

    if (side) {
      side.querySelector('.plan-search').addEventListener('input', function (event) {
        query = event.target.value.trim().toLowerCase();
        renderList();
        paint();
      });
    }

    renderList();
    renderDetail();
    applyTint();
    applyMark(options.mark);
    paint();
    requestAnimationFrame(fit);
    window.addEventListener('resize', fit);

    /**
     * წარწერების განახლება ხელახლა ხატვის გარეშე.
     *
     * ნომრის შესწორების შემდეგ მთელი რუკის თავიდან აგება მასშტაბსა და
     * პოზიციას დააკარგვინებდა — მოდერატორი კი სწორედ იმ ადგილას დგას,
     * სადაც შესწორება გააკეთა.
     */
    function applyLabel() {
      if (!options.label) return;
      for (const cad in nodes) {
        const node = nodes[cad];
        const given = options.label(cad);
        const named = Boolean(given || node.parcel.num);
        node.tag.textContent = String(given || node.parcel.num || node.parcel.tail);
        node.tag.classList.toggle('t-num', named);
        node.tag.classList.toggle('t-code', !named);
      }
    }

    return { select: select, refresh: fit, records: records,
      recolor: applyTint, relabel: applyLabel, mark: applyMark };
  }

  // გეგმის მონაცემი სტატიკურია და ორ ადგილას სჭირდება (შესვლის ეკრანი და
  // რუკის ტაბი) — ერთხელ ჩამოიტვირთება და დაპირება იქეშება.
  let pending = null;
  function load() {
    if (!pending) {
      pending = fetch('data/plan-page.json?v=3').then(function (response) {
        if (!response.ok) throw new Error('გეგმის მონაცემი ვერ ჩაიტვირთა (' + response.status + ')');
        return response.json();
      });
    }
    return pending;
  }

  return { create: create, load: load };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PlanView;
