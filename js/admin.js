const AdminView = (function () {
  const ROLES = [
    { value: 'member', label: 'მაცხოვრებელი — მხოლოდ ნახვა' },
    { value: 'moderator', label: 'მოდერატორი — რედაქტირება' },
    { value: 'admin', label: 'ადმინი — სრული წვდომა' },
    { value: 'blocked', label: 'დაბლოკილი' },
  ];

  async function render() {
    const panel = UI.el('panel-admin');
    panel.innerHTML = '<p>იტვირთება…</p>';
    try {
      const users = await API.call('users');
      const logs = await API.call('logs', { limit: 200 });
      draw(panel, users, logs);
    } catch (error) {
      UI.showError(error.message);
      panel.innerHTML = '<p>ჩატვირთვა ვერ მოხერხდა.</p>';
    }
  }

  function roleOptions(current) {
    return ROLES.map(function (role) {
      return '<option value="' + role.value + '"' +
        (role.value === current ? ' selected' : '') + '>' + role.label + '</option>';
    }).join('');
  }

  function streetOptions(current) {
    const streets = window.PLOTS ? WebLib.streetList(window.PLOTS) : [];
    const trimmedCurrent = String(current || '').trim();
    // მომხმარებლის შენახული ქუჩა შეიძლება არცერთ ნაკვეთზე აღარ ჩანდეს
    // (გადარქმეული, სხვანაირად აკრეფილი, ან ბოლო ნაკვეთი შეიცვალა) — ასეთ
    // შემთხვევაში streets-ს შორის selected ვერაფერი ემთხვევა და ბრაუზერი
    // პირველ option-ს (ქუჩის გარეშე) აირჩევდა ნაგულისხმევად. მხოლოდ როლის
    // შესაცვლელად შენახვისას ეს ჩუმად წაშლიდა ქუჩას — ამიტომ რეალური მნიშვნელობა
    // ყოველთვის უნდა ჩანდეს, თუნდაც არცერთ ნაკვეთს არ ეკუთვნოდეს.
    const isOrphan = trimmedCurrent && streets.indexOf(trimmedCurrent) === -1;
    const orphanOption = isOrphan
      ? '<option value="' + WebLib.escapeHtml(trimmedCurrent) + '" selected>' +
        WebLib.escapeHtml(trimmedCurrent) + ' (ნაკვეთებში არ გვხვდება)</option>'
      : '';
    return orphanOption + '<option value="">ქუჩის გარეშე</option>' +
      streets.map(function (street) {
        return '<option value="' + WebLib.escapeHtml(street) + '"' +
          (street === trimmedCurrent ? ' selected' : '') + '>' + WebLib.escapeHtml(street) + '</option>';
      }).join('');
  }

  function userRow(user) {
    return '<tr data-email="' + WebLib.escapeHtml(user.email) + '">' +
      '<td>' + WebLib.escapeHtml(user.email) + '</td>' +
      '<td>' + WebLib.escapeHtml(user.display_name || '—') + '</td>' +
      '<td><select data-role>' + roleOptions(user.role) + '</select></td>' +
      '<td><select data-street>' + streetOptions(user.street) + '</select></td>' +
      '<td><button data-save>შენახვა</button></td>' +
      '</tr>';
  }

  function draw(panel, users, logs) {
    const pending = users.filter(function (u) { return u.role === 'pending'; });
    const active = users.filter(function (u) { return u.role !== 'pending'; });

    panel.innerHTML =
      '<h3>დასამტკიცებელი მოთხოვნები (' + pending.length + ')</h3>' +
      (pending.length === 0 ? '<p>ახალი მოთხოვნა არ არის.</p>' :
        '<table><tbody>' + pending.map(userRow).join('') + '</tbody></table>') +
      '<h3>მომხმარებლები (' + active.length + ')</h3>' +
      '<table><thead><tr><th>მეილი</th><th>სახელი</th><th>როლი</th>' +
      '<th>ქუჩა</th><th></th></tr></thead><tbody>' +
      active.map(userRow).join('') + '</tbody></table>' +
      '<h3>ცვლილებების ლოგი</h3>' +
      '<table><thead><tr><th>დრო</th><th>ვინ</th><th>მოქმედება</th>' +
      '<th>კოდი</th><th>ველი</th><th>ძველი</th><th>ახალი</th></tr></thead><tbody>' +
      logs.map(function (row) {
        return '<tr><td>' + WebLib.escapeHtml(String(row.at).slice(0, 16).replace('T', ' ')) + '</td>' +
          '<td>' + WebLib.escapeHtml(row.by) + '</td><td>' + WebLib.escapeHtml(row.action) + '</td>' +
          '<td><code>' + WebLib.escapeHtml(row.cad) + '</code></td><td>' + WebLib.escapeHtml(row.field) + '</td>' +
          '<td>' + WebLib.escapeHtml(row.old || '—') + '</td><td>' + WebLib.escapeHtml(row.new || '—') + '</td></tr>';
      }).join('') + '</tbody></table>';

    panel.querySelectorAll('[data-save]').forEach(function (button) {
      button.addEventListener('click', async function () {
        const tr = button.closest('tr');
        try {
          await API.call('setRole', {
            email: tr.getAttribute('data-email'),
            role: tr.querySelector('[data-role]').value,
            street: tr.querySelector('[data-street]').value,
          });
          render();
        } catch (error) {
          UI.showError(error.message);
        }
      });
    });
  }

  return { render: render };
})();
