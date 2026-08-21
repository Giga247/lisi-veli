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

  let panel = null;
  let user = null;
  let list = [];
  let current = null;      // { project, totals, rows, payments }
  let planData = null;
  let planInstance = null;
  let filters = { street: '', tone: '', query: '' };

  const TONE_ORDER = ['paid', 'partial', 'promised', 'loan', 'none', 'declined'];

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
      '<div><dt>კომლი</dt><dd>' + project.households + '</dd></div>' +
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
    panel.innerHTML = '<div class="pr-list">' +
      '<h2>უბნის პროექტები</h2>' +
      (sorted.length === 0
        ? '<p class="pr-empty">პროექტი ჯერ არ არის.</p>'
        : sorted.map(projectCard).join('')) +
      '</div>';
  }

  /* ── ერთი პროექტი ────────────────────────────────────────────── */

  function figures(totals) {
    const cells = [
      ['შეგროვდა', totals.collected, 'pr-hero'],
      ['თანხას დებს', totals.promised, ''],
      ['ვალად იღებს', totals.loan, ''],
      ['არ დებს', totals.declined, ''],
      ['პასუხის გარეშე', totals.pending, ''],
      ['აკლია', totals.remaining, ''],
    ];
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

  /** რუკის დეტალების პანელი — პასუხი, წილი და ჩაწერის ღილაკი. */
  function detailExtra(record) {
    const row = rowByCad()[record.cad];
    if (!row) return '<p class="plan-owner-none">ეს ნაკვეთი პროექტში არ მონაწილეობს.</p>';
    const view = WebLib.pledgeView(row.status);
    const tone = WebLib.toneView(row.color);
    return '<div class="plan-owner"><dl>' +
      '<dt>მფლობელი</dt><dd>' + esc(ownerName(row)) + '</dd>' +
      '<dt>წილი</dt><dd>' + esc(WebLib.money(row.amount_due)) + '</dd>' +
      '<dt>გადახდილი</dt><dd>' + esc(WebLib.money(row.paid)) + '</dd>' +
      '<dt>პასუხი</dt><dd><span class="pr-tone tint-' + esc(row.color) + '">' +
      esc(tone.icon) + '</span> ' + esc(view.label) + '</dd>' +
      (row.recorded_by
        ? '<dt>ჩაწერა</dt><dd>' + esc(row.recorded_by) + '</dd>' : '') +
      '</dl>' + answerButton(row) + '</div>';
  }

  function answerButton(row) {
    if (!canAnswer(row)) return '';
    return '<button type="button" class="pr-answer" data-answer="' + esc(row.cad) + '">' +
      '📞 პასუხის ჩაწერა</button>';
  }

  function canAnswer(row) {
    if (!user || !current || current.project.status !== 'active') return false;
    if (user.role === 'admin') return true;
    if (user.role !== 'moderator') return false;
    return !!row.street && row.street === (user.street || '');
  }

  let byCadCache = null;
  function rowByCad() {
    if (!byCadCache) {
      byCadCache = {};
      current.rows.forEach(function (row) { byCadCache[row.cad] = row; });
    }
    return byCadCache;
  }

  function streetTable(rows) {
    const breakdown = WebLib.streetBreakdown(rows);
    return '<details class="pr-streets" open><summary>ქუჩების ჭრილი</summary>' +
      '<table><thead><tr><th>ქუჩა</th><th>კომლი</th><th>წილი</th>' +
      '<th>შემოვიდა</th><th>პასუხის გარეშე</th></tr></thead><tbody>' +
      breakdown.map(function (street) {
        return '<tr><td>' + esc(street.street) + '</td><td>' + street.total + '</td>' +
          '<td>' + esc(WebLib.money(street.due)) + '</td>' +
          '<td>' + esc(WebLib.money(street.paid)) + '</td>' +
          '<td>' + street.counts.none + '</td></tr>';
      }).join('') + '</tbody></table></details>';
  }

  function householdTable(rows) {
    const shown = WebLib.filterPledgeRows(rows, filters);
    const streets = [];
    rows.forEach(function (row) {
      const street = row.street || '';
      if (street && streets.indexOf(street) === -1) streets.push(street);
    });
    streets.sort();

    return '<div class="pr-table">' +
      '<div class="pr-filters">' +
      '<input type="search" id="pr-q" placeholder="ძებნა — მფლობელი, კოდი, მისამართი" ' +
      'value="' + esc(filters.query) + '" aria-label="ძებნა">' +
      '<select id="pr-street" aria-label="ქუჩა"><option value="">ყველა ქუჩა</option>' +
      streets.map(function (street) {
        return '<option value="' + esc(street) + '"' +
          (filters.street === street ? ' selected' : '') + '>' + esc(street) + '</option>';
      }).join('') + '</select>' +
      '<select id="pr-tone" aria-label="მდგომარეობა"><option value="">ყველა პასუხი</option>' +
      TONE_ORDER.map(function (tone) {
        return '<option value="' + tone + '"' + (filters.tone === tone ? ' selected' : '') +
          '>' + esc(WebLib.toneView(tone).label) + '</option>';
      }).join('') + '</select>' +
      '<span class="pr-count">' + shown.length + ' / ' + rows.length + '</span>' +
      '</div>' +
      '<table><thead><tr><th>მისამართი</th><th>მფლობელი</th><th>წილი</th>' +
      '<th>გადახდილი</th><th>პასუხი</th><th>ჩაწერა</th><th></th></tr></thead><tbody>' +
      shown.map(function (row) {
        const view = WebLib.pledgeView(row.status);
        const tone = WebLib.toneView(row.color);
        return '<tr><td>' + esc(row.address || row.cad) + '</td>' +
          '<td>' + esc(ownerName(row)) + '</td>' +
          '<td>' + esc(WebLib.money(row.amount_due)) + '</td>' +
          '<td>' + esc(WebLib.money(row.paid)) + '</td>' +
          '<td><span class="pr-tone tint-' + esc(row.color) + '">' + esc(tone.icon) +
          '</span> ' + esc(view.short) + '</td>' +
          '<td class="pr-by">' + esc(row.recorded_by || '—') + '</td>' +
          '<td>' + (canAnswer(row)
            ? '<button type="button" class="pr-answer" data-answer="' + esc(row.cad) +
              '" aria-label="პასუხის ჩაწერა">✏️</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderProject() {
    const project = current.project;
    const totals = current.totals;
    byCadCache = null;

    panel.innerHTML =
      '<div class="pr-page">' +
      '<button type="button" class="pr-back" data-back="1">← ყველა პროექტი</button>' +
      '<header class="pr-head"><h2>' + esc(project.name) + '</h2>' +
      '<span class="pr-status pr-status-' + esc(project.status) + '">' +
      esc(statusLabel(project.status)) + '</span></header>' +
      (project.description ? '<p class="pr-desc">' + esc(project.description) + '</p>' : '') +
      figures(totals) +
      progressBar(totals) +
      '<div id="pr-plan"></div>' +
      streetTable(current.rows) +
      householdTable(current.rows) +
      '</div>';

    renderPlan();
  }

  function renderPlan() {
    const host = document.getElementById('pr-plan');
    if (!host) return;
    const paint = function () {
      const map = rowByCad();
      planInstance = PlanView.create(host, planData, {
        tint: function (cad) { return map[cad] ? map[cad].color : 'none'; },
        legend: legendHtml(current.rows),
        extra: detailExtra,
      });
    };
    if (planData) { paint(); return; }
    PlanView.load().then(function (data) { planData = data; paint(); })
      .catch(function () {
        host.innerHTML = '<p class="pr-empty">გეგმა ვერ ჩაიტვირთა — ' +
          'ცხრილი ქვემოთ სრულია.</p>';
      });
  }

  /* ── პასუხის ჩაწერა ──────────────────────────────────────────── */

  function openAnswer(cad) {
    const row = rowByCad()[cad];
    if (!row || !canAnswer(row)) return;

    const dialog = document.createElement('div');
    dialog.className = 'pr-dialog';
    dialog.innerHTML =
      '<form class="pr-dialog-box">' +
      '<h3>' + esc(ownerName(row)) + '</h3>' +
      '<p class="pr-dialog-sub">' + esc(row.address || row.cad) + ' · წილი ' +
      esc(WebLib.money(row.amount_due)) + '</p>' +
      (row.phone ? '<p><a href="tel:' + esc(row.phone) + '">' + esc(row.phone) + '</a></p>' : '') +
      '<fieldset><legend>რა უპასუხა?</legend>' +
      Object.keys(WebLib.PLEDGE_VIEW).map(function (key) {
        const view = WebLib.PLEDGE_VIEW[key];
        return '<label class="pr-choice"><input type="radio" name="status" value="' + key + '"' +
          (row.status === key ? ' checked' : '') + '> <span>' + esc(view.label) + '</span></label>';
      }).join('') + '</fieldset>' +
      '<label class="pr-note">შენიშვნა<textarea name="note" rows="2" maxlength="500">' +
      esc(row.note || '') + '</textarea></label>' +
      '<p class="pr-dialog-error" hidden></p>' +
      '<div class="pr-dialog-actions">' +
      '<button type="button" data-cancel="1">გაუქმება</button>' +
      '<button type="submit">შენახვა</button></div></form>';
    document.body.appendChild(dialog);

    const form = dialog.querySelector('form');
    const errorBox = dialog.querySelector('.pr-dialog-error');
    const close = function () { dialog.remove(); };
    dialog.querySelector('[data-cancel]').addEventListener('click', close);
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) close();
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const status = form.querySelector('input[name="status"]:checked');
      if (!status) {
        errorBox.textContent = 'აირჩიეთ პასუხი';
        errorBox.hidden = false;
        return;
      }
      // ღილაკი ითიშება, დიალოგი კი ღია რჩება პასუხამდე — წინააღმდეგ
      // შემთხვევაში შეცდომისას აკრეფილი შენიშვნა დაიკარგებოდა.
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.textContent = 'ინახება…';
      try {
        await API.call('setPledge', {
          project_id: current.project.id,
          cad: cad,
          status: status.value,
          note: form.querySelector('textarea[name="note"]').value,
        });
        close();
        await openProject(current.project.id);
      } catch (error) {
        errorBox.textContent = error.message || 'შენახვა ვერ მოხერხდა';
        errorBox.hidden = false;
        submit.disabled = false;
        submit.textContent = 'შენახვა';
      }
    });
  }

  /* ── ნაკადი ──────────────────────────────────────────────────── */

  async function openProject(id) {
    try {
      current = await API.call('project', { id: id });
      filters = { street: '', tone: '', query: '' };
      renderProject();
    } catch (error) {
      UI.showError(error.message || 'პროექტი ვერ ჩაიტვირთა');
    }
  }

  async function render(currentUser) {
    user = currentUser;
    panel = UI.el('panel-projects');
    panel.innerHTML = '<p class="pr-empty">იტვირთება…</p>';
    try {
      list = await API.call('projects');
    } catch (error) {
      panel.innerHTML = '<p class="pr-empty">პროექტები ვერ ჩაიტვირთა — ' +
        esc(error.message || '') + '</p>';
      return;
    }
    current = null;
    renderList();
  }

  function bind() {
    const host = UI.el('panel-projects');
    if (!host || host._bound) return;
    host._bound = true;

    host.addEventListener('click', function (event) {
      const target = event.target;
      const card = target.closest && target.closest('[data-open]');
      if (card) { openProject(card.getAttribute('data-open')); return; }
      if (target.closest && target.closest('[data-back]')) { renderList(); return; }
      const answer = target.closest && target.closest('[data-answer]');
      if (answer) { openAnswer(answer.getAttribute('data-answer')); }
    });

    host.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest && event.target.closest('[data-open]');
      if (!card) return;
      event.preventDefault();
      openProject(card.getAttribute('data-open'));
    });

    // ფილტრები ცხრილს თავიდან ხატავენ, ამიტომ მოვლენა დელეგირებულია.
    host.addEventListener('input', function (event) {
      if (event.target.id !== 'pr-q') return;
      filters.query = event.target.value;
      refreshTable(true);
    });
    host.addEventListener('change', function (event) {
      if (event.target.id === 'pr-street') filters.street = event.target.value;
      else if (event.target.id === 'pr-tone') filters.tone = event.target.value;
      else return;
      refreshTable(false);
    });
  }

  /**
   * მხოლოდ ცხრილს ხატავს თავიდან — რუკას ხელს არ ახლებს.
   * გვერდის სრული გადახატვა ძებნის ველიდან ფოკუსს იპარავდა.
   */
  function refreshTable(keepFocus) {
    const box = UI.el('panel-projects').querySelector('.pr-table');
    if (!box || !current) return;
    const caret = keepFocus ? document.getElementById('pr-q').selectionStart : null;
    box.outerHTML = householdTable(current.rows);
    if (keepFocus) {
      const field = document.getElementById('pr-q');
      field.focus();
      if (caret != null) field.setSelectionRange(caret, caret);
    }
  }

  function refresh() { if (planInstance) planInstance.refresh(); }

  return { render: render, bind: bind, refresh: refresh, openProject: openProject };
})();
