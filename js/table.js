/**
 * ნაკვეთების სია მთავარ გვერდზე.
 *
 * ცხრილი სტრიქონებად გადაკეთდა: ექვსსვეტიანი ცხრილი ტელეფონზე ან
 * ჰორიზონტალურად იჭიმებოდა, ან ისე იკუმშებოდა, რომ სახელი ორ ასოზე
 * წყდებოდა. თითო კომლი ერთი მწკრივია, დაჭერით — იგივე ბარათი, რასაც
 * რუკა ხსნის.
 */
const TableView = (function () {
  'use strict';

  const esc = function (v) { return WebLib.escapeHtml(v); };

  let plots = [];
  let user = null;
  let statusByCad = {};
  let project = null;
  let filters = { query: '', street: '', status: '' };

  function canEdit() {
    return user && (user.role === 'moderator' || user.role === 'admin');
  }

  function chips() {
    const streets = WebLib.streetList(plots);
    const status = Object.keys(WebLib.PLEDGE_VIEW);
    const one = function (group, value, label, on) {
      return '<button type="button" data-f="' + group + '" data-v="' + esc(value) +
        '"' + (on ? ' class="on"' : '') + '>' + esc(label) + '</button>';
    };
    return '<div class="chips">' +
      one('street', '', 'ყველა ქუჩა', filters.street === '') +
      streets.map(function (street) {
        return one('street', street, street, filters.street === street);
      }).join('') +
      '</div>' +
      (project
        ? '<div class="chips">' +
          one('status', '', 'ყველა სტატუსი', filters.status === '') +
          status.map(function (key) {
            return one('status', key, WebLib.PLEDGE_VIEW[key].label, filters.status === key);
          }).join('') + '</div>'
        : '');
  }

  function matches(plot) {
    if (filters.status) {
      const row = statusByCad[String(plot.cad).trim()];
      if (!row || row.status !== filters.status) return false;
    }
    return true;
  }

  function visible() {
    return WebLib.sortPlots(
      WebLib.filterPlots(plots, { query: filters.query, street: filters.street }),
      'street', 'asc').filter(matches);
  }

  function rowHtml(plot) {
    const row = statusByCad[String(plot.cad).trim()];
    const view = row ? WebLib.pledgeView(row.status) : null;
    const where = [plot.street, plot.num ? '№' + plot.num : '']
      .filter(Boolean).join(' ');
    return '<button type="button" class="it" data-cad="' + esc(plot.cad) + '">' +
      '<i class="dot' + (view ? ' tint-' + esc(row.status) : ' is-plain') + '"></i>' +
      '<span class="it-b">' +
      '<span class="it-n">' + esc(WebLib.fullName(plot) || '—') + '</span>' +
      '<span class="it-a">' + esc(where || plot.cad) + '</span></span>' +
      (view ? '<span class="it-s">' + esc(view.short) + '</span>' : '') +
      '</button>';
  }

  function draw() {
    const rows = visible();
    UI.el('list-count').textContent = rows.length + (rows.length === plots.length
      ? '' : ' / ' + plots.length);
    UI.el('list-rows').innerHTML = rows.length === 0
      ? '<p class="empty">ვერაფერი მოიძებნა.</p>'
      : rows.map(rowHtml).join('');
    UI.el('list-filters').innerHTML = chips();
  }

  function render(allPlots, currentUser, activeProject, projectRows) {
    plots = allPlots || [];
    user = currentUser;
    project = activeProject || null;
    statusByCad = {};
    (projectRows || []).forEach(function (row) {
      statusByCad[String(row.cad).trim()] = row;
    });

    const host = UI.el('home-list');
    host.innerHTML =
      '<div class="sec-h"><h2>ნაკვეთები</h2><span id="list-count" class="muted"></span></div>' +
      '<input id="list-q" type="search" placeholder="ძებნა — სახელი, მისამართი, კოდი">' +
      '<div id="list-filters"></div>' +
      '<div id="list-rows" class="list"></div>';

    // მოვლენები დელეგირებულია: სია და ჩიპები ყოველ ფილტრზე თავიდან
    // იხატება, ამიტომ პირდაპირ მიბმული მსმენელი პირველივე ძებნას
    // გადარჩებოდა.
    host.addEventListener('input', function (event) {
      if (event.target.id !== 'list-q') return;
      filters.query = event.target.value;
      draw();
    });
    host.addEventListener('click', function (event) {
      const chip = event.target.closest('[data-f]');
      if (chip) {
        filters[chip.getAttribute('data-f')] = chip.getAttribute('data-v');
        draw();
        return;
      }
      const item = event.target.closest('[data-cad]');
      if (item) MapView.openSheet(item.getAttribute('data-cad'));
    });

    draw();
  }

  function findPlot(cad) {
    return plots.filter(function (plot) { return plot.cad === cad; })[0];
  }

  const EDITABLE = [
    { key: 'first_name', label: 'სახელი' },
    { key: 'last_name', label: 'გვარი' },
    { key: 'phone', label: 'ტელეფონი' },
    { key: 'address', label: 'სრული მისამართი' },
    { key: 'num', label: 'N' },
    { key: 'note', label: 'შენიშვნა' },
  ];

  function openEditor(cad) {
    const plot = findPlot(cad);
    if (!plot || !canEdit()) return;

    const fields = EDITABLE.map(function (field) {
      return '<label>' + field.label +
        '<input data-field="' + field.key + '" value="' +
        WebLib.escapeHtml(plot[field.key]) +
        '"></label>';
    }).join('');

    const dialog = document.createElement('dialog');
    dialog.innerHTML =
      '<form method="dialog">' +
      '<h3>' + WebLib.escapeHtml(plot.address || plot.cad) + '</h3>' + fields +
      '<p class="dialog-error" data-error hidden></p>' +
      '<div class="controls">' +
      '<button data-save>შენახვა</button>' +
      '<button type="button" data-cancel>გაუქმება</button>' +
      '</div></form>';
    document.body.appendChild(dialog);
    dialog.showModal();

    const errorBox = dialog.querySelector('[data-error]');
    // `[data-save]`, და არა `[value="save"]`: ველების <input>-ებს ზემოთ
    // Sheet-იდან მოსული value აქვთ და თუ რომელიმე მათგანი სიტყვასიტყვით
    // "save"-ს შეიცავდა, querySelector სწორედ მას დააბრუნებდა (DOM-ში ისინი
    // ღილაკზე ადრე დგანან) — disabled არასწორ ელემენტზე დაჯდებოდა.
    const saveButton = dialog.querySelector('[data-save]');

    // `close` ერთადერთი ადგილია, სადაც dialog DOM-იდან იშლება — და ის
    // ყველა დახურვის გზაზე ისვლება: Escape, „გაუქმება" და წარმატებული
    // შენახვა. ასე ვერცერთ ტოტზე ვერ დარჩება მიტოვებული <dialog>.
    dialog.addEventListener('close', function () { dialog.remove(); });
    dialog.querySelector('[data-cancel]').addEventListener('click', function () {
      dialog.close();
    });

    dialog.querySelector('form').addEventListener('submit', async function (event) {
      // `method="dialog"`-ის ნაგულისხმევი ქცევა ფორმის გაგზავნისთანავე ხურავს
      // dialog-ს — ვაჩერებთ. თუ სერვერი VALIDATION-ს (მაგ. არასწორი ტელეფონი),
      // CONFLICT-ს ან ქსელის შეცდომას დააბრუნებს, მოდერატორის აკრეფილი ექვსივე
      // ველი ეკრანზე რჩება და შესწორება ხელახლა აკრეფის გარეშე შეიძლება.
      event.preventDefault();

      const changed = {};
      dialog.querySelectorAll('[data-field]').forEach(function (input) {
        changed[input.getAttribute('data-field')] = input.value;
      });

      errorBox.hidden = true;
      saveButton.disabled = true;
      try {
        const result = await API.call('updatePlot', {
          cad: cad,
          expected_updated_at: String(plot.updated_at || ''),
          fields: changed,
        });
        // სერვერი ინახავს გასუფთავებულ მნიშვნელობებს (მაგ. ტელეფონი +995-ით
        // ნორმალიზებული) — ვცდილობთ ვცადოთ ისინი, თუ სერვერმა `fields`
        // დააბრუნა; თუ არა (ძველი დეპლოი), მაინც არ დავტოვოთ რიგი ცარიელი.
        Object.assign(plot, result.fields || changed);
        plot.updated_at = result.updated_at;
        dialog.close();
        draw();
        // რუკის თავიდან ხატვა არ სჭირდება: `MapView` სიის იმავე
        // ობიექტებს იხსენებს, ამიტომ `Object.assign` მასაც ეხება.
        // გეომეტრია და სტატუსი კი რედაქტირებით არ იცვლება.
      } catch (error) {
        // შეცდომა თავად dialog-ში ჩანს და 6 წამში არ ქრება — ტოსტი
        // შესწორებისთვის საკმარისი დრო არ იყო, და მისი გაქრობის შემდეგ
        // მოდერატორს აღარაფერი რჩებოდა, გარდა ხელახლა აკრეფისა.
        errorBox.textContent = error.message;
        errorBox.hidden = false;
        saveButton.disabled = false;
      }
    });
  }

  return { render: render, openEditor: openEditor };
})();
