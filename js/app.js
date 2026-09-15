const STORAGE_KEY = "overtime_tracker_v3";
const SALARY_KEY = "overtime_base_salary_v1";

// Dasar perhitungan lembur: upah sejam = gaji pokok / 173 jam sebulan.
const HOURS_PER_MONTH = 173;
const MULTIPLIER_FIRST = 1.5; // jam pertama di hari kerja
const MULTIPLIER_NEXT = 2; // jam ke-2 dst, dan seluruh jam di hari libur

const MEAL_ALLOWANCE = 15000;
const MEAL_MIN_HOURS = 2;

let records = load();
let baseSalary = loadSalary();
let editingId = null;
let searchTerm = "";

const form = document.getElementById("overtimeForm");
const dateInput = document.getElementById("date");
const hoursInput = document.getElementById("hours");
const holidayInput = document.getElementById("holiday");
const holidayPanel = document.getElementById("holidayPanel");
const submitBtn = document.getElementById("submitBtn");
const tableBody = document.getElementById("tableBody");
const searchInput = document.getElementById("search");
const datePickerWrap = document.getElementById("datePickerWrap");
const dateClickOverlay = document.getElementById("dateClickOverlay");
const baseSalaryInput = document.getElementById("baseSalary");
const salaryHint = document.getElementById("salaryHint");
const salaryStatus = document.getElementById("salaryStatus");
const applySalaryBtn = document.getElementById("applySalaryBtn");
const previewStrip = document.getElementById("previewStrip");
const previewText = document.getElementById("previewText");

const periodStartInput = document.getElementById("periodStart");
const periodEndInput = document.getElementById("periodEnd");

const dateRangePicker = document.getElementById("dateRangePicker");
const dateRangeTrigger = document.getElementById("dateRangeTrigger");
const dateRangeTriggerText = document.getElementById("dateRangeTriggerText");
const btnClearDateRange = document.getElementById("btnClearDateRange");
const dateRangePopover = document.getElementById("dateRangePopover");
const drpMonthLabel0 = document.getElementById("drpMonthLabel0");
const drpMonthLabel1 = document.getElementById("drpMonthLabel1");
const drpGrid0 = document.getElementById("drpGrid0");
const drpGrid1 = document.getElementById("drpGrid1");
const drpGrids = document.getElementById("drpGrids");
const drpNavPrev = document.getElementById("drpNavPrev");
const drpNavNext = document.getElementById("drpNavNext");
const drpApplyBtn = document.getElementById("drpApply");
const drpResetBtn = document.getElementById("drpReset");
const quickDateButtons = document.querySelectorAll(".quick-date-btn[data-preset]");

const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFileInput = document.getElementById("importFile");

const editModalEl = document.getElementById("editModal");
const manualBackdrop = document.getElementById("manualBackdrop");
const editDateInput = document.getElementById("editDate");
const editHoursInput = document.getElementById("editHours");
const editSalaryInput = document.getElementById("editSalary");
const editSalaryHint = document.getElementById("editSalaryHint");
const editHolidayInput = document.getElementById("editHoliday");
const editHolidayPanel = document.getElementById("editHolidayPanel");
const saveEditBtn = document.getElementById("saveEditBtn");
const toast = document.getElementById("toast");
const confirmToast = document.getElementById("confirmToast");
const toastClose = document.getElementById("toastClose");
let confirmCallback = null;
let toastTimer = null;

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function loadSalary() {
  const stored = Number(localStorage.getItem(SALARY_KEY));
  return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

function persistSalary() {
  localStorage.setItem(SALARY_KEY, String(baseSalary));
}

function makeId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + "-" + Math.random();
}

function weekend(date) {
  const d = new Date(date + "T00:00:00");
  return d.getDay() === 0 || d.getDay() === 6;
}

function isHoliday(date, manual) {
  return weekend(date) || manual;
}

function dayName(date) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(
    new Date(date + "T00:00:00"),
  );
}

function dateText(date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date + "T00:00:00"));
}

function digitsOnly(value) {
  return String(value).replace(/\D/g, "");
}

function parseSalary(value) {
  return Number(digitsOnly(value)) || 0;
}

function groupThousands(value) {
  const digits = digitsOnly(value);
  return digits ? Number(digits).toLocaleString("id-ID") : "";
}

