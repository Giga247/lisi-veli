/**
 * ერთჯერადი დაყენება — რედაქტორიდან ერთი გაშვებით.
 *
 * ცალკე ფაილში ცხოვრობს განზრახ: Apps Script-ის „Run"-ის ჩამონათვალი
 * აქტიური ფაილის პირველ ფუნქციას ირჩევს ნაგულისხმევად, და ერთფუნქციან
 * ფაილში არჩევანი ცალსახაა. `Code.gs`-ში ეს ფუნქცია ოცდაათი სხვას
 * შორის დაიკარგებოდა და ჩამონათვალიდან ხელით ამორჩევა საჭირო იქნებოდა.
 *
 * სამივე ნაბიჯი იდემპოტენტურია — განმეორებით გაშვება უსაფრთხოა.
 *
 * **რიგი მნიშვნელოვანია.** გააქტიურება თითოეულ ნაკვეთს წილს უყინავს
 * (`handleActivateProject`), ამიტომ ნაკვეთების სია მანამდე უნდა იყოს
 * საბოლოო. თუ იმპორტი გააქტიურების შემდეგ დაამატებდა ნაკვეთს, იმ კომლს
 * ვალდებულების ჩანაწერი საერთოდ არ გაუჩნდებოდა — პროექტში უხილავი
 * დარჩებოდა. ამიტომ: ფურცლები → იმპორტი → პროექტი.
 */
function setupEverything() {
  const report = [];

  report.push('── ფურცლები ──');
  setupProjectSheets().forEach(function (line) { report.push('  ' + line); });

  report.push('── ნაკვეთები და ტელეფონები Drive-ის CSV-დან ──');
  try {
    const result = importPlotsFromDrive();
    report.push('  CSV რიგი: ' + result.csvRows);
    report.push('  დაემატა: ' + result.added);
    report.push('  შეიცვალა უჯრა: ' + result.changedCells);
    report.push('  ტელეფონით: ' + countPhones_());
  } catch (error) {
    report.push('  ⚠ ' + error.message);
  }

  report.push('── პირველი პროექტი ──');
  try {
    const project = seedDrainageProject();
    report.push('  კომლი: ' + (project.households || '—'));
    if (project.roundingDiff !== undefined) {
      report.push('  დამრგვალების სხვაობა: ' + project.roundingDiff + ' ₾');
    }
  } catch (error) {
    report.push('  ⚠ ' + error.message);
  }

  report.forEach(function (line) { console.log(line); });
  return report;
}

/** რამდენ ნაკვეთს აქვს ტელეფონი. ნომრებს არ ბეჭდავს — მხოლოდ რიცხვს. */
function countPhones_() {
  const data = sheetRows(SHEET_PLOTS);
  let filled = 0;
  data.rows.forEach(function (row) {
    if (String(row[data.map.phone] || '').trim()) filled += 1;
  });
  return filled + ' / ' + data.rows.length;
}
