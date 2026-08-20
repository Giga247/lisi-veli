const TableView = (function () {
  let plots = [];
  let user = null;
  let sortKey = 'street';
  let sortDir = 'asc';

  const COLUMNS = [
    { key: 'street', label: 'ქუჩა' },
    { key: 'num', label: 'N' },
    { key: 'name', label: 'მფლობელი', sortable: false },
    { key: 'phone', label: 'ტელეფონი' },
    { key: 'area', label: 'ფართობი' },
    { key: 'cad', label: 'საკადასტრო კოდი' },
  ];

  /**
   * ველების მონაცემები Sheet-იდან მოდის და შეიძლება შეიცავდეს ნებისმიერ
   * სიმბოლოს (მათ შორის `"`, `<`, `>`, `&`) — ყველა ადგილას, სადაც ეს
   * მონაცემი HTML-ში embed-დება, escape-ვართ, თორემ ველი (მაგ. შენიშვნა
   * ან მისამართი) მარკაპს გატეხს ან attribute-დან გამოაპარებს.
   */
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function canEdit() {
    return user && (user.role === 'moderator' || user.role === 'admin');
  }

  function render(allPlots, currentUser) {
    plots = allPlots;
    user = currentUser;
    const panel = UI.el('panel-table');
    panel.innerHTML =
      '<div class="controls">' +
      '  <input id="tbl-search" type="search" placeholder="ძებნა…">' +
      '  <select id="tbl-street"><option value="">ყველა ქუჩა</option></select>' +
      '  <span id="tbl-count"></span>' +
      '</div><div id="tbl-body"></div>';

    const select = UI.el('tbl-street');
    WebLib.streetList(plots).forEach(function (street) {
      const option = document.createElement('option');
      option.value = street;
      option.textContent = street;
      select.appendChild(option);
    });

    UI.el('tbl-search').addEventListener('input', draw);
    select.addEventListener('change', draw);
    draw();
  }

  function draw() {
    const query = UI.el('tbl-search').value;
    const street = UI.el('tbl-street').value;
    const rows = WebLib.sortPlots(
      WebLib.filterPlots(plots, { query: query, street: street }),
      sortKey, sortDir);

    UI.el('tbl-count').textContent = rows.length + ' ნაკვეთი';

    const head = COLUMNS.map(function (column) {
      const arrow = (column.key === sortKey) ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      const attr = column.sortable === false ? '' :
        ' data-sort="' + column.key + '"';
      return '<th' + attr + '>' + column.label + arrow + '</th>';
    }).join('') + '<th></th>';

    const body = rows.map(function (plot) {
      const status = WebLib.mapStatus(plot);
      const flag = status === 'missing' ? ' 🚩' : (status === 'marker' ? ' 📍' : '');
      const phone = plot.phone
        ? '<a href="tel:' + escapeHtml(plot.phone) + '">' + escapeHtml(plot.phone) + '</a>'
        : '—';
      const edit = canEdit()
        ? '<button data-edit="' + escapeHtml(plot.cad) + '">✏️</button>' : '';
      return '<tr>' +
        '<td>' + escapeHtml(plot.street || '—') + flag + '</td>' +
        '<td>' + escapeHtml(plot.num || '—') + '</td>' +
        '<td>' + escapeHtml(WebLib.fullName(plot)) + '</td>' +
        '<td>' + phone + '</td>' +
        '<td>' + escapeHtml(plot.area || '—') + '</td>' +
        '<td>' + escapeHtml(plot.cad) + '</td>' +
        '<td>' + edit + '</td>' +
        '</tr>';
    }).join('');

    UI.el('tbl-body').innerHTML =
      '<table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';

    UI.el('tbl-body').querySelectorAll('[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        const key = th.getAttribute('data-sort');
        if (key === sortKey) { sortDir = (sortDir === 'asc') ? 'desc' : 'asc'; }
        else { sortKey = key; sortDir = 'asc'; }
        draw();
      });
    });
    UI.el('tbl-body').querySelectorAll('[data-edit]').forEach(function (button) {
      button.addEventListener('click', function () {
        openEditor(button.getAttribute('data-edit'));
      });
    });
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
        escapeHtml(plot[field.key]) +
        '"></label>';
    }).join('');

    const dialog = document.createElement('dialog');
    dialog.innerHTML =
      '<form method="dialog">' +
      '<h3>' + escapeHtml(plot.address || plot.cad) + '</h3>' + fields +
      '<div class="controls">' +
      '<button value="save">შენახვა</button>' +
      '<button value="cancel">გაუქმება</button>' +
      '</div></form>';
    document.body.appendChild(dialog);
    dialog.showModal();

    dialog.addEventListener('close', async function () {
      if (dialog.returnValue !== 'save') { dialog.remove(); return; }
      const changed = {};
      dialog.querySelectorAll('[data-field]').forEach(function (input) {
        changed[input.getAttribute('data-field')] = input.value;
      });
      dialog.remove();
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
        draw();
        if (window.MapView) MapView.render(plots, user);
      } catch (error) {
        UI.showError(error.message);
      }
    });
  }

  return { render: render, openEditor: openEditor };
})();