// Format angka biasa dengan gaya id-ID (koma sebagai desimal).
function numberText(value) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(
    Number(value),
  );
}

// Nominal yang dibayarkan: selalu rupiah bulat.
function money(v) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v);
}

// Upah sejam sebagai dasar seluruh perhitungan lembur.
function hourlyRate(salary) {
  const value = Number(salary);
  return value > 0 ? value / HOURS_PER_MONTH : 0;
}

// Total pengali jam lembur:
//   hari libur  -> setiap jam dikali 2
//   hari kerja  -> jam pertama dikali 1,5 lalu sisanya dikali 2
function multiplier(hours, holiday) {
  hours = Number(hours);
  if (!hours || hours <= 0) return 0;
  if (holiday) return hours * MULTIPLIER_NEXT;
  if (hours <= 1) return hours * MULTIPLIER_FIRST;
  return MULTIPLIER_FIRST + (hours - 1) * MULTIPLIER_NEXT;
}

// Upah per jam adalah angka antara, bukan nominal yang dibayarkan, jadi
// ditampilkan apa adanya supaya rincian perhitungan bisa dicek manual.
function rateMoney(v) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(v);
}

function calculate(hours, holiday, salary) {
  return Math.round(multiplier(hours, holiday) * hourlyRate(salary));
}

// Gaji pokok yang dipakai satu baris: nilai tersimpan di pencatatan itu,
// dengan cadangan ke gaji pokok aktif untuk data lama.
function salaryOf(record) {
  const value = Number(record && record.baseSalary);
  return value > 0 ? value : baseSalary;
}

// Uang makan bersifat flat per hari lembur: sekali Rp15.000 selama
// durasinya minimal 2 jam, tidak dikalikan kelipatan jam.
function mealAllowance(hours) {
  return Number(hours) >= MEAL_MIN_HOURS ? MEAL_ALLOWANCE : 0;
}

function rowTotal(hours, holiday, salary) {
  return calculate(hours, holiday, salary) + mealAllowance(hours);
}

function calculationText(hours, holiday, salary) {
  hours = Number(hours);
  const rate = rateMoney(hourlyRate(salary));
  if (holiday) return `(${numberText(hours)} × 2) × ${rate}`;
  if (hours <= 1) return `(${numberText(hours)} × 1,5) × ${rate}`;
  return `(1,5 + ${numberText(hours - 1)} × 2) × ${rate}`;
}

function renderRates() {
  const rate = hourlyRate(baseSalary);

  document.getElementById("rateHour").textContent = rateMoney(rate);
  document.getElementById("rateFirst").textContent = money(
    rate * MULTIPLIER_FIRST,
  );
  document.getElementById("rateNext").textContent = money(
    rate * MULTIPLIER_NEXT,
  );
  document.getElementById("rateHoliday").textContent = money(
    rate * MULTIPLIER_NEXT,
  );

  salaryStatus.hidden = !baseSalary;
  salaryHint.classList.toggle("is-warning", !baseSalary);
  salaryHint.innerHTML = baseSalary
    ? `Upah per jam = ${money(baseSalary)} ÷ ${HOURS_PER_MONTH} = <strong>${rateMoney(rate)}</strong>`
    : "Isi gaji pokok dulu supaya upah lembur bisa dihitung.";
}

function renderPreview() {
  const hours = Number(hoursInput.value);
  const date = dateInput.value;
  const holiday = date
    ? isHoliday(date, holidayInput.checked)
    : holidayInput.checked;

  if (!baseSalary || !hours || hours <= 0) {
    previewStrip.classList.add("is-idle");
    previewText.textContent = !baseSalary
      ? "Isi gaji pokok untuk melihat estimasi."
      : "Isi jumlah jam untuk melihat estimasi.";
    return;
  }

  const wage = calculate(hours, holiday, baseSalary);
  const meal = mealAllowance(hours);
  const mealText = meal ? ` + uang makan ${money(meal)}` : "";

  previewStrip.classList.remove("is-idle");
  previewText.textContent =
    `${numberText(hours)} jam ${holiday ? "libur" : "hari kerja"}: ` +
    `${calculationText(hours, holiday, baseSalary)} = ${money(wage)}${mealText}` +
    ` → ${money(wage + meal)}`;
}

