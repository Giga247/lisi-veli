/**
 * „პროექტები" ტაბი — სია და ერთი პროექტის გვერდი.
 *
 * გვერდზე ერთი და იგივე მონაცემი სამი სახით ჩანს: ციფრები ზემოთ,
 * რუკა შუაში, ცხრილი ქვემოთ. სამივე ერთ პასუხს ეყრდნობა — ფერს
 * სერვერი ითვლის, ამიტომ რუკა და ცხრილი ვერასდროს დაშორდებიან.
 *
 * ფერი მარტო არასდროს ატარებს მნიშვნელობას: მწვანე და ნარინჯისფერი
 * პროტანოპიისთვის ΔE 6.0-ით შორდება ერთმანეთს, ამიტომ ყველგან
 * სიმბოლოცაა და წარწერაც, ცხრილიც ხელმისაწვდომია.
 */
const ProjectsView = (function () {
  'use strict';

  const esc = function (v) { return WebLib.escapeHtml(v); };

  let user = null;
  let list = [];
  let current = null;      // { project, totals, rows, payments }
  let planData = null;
  let planInstance = null;

  const TONE_ORDER = ['paid', 'paying', 'loan', 'declined', 'unreachable', 'not_contacted'];

  /* ── სია ─────────────────────────────────────────────────────── */

  function progressBar(totals) {
    const budget = totals.budget || 0;
    const pct = function (value) {
      return budget > 0 ? Math.min(100, Math.round(value / budget * 100)) : 0;
    };
    const collected = pct(totals.collected);
    const pledged = pct(totals.collected + totals.promised + totals.loan);
    return '<div class="pr-meter" role="img" aria-label="შეგროვდა ' +
      collected + ' პროცენტი ბიუჯეტის">' +
      '<span class="pr-meter-pledged" style="width:' + pledged + '%"></span>' +
      '<span class="pr-meter-collected" style="width:' + collected + '%"></span>' +
      '</div>';
  }

  function projectCard(project) {
    const totals = project.totals;
    const dates = [project.starts_on, project.ends_on].filter(Boolean).join(' — ');
    return '<article class="pr-card" data-open="' + esc(project.id) + '" tabindex="0" role="button">' +
      '<header><h3>' + esc(project.name) + '</h3>' +
      '<span class="pr-status pr-status-' + esc(project.status) + '">' +
      esc(statusLabel(project.status)) + '</span></header>' +
      (project.description
        ? '<p class="pr-desc">' + esc(clip(project.description, 160)) + '</p>' : '') +
      progressBar(totals) +
      '<dl class="pr-figures">' +
      '<div><dt>შეგროვდა</dt><dd class="pr-hero">' + esc(WebLib.money(totals.collected)) + '</dd></div>' +
      '<div><dt>ბიუჯეტი</dt><dd>' + esc(WebLib.money(totals.budget)) + '</dd></div>' +
      '<div><dt>ნაკვეთი</dt><dd>' + project.households + '</dd></div>' +
      (project.owners == null ? ''
        : '<div><dt>მეპატრონე</dt><dd>' + project.owners + '</dd></div>') +
      '</dl>' +
      (dates ? '<p class="pr-dates">' + esc(dates) + '</p>' : '') +
      '</article>';
  }

  function statusLabel(status) {
    return { draft: 'მზადდება', active: 'მიმდინარე', done: 'დასრულებული',
      cancelled: 'გაუქმებული' }[status] || status;
  }

  function clip(text, max) {
    const value = String(text || '');
    return value.length > max ? value.slice(0, max - 1) + '…' : value;
  }

  function renderList() {
    const order = { active: 0, draft: 1, done: 2, cancelled: 3 };
    const sorted = list.slice().sort(function (a, b) {
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    });
    UI.el('home-projects').innerHTML =
      '<div class="sec-h"><h2>უბნის პროექტები</h2>' +
      (canCreate() ? '<button type="button" data-new="1" class="pr-new">' +
        '+ ახალი</button>' : '') + '</div>' +
      (sorted.length === 0
        ? '<p class="empty">პროექტი ჯერ არ არის.</p>'
        : '<div class="pr-cards">' + sorted.map(projectCard).join('') + '</div>');
  }

  /** პროექტს ქმნის ადმინი ან მოდერატორი; ამტკიცებს მხოლოდ ადმინი. */
  function canCreate() {
    return Boolean(user) && (user.role === 'admin' || user.role === 'moderator');
  }

  function canApprove(project) {
    return Boolean(user) && user.role === 'admin' && project && project.status === 'draft';
  }

  /* ── ერთი პროექტი ────────────────────────────────────────────── */

  /**
   * ფოტოების ზოლი. bucket კერძოა, ამიტომ `url` ხელმოწერილია და ვადა
   * აქვს — გვერდის ხელახლა გახსნისას ახალი მოდის.
   */
  function photoStrip(photos) {
    const shown = (photos || []).filter(function (photo) { return photo.url; });
    if (shown.length === 0) return '';
    return '<div class="pr-photos">' +
      shown.map(function (photo) {
        return '<a href="' + esc(photo.url) + '" target="_blank" rel="noopener">' +
          '<img src="' + esc(photo.url) + '" alt="" loading="lazy"></a>';
      }).join('') + '</div>';
  }

  /**
   * დაუმტკიცებელი პროექტის ბანერი.
   *
   * ღილაკი ერთი დაჭერით ათეულობით ვალდებულებას ქმნის, ამიტომ ეკრანზე
   * წერია, ზუსტად რამდენს — და არა უბრალოდ „დამტკიცება".
   */
  function approvalBanner(project) {
    if (project.status !== 'draft') return '';
    const count = (project.plot_cads || []).length;
    const each = Number(project.amount_per_household) || 0;
    const sum = 'შეიქმნება ' + count + ' ვალდებულება, თითო ' +
      WebLib.money(each) + ' — სულ ' + WebLib.money(count * each);
    return '<div class="pr-approval">' +
      '<p><strong>ეს პროექტი ჯერ არ არის დამტკიცებული.</strong> ' + esc(sum) + '.</p>' +
      (canApprove(project)
        ? '<button type="button" data-approve="' + esc(project.id) + '">დამტკიცება</button>'
        : '<p class="pr-approval-wait">დამტკიცებას ადმინი ახდენს.</p>') +
      '</div>';
  }

  /**
   * ნაკვეთი და მეპატრონე ცალკე ითვლება.
   *
   * მეპატრონე ნაკვეთზე ნაკლებია — ზოგს რამდენიმე ნაკვეთი აქვს — და
   * მხოლოდ ნაკვეთების რიცხვი უბნის ხალხს ზედმეტად ბევრად აჩვენებდა.
   */
  function scale(rows) {
    const owners = WebLib.ownerCount(rows);
    return '<p class="pr-scale">' +
      '<span><b>' + esc(String(rows.length)) + '</b> ნაკვეთი</span>' +
      '<span><b>' + esc(String(owners)) + '</b> მეპატრონე</span></p>';
  }

  function figures(totals) {
    const cells = [
      ['შეგროვდა', totals.collected, 'pr-hero'],
      ['თანხას დებს', totals.promised, ''],
      ['ვალად იღებს', totals.loan, ''],
      ['არ დებს', totals.declined, ''],
      ['პასუხის გარეშე', totals.pending, ''],
    ];
    // „აკლია" და „ნამეტი" ერთდროულად ვერასდროს იქნება — ერთი მათგანი
    // ყოველთვის ნული იქნებოდა და ეკრანზე ცარიელ სვეტს იჭერდა. ნამეტი
    // შეცდომა არ არის: ის უბნის ფონდში რჩება, ამიტომ ისე ჩანს,
    // როგორც შედეგი, და არა როგორც გაფრთხილება.
    cells.push(totals.surplus > 0
      ? ['ნამეტი', totals.surplus, 'pr-surplus']
      : ['აკლია', totals.remaining, '']);
    return '<dl class="pr-kpi">' + cells.map(function (cell) {
      return '<div><dt>' + esc(cell[0]) + '</dt>' +
        '<dd class="' + cell[2] + '">' + esc(WebLib.money(cell[1])) + '</dd></div>';
    }).join('') + '</dl>';
  }

  function legendHtml(rows) {
    const counts = {};
    rows.forEach(function (row) { counts[row.color] = (counts[row.color] || 0) + 1; });
    return TONE_ORDER.filter(function (tone) { return counts[tone]; })
      .map(function (tone) {
        const view = WebLib.toneView(tone);
        return '<span class="lg"><i class="tint-' + tone + '">' + esc(view.icon) + '</i>' +
          esc(view.label) + ' · ' + counts[tone] + '</span>';
      }).join('') +
      '<span class="lg-note">ფერს ყველგან სიმბოლო და წარწერა მოსდევს — ' +
      'მწვანე და ნარინჯისფერი ფერთა აღქმის დარღვევისას ერთმანეთს ჰგავს.</span>';
  }

  function ownerName(row) {
    const name = [row.last_name, row.first_name]
      .filter(function (part) { return part && String(part).trim(); }).join(' ');
    return name || '—';
  }

  /**
   * ზარის პასუხის ჩაწერა.
   *
   * ქუჩის შეზღუდვა მოიხსნა: მოდერატორი მხოლოდ თავის ქუჩაზე რომ წერდა,
   * შვებულებაში წასული ან ჯერ დაუნიშნავი ქუჩა უპატრონოდ რჩებოდა და
   * პასუხს ვერავინ აფიქსირებდა. ვინც ურეკავს, ის წერს.
   */
  function canAnswer(row) {
    if (!user || !current || current.project.status !== 'active') return false;
    return user.role === 'admin' || user.role === 'moderator';
  }

  /**
   * ფულის ჩაწერის უფლება.
   *
   * `canAnswer`-ისგან განსხვავებით მოდერატორი აქ ქუჩით **არ** არის
   * შეზღუდული — ასე წერია RLS-ში, და კლიენტი განზრახ იმეორებს ბაზას:
   * ფორმა, რომელსაც ბაზა უარყოფს, არ უნდა გამოჩნდეს, და პირიქითაც.
   *
   * ხაზინდარი გლობალური როლი არ არის — ის პროექტის ველია, ამიტომ
   * ჩვეულებრივ მაცხოვრებელსაც შეუძლია ფულის ჩაწერა, თუ ამ პროექტის
   * ხაზინდარია.
   */
  /**
   * ფულს მხოლოდ ხაზინდარი და ადმინი ეხება.
   *
   * მოდერატორი სტატუსებს ცვლის — ზარის პასუხს, რომლის შეცდომაც იაფად
   * სწორდება. გადახდა კი ანგარიშია: ვინც ჩაწერს, ის აგებს პასუხს
   * ჯამზე, და ეს უბანში ერთი ადამიანია. ნამდვილ შემოწმებას RLS
   * აკეთებს — აქ ღილაკი მხოლოდ იმიტომ იმალება, რომ არავის შესთავაზოს
   * მოქმედება, რომელსაც ბაზა უარყოფს.
   */
  function canPay() {
    if (!user || !current || current.project.status !== 'active') return false;
    if (user.role === 'admin') return true;
    return isTreasurer();
  }

  /** ხაზინდარი ერთი არ არის — 86 ნაკვეთს ერთი კაცი ვერ მოაწევს. */
  function isTreasurer() {
    if (!user || !current) return false;
    return (current.project.treasurers || []).indexOf(user.email) !== -1;
  }

  /**
   * ვინ ხედავს სტატუსსა და გადახდას.
   *
   * მაცხოვრებელი ბარათზე მხოლოდ ნაკვეთის მონაცემებს ხედავს — ვისი
   * სახლია და სად. ვინ რას უპასუხა და ვინ რამდენი შემოიტანა, უბნის
   * შიდა საქმეა და მეზობლის თვალწინ არ იშლება. რუკაზე ფერები ყველას
   * უჩანს: ისინი უბნის საერთო პროგრესს აჩვენებს და არა კონკრეტული
   * კარის უკან რა ხდება.
   */
  function canSeeProgress() {
    if (!user || !current) return false;
    if (user.role === 'admin' || user.role === 'moderator') return true;
    return isTreasurer();
  }

  /** ნაკვეთის მონაცემები — სახელი, ტელეფონი, მისამართი. */
  function canEditPlot() {
    return Boolean(user) && (user.role === 'moderator' || user.role === 'admin');
  }

  let byCadCache = null;
  function rowByCad() {
    if (!byCadCache) {
      byCadCache = {};
      current.rows.forEach(function (row) { byCadCache[row.cad] = row; });
    }
    return byCadCache;
  }

  /**
   * „ჩემი ნაკვეთი" — შესული მომხმარებლის საკუთარი წილი, თავშივე.
   *
   * ეს არის მიზეზი, რის გამოც `მომხმარებლები` ფურცელს საკადასტრო კოდის
   * სვეტი აქვს. თუ კოდი მიბმული არ არის, ბლოკი უბრალოდ არ ჩნდება —
   * ცარიელი ჩარჩო უფრო აბნევს, ვიდრე მისი არარსებობა.
   */
  function myHousehold() {
    const cad = String((user && user.cad) || '').trim();
    if (!cad) return '';
    const row = rowByCad()[cad];
    if (!row) return '';
    const view = WebLib.pledgeView(row.status);
    const tone = WebLib.toneView(row.color);
    const left = Math.max(0, (row.amount_due || 0) - (row.paid || 0));
    return '<section class="pr-mine">' +
      '<h3>ჩემი ნაკვეთი</h3>' +
      '<p class="pr-mine-address">' + esc(row.address || cad) + '</p>' +
      '<dl class="pr-kpi">' +
      '<div><dt>ჩემი წილი</dt><dd>' + esc(WebLib.money(row.amount_due)) + '</dd></div>' +
      '<div><dt>გადახდილი</dt><dd>' + esc(WebLib.money(row.paid)) + '</dd></div>' +
      '<div><dt>დარჩენილი</dt><dd>' + esc(WebLib.money(left)) + '</dd></div>' +
      '<div><dt>ჩემი პასუხი</dt><dd><span class="pr-tone tint-' + esc(row.color) + '">' +
      esc(tone.icon) + '</span> ' + esc(view.short) + '</dd></div>' +
      '</dl></section>';
  }

  /**
   * ვინ პასუხობს ამ პროექტზე.
   *
   * მეზობელს, რომელსაც კითხვა აქვს, უნდა ჰქონდეს ერთი მისამართი —
   * თორემ ან ადმინს წერს, ან არავის. სახელები `project_staff()`-იდან
   * მოდის: `profiles`-ს მაცხოვრებელი ვერ კითხულობს.
   */
  function staffBlock(staff) {
    const byKind = { moderator: [], treasurer: [] };
    (staff || []).forEach(function (person) {
      if (byKind[person.kind]) byKind[person.kind].push(person.display_name);
    });

    const one = function (kind, label) {
      const names = byKind[kind];
      return '<div class="pr-staff-i"><span>' + esc(label) + '</span>' +
        (names.length
          ? '<b>' + names.map(esc).join(', ') + '</b>'
          : '<i>დაუნიშნავი</i>') + '</div>';
    };

    return '<section class="pr-staff">' +
      one('moderator', names(byKind.moderator.length, 'მოდერატორი', 'მოდერატორები')) +
      one('treasurer', names(byKind.treasurer.length, 'ხაზინდარი', 'ხაზინდრები')) +
      (user && user.role === 'admin'
        ? '<button type="button" class="pr-staff-b" data-staff="1">დანიშვნა</button>'
        : '') +
      '</section>';
  }

  /** ერთი კაცია თუ რამდენიმე — წარწერაც იმას მიჰყვება. */
  function names(count, one, many) {
    return count > 1 ? many : one;
  }

  /**
   * ძებნა რუკაზე.
   *
   * ოთხმოცდაორ ნაკვეთში კონკრეტულის თვალით პოვნა ზარის დროს ნელია —
   * მოდერატორმა სახელი იცის, ადგილი კი არა. სია განზრახ არ ჩნდება:
   * პასუხი რუკაზე მონიშნული ნაკვეთია და მისი ბარათი, ანუ იქვე, სადაც
   * ისედაც მუშაობს.
   *
   * მაცხოვრებელს ეს ველი არ უჩანს — მას სტატუსებიც არ უჩანს და ძებნა
   * მხოლოდ მეზობლების სიის დათვალიერების საშუალება იქნებოდა.
   */
  function findBox() {
    if (!canSeeProgress()) return '';
    return '<div class="pr-find">' +
      '<input type="search" id="pr-find-q" autocomplete="off" ' +
      'placeholder="ძებნა — სახელი, მისამართი, კოდი, ნომერი" ' +
      'aria-label="ნაკვეთის ძებნა რუკაზე">' +
      '<div class="pr-find-r" hidden></div></div>';
  }

  /**
   * ნაპოვნის ნიშანი რუკაზე.
   *
   * `PlanView`-ის საკუთარი `is-sel` აქ არ გამოდგება: ბარათის დახურვისას
   * ის იხსნება, ხოლო ძებნის აზრი სწორედ ისაა, რომ ბარათის დახურვის
   * მერეც იცოდე, რომელი ნაკვეთი იპოვე. ეს ნიშანი შემდეგ ძებნამდე რჩება.
   */
  function mark(cad) {
    const host = document.getElementById('pr-plan');
    if (!host) return;
    const old = host.querySelector('.plot.is-found');
    if (old) old.classList.remove('is-found');
    const path = host.querySelector('path.plot[data-cad="' + cad + '"]');
    if (!path) return;
    // ანიმაცია თავიდან რომ გაეშვას, კლასი ჯერ უნდა მოცილდეს — ერთი
    // ნაკვეთის ორჯერ პოვნა უნიშნოდ გაივლიდა.
    void path.getBoundingClientRect();
    path.classList.add('is-found');
    // მონიშნული ყველაზე ზემოთ: მეზობელი ნაკვეთის კანტი მას გადაფარავდა.
    path.parentNode.appendChild(path);
  }

  function wireFind() {
    const input = document.getElementById('pr-find-q');
    if (!input) return;
    const box = input.parentNode.querySelector('.pr-find-r');
    let hits = [];

    const draw = function () {
      const query = input.value.trim();
      // ერთი სიმბოლო ნახევარ უბანს დააბრუნებდა — სია მაშინ ჩნდება,
      // როცა უკვე რაღაცას ავიწროებს.
      if (query.length < 2) { hits = []; box.hidden = true; box.innerHTML = ''; return; }
      hits = WebLib.searchRows(current.rows, query, 8);
      box.hidden = false;
      box.innerHTML = hits.length
        ? hits.map(function (row) {
          return '<button type="button" data-find="' + esc(row.cad) + '">' +
            '<i class="pr-tone tint-' + esc(row.color) + '"></i>' +
            '<span class="pr-find-n">' + esc(ownerName(row)) + '</span>' +
            '<span class="pr-find-a">' + esc(row.address || row.cad) + '</span>' +
            '</button>';
        }).join('')
        : '<p class="empty">ვერაფერი მოიძებნა.</p>';
    };

    const go = function (cad) {
      box.hidden = true;
      input.value = '';
      hits = [];
      mark(cad);
      if (!planInstance) return;
      // ჯერ ვასუფთავებთ: `select` გადამრთველია და იმავე ნაკვეთზე
      // მეორედ დაძახება მას მოხსნიდა ბარათის გახსნის ნაცვლად.
      planInstance.select(null);
      planInstance.select(cad);
    };

    input.addEventListener('input', draw);
    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      // ფორმა აქ არ არის, მაგრამ Enter-ს ბრაუზერი ზოგჯერ გვერდის
      // გადატვირთვად კითხულობს — და ნაპოვნი ისედაც ერთი დაჭერაა.
      event.preventDefault();
      if (hits.length) go(hits[0].cad);
    });
    box.addEventListener('click', function (event) {
      const hit = event.target.closest && event.target.closest('[data-find]');
      if (hit) go(hit.getAttribute('data-find'));
    });
  }

  function renderProject() {
    const project = current.project;
    const totals = current.totals;
    byCadCache = null;

    UI.el('view-project').innerHTML =
      '<div class="pr-page">' +
      '<button type="button" class="pr-back" data-back="1">← მთავარი</button>' +
      '<header class="pr-head"><h2>' + esc(project.name) + '</h2>' +
      '<span class="pr-status pr-status-' + esc(project.status) + '">' +
      esc(statusLabel(project.status)) + '</span>' +
      (user && user.role === 'admin'
        ? '<button type="button" class="pr-edit" data-edit-project="1">' +
          'რედაქტირება</button>'
        : '') +
      '</header>' +
      approvalBanner(project) +
      (project.description ? '<p class="pr-desc">' + esc(project.description) + '</p>' : '') +
      photoStrip(current.photos) +
      staffBlock(current.staff) +
      scale(current.rows) +
      figures(totals) +
      progressBar(totals) +
      myHousehold() +
      // სია აქ განზრახ არ არის: პროექტის გვერდზე ერთადერთი ინტერაქცია
      // რუკაა. ნაკვეთზე შეხებით იხსნება კომპაქტური ბარათი, სადაც
      // ერთ ეკრანზე ეტევა ყველაფერი, რაც მოდერატორს ზარის დროს სჭირდება.
      findBox() +
      '<div id="pr-plan"></div>' +
      '<p class="map-hint">შეეხე ნაკვეთს — სტატუსი, შენიშვნა, გადახდა</p>' +
      '</div>';

    UI.showView('project');
    renderPlan();
    wireFind();
  }

  function renderPlan() {
    const host = document.getElementById('pr-plan');
    if (!host) return;
    const paint = function () {
      const map = rowByCad();
      planInstance = PlanView.create(host, planData, {
        sidebar: false,
        // პროექტში არმყოფი ნაკვეთი „არ დარეკილად" იღებებოდა — თითქოს
        // მასზეც ველოდებით პასუხს. ის უბრალოდ არ მონაწილეობს.
        tint: function (cad) { return map[cad] ? map[cad].color : null; },
        legend: legendHtml(current.rows),
        onSelect: function (cad) { if (cad) openAnswer(cad); },
      });
    };
    if (planData) { paint(); return; }
    PlanView.load().then(function (data) { planData = data; paint(); })
      .catch(function () {
        host.innerHTML = '<p class="empty">გეგმა ვერ ჩაიტვირთა — ' +
          'გადატვირთეთ გვერდი.</p>';
      });
  }

  /* ── პასუხის ჩაწერა ──────────────────────────────────────────── */

  /**
   * სტატუსის ჩიპები.
   *
   * „გადახდილია" აქ არ არის: ის ფულის ფაქტია და არა ზარის პასუხი —
   * ბოლოს ცალკე ჩამრთველად დგას. ჩიპებში რომ ერეოდა, ერთი და იმავე
   * ველიდან ორი სხვადასხვა რამ იმართებოდა.
   *
   * `open=false` ხაზინდრისთვისაა, ვისაც სტატუსის ცვლა არ შეუძლია:
   * ჩიპები დამალულია და მხოლოდ მაშინ ჩნდება, როცა გადახდას თიშავს —
   * მაშინ სადღაც ხომ უნდა დაბრუნდეს ვალდებულება.
   */
  function statusChips(row, open) {
    const keys = Object.keys(WebLib.PLEDGE_VIEW)
      .filter(function (key) { return key !== 'paid'; });
    // გადახდილს ძველი პასუხი აღარ ახსოვს — „დებს" ყველაზე ახლოა
    // სიმართლესთან, ვინც ფული უკვე შემოიტანა.
    const checked = row.status === 'paid' ? 'paying' : row.status;
    return '<fieldset class="pc-status' + (open ? '' : ' is-revert') + '"' +
      (open ? '' : ' hidden') + '>' +
      '<legend>' + (open ? 'სტატუსი' : 'დაბრუნდეს სტატუსში') + '</legend>' +
      keys.map(function (key) {
        const item = WebLib.PLEDGE_VIEW[key];
        return '<label class="pc-chip tint-' + esc(key) + '">' +
          '<input type="radio" name="status" value="' + esc(key) + '"' +
          (checked === key ? ' checked' : '') + '>' +
          '<span>' + esc(item.label) + '</span></label>';
      }).join('') + '</fieldset>';
  }

  /**
   * დადასტურების პოპაპი.
   *
   * `confirm()` განზრახ არ გამოიყენება: ბრაუზერის მოდალი ინგლისურ
   * ჩარჩოში სვამს ქართულ ტექსტს, მობაილზე ეკრანის თავში ხტება და
   * ვერ ჩამოთვლის, კონკრეტულად რა იცვლება. აქ კითხვის ქვეშ თვითონ
   * ცვლილებები წერია — ვინც ღილაკს ეხება, ხედავს რას ადასტურებს.
   */
  function confirmAsk(question, lines) {
    return new Promise(function (resolve) {
      const box = document.createElement('div');
      box.className = 'pr-dialog pc-confirm';
      box.innerHTML = '<div class="pr-dialog-box pc-confirm-box">' +
        '<h3>' + esc(question) + '</h3>' +
        (lines.length
          ? '<ul>' + lines.map(function (line) {
            return '<li>' + esc(line) + '</li>';
          }).join('') + '</ul>'
          : '') +
        '<div class="pc-confirm-act">' +
        '<button type="button" data-no="1">არა</button>' +
        '<button type="button" class="pc-confirm-yes" data-yes="1">დიახ</button>' +
        '</div></div>';

      const done = function (answer) { box.remove(); resolve(answer); };
      box.querySelector('[data-no]').addEventListener('click', function () { done(false); });
      box.querySelector('[data-yes]').addEventListener('click', function () { done(true); });
      box.addEventListener('click', function (event) {
        if (event.target === box) done(false);
      });
      document.body.appendChild(box);
      box.querySelector('[data-yes]').focus();
    });
  }

  /**
   * ნაკვეთის ბარათი პროექტში.
   *
   * ერთი ეკრანი, რომელზეც ეტევა ყველაფერი, რაც მოდერატორს ზარის დროს
   * სჭირდება: ვის ურეკავს, რა ნომერზე, რა უპასუხა, რა უნდა დაიმახსოვროს
   * და შემოვიდა თუ არა ფული. სტატუსები ჩიპებია და არა ერთმანეთის ქვეშ
   * დაწყობილი რადიოები — ექვსი გრძელი წარწერა ეკრანის ნახევარს ჭამდა.
   */
  /**
   * პროექტში არმყოფი ნაკვეთი — მხოლოდ რეესტრის მონაცემები.
   *
   * რუკა უბნის ყველა ნაკვეთს ხატავს, პროექტი კი მათ ნაწილს მოიცავს.
   * კლიკი უპასუხოდ რომ რჩებოდეს, გატეხილად გამოიყურებოდა.
   */
  function outsideRow(cad) {
    const plot = (window.PLOTS || []).filter(function (item) {
      return item.cad === cad;
    })[0];
    if (!plot) return null;
    return {
      cad: plot.cad, street: plot.street || '', address: plot.address || '',
      first_name: plot.first_name || '', last_name: plot.last_name || '',
      phone: plot.phone || '', amount_due: 0, paid: 0,
      status: 'not_contacted', note: '', color: 'not_contacted',
    };
  }

  function openAnswer(cad) {
    const inProject = Boolean(rowByCad()[cad]);
    const row = rowByCad()[cad] || outsideRow(cad);
    if (!row) return;
    const mayAnswer = inProject && canAnswer(row);
    const mayPay = inProject && canPay();
    const maySee = inProject && canSeeProgress();
    const wasPaid = Number(row.paid) > 0;
    const view = WebLib.pledgeView(row.status);

    const dialog = document.createElement('div');
    dialog.className = 'pr-dialog';
    dialog.innerHTML =
      '<form class="pr-dialog-box pr-card-box">' +

      '<header class="pc-h">' +
      '<div><h3>' + esc(ownerName(row)) + '</h3>' +
      '<p>' + esc(row.address || '—') + '</p>' +
      '<p class="pc-cad mono">' + esc(row.cad) + '</p></div>' +
      (canEditPlot()
        ? '<button type="button" class="pc-ed" data-edit-plot="1" ' +
          'title="ნაკვეთის რედაქტირება" aria-label="ნაკვეთის რედაქტირება">' +
          '✎</button>'
        : '') +
      '<button type="button" class="pc-x" data-cancel="1" aria-label="დახურვა">✕</button>' +
      '</header>' +

      (row.phone
        ? '<a class="pc-call" href="tel:' + esc(row.phone) + '">' +
          'დარეკვა · ' + esc(row.phone) + '</a>'
        : '') +

      (mayAnswer
        ? statusChips(row, true) +
          '<label class="pc-note">შენიშვნა' +
          '<textarea name="note" rows="2" maxlength="500" ' +
          'placeholder="მაგ. ხვალ დამირეკავს">' + esc(row.note || '') + '</textarea></label>'
        : maySee
          ? '<p class="pc-ro"><span class="pr-tone tint-' + esc(row.color) + '">' +
            esc(view.icon) + '</span> ' + esc(view.label) +
            (row.note ? ' · ' + esc(row.note) : '') + '</p>'
          : '') +

      (maySee
        ? '<div class="pc-money">' +
          '<span>წილი <b>' + esc(WebLib.money(row.amount_due)) + '</b></span>' +
          '<span>გადახდილი <b>' + esc(WebLib.money(row.paid)) + '</b></span>' +
          '</div>'
        : '') +
      (mayPay
        ? (mayAnswer ? '' : statusChips(row, false)) +
          '<label class="pc-paid' + (wasPaid ? ' is-on' : '') + '">' +
          '<input type="checkbox" name="paid"' + (wasPaid ? ' checked' : '') + '>' +
          '<span class="pc-paid-sw" aria-hidden="true"></span>' +
          '<span class="pc-paid-t">გადახდილია</span></label>' +
          // თანხა ცალკე ველია და არა ღილაკზე დაწერილი რიცხვი: მეზობელი
          // ხან ნაკლებს დებს, ხან მეტს, და ხაზინდარმა ის უნდა ჩაწეროს,
          // რაც ხელში მიიღო.
          '<label class="pc-sum"' + (wasPaid ? '' : ' hidden') +
          '>შემოსული თანხა, ₾' +
          '<input type="number" name="amount" step="any" min="1" value="' +
          esc(String(wasPaid ? row.paid : row.amount_due)) + '"></label>'
        : '') +
      '<p class="pr-dialog-error" hidden></p>' +
      (mayAnswer || mayPay
        ? '<button type="submit" class="pc-save">შენახვა</button>' : '') +
      '</form>';

    document.body.appendChild(dialog);
    document.body.classList.add('sheet-open');

    const form = dialog.querySelector('form');
    const errorBox = dialog.querySelector('.pr-dialog-error');
    const close = function () {
      dialog.remove();
      document.body.classList.remove('sheet-open');
      if (planInstance) planInstance.select(null);
    };
    dialog.querySelector('[data-cancel]').addEventListener('click', close);
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) close();
    });

    const fail = function (message) {
      errorBox.textContent = message;
      errorBox.hidden = false;
    };

    // რედაქტორი მთავარი სიის მოდულშია — იმავე ველებით, იმავე
    // კონფლიქტის შემოწმებით. აქ მისი გამეორება ორ ადგილას ერთი
    // ფორმის შენახვას ნიშნავდა.
    const editButton = dialog.querySelector('[data-edit-plot]');
    if (editButton) {
      const projectId = current.project.id;
      editButton.addEventListener('click', function () {
        close();
        TableView.openEditor(cad, function () {
          openProject(projectId).catch(function () {});
        });
      });
    }

    const paidBox = form.elements.paid || null;
    const sumBox = form.querySelector('.pc-sum');
    const revert = form.querySelector('.pc-status.is-revert');

    // ხაზინდარს სტატუსი მხოლოდ მაშინ სჭირდება, როცა გადახდას თიშავს.
    if (paidBox) {
      paidBox.addEventListener('change', function () {
        paidBox.closest('.pc-paid').classList.toggle('is-on', paidBox.checked);
        if (sumBox) sumBox.hidden = !paidBox.checked;
        if (revert) revert.hidden = paidBox.checked || !wasPaid;
      });
    }

    const save = form.querySelector('.pc-save');
    if (save) {
      const original = save.textContent;
      save.addEventListener('click', async function (event) {
        event.preventDefault();
        errorBox.hidden = true;

        const wantPaid = paidBox ? paidBox.checked : wasPaid;
        const sum = wantPaid && form.elements.amount
          ? Number(form.elements.amount.value) : 0;
        if (wantPaid && (!isFinite(sum) || sum <= 0)) {
          fail('შემოსული თანხა დადებითი უნდა იყოს');
          return;
        }
        const picked = form.querySelector('input[name="status"]:checked');
        // სტატუსი მაშინაა სავალდებულო, როცა მართლა ვწერთ: პასუხის
        // შეცვლისას ან გადახდის გაუქმებისას.
        if (!picked && (mayAnswer || (wasPaid && !wantPaid))) {
          fail('აირჩიეთ სტატუსი');
          return;
        }

        const lines = [];
        if (mayAnswer && !(wasPaid && wantPaid)) {
          lines.push('სტატუსი: ' + WebLib.pledgeView(picked.value).label);
        }
        if (wantPaid && !wasPaid) {
          lines.push('გადახდა ჩაიწერება: ' + WebLib.money(sum));
        }
        if (wantPaid && wasPaid && sum !== Number(row.paid)) {
          lines.push('თანხა შესწორდება: ' + WebLib.money(row.paid) +
            ' → ' + WebLib.money(sum));
        }
        if (!wantPaid && wasPaid) {
          lines.push('გადახდა უქმდება და ბრუნდება: ' +
            WebLib.pledgeView(picked.value).label);
        }
        if (!await confirmAsk('მართლა გსურს შენახვა?', lines)) return;

        save.disabled = true;
        save.textContent = 'ინახება…';
        try {
          // თანმიმდევრობას მნიშვნელობა აქვს: გაუქმება სტატუსს თავად
          // სვამს, ჩაწერა კი ბოლოს „გადახდილზე" გადაიყვანს.
          if (wasPaid && !wantPaid) {
            await API.call('cancelPayment', {
              project_id: current.project.id, cad: cad, status: picked.value,
            });
          }
          if (mayAnswer) {
            await API.call('setPledge', {
              project_id: current.project.id, cad: cad,
              status: (wasPaid && wantPaid) ? 'paid' : picked.value,
              note: form.elements.note.value,
            });
          }
          // ჩაწერაც და შესწორებაც ერთი გზაა — RPC ძველ ჩანაწერს ცვლის.
          if (wantPaid && (!wasPaid || sum !== Number(row.paid))) {
            await API.call('recordPayment', {
              project_id: current.project.id, cad: cad, amount: sum,
              paid_on: new Date().toISOString().slice(0, 10),
            });
          }
          close();
          await openProject(current.project.id);
        } catch (error) {
          fail(error.message || 'ვერ შეინახა');
          save.disabled = false;
          save.textContent = original;
        }
      });
    }

    // ფორმის ნაგულისხმევი გაგზავნა (Enter ველში) ღილაკს გვერდს
    // აუვლიდა და დადასტურების გარეშე შეინახავდა.
    form.addEventListener('submit', function (event) { event.preventDefault(); });
  }

  /* ── ნაკადი ──────────────────────────────────────────────────── */

  async function openProject(id) {
    try {
      current = await API.call('project', { id: id });
      renderProject();
    } catch (error) {
      UI.showError(error.message || 'პროექტი ვერ ჩაიტვირთა');
    }
  }

  /**
   * @returns {Array} პროექტების სია — `main.js`-ს აქტიური სჭირდება
   *          რუკისა და სიის შესაღებად.
   */
  async function render(currentUser) {
    user = currentUser;
    const host = UI.el('home-projects');
    host.innerHTML = '<p class="empty">იტვირთება…</p>';
    try {
      list = await API.call('projects');
    } catch (error) {
      host.innerHTML = '<p class="empty">პროექტები ვერ ჩაიტვირთა — ' +
        esc(error.message || '') + '</p>';
      return [];
    }
    current = null;
    renderList();
    return list;
  }

  function bind() {
    // ორი ჰოსტი: ბარათები მთავარზე, დეტალები ცალკე ხედში. მოვლენები
    // ორივეზე დელეგირებულია და ერთი და იგივე დამმუშავებელი ემსახურება.
    ['home-projects', 'view-project'].forEach(function (id) {
      const box = UI.el(id);
      if (box && !box._bound) { box._bound = true; wire(box); }
    });
  }

  function wire(host) {
    host.addEventListener('click', function (event) {
      const target = event.target;
      const card = target.closest && target.closest('[data-open]');
      if (card) { openProject(card.getAttribute('data-open')); return; }
      if (target.closest && target.closest('[data-back]')) {
        UI.showView('home');
        return;
      }
      const answer = target.closest && target.closest('[data-answer]');
      if (answer) { openAnswer(answer.getAttribute('data-answer')); return; }
      if (target.closest && target.closest('[data-new]')) { openNewProject(); return; }
      const approve = target.closest && target.closest('[data-approve]');
      if (approve) { confirmApprove(approve); return; }
      if (target.closest && target.closest('[data-staff]')) { openStaff(); return; }
      if (target.closest && target.closest('[data-edit-project]')) { openEditProject(); }
    });

    host.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest && event.target.closest('[data-open]');
      if (!card) return;
      event.preventDefault();
      openProject(card.getAttribute('data-open'));
    });

  }

  /**
   * პასუხისმგებლების დანიშვნა (ადმინი).
   *
   * ცალკე „პროექტის რედაქტირების" გვერდი არ გვაქვს და მხოლოდ ორი
   * ველისთვის მისი აშენება გადაჭარბებული იქნებოდა. სია `users`-იდან
   * მოდის — მას ისედაც მხოლოდ ადმინი კითხულობს.
   */
  /**
   * პროექტის ველების რედაქტირება (ადმინი).
   *
   * სტატუსი აქვეა: „მიმდინარე → დასრულებული" ცალკე ღილაკს არ იმსახურებს,
   * ის იმავე ფორმის ნაწილია. მონახაზიდან გამოსვლა კი აქ არ ხდება —
   * აქტიურობას `approve_project()` ანიჭებს, რომელიც ვალდებულებებსაც
   * ქმნის, და ორ გზას ერთი და იმავე გადასვლისთვის აზრი არ აქვს.
   */
  function openEditProject() {
    if (!user || user.role !== 'admin' || !current) return;
    const project = current.project;
    const draft = project.status === 'draft';

    const statuses = [
      ['active', 'მიმდინარე'], ['done', 'დასრულებული'], ['cancelled', 'გაუქმებული'],
    ];

    const dialog = document.createElement('div');
    dialog.className = 'pr-dialog';
    dialog.innerHTML =
      '<form class="pr-dialog-box">' +
      '<h3>პროექტის რედაქტირება</h3>' +

      '<label class="pc-note">სახელი' +
      '<input name="name" maxlength="120" value="' + esc(project.name) + '"></label>' +

      '<label class="pc-note">აღწერა' +
      '<textarea name="description" rows="3" maxlength="2000">' +
      esc(project.description || '') + '</textarea></label>' +

      '<div class="pr-edit-row">' +
      '<label class="pc-note">ბიუჯეტი, ₾' +
      '<input name="budget" type="number" step="any" min="0" value="' +
      esc(project.budget == null ? '' : String(project.budget)) + '"></label>' +
      '<label class="pc-note">თანხა ნაკვეთიდან, ₾' +
      '<input name="amount_per_household" type="number" step="any" min="1" ' +
      'value="' + esc(String(project.amount_per_household)) + '"></label>' +
      '</div>' +

      (draft
        ? '<p class="pr-dialog-sub">სტატუსი მონახაზია — „მიმდინარეზე" ' +
          'დამტკიცების ღილაკი გადაიყვანს.</p>'
        : '<label class="pc-note">სტატუსი<select name="status">' +
          statuses.map(function (item) {
            return '<option value="' + esc(item[0]) + '"' +
              (project.status === item[0] ? ' selected' : '') + '>' +
              esc(item[1]) + '</option>';
          }).join('') + '</select></label>') +

      '<p class="pr-dialog-sub">თანხის შეცვლა უკვე გადახდილ ნაკვეთს არ ' +
      'ეხება — ვინც შემოიტანა, ის დავალიანებაში არ უნდა აღმოჩნდეს.</p>' +
      '<p class="pr-dialog-error" hidden></p>' +
      '<div class="pc-confirm-act">' +
      '<button type="button" data-cancel="1">გაუქმება</button>' +
      '<button type="submit" class="pc-confirm-yes">შენახვა</button>' +
      '</div></form>';

    document.body.appendChild(dialog);
    document.body.classList.add('sheet-open');
    const close = function () {
      dialog.remove();
      document.body.classList.remove('sheet-open');
    };
    dialog.querySelector('[data-cancel]').addEventListener('click', close);
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) close();
    });

    const errorBox = dialog.querySelector('.pr-dialog-error');
    const submit = dialog.querySelector('[type="submit"]');
    dialog.querySelector('form').addEventListener('submit', async function (event) {
      event.preventDefault();
      errorBox.hidden = true;
      submit.disabled = true;
      try {
        const status = draft ? 'draft' : dialog.querySelector('[name="status"]').value;
        const result = await API.call('updateProject', {
          id: project.id,
          name: dialog.querySelector('[name="name"]').value,
          description: dialog.querySelector('[name="description"]').value,
          budget: dialog.querySelector('[name="budget"]').value,
          amount_per_household: dialog.querySelector('[name="amount_per_household"]').value,
          status: status,
        });
        close();
        // ჩუმად რომ გაგვევლო, ადმინი იფიქრებდა, რომ ახალი წილი ყველას
        // შეეხო — და ჯამები მოულოდნელი გამოუვიდოდა.
        if (result && Number(result.kept) > 0) {
          UI.showError('თანხა შეიცვალა ' + result.repriced + ' ნაკვეთზე; ' +
            result.kept + ' უკვე გადახდილს არ შევეხეთ.');
        }
        await openProject(project.id);
      } catch (error) {
        errorBox.textContent = error.message || 'ვერ შეინახა';
        errorBox.hidden = false;
        submit.disabled = false;
      }
    });
  }

  async function openStaff() {
    if (!user || user.role !== 'admin' || !current) return;
    const project = current.project;

    let people = [];
    try {
      people = await API.call('users');
    } catch (error) {
      UI.showError(error.message || 'მომხმარებლები ვერ ჩაიტვირთა');
      return;
    }
    const active = people.filter(function (person) {
      return ['member', 'moderator', 'admin'].indexOf(person.role) !== -1;
    });

    /*
     * ჩამოსაშლელის ნაცვლად მონიშვნების სია.
     *
     * `<select multiple>` ტელეფონზე Ctrl-ის დაჭერას მოითხოვს და
     * მონიშნული სტრიქონები ეკრანზე ერთდროულად არ ჩანს. აქ თითო კაცი
     * ცალკე ჩექბოქსია: ერთი შეხედვით ჩანს, ვინ არის შიგნით და ვინ არა.
     */
    const list = function (field, chosen) {
      return '<div class="pr-pick">' + active.map(function (person) {
        const label = String(person.display_name || '').trim() || person.email;
        return '<label class="pr-pick-i">' +
          '<input type="checkbox" name="' + field + '" value="' +
          esc(person.email) + '"' +
          (chosen.indexOf(person.email) === -1 ? '' : ' checked') + '>' +
          '<span class="pr-pick-n">' + esc(label) + '</span>' +
          '<span class="pr-pick-e">' + esc(person.email) + '</span>' +
          '</label>';
      }).join('') + '</div>';
    };

    const picked = function (field) {
      return Array.prototype.map.call(
        dialog.querySelectorAll('[name="' + field + '"]:checked'),
        function (box) { return box.value; });
    };

    const dialog = document.createElement('div');
    dialog.className = 'pr-dialog';
    dialog.innerHTML =
      '<form class="pr-dialog-box">' +
      '<h3>ვინ პასუხობს პროექტზე</h3>' +
      '<div class="pr-pick-g"><p class="pr-pick-h">მოდერატორები — ' +
      'ზარები და სტატუსები</p>' + list('moderators', project.moderators || []) +
      '</div>' +
      '<div class="pr-pick-g"><p class="pr-pick-h">ხაზინდრები — ' +
      'გადახდები</p>' + list('treasurers', project.treasurers || []) + '</div>' +
      '<p class="pr-dialog-sub">მოდერატორად დანიშვნა მაცხოვრებელს ' +
      'მოდერატორის როლსაც აძლევს — უფლების გარეშე დანიშვნა ცარიელი ' +
      'ჟესტი იქნებოდა.</p>' +
      '<p class="pr-dialog-error" hidden></p>' +
      '<div class="pc-confirm-act">' +
      '<button type="button" data-cancel="1">გაუქმება</button>' +
      '<button type="submit" class="pc-confirm-yes">შენახვა</button>' +
      '</div></form>';

    document.body.appendChild(dialog);
    document.body.classList.add('sheet-open');
    const close = function () {
      dialog.remove();
      document.body.classList.remove('sheet-open');
    };
    dialog.querySelector('[data-cancel]').addEventListener('click', close);
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) close();
    });

    const errorBox = dialog.querySelector('.pr-dialog-error');
    const submit = dialog.querySelector('[type="submit"]');
    dialog.querySelector('form').addEventListener('submit', async function (event) {
      event.preventDefault();
      errorBox.hidden = true;
      submit.disabled = true;
      try {
        // ორივე ველი ერთად მიდის: გამოტოვებულს ბაზა ასუფთავებს.
        await API.call('setProjectStaff', {
          id: project.id,
          moderators: picked('moderators'),
          treasurers: picked('treasurers'),
        });
        close();
        await openProject(project.id);
      } catch (error) {
        errorBox.textContent = error.message || 'ვერ შეინახა';
        errorBox.hidden = false;
        submit.disabled = false;
      }
    });
  }

  function openNewProject() {
    if (!canCreate()) return;
    ProjectForm.open(window.PLOTS || [], async function (id) {
      list = await API.call('projects');
      await openProject(id);
    });
  }

  /**
   * დამტკიცება ორ დაჭერას ითხოვს.
   *
   * `confirm()` განზრახ არ გამოიყენება: ბრაუზერის მოდალი გვერდს კეტავს
   * და ეკრანზე ინგლისურ ჩარჩოში ჩასმულ ქართულ ტექსტს აჩვენებს. მეორე
   * დაჭერა იმავეს აკეთებს, ოღონდ გვერდის ენაზე — და შემთხვევითი
   * დაჭერისგანაც ისევე იცავს.
   */
  async function confirmApprove(button) {
    const id = button.getAttribute('data-approve');
    if (button.getAttribute('data-armed') !== '1') {
      button.setAttribute('data-armed', '1');
      button.textContent = 'დარწმუნებული ხარ? დააჭირე ისევ';
      button.classList.add('pr-armed');
      setTimeout(function () {
        if (!button.isConnected) return;
        button.removeAttribute('data-armed');
        button.textContent = 'დამტკიცება';
        button.classList.remove('pr-armed');
      }, 5000);
      return;
    }

    button.disabled = true;
    button.textContent = 'მტკიცდება…';
    try {
      const result = await API.call('approveProject', { id: id });
      UI.showError('პროექტი დამტკიცდა — შეიქმნა ' + result.pledges + ' ვალდებულება');
      list = await API.call('projects');
      await openProject(id);
    } catch (error) {
      UI.showError(error.message || 'დამტკიცება ვერ მოხერხდა');
      button.disabled = false;
      button.textContent = 'დამტკიცება';
      button.removeAttribute('data-armed');
      button.classList.remove('pr-armed');
    }
  }

  function refresh() { if (planInstance) planInstance.refresh(); }

  return { render: render, bind: bind, refresh: refresh, openProject: openProject };
})();
