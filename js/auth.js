/**
 * ავტორიზაცია Supabase Auth-ით (Google provider).
 *
 * წინა ვერსია Google Identity Services-ს იყენებდა და ID token-ს მხოლოდ
 * მეხსიერებაში ინახავდა. ახლა სესიას supabase-js მართავს: ის თვითონ
 * ინახავს, თვითონ განაახლებს ვადის გასვლამდე და გვერდის გადატვირთვას
 * გადაურჩება. `Auth`-ის გარე ინტერფეისი განზრახ უცვლელია, რომ
 * `main.js`-ს და დანარჩენებს არ შეხებოდა.
 */
const Auth = (function () {
  const client = supabase.createClient(
    CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

  let session = null;

  async function init(callback) {
    const button = document.getElementById('signin-button');
    if (button) {
      button.innerHTML =
        '<button type="button" class="signin-google">Google-ით შესვლა</button>';
      button.querySelector('button').addEventListener('click', signIn);
    }

    // `detectSessionInUrl` Google-იდან დაბრუნებულ ფრაგმენტს თვითონ კითხულობს
    // და სესიად აქცევს, ამიტომ აქ უკვე მზა სესიას ვიღებთ.
    const { data } = await client.auth.getSession();
    session = data.session;

    // გადაწყვეტილება მომხმარებლის id-ზეა და არა სესიის არსებობაზე:
    // ტოკენის განახლებისას სესია წამით ქრება და ბრუნდება, რაც
    // „ახალ შესვლად" ჩაითვლებოდა და მთელ აპს თავიდან ახატვინებდა.
    let signedInAs = session ? session.user.id : null;

    client.auth.onAuthStateChange(function (_event, next) {
      session = next;
      const nextId = next ? next.user.id : null;
      if (nextId && nextId !== signedInAs) {
        signedInAs = nextId;
        if (callback) callback();
        return;
      }
      if (!nextId && _event === 'SIGNED_OUT') signedInAs = null;
    });

    if (session && callback) callback();
    return Boolean(session);
  }

  function signIn() {
    // `redirectTo` აუცილებლად მიმდინარე გვერდია — GitHub Pages-ზე საიტი
    // ქვესაქაღალდეშია და ნაგულისხმევი (საიტის ფესვი) 404-ს დააბრუნებდა.
    return client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname },
    });
  }

  function getClient() { return client; }

  /**
   * მიმდინარე სესია — ყოველთვის კლიენტს ვეკითხებით, არასდროს ქეშს.
   *
   * ადრე სესია მოდულის ცვლადში ეწერა და `onAuthStateChange`-იდან
   * ნახლდებოდა. ტოკენის განახლების მომენტში იმ ცვლადში null ჩავარდებოდა
   * და ისე რჩებოდა შემდეგ მოვლენამდე — შედეგად სრულიად ავტორიზებული
   * მომხმარებელი „შესვლა საჭიროა"-ს იღებდა. `getSession()` შიგნით
   * მიმდინარე განახლებას ელოდება და სწორ პასუხს აბრუნებს.
   */
  async function getSession() {
    const { data } = await client.auth.getSession();
    session = data.session;
    return session;
  }

  async function getToken() {
    const active = await getSession();
    return active ? active.access_token : null;
  }

  async function getUser() {
    const active = await getSession();
    return active ? active.user : null;
  }

  /**
   * სესიის ხელახლა შემოწმება.
   *
   * `refreshSession()`-ს **განზრახ არ ვიძახებთ.** `autoRefreshToken`
   * ჩართულია და supabase-js თვითონ ანახლებს ტოკენს ვადის გასვლამდე;
   * ჩვენი ხელით გამოძახება მასთან რბოლაში ვარდებოდა და ორივე ერთსა და
   * იმავე refresh-ტოკენს ხმარობდა. ტოკენები როტაციულია, ამიტომ მეორე
   * მცდელობა უკვე გამოყენებულ ტოკენს აგზავნიდა — Supabase ამას ქურდობად
   * კითხულობს და მთელ სესიას აუქმებს. შედეგად მომხმარებელი შემთხვევით
   * მომენტში სრულიად გამოდიოდა სისტემიდან.
   *
   * `getSession()` უსაფრთხოა: ის მიმდინარე განახლებას ელოდება და
   * საჭიროების შემთხვევაში თვითონ ანახლებს, ერთხელ.
   */
  async function refresh() {
    return Boolean(await getSession());
  }

  async function signOut() {
    await client.auth.signOut();
    session = null;
    location.reload();
  }

  return {
    init: init, signIn: signIn, signOut: signOut,
    getClient: getClient, getSession: getSession,
    getToken: getToken, getUser: getUser, refresh: refresh,
  };
})();