function setHolidayVisual() {
  holidayPanel.classList.toggle("active", holidayInput.checked);
}

function filtered() {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return records;
  return records.filter((r) =>
    [r.date, dayName(r.date), dateText(r.date), String(r.hours)]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}

function render() {
  records.sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
  );

  const rows = filtered();
  tableBody.innerHTML = "";

  if (!rows.length) {
    tableBody.innerHTML = `
    <tr>
      <td colspan="9">
        <div class="empty">
          <div class="empty-icon"><i class="bi bi-inbox"></i></div>
          <div class="fw-bold text-dark mb-1">${records.length ? "Data tidak ditemukan" : "Belum ada pencatatan"}</div>
          <div>${records.length ? "Coba gunakan kata pencarian yang berbeda." : "Tambahkan data lembur menggunakan form di atas."}</div>
        </div>
      </td>
    </tr>`;
  } else {
    rows.forEach((r, i) => {
      const holiday = isHoliday(r.date, r.holiday);
      const salary = salaryOf(r);
      const meal = mealAllowance(r.hours);
      const total = rowTotal(r.hours, holiday, salary);

      tableBody.insertAdjacentHTML(
        "beforeend",
        `
      <tr>
        <td class="fw-semibold text-secondary">${i + 1}</td>
        <td class="fw-semibold">${dateText(r.date)}</td>
        <td>${dayName(r.date)}</td>
        <td>
          <span class="badge-soft ${holiday ? "badge-holiday" : "badge-weekday"}">
            <i class="bi ${holiday ? "bi-calendar-event" : "bi-briefcase"}"></i>
            ${holiday ? "Libur / Weekend" : "Weekday"}
          </span>
        </td>
        <td class="fw-bold">${r.hours} jam</td>
        <td class="calc">${calculationText(r.hours, holiday, salary)}</td>
        <td>
          ${
            meal
              ? `<span class="badge-soft badge-meal"><i class="bi bi-cup-hot"></i> ${money(meal)}</span>`
              : `<span class="meal-none">&mdash;</span>`
          }
        </td>
        <td class="amount">${money(total)}</td>
        <td>
          <div class="d-flex gap-1">
            <button type="button" class="btn btn-light border btn-sm row-action" data-action="edit" data-id="${r.id}" title="Edit">
              <i class="bi bi-pencil"></i>
            </button>
            <button type="button" class="btn btn-light border text-danger btn-sm row-action" data-action="delete" data-id="${r.id}" title="Hapus">
              <i class="bi bi-trash3"></i>
            </button>
          </div>
        </td>
      </tr>
    `,
      );
    });
  }

  persist();
  renderRates();
  renderPreview();
  renderSummary();
}

