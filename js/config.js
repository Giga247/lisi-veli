/**
 * ერთადერთი კონფიგურაცია. ორივე მნიშვნელობა საჯაროა — Client ID
 * Google-ის დიზაინით ღიაა, Web App URL კი ტოკენის გარეშე არაფერს აბრუნებს.
 *
 * სიტყვა `ჩასვი` ორივე მნიშვნელობაში მარკერია, არა შემთხვევითი ტექსტი:
 * `js/main.js`-ის `configNotFilled()` სწორედ მას ეძებს და შესვლის ცდის
 * მაგივრად ქართულ ინსტრუქციას აჩვენებს. შევსებისას მთელი სტრიქონი
 * იცვლება რეალური მნიშვნელობით — იხ. `docs/setup.md`.
 */
const CONFIG = {
  CLIENT_ID: '653432134885-71vbd293jlgrceuujql2gtqf8m0g6iqr.apps.googleusercontent.com',
  API_URL: 'https://script.google.com/macros/s/ჩასვი-შენი-id/exec',
};
