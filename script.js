/* TODO: เปลี่ยน URL นี้เป็น Google Form สำหรับรับคำแนะนำจากผู้ใช้จริง */
const FEEDBACK_FORM_URL = "https://forms.gle/REPLACE_ME";

const presets = [
  ["แอร์", 1200], ["ตู้เย็น", 150], ["พัดลม", 50], ["กระติกน้ำร้อน", 800], ["เตารีด", 1000],
  ["เครื่องซักผ้า", 500], ["คอมพิวเตอร์ / โน้ตบุ๊ก", 100], ["ทีวี", 100], ["หลอดไฟ", 10], ["อื่นๆ", 100]
];

const $ = id => document.getElementById(id);
const money = n => Number.isFinite(n) ? "฿" + new Intl.NumberFormat("th-TH", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n) : "—";
const num = n => Number.isFinite(n) ? new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(n) : "—";
const val = id => {
  const n = parseFloat($(id).value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

let mode = "bill", billMethod = "meter", people = 1, applianceId = 0;
let appliances = [];

/* เดิมโหลดไอคอนจาก unpkg.com/lucide@latest ซึ่งไม่อยู่ใน allowlist ของ Artifact CSP
   (โฮสต์สคริปต์ภายนอกที่อนุญาตมีแค่ cdnjs.cloudflare.com, cdn.jsdelivr.net/npm/,
   cdn.tailwindcss.com, code.jquery.com) และใช้ @latest แบบไม่ล็อกเวอร์ชัน จึงเปลี่ยนมา
   ฝังไอคอนแบบ inline SVG เองแทน ไม่พึ่งพาเครือข่ายภายนอกเลย */
const ICONS = {
  zap: '<path d="M13 2 3 14h7l-1 8 10-12h-7z"/>',
  "help-circle": '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 2-3 4"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  "circle-dot": '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/>',
  "scan-line": '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  receipt: '<path d="M4 2h16v20l-3-2-2 2-2-2-2 2-2-2-2 2-3-2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="13" y2="15"/>',
  "sliders-horizontal": '<line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="11" cy="18" r="2" fill="currentColor" stroke="none"/>',
  sparkles: '<path d="M12 3l1.7 4.6L18 9.5l-4.3 1.9L12 16l-1.7-4.6L6 9.5l4.3-1.9z"/><path d="M5 3l.6 1.6L7 5l-1.4.6L5 7l-.6-1.4L3 5l1.4-.4z"/><path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8L16.5 17.5l1.8-.7z"/>',
  "trash-2": '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  "chevron-down": '<polyline points="6 9 12 15 18 9"/>'
};
function iconSvg(name, size) {
  size = size || 20;
  const inner = ICONS[name] || "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
function iconRefresh() {
  document.querySelectorAll("[data-icon]").forEach(el => {
    const name = el.dataset.icon, size = el.dataset.iconSize || 20;
    el.innerHTML = iconSvg(name, size);
  });
}

/* เลขยอดรวมค่อยๆ ไล่นับขึ้น/ลงแทนการกระโดดเปลี่ยนทันที และการ์ดผลลัพธ์กระพริบเบาๆ
   ตอนคำนวณเสร็จ เพื่อให้รู้สึกว่าเครื่องมือ "ตอบสนอง" ต่อสิ่งที่พิมพ์ ไม่ใช่แค่ค่านิ่งๆ */
const countState = new WeakMap();
function animateNumber(el, toValue, formatFn, duration) {
  duration = duration || 450;
  const prev = countState.get(el);
  const from = (prev === undefined || !Number.isFinite(prev)) ? toValue : prev;
  countState.set(el, toValue);
  if (!Number.isFinite(from) || !Number.isFinite(toValue) || from === toValue) {
    el.textContent = formatFn(toValue);
    return;
  }
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const current = from + (toValue - from) * eased;
    el.textContent = formatFn(current);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = formatFn(toValue);
  }
  requestAnimationFrame(tick);
}
function pulseBox(el) {
  el.classList.remove("pulse");
  void el.offsetWidth; // reflow เพื่อรีสตาร์ท animation ได้ทุกครั้ง
  el.classList.add("pulse");
}
function setMetricsEmpty(ids, isEmpty) {
  ids.forEach(id => {
    const box = $(id).closest(".metric");
    if (box) box.classList.toggle("is-empty", isEmpty);
  });
}

/* กราฟแท่งเปรียบเทียบเดือนก่อน/เดือนนี้: ถ้าการ์ดผลลัพธ์ยังไม่เคยเลื่อนเข้าจอ
   ให้พักความสูงไว้ก่อน (แท่งแบนอยู่ที่ 0) แล้วค่อยไปโตขึ้นพร้อมเลขตอนเลื่อนมาเห็น
   แต่ถ้าเคยเผยแล้ว (หรือกำลังแก้ไขค่าอยู่) ก็ให้โตขึ้นทันทีตามปกติ */
let billBarsRevealed = false;
let pendingBarHeights = null;
function setBarHeights(prevPct, nowPct) {
  if (billBarsRevealed) {
    requestAnimationFrame(() => {
      $("compareBarPrevFill").style.height = prevPct + "%";
      $("compareBarNowFill").style.height = nowPct + "%";
    });
  } else {
    pendingBarHeights = { prevPct, nowPct };
  }
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("electricity_theme", theme);
  $("themeBtn").innerHTML = iconSvg(theme === "dark" ? "sun" : "moon", 20);
}
setTheme(localStorage.getItem("electricity_theme") || "light");

$("brandIcon").innerHTML = iconSvg("zap", 22);
$("helpBtn").innerHTML = iconSvg("help-circle", 20);
$("billSummaryIcon").innerHTML = iconSvg("scan-line", 17);
$("addApplianceIcon").innerHTML = iconSvg("plus", 17);
$("appSummaryIcon").innerHTML = iconSvg("scan-line", 17);
$("fabBillIcon").innerHTML = iconSvg("receipt", 20);
$("fabApplianceIcon").innerHTML = iconSvg("zap", 20);
$("fab").innerHTML = iconSvg("sliders-horizontal", 22);
$("walkSparkleIcon").innerHTML = iconSvg("sparkles", 17);

$("themeBtn").onclick = () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");

/* หลัก: กรอกเลขมิเตอร์ครั้งก่อน/ครั้งนี้ ให้ระบบคำนวณหน่วยให้เอง
   ทางเลือกเสริม: กดลิงก์เพื่อกรอกจำนวนหน่วยตรงๆ แทน (เช่น ไม่รู้เลขมิเตอร์ครั้งก่อน) */
function setMeterMode(useMeter) {
  billMethod = useMeter ? "meter" : "units";
  $("meterFields").classList.toggle("hidden", !useMeter);
  $("unitsValueWrap").classList.toggle("hidden", useMeter);
  $("toggleMeterModeLabel").textContent = useMeter ? "กรอกจำนวนหน่วยเอง" : "กลับไปกรอกเลขมิเตอร์";
  calculateBill();
}
$("toggleMeterMode").onclick = () => setMeterMode(billMethod !== "meter");

$("moreOptionsToggle").onclick = () => {
  const open = $("moreOptions").classList.toggle("hidden");
  $("moreOptionsToggle").classList.toggle("open", !open);
};
["prevMeter", "currentMeter"].forEach(id => $(id).addEventListener("input", () => {
  const p = val("prevMeter"), c = val("currentMeter");
  if (p !== null && c !== null && c >= p) $("usedUnits").value = c - p;
  calculateBill();
}));

/* ปุ่มกดเลือกอัตราค่าไฟแบบด่วน 7/8/9 บาท + ยังกรอกเองได้ผ่านช่อง custom */
function setRate(rateStr, fromCustom) {
  $("billRate").value = rateStr;
  document.querySelectorAll(".rate-pill[data-rate]").forEach(b => b.classList.toggle("active", !fromCustom && b.dataset.rate === String(rateStr)));
  calculateBill();
}
document.querySelectorAll(".rate-pill[data-rate]").forEach(btn => {
  btn.onclick = () => {
    $("rateCustomBtn").classList.remove("active");
    $("billRateCustom").classList.remove("show"); $("billRateCustom").value = "";
    setRate(btn.dataset.rate, false);
  };
});
$("rateCustomBtn").onclick = () => {
  $("rateCustomBtn").classList.add("active");
  document.querySelectorAll(".rate-pill[data-rate]").forEach(b => b.classList.remove("active"));
  $("billRateCustom").classList.add("show");
  $("billRateCustom").focus();
};
$("billRateCustom").addEventListener("input", () => {
  document.querySelectorAll(".rate-pill[data-rate]").forEach(b => b.classList.remove("active"));
  $("rateCustomBtn").classList.add("active");
  const v = $("billRateCustom").value;
  if (v !== "") setRate(v, true); else calculateBill();
});
/* เริ่มต้นเลือกไว้ที่ 8 บาท ให้ตรงกับดีไซน์ต้นแบบ */
setRate("8", false);

function calculateBill() {
  const rate = val("billRate");
  const service = val("serviceFee") ?? 0;
  let units = null;
  $("prevError").textContent = ""; $("currentError").textContent = "";
  if (billMethod === "meter") {
    const prev = val("prevMeter"), cur = val("currentMeter");
    if (prev !== null && cur !== null) {
      if (cur < prev) { $("currentError").textContent = "เลขมิเตอร์ครั้งนี้ต้องไม่น้อยกว่าครั้งก่อนนะ"; return }
      units = cur - prev;
    }
  } else units = val("usedUnits");

  if (units === null || rate === null) {
    setMetricsEmpty(["rUnits", "rEnergy", "rService", "rPerson"], true);
    ["rUnits", "rEnergy", "rService", "rPerson"].forEach(id => { $(id).textContent = "—"; countState.delete($(id)) });
    animateNumber($("rTotal"), 0, v => money(v));
    $("rPersonSub").textContent = "กรอกหน่วยและอัตราค่าไฟเพื่อเริ่มคำนวณ";
    $("comparisonChip").classList.add("hidden"); $("comparisonBars").classList.add("hidden"); $("highWarning").classList.add("hidden");
    return;
  }
  setMetricsEmpty(["rUnits", "rEnergy", "rService", "rPerson"], false);
  const energy = units * rate, total = energy + service, per = total / people;
  $("rUnits").textContent = num(units) + " หน่วย";
  animateNumber($("rEnergy"), energy, v => money(v));
  animateNumber($("rService"), service, v => money(v));
  animateNumber($("rPerson"), per, v => money(v));
  animateNumber($("rTotal"), total, v => money(v));
  $("rPersonSub").textContent = `${people} คน · คนละ ${money(per)}`;
  pulseBox($("billTotalBox"));
  const last = val("lastBill");
  if (last !== null) {
    const diff = total - last, pct = last === 0 ? null : (diff / last) * 100;
    $("comparisonChip").classList.remove("hidden");
    const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";
    $("comparisonChip").textContent = last === 0 ? `${arrow} ต่างจากเดือนก่อน ${money(Math.abs(diff))}` : `${arrow} ${diff > 0 ? "เพิ่มขึ้น" : "ลดลง"} ${money(Math.abs(diff))} (${Math.abs(pct).toFixed(1)}%)`;

    $("comparisonBars").classList.remove("hidden");
    const maxVal = Math.max(last, total, 1);
    $("compareBarPrevValue").textContent = money(last);
    $("compareBarNowValue").textContent = money(total);
    setBarHeights(Math.max(6, (last / maxVal) * 100), Math.max(6, (total / maxVal) * 100));
  } else { $("comparisonChip").classList.add("hidden"); $("comparisonBars").classList.add("hidden"); }
  $("highWarning").classList.toggle("hidden", per <= 800);
}

["prevMeter", "currentMeter", "usedUnits", "billRate", "serviceFee", "lastBill"].forEach(id => $(id).addEventListener("input", calculateBill));
function bumpPeopleValue() {
  const el = $("peopleValue");
  el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
}
$("minusPeople").onclick = () => { people = Math.max(1, people - 1); $("peopleValue").textContent = people + " คน"; bumpPeopleValue(); calculateBill() };
$("plusPeople").onclick = () => { people++; $("peopleValue").textContent = people + " คน"; bumpPeopleValue(); calculateBill() };

function switchMode(next) {
  mode = next;
  $("billMode").classList.toggle("hidden", mode !== "bill");
  $("applianceMode").classList.toggle("hidden", mode !== "appliance");
  $("heroTitle").innerHTML = mode === "bill" ? "เช็กค่าไฟเดือนนี้<br>ให้รู้ก่อนบิลมา" : "ลองประมาณค่าไฟ<br>จากเครื่องใช้ไฟฟ้า";
  $("heroDesc").textContent = mode === "bill" ? "มีเลขมิเตอร์หรือยอดหน่วยอยู่แล้ว? ใส่ข้อมูลไม่กี่ช่อง แล้วดูยอดรวมกับค่าไฟต่อคนได้ทันที" : "ยังไม่มีบิล? ใส่เครื่องใช้ไฟฟ้าที่ใช้ในห้อง แล้วดูค่าไฟคร่าวๆ";
  $("fabWrap").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll("[data-switch]").forEach(b => b.onclick = () => switchMode(b.dataset.switch));

$("fab").onclick = () => $("fabWrap").classList.toggle("open");
document.addEventListener("click", e => {
  if (!$("fabWrap").contains(e.target)) $("fabWrap").classList.remove("open");
});

function addAppliance(data = {}) {
  const id = ++applianceId;
  appliances.push({ id, name: data.name || "แอร์", watts: data.watts ?? 1200, minutes: data.minutes ?? 60 });
  renderAppliances(); calculateAppliances();
}
function removeAppliance(id) {
  appliances = appliances.filter(a => a.id !== id);
  if (!appliances.length) addAppliance();
  else { renderAppliances(); calculateAppliances() }
}
function renderAppliances() {
  $("applianceList").innerHTML = appliances.map(a => `
    <div class="appliance" data-id="${a.id}">
      <div class="appliance-top">
        <select class="app-name" aria-label="เลือกเครื่องใช้ไฟฟ้า">
          ${presets.map(([n, w]) => `<option ${n === a.name ? "selected" : ""} value="${n}">${n}</option>`).join("")}
        </select>
        <button class="remove-btn" aria-label="ลบเครื่องใช้ไฟฟ้า" onclick="removeAppliance(${a.id})">${iconSvg("trash-2", 17)}</button>
      </div>
      <div class="appliance-fields">
        <div class="field" style="margin:0"><label>กำลังไฟ (W)</label><input class="app-watts" type="number" min="0" step="any" value="${a.watts}"><div class="example">ค่าเริ่มต้นเป็นตัวอย่าง แก้ตามฉลากจริง</div></div>
        <div class="field" style="margin:0"><label>เวลาใช้งาน (นาที/วัน)</label><input class="app-minutes" type="number" min="0" step="any" value="${a.minutes}"><div class="example">ตัวอย่างเท่านั้น — ปรับตามการใช้งานจริง</div></div>
      </div>
    </div>`).join("");
  document.querySelectorAll(".appliance").forEach(row => {
    const a = appliances.find(x => x.id == row.dataset.id);
    row.querySelector(".app-name").onchange = e => {
      a.name = e.target.value;
      const p = presets.find(x => x[0] === a.name); if (p) a.watts = p[1];
      renderAppliances(); calculateAppliances();
    };
    row.querySelector(".app-watts").oninput = e => { a.watts = Math.max(0, parseFloat(e.target.value) || 0); calculateAppliances() };
    row.querySelector(".app-minutes").oninput = e => { a.minutes = Math.max(0, parseFloat(e.target.value) || 0); calculateAppliances() };
  });
  iconRefresh();
}
function calculateAppliances() {
  const rate = val("appRate");
  let totalUnits = 0;
  appliances.forEach(a => totalUnits += (a.watts / 1000) * (a.minutes / 60));
  $("aUnits").textContent = num(totalUnits) + " หน่วย";
  if (rate === null) {
    setMetricsEmpty(["aUnits", "aMonthly"], true);
    $("aMonthly").textContent = "—"; countState.delete($("aMonthly"));
    animateNumber($("aDaily"), 0, v => money(v));
  } else {
    setMetricsEmpty(["aUnits", "aMonthly"], false);
    const daily = totalUnits * rate;
    animateNumber($("aDaily"), daily, v => money(v));
    animateNumber($("aMonthly"), daily * 30, v => money(v));
    pulseBox($("appTotalBox"));
  }
  $("breakdown").innerHTML = rate === null ? "" : `
    <div style="font-weight:800;margin-bottom:5px">ใช้ไฟประมาณรายเดือน</div>
    ${appliances.map(a => {
    const u = (a.watts / 1000) * (a.minutes / 60), m = u * rate * 30;
    return `<div class="breakdown-row"><span>${a.name}</span><span>${money(m)}</span></div>`
  }).join("")}`;
}
$("appRate").addEventListener("input", calculateAppliances);
$("addAppliance").onclick = () => addAppliance();
addAppliance({ name: "แอร์", watts: 1200, minutes: 60 });

function showSummary(type) {
  const card = $("captureCard");
  if (type === "bill") {
    const rate = val("billRate"), service = val("serviceFee") ?? 0;
    let units = null;
    if (billMethod === "meter") { const p = val("prevMeter"), c = val("currentMeter"); if (p !== null && c !== null && c >= p) units = c - p }
    else units = val("usedUnits");
    if (units === null || rate === null) { toast("กรอกหน่วยและอัตราค่าไฟก่อนนะ"); return }
    const total = units * rate + service, per = total / people;
    card.innerHTML = `
      <div class="capture-brand">${iconSvg("zap", 17)} ค่าไฟเด็กหอ · บิลจริง</div>
      <div class="capture-total">${money(total)}</div><div class="capture-sub">ยอดค่าไฟรวม</div>
      <div class="capture-rule"></div>
      <div class="capture-details">
        <div class="capture-detail"><small>หน่วยที่ใช้</small><strong>${num(units)} หน่วย</strong></div>
        <div class="capture-detail"><small>อัตราค่าไฟ</small><strong>${money(rate)}/หน่วย</strong></div>
        <div class="capture-detail"><small>ค่าบริการ</small><strong>${money(service)}</strong></div>
        <div class="capture-detail"><small>หาร ${people} คน</small><strong>${money(per)}/คน</strong></div>
      </div>
      <div class="note">คำนวณเพื่อประมาณการเท่านั้น</div>`;
  } else {
    const rate = val("appRate"); if (rate === null) { toast("ใส่อัตราค่าไฟก่อนนะ"); return }
    let units = 0; appliances.forEach(a => units += (a.watts / 1000) * (a.minutes / 60));
    const daily = units * rate, monthly = daily * 30;
    card.innerHTML = `
      <div class="capture-brand">${iconSvg("zap", 17)} ค่าไฟเด็กหอ · ประมาณการ</div>
      <div class="capture-total">${money(daily)}</div><div class="capture-sub">ค่าไฟประมาณ / วัน</div>
      <div class="capture-rule"></div>
      <div class="capture-details">
        <div class="capture-detail"><small>ใช้ไฟประมาณ</small><strong>${num(units)} หน่วย/วัน</strong></div>
        <div class="capture-detail"><small>ค่าไฟประมาณ / เดือน</small><strong>${money(monthly)}</strong></div>
        <div class="capture-detail"><small>อัตราค่าไฟ</small><strong>${money(rate)}/หน่วย</strong></div>
        <div class="capture-detail"><small>เครื่องใช้ไฟฟ้า</small><strong>${appliances.length} รายการ</strong></div>
      </div>
      <div class="note">เป็นการประมาณคร่าวๆ จากกำลังไฟและเวลาที่กรอก การใช้ไฟจริงอาจแตกต่างกัน</div>`;
  }
  iconRefresh(); $("fabWrap").classList.add("hidden"); $("summaryModal").classList.remove("hidden");
}
$("billSummary").onclick = () => showSummary("bill");
$("appSummary").onclick = () => showSummary("app");
$("closeSummary").onclick = () => { $("summaryModal").classList.add("hidden"); $("fabWrap").classList.remove("hidden") };
$("summaryModal").addEventListener("click", e => { if (e.target === $("summaryModal")) $("closeSummary").click() });

function toast(text) { $("toast").textContent = text; $("toast").classList.add("show"); setTimeout(() => $("toast").classList.remove("show"), 2200) }

const walks = {
  bill: [
    ["intro", "ยินดีต้อนรับ 👋", "เดี๋ยวเราจะแนะนำวิธีใช้ “ค่าไฟเด็กหอ” แบบสั้นๆ ใช้เวลาไม่กี่ขั้นตอน แล้วคุณจะรู้ว่าต้องกรอกอะไรและดูผลลัพธ์ตรงไหน"],
    ["method", "กรอกเลขมิเตอร์", "ใส่เลขมิเตอร์ครั้งก่อนกับครั้งนี้ ระบบจะคำนวณจำนวนหน่วยที่ใช้ให้อัตโนมัติ ถ้าไม่มีเลขมิเตอร์ครั้งก่อน กดลิงก์ด้านล่างเพื่อกรอกจำนวนหน่วยเองได้"],
    ["rate", "อัตราค่าไฟ", "ใส่อัตราค่าไฟตามสัญญาหรือบิลของหอ ระบบจะใช้ตัวเลขนี้คำนวณยอดค่าไฟ"],
    ["people", "จำนวนคน", "ถ้าหารค่าไฟกับเพื่อน ใส่จำนวนคนได้เลย ระบบจะคำนวณยอดที่ต้องจ่ายต่อคนให้"],
    ["result", "ดูผลลัพธ์", "เมื่อกรอกข้อมูลครบ คุณจะเห็นหน่วยที่ใช้ ค่าไฟ ค่าบริการ ยอดรวม และยอดหารต่อคนตรงนี้"]
  ],
  appliance: [
    ["intro", "ยินดีต้อนรับ 👋", "เดี๋ยวเราจะแนะนำวิธีใช้โหมดประมาณค่าไฟจากเครื่องใช้ไฟฟ้าแบบสั้นๆ เพื่อให้คุณเริ่มใช้งานได้ทันที"],
    ["appliances", "เครื่องใช้ไฟฟ้า", "เลือกเครื่องใช้ไฟฟ้าที่มีในห้อง และเพิ่มรายการได้หลายชิ้น"],
    ["rate2", "อัตราค่าไฟ", "ใส่อัตราค่าไฟตามสัญญาหรือบิลของหอ"],
    ["appliance-fields", "Watt และเวลาใช้งาน", "แก้กำลังไฟให้ตรงกับฉลาก และใส่นาทีที่ใช้ต่อวันโดยประมาณ"],
    ["appResult", "ดูผลลัพธ์", "ระบบจะประมาณหน่วยไฟต่อวัน ค่าไฟต่อวัน และค่าไฟต่อเดือนให้ตรงนี้"]
  ]
};
let walkSteps = [], walkIndex = 0;
function startWalkthrough(force = true) {
  walkSteps = walks[mode]; walkIndex = 0;
  $("walkOverlay").classList.remove("hidden");
  $("walkTip").classList.remove("hidden");
  $("spotlight").classList.add("hidden");
  renderWalk();
}
function renderWalk() {
  const [target, title, text] = walkSteps[walkIndex];

  // ขั้นแรกเป็น Welcome/Introduction ก่อนเริ่ม Spotlight
  if (target === "intro") {
    $("spotlight").classList.add("hidden");
    $("walkTip").style.top = "50%";
    $("walkTip").style.left = "50%";
    $("walkTip").style.transform = "translate(-50%,-50%)";
    $("walkTip").style.width = "min(390px,calc(100vw - 28px))";
    $("walkCount").textContent = `เริ่มต้น · 1 / ${walkSteps.length}`;
    $("walkTitle").textContent = title;
    $("walkText").textContent = text;
    $("walkNext").textContent = "เริ่มแนะนำ";
    return;
  }

  $("walkTip").style.transform = "";
  $("walkTip").style.width = "min(330px,calc(100vw - 28px))";

  const [_, title2, text2] = walkSteps[walkIndex];
  let el;
  if (target === "method") el = document.querySelector('[data-walk="meter"]');
  else if (target === "rate") el = document.querySelector('[data-walk="rate"]');
  else if (target === "rate2") el = $("appRate");
  else if (target === "people") el = document.querySelector('[data-walk="people"]');
  else if (target === "result") el = $("billResult");
  else if (target === "appResult") el = $("appResult");
  else if (target === "appliances") el = $("applianceList");
  else if (target === "appliance-fields") el = document.querySelector(".appliance-fields");
  if (!el) return;
  walkCurrentEl = el;
  $("spotlight").classList.remove("hidden");
  $("walkCount").textContent = `${walkIndex + 1} / ${walkSteps.length}`;
  $("walkTitle").textContent = title2; $("walkText").textContent = text2;
  $("walkNext").textContent = walkIndex === walkSteps.length - 1 ? "เสร็จสิ้น" : "ถัดไป";

  /* เดิม: วัดตำแหน่ง el แล้ววาง spotlight ทันที จากนั้นค่อยสั่ง scrollTo แบบ smooth
     ทีหลัง — พอหน้าเลื่อนจริง ตำแหน่งของ el บนจอเปลี่ยนไปแล้ว แต่ spotlight ค้างอยู่
     ที่พิกัดเดิมก่อนเลื่อน ทำให้วงไม่ตรงกับช่องจริง (เห็นชัดสุดตอนจอแคบเพราะต้องเลื่อน
     ไกลกว่า) แก้โดยเลื่อนจอก่อน แล้วค่อยวาง spotlight ตามตำแหน่งจริงหลังเลื่อนเสร็จ
     พร้อมคอยอัปเดตตำแหน่งระหว่างเลื่อน (ทั้งแบบ smooth และแบบผู้ใช้เลื่อนเอง) ด้วย */
  const targetTop = Math.max(0, window.scrollY + el.getBoundingClientRect().top - window.innerHeight * .35);
  window.scrollTo({ top: targetTop, behavior: "smooth" });
  trackSpotlightDuringScroll();
}
let walkCurrentEl = null;
let walkTrackRAF = null;
function positionSpotlightNow() {
  if (!walkCurrentEl) return;
  const r = walkCurrentEl.getBoundingClientRect(), pad = 5;
  $("spotlight").style.left = (r.left - pad) + "px"; $("spotlight").style.top = (r.top - pad) + "px";
  $("spotlight").style.width = (r.width + pad * 2) + "px"; $("spotlight").style.height = (r.height + pad * 2) + "px";
  let tipTop = r.bottom + 14, tipLeft = Math.max(14, Math.min(window.innerWidth - 344, r.left));
  if (tipTop + 170 > window.innerHeight) tipTop = Math.max(14, r.top - 185);
  $("walkTip").style.top = tipTop + "px"; $("walkTip").style.left = tipLeft + "px";
}
function trackSpotlightDuringScroll() {
  if (walkTrackRAF) cancelAnimationFrame(walkTrackRAF);
  let lastY = -1, stableFrames = 0;
  function step() {
    positionSpotlightNow();
    if (window.scrollY === lastY) {
      stableFrames++;
      if (stableFrames > 4) { walkTrackRAF = null; return; } // scroll settled, stop the loop
    } else {
      stableFrames = 0;
      lastY = window.scrollY;
    }
    walkTrackRAF = requestAnimationFrame(step);
  }
  step();
}
function endWalk() {
  $("walkOverlay").classList.add("hidden"); $("spotlight").classList.add("hidden"); $("walkTip").classList.add("hidden");
  localStorage.setItem("electricity_walkthrough_seen", "true");
  walkCurrentEl = null;
  if (walkTrackRAF) { cancelAnimationFrame(walkTrackRAF); walkTrackRAF = null }
}
$("walkNext").onclick = () => {
  if (walkIndex < walkSteps.length - 1) {
    walkIndex++;
    renderWalk();
  } else {
    endWalk();
  }
};
$("walkSkip").onclick = endWalk;
$("helpBtn").onclick = () => startWalkthrough(true);
$("footerHelp").onclick = e => { e.preventDefault(); startWalkthrough(true) };
window.addEventListener("resize", () => { if (walkCurrentEl && !$("walkTip").classList.contains("hidden")) positionSpotlightNow() });

$("feedbackLink").onclick = e => {
  e.preventDefault();
  if (FEEDBACK_FORM_URL.includes("REPLACE_ME")) { toast("ยังไม่ได้ตั้งค่าลิงก์ Google Form"); return }
  window.open(FEEDBACK_FORM_URL, "_blank", "noopener,noreferrer");
};

iconRefresh();
calculateBill(); calculateAppliances();

if (!localStorage.getItem("electricity_walkthrough_seen")) {
  setTimeout(() => startWalkthrough(false), 700);
}

/* ===== เลขนับวิ่งตอนเลื่อนจอมาเห็น (scroll reveal) ======================
   ให้การ์ดผลลัพธ์ดูมีชีวิตขึ้นตอนเลื่อนหน้าจอมาถึง โดยเลขจะไล่นับจาก 0
   ขึ้นไปหาค่าจริงแบบ ease-out ครั้งเดียวตอนการ์ดเลื่อนเข้ามาในจอเป็นครั้งแรก
   (ใช้ animateNumber()/countState เดิม เพื่อไม่ชนกับ animation ตอนพิมพ์แก้ไขค่า) */
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  // ระบุชัดเจนว่าแต่ละตัวเลขใช้ฟอร์แมตแบบไหน (จำนวนเฉยๆ+หน่วย หรือสกุลเงิน ฿)
  // กันบั๊กที่เดา format จากข้อความเดิมแล้วผิด เช่น ตัวเลขที่โชว์เป็นเงิน (฿9.60)
  // ถูกไปนับใหม่แบบจำนวนธรรมดาแล้วสัญลักษณ์ ฿ หาย
  const revealTargets = [
    {
      card: "#billResult", metrics: [
        { id: "rUnits", type: "unit" }, { id: "rEnergy", type: "money" },
        { id: "rService", type: "money" }, { id: "rPerson", type: "money" }
      ], total: "rTotal"
    },
    {
      card: "#appResult", metrics: [
        { id: "aUnits", type: "unit" }, { id: "aMonthly", type: "money" }
      ], total: "aDaily"
    }
  ];
  const revealed = new WeakSet();
  function playReveal(cfg) {
    const cardEl = document.querySelector(cfg.card);
    if (!cardEl || revealed.has(cardEl)) return;
    revealed.add(cardEl);
    cardEl.classList.add("reveal-in");

    // เก็บค่าปัจจุบันของแต่ละตัวเลขไว้ก่อน แล้วรีเซ็ตกลับไป 0 ชั่วคราว
    // จากนั้นค่อยไล่นับขึ้นใหม่แบบ stagger ทีละตัวให้ดูเป็นจังหวะ ไม่ใช่กระโดดพร้อมกันหมด
    // ใช้ค่าจริงที่ animateNumber() บันทึกไว้ใน countState เป็นเป้าหมาย (ไม่ใช่อ่านจาก
    // ข้อความที่กำลังแสดงผล) เพราะถ้าตัวเลขนั้นกำลังไล่นับจากการพิมพ์แก้ไขค่าอยู่พอดี
    // ข้อความบนจอจะเป็นค่ากลางทางที่ยังไม่นิ่ง ทำให้ reveal ไปจับค่าผิดและค้างเพี้ยนได้
    const jobs = [];
    cfg.metrics.forEach(({ id, type }) => {
      const el = document.getElementById(id);
      if (!el || el.closest(".metric")?.classList.contains("is-empty")) return;
      const text = el.textContent;
      const stateTarget = countState.get(el);
      const numMatch = text.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
      const target = Number.isFinite(stateTarget) ? stateTarget : (numMatch ? parseFloat(numMatch[0]) : null);
      if (target === null) return;
      countState.set(el, 0);
      if (type === "money") {
        jobs.push(() => animateNumber(el, target, v => money(v), 600));
      } else {
        const suffix = numMatch ? text.slice(text.indexOf(numMatch[0]) + numMatch[0].length) : "";
        jobs.push(() => animateNumber(el, target, v => num(v) + suffix, 600));
      }
    });
    const totalEl = document.getElementById(cfg.total);
    if (totalEl) {
      const text = totalEl.textContent;
      const stateTarget = countState.get(totalEl);
      const numMatch = text.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
      const target = Number.isFinite(stateTarget) ? stateTarget : (numMatch ? parseFloat(numMatch[0]) : null);
      if (target !== null) {
        countState.set(totalEl, 0);
        jobs.push(() => animateNumber(totalEl, target, v => money(v), 700));
      }
    }
    jobs.forEach((job, i) => setTimeout(job, i * 70));

    // กราฟแท่งเปรียบเทียบเดือนก่อน/เดือนนี้: ให้โตขึ้นจากด้านล่างพร้อมจังหวะเดียวกัน
    if (cfg.card === "#billResult") {
      billBarsRevealed = true;
      if (pendingBarHeights) {
        const { prevPct, nowPct } = pendingBarHeights;
        setTimeout(() => {
          requestAnimationFrame(() => {
            $("compareBarPrevFill").style.height = prevPct + "%";
            $("compareBarNowFill").style.height = nowPct + "%";
          });
        }, jobs.length * 70);
      }
    }
  }
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const cfg = revealTargets.find(t => document.querySelector(t.card) === entry.target);
      if (cfg) playReveal(cfg);
    });
  }, { threshold: 0.4 });
  revealTargets.forEach(cfg => {
    const el = document.querySelector(cfg.card);
    if (el) revealObserver.observe(el);
  });
}