// Rentang tanggal bersifat inklusif di kedua ujung; batas yang dikosongkan
// dianggap tak terbatas (mis. "dari" kosong = sejak data paling lama).
function inPeriod(date, start, end) {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function periodRecords() {
  const start = periodStartInput.value;
  const end = periodEndInput.value;
  if (!start && !end) return records;
  return records.filter((r) => inPeriod(r.date, start, end));
}

// Satu-satunya kartu ringkasan: defaultnya seluruh data (periodStart/End
// kosong), atau disaring ke rentang yang sedang diterapkan lewat
// date-range-picker di bawah.
function renderSummary() {
  const rows = periodRecords();

  const totalHours = rows.reduce((s, r) => s + Number(r.hours), 0);
  const totalWage = rows.reduce(
    (s, r) =>
      s + calculate(r.hours, isHoliday(r.date, r.holiday), salaryOf(r)),
    0,
  );
  const mealDays = rows.filter((r) => mealAllowance(r.hours) > 0).length;
  const totalMeal = mealDays * MEAL_ALLOWANCE;
  const holidayDays = rows.filter((r) => isHoliday(r.date, r.holiday)).length;
  const weekdayDays = rows.length - holidayDays;
  const averageHours = rows.length ? totalHours / rows.length : 0;

  document.getElementById("totalDays").textContent = rows.length;
  document.getElementById("totalDaysSub").textContent = rows.length
    ? `${weekdayDays} weekday · ${holidayDays} libur`
    : "Belum ada pencatatan";
  document.getElementById("totalHours").textContent = Number.isInteger(
    totalHours,
  )
    ? totalHours
    : totalHours.toFixed(1);
  document.getElementById("totalHoursSub").textContent = rows.length
    ? `Rata-rata ${numberText(Math.round(averageHours * 10) / 10)} jam/hari`
    : "Belum ada jam tercatat";
  document.getElementById("totalMeal").textContent = money(totalMeal);
  document.getElementById("totalMealSub").textContent = mealDays
    ? `${mealDays} hari × ${money(MEAL_ALLOWANCE)}`
    : `Lembur ≥ ${MEAL_MIN_HOURS} jam dapat ${money(MEAL_ALLOWANCE)}`;
  document.getElementById("totalAmount").textContent = money(
    totalWage + totalMeal,
  );
  document.getElementById("totalAmountSub").textContent =
    `Lembur ${money(totalWage)} + makan ${money(totalMeal)}`;

  drpSyncTriggerFromFilter();
}

/* PEMILIH RENTANG TANGGAL — kalender dua bulan (gaya ShipmentSchedule).
   periodStart/periodEnd (disembunyikan lewat .d-none) tetap satu-satunya
   sumber kebenaran yang dibaca periodRecords() di atas; widget ini cuma
   lapisan tampilan di atasnya. */
const HARI_PENDEK = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

// Kotak-kotak satu bulan, SELALU dari Senin, dengan tanggal bulan
// sebelum/sesudahnya sebagai pengisi (abu-abu, tetap bisa diklik) --
// requirement umum date-range picker: memilih akhir bulan ini sampai
// awal bulan depan tanpa harus pindah bulan dulu.
function drpBuildMonthCells(year, month) {
  const pertama = new Date(year, month, 1);
  // getDay(): 0=Minggu..6=Sabtu -> digeser supaya 0=Senin..6=Minggu
  const mulaiKosong = (pertama.getDay() + 6) % 7;
  const jumlahHari = new Date(year, month + 1, 0).getDate();
  const totalSel = Math.ceil((mulaiKosong + jumlahHari) / 7) * 7;

  const sel = [];
  for (let i = 0; i < totalSel; i++) {
    const hariKe = i - mulaiKosong + 1;
    const tgl = new Date(year, month, hariKe);
    sel.push({
      iso: toISODate(tgl),
      label: tgl.getDate(),
      diLuarBulan: hariKe < 1 || hariKe > jumlahHari,
    });
  }
  return sel;
}

let drpViewYear = 0;
let drpViewMonth = 0; // bulan PERTAMA dari dua yang ditampilkan (0-11)
let drpTempFrom = "";
let drpTempTo = "";

function drpMonthGridHtml(year, month) {
  const sel = drpBuildMonthCells(year, month);
  const baris = [];
  for (let i = 0; i < sel.length; i += 7) baris.push(sel.slice(i, i + 7));
  const dari = drpTempFrom,
    sampai = drpTempTo;
  const min = dari && sampai ? (dari < sampai ? dari : sampai) : "";
  const maks = dari && sampai ? (dari < sampai ? sampai : dari) : "";

  const kepala = HARI_PENDEK.map(
    (h) => `<div class="drp-dow">${h}</div>`,
  ).join("");
  const badan = baris
    .map(
      (mgg) =>
        `<div class="drp-week">${mgg
          .map((c) => {
            const kelas = ["drp-day"];
            if (c.diLuarBulan) kelas.push("drp-day--muted");
            if (c.iso === dari || c.iso === sampai)
              kelas.push("drp-day--endpoint");
            else if (min && c.iso > min && c.iso < maks)
              kelas.push("drp-day--inrange");
            return `<button type="button" class="${kelas.join(" ")}" data-drp-day="${c.iso}">${c.label}</button>`;
          })
          .join("")}</div>`,
    )
    .join("");
  return `<div class="drp-dow-row">${kepala}</div>${badan}`;
}

function drpRenderCalendars() {
  drpMonthLabel0.textContent = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(drpViewYear, drpViewMonth, 1));
  drpMonthLabel1.textContent = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(drpViewYear, drpViewMonth + 1, 1));
  drpGrid0.innerHTML = drpMonthGridHtml(drpViewYear, drpViewMonth);
  drpGrid1.innerHTML = drpMonthGridHtml(drpViewYear, drpViewMonth + 1);
}

