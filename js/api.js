/**
 * ბაზასთან საუბრის ერთადერთი ფაილი. ყველა სხვა ფაილი მხოლოდ ამას იძახებს.
 *
 * გარე ინტერფეისი — `API.call(action, payload)` — იგივეა, რაც Apps Script-ის
 * დროს იყო: აბრუნებს მონაცემს ან აგდებს Error-ს `.code`-ით. `main.js`,
 * `table.js` და `admin.js` შეცდომებს მხოლოდ `.code`-ით მარშრუტავენ, ასე რომ
 * კოდების ნაკრები განზრახ შენარჩუნებულია.
 *
 * განსხვავება ერთია და არსებითი: უფლებებს აღარ ვამოწმებთ „ჩვენით" —
 * ამოწმებს RLS. აქაური შემოწმებები მხოლოდ იმისთვისაა, რომ მომხმარებელმა
 * ქართული შეტყობინება დაინახოს Postgres-ის ინგლისური უარის ნაცვლად.
 */
const API = (function () {
  const sb = Auth.getClient();

  const ROLES_MEMBER = ['member', 'moderator', 'admin'];
  const ROLES_STAFF = ['moderator', 'admin'];

  function fail(code, message) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }

  /** PostgREST-ის შეცდომა -> ჩვენი კოდი. */
  function fromPostgrest(error) {
    if (!error) return;
    // 42501 = permission denied, PGRST301 = ვადაგასული ტოკენი.
    if (error.code === 'PGRST301' || error.code === '401') fail('UNAUTHENTICATED', 'სესია ამოიწურა');
    if (error.code === '42501') fail('FORBIDDEN', 'ამ მოქმედების უფლება არ გაქვთ');
    if (error.code === '23505') fail('CONFLICT', 'ასეთი ჩანაწერი უკვე არსებობს');
    // RPC-ების `raise exception ... using errcode` — შეტყობინება უკვე
    // ქართულია, ამიტომ ისე გადმოგვაქვს, როგორც ბაზამ დაწერა.
    if (error.code === '22023') fail('VALIDATION', error.message);
    if (error.code === 'P0002') fail('NOT_FOUND', error.message);
    fail('SERVER', 'ბაზასთან კავშირი ვერ დამყარდა');
  }

  async function profile() {
    const user = await Auth.getUser();
    if (!user) fail('UNAUTHENTICATED', 'შესვლა საჭიროა');
    const { data, error } = await sb
      .from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) fromPostgrest(error);
    if (!data) fail('NO_ACCOUNT', 'ანგარიში ვერ მოიძებნა');
    return data;
  }

  /** პროფილი + სტატუსის შემოწმება. ყველა action ამით იწყება, გარდა requestAccess-ისა. */
  async function active(roles) {
    const me = await profile();
    if (me.role === 'pending') fail('PENDING', 'თქვენი მოთხოვნა დამტკიცების პროცესშია');
    if (me.role === 'blocked') fail('BLOCKED', 'წვდომა შეზღუდულია');
    if (roles && roles.indexOf(me.role) === -1) {
      fail('FORBIDDEN', 'ამ მოქმედების უფლება არ გაქვთ');
    }
    return me;
  }

  // ── action-ები ──────────────────────────────────────────────────────

  async function actionMe() {
    return await active(ROLES_MEMBER);
  }

  /**
   * ანგარიშის მოთხოვნა.
   *
   * პროფილს ახლა ბაზის ტრიგერი ქმნის `auth.users`-ში ჩაწერისთანავე, ასე
   * რომ ცალკე „მოთხოვნის გაგზავნა" აღარ არსებობს — უბრალოდ ვამოწმებთ,
   * გაჩნდა თუ არა. თუ ჯერ არა, ეს ტრიგერსა და ამ მოთხოვნას შორის რბოლაა.
   */
  async function actionRequestAccess() {
    const me = await profile();
    fail('PENDING', me.role === 'pending'
      ? 'მოთხოვნა გაგზავნილია. ადმინი დაგიდასტურებთ.'
      : 'თქვენი მოთხოვნა დამტკიცების პროცესშია');
  }

  // `*` აქ განზრახ არ არის: `phone`-ზე `authenticated`-ს უფლება აღარ აქვს
  // და `select('*')` მთელ მოთხოვნას ჩააგდებდა. სვეტების სია ბაზის
  // სვეტობრივ უფლებებს ზუსტად იმეორებს.
  const PLOT_COLUMNS = 'cad, street, num, address, area, purpose, ' +
    'first_name, last_name, lat, lon, geometry, source, note, ' +
    'updated_at, updated_by';

  async function actionPlots() {
    await active(ROLES_MEMBER);
    const { data, error } = await sb.from('plots').select(PLOT_COLUMNS)
      .order('street', { ascending: true }).order('num', { ascending: true });
    if (error) fromPostgrest(error);

    // ნომრები ცალკე მოთხოვნით — ბაზა თვითონ წყვეტს, დაგვიბრუნებს თუ არა.
    // უფლების არქონა ცარიელი ნაკრებია და არა შეცდომა, ამიტომ ჩავარდნაზე
    // უბრალოდ ნომრების გარეშე ვაგრძელებთ.
    const phones = await sb.rpc('plot_phones');
    if (!phones.error && phones.data) {
      const byCad = {};
      phones.data.forEach(function (row) { byCad[row.cad] = row.phone; });
      data.forEach(function (plot) { plot.phone = byCad[plot.cad] || null; });
    }
    return data;
  }

  async function actionUpdatePlot(payload) {
    const me = await active(ROLES_STAFF);
    const cad = String((payload && payload.cad) || '').trim();
    const fields = (payload && payload.fields) || {};
    const expected = payload && payload.expected_updated_at;

    if (!cad) fail('VALIDATION', 'საკადასტრო კოდი არ არის მითითებული');
    if (typeof expected !== 'string') {
      fail('VALIDATION', 'expected_updated_at სავალდებულოა');
    }

    const clean = {};
    for (const field in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, field)) continue;
      if (!WebLib.isEditableField(field)) {
        fail('FORBIDDEN', 'ველი არ ექვემდებარება რედაქტირებას: ' + field);
      }
      if (field === 'phone') {
        const phone = WebLib.normalizePhone(fields[field]);
        if (!phone.ok) fail('VALIDATION', phone.message);
        clean[field] = phone.value === '' ? null : phone.value;
      } else {
        const value = String(fields[field] == null ? '' : fields[field]).trim().slice(0, 200);
        clean[field] = value === '' ? null : value;
      }
    }
    if (Object.keys(clean).length === 0) fail('VALIDATION', 'შესაცვლელი ველი არ არის');

    // ოპტიმისტური ბლოკირება ერთ ატომურ მოთხოვნაშია: `updated_at`-ის
    // პირობა თავად UPDATE-შია, ასე რომ შემოწმებასა და ჩაწერას შორის
    // სხვისი ცვლილება ვერ ჩაეტევა. Apps Script-ს ამისთვის LockService
    // სჭირდებოდა — აქ ამას ბაზა თავად აკეთებს.
    const { data, error } = await sb.from('plots')
      .update(clean).eq('cad', cad).eq('updated_at', expected)
      .select(PLOT_COLUMNS);
    if (error) fromPostgrest(error);

    if (!data || data.length === 0) {
      const { data: exists } = await sb.from('plots').select('cad').eq('cad', cad).maybeSingle();
      if (!exists) fail('NOT_FOUND', 'ნაკვეთი ვერ მოიძებნა');
      fail('CONFLICT', 'ჩანაწერი სხვამ შეცვალა, გადატვირთეთ გვერდი');
    }

    const row = data[0];
    const changed = Object.keys(clean)
      .filter(function (key) { return String(row[key] == null ? '' : row[key]) !== ''; });
    return {
      cad: cad, updated_at: row.updated_at,
      changed: changed.length, fields: clean, updated_by: me.email,
    };
  }

  /**
   * მომხმარებლები ადმინის პანელისთვის.
   *
   * ხაზინდრობა პროფილში არ წერია — ის `projects.treasurer` ველია, ამიტომ
   * პროექტებსაც ვკითხულობთ და თითო მომხმარებელს ვამაგრებთ იმ პროექტების
   * სახელებს, სადაც ის ხაზინდარია. ეს მხოლოდ საჩვენებელია: შეცვლა
   * პროექტის ფორმაში ხდება და `setRole` მას არ ეხება.
   */
  async function actionUsers() {
    await active(['admin']);
    const [profiles, projects] = await Promise.all([
      sb.from('profiles').select('*').order('requested_at', { ascending: false }),
      sb.from('projects').select('id, name, treasurer, status'),
    ]);
    if (profiles.error) fromPostgrest(profiles.error);
    // პროექტების ჩავარდნა მომხმარებლების სიას არ აჩერებს — ხაზინდრობა
    // დამატებითი ინფორმაციაა, დამტკიცება კი მთავარი სამუშაო.
    const byEmail = projects.error
      ? {} : WebLib.treasurerIndex(projects.data);

    return profiles.data.map(function (profile) {
      const email = String(profile.email || '').trim().toLowerCase();
      return Object.assign({}, profile, { treasurer_of: byEmail[email] || [] });
    });
  }

  async function actionSetRole(payload) {
    const me = await active(['admin']);
    const email = String((payload && payload.email) || '').trim().toLowerCase();
    const role = String((payload && payload.role) || '').trim();
    const allowed = ['admin', 'moderator', 'member', 'pending', 'blocked'];
    if (!email) fail('VALIDATION', 'მეილი არ არის მითითებული');
    if (allowed.indexOf(role) === -1) fail('VALIDATION', 'უცნობი როლი: ' + role);
    if (email === me.email) fail('VALIDATION', 'საკუთარ როლს ვერ შეცვლით');

    // ქუჩა იმავე მოთხოვნაში მიდის. ადრე `admin.js` მას აგზავნიდა, აქ კი
    // ჩუმად იკარგებოდა: ადმინი ირჩევდა ქუჩას, „შენახვას" აჭერდა, შეცდომას
    // ვერ ხედავდა — და ველი მაინც ძველი რჩებოდა.
    const street = payload && payload.street !== undefined
      ? String(payload.street || '').trim() : null;

    const approving = role !== 'pending' && role !== 'blocked';
    const fields = {
      role: role,
      approved_at: approving ? new Date().toISOString() : null,
      approved_by: approving ? me.email : null,
    };
    if (payload && payload.street !== undefined) fields.street = street || null;

    const { data, error } = await sb.from('profiles').update(fields)
      .eq('email', email).select();
    if (error) fromPostgrest(error);
    if (!data || data.length === 0) fail('NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    return data[0];
  }

  async function actionLogs(payload) {
    await active(['admin']);
    const limit = Number(payload && payload.limit) || 200;
    // ძველი სახელები (`by`, `old`, `new`) alias-ებით ნარჩუნდება — `admin.js`
    // სწორედ მათ კითხულობს.
    const { data, error } = await sb.from('audit_log')
      .select('at, by:actor, action, cad, field, old:old_value, new:new_value')
      .order('at', { ascending: false }).limit(limit);
    if (error) fromPostgrest(error);
    return data;
  }

  // ── პროექტები ───────────────────────────────────────────────────────
  // ჯამებს და ფერებს კლიენტი ითვლის `WebLib`-ით. Apps Script-ის დროს ეს
  // სერვერზე ხდებოდა, რომ რუკა და ცხრილი ერთ პასუხს დაყრდნობოდნენ —
  // ახლა ისინი ერთსა და იმავე სუფთა ფუნქციას იძახებენ, რაც იმავეს
  // იძლევა და ერთი მოთხოვნით ნაკლებს.

  async function actionProjects() {
    await active(ROLES_MEMBER);
    const [projects, pledges, payments] = await Promise.all([
      sb.from('projects').select('*').order('created_at', { ascending: false }),
      sb.from('pledges').select('project_id, cad, amount_due, status'),
      sb.from('payments').select('project_id, cad, amount'),
    ]);
    [projects, pledges, payments].forEach(function (r) { if (r.error) fromPostgrest(r.error); });

    return projects.data.map(function (project) {
      const mine = pledges.data.filter(function (x) { return x.project_id === project.id; });
      const paid = payments.data.filter(function (x) { return x.project_id === project.id; });
      return Object.assign({}, project, {
        totals: WebLib.projectTotals(project, mine, paid),
        households: mine.length,
      });
    });
  }

  async function actionProject(payload) {
    await active(ROLES_MEMBER);
    const id = String((payload && payload.id) || '').trim();
    if (!id) fail('VALIDATION', 'პროექტის id არ არის მითითებული');

    const [project, pledges, payments, plots, photos, phones] = await Promise.all([
      sb.from('projects').select('*').eq('id', id).maybeSingle(),
      sb.from('pledges').select('*').eq('project_id', id),
      sb.from('payments').select('*').eq('project_id', id),
      sb.from('plots').select('cad, street, num, address, area, first_name, last_name'),
      sb.from('project_photos').select('*').eq('project_id', id).order('sort'),
      sb.rpc('plot_phones'),
    ]);
    [project, pledges, payments, plots, photos]
      .forEach(function (r) { if (r.error) fromPostgrest(r.error); });
    if (!project.data) fail('NOT_FOUND', 'პროექტი ვერ მოიძებნა');

    const plotByCad = {};
    plots.data.forEach(function (plot) { plotByCad[plot.cad] = plot; });
    // ნომერი მხოლოდ მაშინ მოვა, თუ ბაზამ დაუშვა — მოდერატორს, ადმინს
    // ან ამ პროექტის ხაზინდარს. სხვას ცარიელი ნაკრები უბრუნდება.
    const phoneByCad = {};
    if (!phones.error && phones.data) {
      phones.data.forEach(function (row) { phoneByCad[row.cad] = row.phone; });
    }

    const paidByCad = {};
    payments.data.forEach(function (payment) {
      paidByCad[payment.cad] = (paidByCad[payment.cad] || 0) + Number(payment.amount || 0);
    });

    const rows = pledges.data.map(function (pledge) {
      const plot = plotByCad[pledge.cad] || {};
      const paid = paidByCad[pledge.cad] || 0;
      return {
        cad: pledge.cad,
        street: plot.street || '', address: plot.address || '',
        area: plot.area == null ? null : Number(plot.area),
        first_name: plot.first_name || '', last_name: plot.last_name || '',
        phone: phoneByCad[pledge.cad] || '',
        amount_due: pledge.amount_due, status: pledge.status,
        note: pledge.note || '',
        recorded_by: pledge.recorded_by || '', recorded_at: pledge.recorded_at || '',
        paid: paid,
        color: WebLib.plotColor(pledge),
      };
    });

    return {
      project: project.data,
      totals: WebLib.projectTotals(project.data, pledges.data, payments.data),
      rows: rows,
      payments: payments.data,
      photos: await signPhotos(photos.data),
    };
  }

  /**
   * bucket კერძოა, ამიტომ პირდაპირი ბმული არ არსებობს — თითოეულ ფოტოს
   * ერთსაათიანი ხელმოწერილი URL ეძლევა.
   */
  async function signPhotos(rows) {
    if (!rows || rows.length === 0) return [];
    const paths = rows.map(function (row) { return row.path; });
    const { data, error } = await sb.storage
      .from('project-photos').createSignedUrls(paths, 3600);
    if (error) return rows.map(function (row) { return Object.assign({}, row, { url: null }); });
    const urlByPath = {};
    data.forEach(function (item) { urlByPath[item.path] = item.signedUrl; });
    return rows.map(function (row) {
      return Object.assign({}, row, { url: urlByPath[row.path] || null });
    });
  }

  async function actionSetPledge(payload) {
    await active(ROLES_STAFF);
    const projectId = String((payload && payload.project_id) || '').trim();
    const cad = String((payload && payload.cad) || '').trim();
    const status = String((payload && payload.status) || '').trim();
    const allowed = ['not_contacted', 'unreachable', 'paying', 'loan', 'declined', 'paid'];
    if (!projectId || !cad) fail('VALIDATION', 'პროექტი ან ნაკვეთი არ არის მითითებული');
    if (allowed.indexOf(status) === -1) fail('VALIDATION', 'უცნობი პასუხი: ' + status);

    const patch = {
      status: status,
      note: String((payload && payload.note) || '').trim().slice(0, 500) || null,
      recorded_at: new Date().toISOString(),
    };
    const { data, error } = await sb.from('pledges')
      .update(patch).eq('project_id', projectId).eq('cad', cad).select();
    if (error) fromPostgrest(error);
    if (!data || data.length === 0) fail('NOT_FOUND', 'ვალდებულება ვერ მოიძებნა');
    return data[0];
  }

  async function actionCreateProject(payload) {
    await active(ROLES_STAFF);
    const { data, error } = await sb.rpc('create_project', {
      p_name: String((payload && payload.name) || '').trim(),
      p_description: String((payload && payload.description) || '').trim(),
      p_budget: payload && payload.budget === '' ? null : Number(payload.budget),
      p_amount_per_household: Number(payload && payload.amount_per_household),
      p_cads: (payload && payload.cads) || [],
      p_treasurer: String((payload && payload.treasurer) || '').trim() || null,
    });
    if (error) fromPostgrest(error);
    return { id: data, status: 'draft' };
  }

  async function actionApproveProject(payload) {
    await active(['admin']);
    const { data, error } = await sb.rpc('approve_project', {
      p_id: String((payload && payload.id) || '').trim(),
    });
    if (error) fromPostgrest(error);
    return { id: payload.id, status: 'active', pledges: data };
  }

  const ACTIONS = {
    me: actionMe,
    requestAccess: actionRequestAccess,
    plots: actionPlots,
    updatePlot: actionUpdatePlot,
    users: actionUsers,
    setRole: actionSetRole,
    logs: actionLogs,
    projects: actionProjects,
    project: actionProject,
    setPledge: actionSetPledge,
    createProject: actionCreateProject,
    approveProject: actionApproveProject,
    recordPayment: actionRecordPayment,
    cancelPayment: actionCancelPayment,
  };

  /**
   * გადახდის ჩაწერა.
   *
   * როლი აქ `member`-ზეა გახსნილი განზრახ: ხაზინდარი გლობალური როლი არ
   * არის, ის პროექტის ველია. ნამდვილ შემოწმებას RLS აკეთებს —
   * `moderator`/`admin`, ან ამ კონკრეტული პროექტის ხაზინდარი.
   *
   * `recorded_by` აქ არ იგზავნება: მას ბაზის ტრიგერი სვამს სესიის
   * მიხედვით, რომ ფულის ისტორიაში ავტორი კლიენტს არ ეთქვა.
   */
  async function actionRecordPayment(payload) {
    await active(ROLES_MEMBER);
    const projectId = String((payload && payload.project_id) || '').trim();
    const cad = String((payload && payload.cad) || '').trim();
    const amount = Number(payload && payload.amount);
    const paidOn = String((payload && payload.paid_on) || '').trim();

    if (!projectId || !cad) fail('VALIDATION', 'პროექტი ან ნაკვეთი არ არის მითითებული');
    if (!isFinite(amount) || amount <= 0) fail('VALIDATION', 'თანხა დადებითი უნდა იყოს');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) fail('VALIDATION', 'გადახდის თარიღი არასწორია');

    const { data, error } = await sb.from('payments').insert({
      project_id: projectId, cad: cad, amount: amount,
      paid_on: paidOn,
      note: String((payload && payload.note) || '').trim().slice(0, 200) || null,
    }).select().single();
    if (error) fromPostgrest(error);
    return data;
  }

  /**
   * გადახდის გაუქმება არჩეული სტატუსით.
   *
   * ორივე ცვლილება — ჩანაწერის წაშლა და სტატუსის დაბრუნება — ერთ
   * ტრანზაქციაშია ბაზაში. კლიენტი რომ ორ ცალკე მოთხოვნას აგზავნიდეს,
   * შუაში ჩავარდნა ვალდებულებას წაშლილი ფულითა და ძველი სტატუსით
   * დატოვებდა.
   */
  async function actionCancelPayment(payload) {
    await active(ROLES_MEMBER);
    const projectId = String((payload && payload.project_id) || '').trim();
    const cad = String((payload && payload.cad) || '').trim();
    const status = String((payload && payload.status) || '').trim();
    const allowed = ['not_contacted', 'unreachable', 'paying', 'loan', 'declined'];
    if (!projectId || !cad) fail('VALIDATION', 'პროექტი ან ნაკვეთი არ არის მითითებული');
    if (allowed.indexOf(status) === -1) fail('VALIDATION', 'აირჩიეთ სტატუსი');

    const { data, error } = await sb.rpc('cancel_payment', {
      p_project_id: projectId, p_cad: cad, p_status: status,
    });
    if (error) fromPostgrest(error);
    return { cancelled: data };
  }

  /**
   * ფოტოს ატვირთვა. ორი ნაბიჯია — ფაილი Storage-ში, ჩანაწერი ცხრილში.
   *
   * თუ მეორე ჩავარდა, ატვირთულ ფაილს ვშლით: bucket-ში მიტოვებული ფაილი,
   * რომელზეც ვერავინ მიუთითებს, სამუდამოდ დარჩებოდა და ადგილს ჭამდა.
   */
  async function uploadPhoto(projectId, file, sort) {
    await active(ROLES_STAFF);
    const id = String(projectId || '').trim();
    if (!id) fail('VALIDATION', 'პროექტი არ არის მითითებული');
    if (!file) fail('VALIDATION', 'ფაილი არ არის არჩეული');
    if (file.size > 10 * 1024 * 1024) fail('VALIDATION', 'ფოტო 10 მბ-ზე დიდია: ' + file.name);

    const dot = file.name.lastIndexOf('.');
    const ext = dot === -1 ? 'jpg' : file.name.slice(dot + 1).toLowerCase();
    const path = id + '/' + crypto.randomUUID() + '.' + ext;

    const up = await sb.storage.from('project-photos')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) fail('SERVER', 'ფოტო ვერ აიტვირთა: ' + file.name);

    const { data, error } = await sb.from('project_photos')
      .insert({ project_id: id, path: path, sort: Number(sort) || 0 })
      .select().single();
    if (error) {
      await sb.storage.from('project-photos').remove([path]);
      fromPostgrest(error);
    }
    return data;
  }

  async function call(action, payload) {
    const handler = ACTIONS[action];
    if (!handler) fail('VALIDATION', 'უცნობი მოქმედება: ' + action);
    return await handler(payload || {});
  }

  /** UNAUTHENTICATED-ზე ერთხელ ცდილობს სესიის განახლებას და იმეორებს. */
  async function callWithRetry(action, payload) {
    try {
      return await call(action, payload);
    } catch (error) {
      if (error.code !== 'UNAUTHENTICATED') throw error;
      const refreshed = await Auth.refresh();
      if (!refreshed) throw error;
      return await call(action, payload);
    }
  }

  return { call: callWithRetry, uploadPhoto: uploadPhoto };
})();