// Mesin pemilihan: klik pertama = mulai (belum ada akhir, digambar
// sebagai satu titik). Klik kedua = akhir, DIURUTKAN otomatis (klik
// tanggal yang lebih awal duluan tidak masalah). Klik berikutnya
// sesudah pasangan lengkap MULAI LAGI dari nol.
function drpHandleDayClick(iso) {
  if (!drpTempFrom || (drpTempFrom && drpTempTo)) {
    drpTempFrom = iso;
    drpTempTo = "";
  } else if (iso < drpTempFrom) {
    drpTempTo = drpTempFrom;
    drpTempFrom = iso;
  } else {
    drpTempTo = iso;
  }
  drpRenderCalendars();
}

function drpOpen() {
  const dari = periodStartInput.value;
  const sampai = periodEndInput.value;
  drpTempFrom = dari || "";
  drpTempTo = sampai || "";
  const acuan = (dari && new Date(dari + "T00:00:00")) || new Date();
  drpViewYear = acuan.getFullYear();
  drpViewMonth = acuan.getMonth();
  drpRenderCalendars();
  dateRangePopover.classList.remove("d-none");
  dateRangeTrigger.setAttribute("aria-expanded", "true");
  dateRangeTrigger.classList.add("is-open");
}

function drpClose() {
  dateRangePopover.classList.add("d-none");
  dateRangeTrigger.setAttribute("aria-expanded", "false");
  dateRangeTrigger.classList.remove("is-open");
}

function drpIsOpen() {
  return !dateRangePopover.classList.contains("d-none");
}

function drpApply() {
  // Baru satu tanggal diklik (belum ada akhir) -> jadi rentang sehari.
  const akhir = drpTempTo || drpTempFrom;
  const a = drpTempFrom && akhir && drpTempFrom > akhir ? akhir : drpTempFrom;
  const b = drpTempFrom && akhir && drpTempFrom > akhir ? drpTempFrom : akhir;
  periodStartInput.value = a || "";
  periodEndInput.value = b || "";
  renderSummary();
  drpClose();
}

function drpReset() {
  periodStartInput.value = "";
  periodEndInput.value = "";
  renderSummary();
  drpClose();
}

// Teks tombol pemicu selalu dari periodStart/End yang SUDAH DITERAPKAN,
// bukan dari drpTempFrom/To -- supaya tidak nyangkut di teks pratinjau
// yang belum tentu jadi diterapkan kalau panel ditutup tanpa "Terapkan".
function drpSyncTriggerFromFilter() {
  const dari = periodStartInput.value;
  const sampai = periodEndInput.value;
  dateRangeTriggerText.textContent =
    dari && sampai
      ? `${dateText(dari)}  –  ${dateText(sampai)}`
      : "Semua Data";
  dateRangeTrigger.classList.toggle("has-value", !!(dari && sampai));
  btnClearDateRange.classList.toggle("d-none", !(dari || sampai));
}

function applyQuickPreset(preset) {
  const now = new Date();
  let start, end;

  if (preset === "thisMonth") {
    start = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
    end = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  } else {
    start = toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    end = toISODate(new Date(now.getFullYear(), now.getMonth(), 0));
  }

  periodStartInput.value = start;
  periodEndInput.value = end;
  renderSummary();
  drpClose();
}

function resetForm() {
  form.reset();
  editingId = null;
  submitBtn.innerHTML = '<i class="bi bi-plus-lg me-1"></i><span>Tambah</span>';
  dateInput.value = todayString();
  holidayInput.checked = false;
  setHolidayVisual();
  renderPreview();
}

// Format ribuan langsung saat mengetik, posisi kursor dipertahankan.
function attachThousandFormat(input, onChange) {
  input.addEventListener("input", () => {
    const caret = input.selectionStart;
    const digitsBeforeCaret = digitsOnly(input.value.slice(0, caret)).length;

    input.value = groupThousands(input.value);

    let pos = 0;
    let seen = 0;
    while (pos < input.value.length && seen < digitsBeforeCaret) {
      if (/\d/.test(input.value[pos])) seen++;
      pos++;
    }
    input.setSelectionRange(pos, pos);

    if (typeof onChange === "function") onChange();
  });
}

function toISODate(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function todayString() {
  return toISODate(new Date());
}

function notify(text) {
  document.getElementById("toastText").textContent = text;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function closeConfirmToast() {
  confirmCallback = null;
  confirmToast.classList.remove("show");
}

function showConfirmToast(title, message, actionLabel, callback) {
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMessage").textContent = message;
  document.getElementById("confirmAction").textContent = actionLabel;
  confirmCallback = callback;
  confirmToast.classList.add("show");
}

function openEditModal() {
  editModalEl.classList.add("manual-modal", "show");
  manualBackdrop.classList.add("show");
  document.body.classList.add("modal-open");
  editModalEl.setAttribute("aria-hidden", "false");
}

function closeEditModal() {
  editModalEl.classList.remove("show");
  manualBackdrop.classList.remove("show");
  document.body.classList.remove("modal-open");
  editModalEl.setAttribute("aria-hidden", "true");
  editingId = null;
}

document
  .getElementById("confirmCancel")
  .addEventListener("click", closeConfirmToast);

document.getElementById("confirmAction").addEventListener("click", () => {
  const callback = confirmCallback;
  confirmCallback = null;
  confirmToast.classList.remove("show");
  if (typeof callback === "function") callback();
});

toastClose.addEventListener("click", () => toast.classList.remove("show"));
manualBackdrop.addEventListener("click", closeEditModal);
editModalEl
  .querySelector(".btn-close")
  .addEventListener("click", closeEditModal);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (editModalEl.classList.contains("show")) closeEditModal();
  if (confirmToast.classList.contains("show")) closeConfirmToast();
  toast.classList.remove("show");
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const date = dateInput.value;
  const hours = Number(hoursInput.value);
  const holiday = holidayInput.checked;

  if (!date || !hours || hours <= 0) {
    notify("Tanggal dan jumlah jam harus diisi.");
    return;
  }

  if (!baseSalary) {
    notify("Isi gaji pokok terlebih dahulu.");
    baseSalaryInput.focus();
    return;
  }

  if (editingId) {
    const idx = records.findIndex((r) => r.id === editingId);
    if (idx !== -1) records[idx] = { ...records[idx], date, hours, holiday };
    notify("Data lembur berhasil diperbarui.");
  } else {
    records.push({
      id: makeId(),
      date,
      hours,
      holiday,
      baseSalary,
      createdAt: Date.now(),
    });
    notify(
      mealAllowance(hours)
        ? `Data lembur ditambahkan · dapat uang makan ${money(MEAL_ALLOWANCE)}.`
        : "Data lembur berhasil ditambahkan.",
    );
  }

  persist();
  resetForm();
  render();
});

function openDatePicker() {
  if (typeof dateInput.showPicker === "function") {
    try {
      dateInput.showPicker();
      return;
    } catch (error) {
      // Fallback to focusing the native date input below.
    }
  }

  dateInput.focus();
}

datePickerWrap.addEventListener("click", (event) => {
  if (event.target !== dateInput) {
    openDatePicker();
  }
});

dateClickOverlay.addEventListener("click", (event) => {
  event.preventDefault();
  openDatePicker();
});

dateInput.addEventListener("click", () => {
  openDatePicker();
});

dateInput.addEventListener("change", () => {
  setHolidayVisual();
  renderPreview();
});

holidayInput.addEventListener("change", () => {
  setHolidayVisual();
  renderPreview();
});

hoursInput.addEventListener("input", renderPreview);

attachThousandFormat(baseSalaryInput, () => {
  baseSalary = parseSalary(baseSalaryInput.value);
  persistSalary();
  renderRates();
  renderPreview();
});

attachThousandFormat(editSalaryInput, () => {
  const salary = parseSalary(editSalaryInput.value);
  editSalaryHint.innerHTML = salary
    ? `Upah per jam = <strong>${rateMoney(hourlyRate(salary))}</strong>`
    : "&nbsp;";
});

applySalaryBtn.addEventListener("click", () => {
  if (!baseSalary) {
    notify("Isi gaji pokok terlebih dahulu.");
    baseSalaryInput.focus();
    return;
  }

  if (!records.length) {
    notify("Belum ada data untuk diperbarui.");
    return;
  }

  showConfirmToast(
    "Terapkan gaji pokok?",
    `Seluruh ${records.length} pencatatan akan dihitung ulang memakai ${money(baseSalary)}.`,
    "Ya, terapkan",
    () => {
      records = records.map((r) => ({ ...r, baseSalary }));
      persist();
      render();
      notify("Semua pencatatan berhasil dihitung ulang.");
    },
  );
});

searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value;
  render();
});

tableBody.addEventListener("click", (event) => {
  const button = event.target.closest(".row-action");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === "edit") {
    editRecord(id);
  } else if (action === "delete") {
    deleteRecord(id);
  }
});

function setEditHolidayVisual() {
  editHolidayPanel.classList.toggle("active", editHolidayInput.checked);
}

function openNativeDatePicker(input) {
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch (error) {
      // Fallback to focus.
    }
  }
  input.focus();
}

function editRecord(id) {
  const r = records.find((x) => x.id === id);
  if (!r) return;

  editingId = id;
  editDateInput.value = r.date;
  editHoursInput.value = r.hours;
  editHolidayInput.checked = r.holiday;
  editSalaryInput.value = groupThousands(salaryOf(r));
  editSalaryInput.dispatchEvent(new Event("input"));
  setEditHolidayVisual();

  openEditModal();
}

editDateInput.addEventListener("click", () => {
  openNativeDatePicker(editDateInput);
});

editDateInput.addEventListener("change", () => {
  setEditHolidayVisual();
});

editHolidayInput.addEventListener("change", setEditHolidayVisual);

saveEditBtn.addEventListener("click", () => {
  if (!editingId) return;

  const date = editDateInput.value;
  const hours = Number(editHoursInput.value);
  const holiday = editHolidayInput.checked;
  const salary = parseSalary(editSalaryInput.value);

  if (!date || !hours || hours <= 0) {
    notify("Tanggal dan jumlah jam harus diisi.");
    return;
  }

  if (!salary) {
    notify("Gaji pokok harus diisi.");
    editSalaryInput.focus();
    return;
  }

  const idx = records.findIndex((r) => r.id === editingId);

  if (idx === -1) {
    notify("Data yang ingin diperbarui tidak ditemukan.");
    return;
  }

  records[idx] = {
    ...records[idx],
    date,
    hours,
    holiday,
    baseSalary: salary,
  };

  persist();
  render();
  closeEditModal();
  editingId = null;
  notify("Data lembur berhasil diperbarui.");
});

function deleteRecord(id) {
  const r = records.find((x) => x.id === id);
  if (!r) return;

  showConfirmToast(
    "Hapus pencatatan?",
    `${dateText(r.date)} · ${r.hours} jam akan dihapus.`,
    "Ya, hapus",
    () => {
      records = records.filter((x) => x.id !== id);
      if (editingId === id) resetForm();

      persist();
      render();
      notify("Data berhasil dihapus.");
    },
  );
}

document.getElementById("resetTopBtn").addEventListener("click", () => {
  if (!records.length) {
    notify("Belum ada data untuk direset.");
    return;
  }

  showConfirmToast(
    "Reset semua pencatatan?",
    "Seluruh data lembur yang tersimpan di browser ini akan dihapus.",
    "Ya, reset",
    () => {
      records = [];
      closeEditModal();
      localStorage.removeItem(STORAGE_KEY);
      resetForm();
      render();
      notify("Semua data berhasil direset.");
    },
  );
});

// Buka/tutup panel lewat tombol pemicu.
dateRangeTrigger.addEventListener("click", () => {
  if (drpIsOpen()) drpClose();
  else drpOpen();
});

// Delegasi klik hari: drpHandleDayClick() memanggil drpRenderCalendars(),
// yang mengganti innerHTML kedua grid -- termasuk tombol yang baru saja
// diklik. stopPropagation() supaya klik ini tidak lanjut menggelembung
// ke listener "klik di luar menutup panel" di bawah (elemen yang sudah
// lepas dari dokumen selalu dianggap "di luar" wrap-nya).
drpGrids.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-drp-day]");
  if (!btn) return;
  event.stopPropagation();
  drpHandleDayClick(btn.dataset.drpDay);
});

drpNavPrev.addEventListener("click", (event) => {
  event.stopPropagation();
  drpViewMonth--;
  drpRenderCalendars();
});

drpNavNext.addEventListener("click", (event) => {
  event.stopPropagation();
  drpViewMonth++;
  drpRenderCalendars();
});

drpApplyBtn.addEventListener("click", drpApply);
drpResetBtn.addEventListener("click", drpReset);

quickDateButtons.forEach((btn) => {
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    applyQuickPreset(btn.dataset.preset);
  });
});

btnClearDateRange.addEventListener("click", (event) => {
  event.stopPropagation();
  periodStartInput.value = "";
  periodEndInput.value = "";
  renderSummary();
});

// Klik di luar popover menutupnya; Escape juga menutupnya (ikut pola
// modal edit yang sudah ada).
document.addEventListener("click", (event) => {
  if (!drpIsOpen()) return;
  if (!dateRangePicker.contains(event.target)) drpClose();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && drpIsOpen()) drpClose();
});

// --- Export / Import: memindahkan data ke perangkat lain lewat file JSON,
// tanpa perlu database eksternal. Import selalu mengganti (bukan
// menggabungkan) data yang ada supaya hasilnya persis sama dengan file.
const EXPORT_VERSION = 1;

function buildExportPayload() {
  return {
    app: "LemburJourney",
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    baseSalary,
    records,
  };
}

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function validateImportPayload(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.records)) {
    return { ok: false };
  }

  const cleanRecords = [];
  data.records.forEach((r) => {
    if (!r || typeof r !== "object") return;
    const date = typeof r.date === "string" ? r.date : "";
    const hours = Number(r.hours);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(hours) ||
      hours <= 0
    ) {
      return;
    }

    cleanRecords.push({
      id: typeof r.id === "string" && r.id ? r.id : makeId(),
      date,
      hours,
      holiday: Boolean(r.holiday),
      baseSalary: Number(r.baseSalary) > 0 ? Number(r.baseSalary) : 0,
      createdAt: Number.isFinite(Number(r.createdAt))
        ? Number(r.createdAt)
        : Date.now(),
    });
  });

  const salary = Number(data.baseSalary);

  return {
    ok: true,
    records: cleanRecords,
    baseSalary: Number.isFinite(salary) && salary > 0 ? salary : 0,
  };
}

exportBtn.addEventListener("click", () => {
  if (!records.length && !baseSalary) {
    notify("Belum ada data untuk diexport.");
    return;
  }

  downloadJSON(
    `lemburjourney-backup-${todayString()}.json`,
    buildExportPayload(),
  );
  notify(
    records.length
      ? `Data berhasil diexport · ${records.length} pencatatan.`
      : "Data berhasil diexport.",
  );
});

importBtn.addEventListener("click", () => {
  importFileInput.value = "";
  importFileInput.click();
});

importFileInput.addEventListener("change", () => {
  const file = importFileInput.files && importFileInput.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch {
      notify(
        "File tidak valid. Pastikan file adalah hasil export LemburJourney.",
      );
      return;
    }

    const result = validateImportPayload(parsed);
    if (!result.ok) {
      notify("Format file tidak dikenali.");
      return;
    }

    const runImport = () => {
      closeEditModal();
      records = result.records;
      baseSalary = result.baseSalary;
      persist();
      persistSalary();
      baseSalaryInput.value = groupThousands(baseSalary);
      resetForm();
      render();
      notify(`Import berhasil · ${records.length} pencatatan dimuat.`);
    };

    if (records.length || baseSalary) {
      showConfirmToast(
        "Timpa data saat ini?",
        `Import akan mengganti ${records.length} pencatatan yang tersimpan saat ini dengan ${result.records.length} pencatatan dari file.`,
        "Ya, timpa",
        runImport,
      );
    } else {
      runImport();
    }
  };

  reader.onerror = () => notify("Gagal membaca file.");
  reader.readAsText(file);
});

baseSalaryInput.value = groupThousands(baseSalary);
dateInput.value = todayString();
holidayInput.checked = false;
setHolidayVisual();
render();
