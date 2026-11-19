/* F-150 Field Service Reference - application logic */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const LS = "f150fsr.v1";
  const MAX_YEAR = new Date().getFullYear() + 1;

  // ---------------- state ----------------
  const defaults = {
    truck: null,              // {year, engine, trans, drive}
    name: "", vin: "",
    odo: null,
    settings: { mi: null, mo: null, warn: 500 },
    log: [],
    lastNotified: null
  };
  let S = load();
  let sel = { year: null, engine: null, trans: null, drive: "4x2" };

  function load() {
    const base = JSON.parse(JSON.stringify(defaults));
    try { const d = JSON.parse(localStorage.getItem(LS)) || {}; return Object.assign(base, d, { settings: Object.assign(base.settings, d.settings || {}) }); }
    catch { return base; }
  }
  function save() { localStorage.setItem(LS, JSON.stringify(S)); }

  // ---------------- helpers ----------------
  const inRange = (y, r) => y >= r[0] && y <= r[1];
  const genFor = (y) => GENERATIONS.find((g) => inRange(y, g.years));
  const engById = (id) => ENGINES.find((e) => e.id === id);
  const trById = (id) => TRANSMISSIONS.find((t) => t.id === id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtMi = (n) => (n == null || isNaN(n) ? "---" : Number(n).toLocaleString("en-US"));
  const fmtDate = (d) => new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const addMonths = (iso, m) => { const d = new Date(iso + "T12:00:00"); d.setMonth(d.getMonth() + Number(m)); return d; };
  const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function enginesFor(y) { return ENGINES.filter((e) => inRange(y, e.years)); }
  function transFor(y, eng) {
    return eng.trans
      .map(trById)
      .filter((t) => t && inRange(y, (eng.transYears && eng.transYears[t.id]) || t.years));
  }

  // ---------------- selector ----------------
  function fillYears() {
    const s = $("#selYear"); s.innerHTML = "";
    for (let y = MAX_YEAR; y >= 1990; y--) s.add(new Option(y, y));
  }
  function fillEngines() {
    const s = $("#selEngine"); s.innerHTML = "";
    enginesFor(sel.year).forEach((e) => s.add(new Option(e.name, e.id)));
    if (!enginesFor(sel.year).some((e) => e.id === sel.engine)) sel.engine = s.options[0]?.value;
    s.value = sel.engine;
  }
  function fillTrans() {
    const s = $("#selTrans"); s.innerHTML = "";
    const list = transFor(sel.year, engById(sel.engine));
    list.forEach((t) => s.add(new Option(t.name, t.id)));
    if (!list.some((t) => t.id === sel.trans)) sel.trans = list[0]?.id;
    s.value = sel.trans;
  }
  function setDrive(v) {
    sel.drive = v;
    $$("#segDrive button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  }

  function bindSelector() {
    $("#selYear").onchange = (e) => { sel.year = +e.target.value; fillEngines(); fillTrans(); renderSpecs(); };
    $("#selEngine").onchange = (e) => { sel.engine = e.target.value; fillTrans(); renderSpecs(); };
    $("#selTrans").onchange = (e) => { sel.trans = e.target.value; renderSpecs(); };
    $$("#segDrive button").forEach((b) => (b.onclick = () => { setDrive(b.dataset.v); renderSpecs(); }));
    $("#btnSaveTruck").onclick = () => {
      S.truck = { ...sel };
      const e = engById(sel.engine);
      if (S.settings.mi == null) S.settings.mi = e.intervalMi;
      if (S.settings.mo == null) S.settings.mo = e.intervalMo;
      save(); renderAll(); toast("Saved as My Truck");
    };
  }

  // ---------------- spec sheet ----------------
  function row(label, value, { big = false, flag = false, copy = false } = {}) {
    const c = copy && value && !/^N\/A|confirm|Not equipped|In-tank/i.test(value)
      ? `<button class="copy" data-copy="${esc(value.split(" (")[0])}" title="Copy">⧉</button>` : "";
    return `<tr><th>${esc(label)}</th><td class="${big ? "big" : ""}${big && String(value).length > 28 ? " long" : ""}">${esc(value)}${flag ? '<span class="vtag">VERIFY</span>' : ""}${c}</td></tr>`;
  }

  function renderSpecs() {
    const g = genFor(sel.year), e = engById(sel.engine), t = trById(sel.trans);
    if (!g || !e || !t) { $("#specOut").innerHTML = ""; return; }
    const ev = (k) => (e.verify || []).includes(k);
    const tv = (k) => (t.verify || []).includes(k);
    const gv = (k) => (g.verify || []).includes(k);
    const is4 = sel.drive === "4x4";

    $("#genLine").textContent =
      `${g.code} · ${g.platform} · MY ${g.years[0]}-${g.years[1] > 2090 ? "present" : g.years[1]} · ${e.family}`;

    const hero = e.isEV ? `
      <div class="hero">
        <div class="kpi"><div class="k">LUG NUT TORQUE</div><div class="v">${esc(g.lugTorque.split(" (")[0])}</div></div>
        <div class="kpi"><div class="k">WASHER FLUID</div><div class="v">${esc(g.washer)}</div></div>
        <div class="kpi"><div class="k">DRIVE</div><div class="v">eAWD</div></div>
        <div class="kpi"><div class="k">INTERVAL</div><div class="v">${fmtMi(e.intervalMi)} mi</div></div>
      </div>` : `
      <div class="hero">
        <div class="kpi"><div class="k">OIL CAPACITY</div><div class="v">${esc(e.oilCap.split(" (")[0])}</div></div>
        <div class="kpi"><div class="k">OIL GRADE</div><div class="v">${esc(e.oilVisc.split(" (")[0].replace("SAE ", ""))}</div></div>
        <div class="kpi"><div class="k">OIL FILTER</div><div class="v">${esc(e.filter.replace("Motorcraft ", "").split(" (")[0])}</div></div>
        <div class="kpi"><div class="k">LUG TORQUE</div><div class="v">${esc(g.lugTorque.split(" (")[0])}</div></div>
      </div>`;

    const engineCard = e.isEV ? "" : `
      <div class="card">
        <div class="card-h"><span class="sec">SEC 02</span> ENGINE LUBRICATION</div>
        <table class="spec">
          ${row("Oil capacity (w/ filter)", e.oilCap, { big: true, flag: ev("oilCap") })}
          ${row("Oil viscosity", e.oilVisc, { flag: ev("oilVisc") })}
          ${row("Oil specification", e.oilSpec)}
          ${row("Oil filter (Motorcraft)", e.filter, { big: true, flag: ev("filter"), copy: true })}
          ${row("Oil pan drain plug torque", e.drainTorque, { flag: ev("drainTorque") })}
        </table>
      </div>`;

    const transCard = `
      <div class="card">
        <div class="card-h"><span class="sec">SEC 03</span> TRANSMISSION · ${esc(t.type.toUpperCase())}</div>
        <table class="spec">
          ${row("Unit", t.name)}
          ${row("Fluid type", t.fluid, { big: true })}
          ${row("Fluid capacity", t.capacity, { flag: tv("capacity") })}
          ${row("Drain plug torque", t.drain, { flag: tv("drain") })}
          ${row("Pan / level check", t.pan, { flag: tv("pan") })}
        </table>
      </div>`;

    // engine-level overrides take precedence over generation values
    const pick = (k) => (e[k] !== undefined ? e[k] : g[k]);
    const pv = (k) => (e[k] !== undefined ? ev(k) : gv(k));

    const fuelCard = `
      <div class="card">
        <div class="card-h"><span class="sec">SEC 04</span> FUEL · IGNITION</div>
        <table class="spec">
          ${row("Fuel type", e.fuel, { big: true, flag: ev("fuel") })}
          ${row(e.isEV ? "Energy storage" : "Fuel tank capacity", pick("fuelTank"), { flag: pv("fuelTank") })}
          ${e.isEV || /diesel/i.test(e.family) ? "" : row("Spark plug", e.plug, { big: true, flag: ev("plug"), copy: true })}
          ${e.isEV || /diesel/i.test(e.family) ? "" : row("Spark plug gap", e.gap, { flag: ev("gap") })}
          ${e.plugMi ? row("Plug replacement", `Every ${fmtMi(e.plugMi)} mi`, { flag: ev("plugMi") }) : ""}
        </table>
      </div>`;

    const filterCard = `
      <div class="card">
        <div class="card-h"><span class="sec">SEC 05</span> FILTERS</div>
        <table class="spec">
          ${e.isEV ? "" : row("Oil filter", e.filter, { flag: ev("filter"), copy: true })}
          ${row("Engine air filter", pick("airFilter"), { big: true, flag: pv("airFilter"), copy: true })}
          ${row("Cabin air filter", g.cabinFilter, { flag: gv("cabinFilter"), copy: true })}
          ${e.isEV ? "" : row("Fuel filter", pick("fuelFilter"), { flag: pv("fuelFilter"), copy: true })}
        </table>
      </div>`;

    const diffCard = e.isEV ? "" : `
      <div class="card">
        <div class="card-h"><span class="sec">SEC 06</span> DIFFERENTIALS · TRANSFER CASE</div>
        <table class="spec">
          ${row("Rear differential fluid", g.rearAxle, { big: true })}
          ${row("Rear differential capacity", g.rearAxleCap, { flag: gv("rearAxleCap") })}
          ${is4 ? row("Front differential fluid (4x4)", g.frontDiff, { big: true }) : ""}
          ${is4 ? row("Front differential capacity", g.frontDiffCap, { flag: gv("frontDiffCap") }) : ""}
          ${is4 ? row("Transfer case (4x4)", g.transferCase, { flag: gv("transferCase") }) : ""}
          ${row("Fill level", "To the bottom edge of the fill-plug hole, truck level")}
        </table>
        ${is4 ? "" : '<p class="hint" style="margin-bottom:12px">Select 4x4 to see front differential and transfer case specs.</p>'}
      </div>`;

    const chassisCard = `
      <div class="card">
        <div class="card-h"><span class="sec">SEC 07</span> WHEELS · CHASSIS · FLUIDS</div>
        <table class="spec">
          ${row("Lug nut torque", g.lugTorque, { big: true })}
          ${row("Bolt pattern", g.lugPattern)}
          ${row("Stud thread", g.lugThread)}
          ${row("Washer fluid reservoir", g.washer, { flag: gv("washer") })}
          ${e.isEV ? "" : row("Engine coolant", g.coolant)}
          ${row("Brake fluid", g.brakeFluid)}
        </table>
      </div>`;

    const schedCard = renderSchedule({ year: sel.year, gen: g, eng: e, trans: t, drive: sel.drive });

    const notes = [...(e.notes || []), ...(g.notes || [])];
    const notesCard = notes.length ? `
      <div class="card">
        <div class="card-h"><span class="sec">SEC 09</span> ENGINEERING NOTES</div>
        <ul class="notes">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
      </div>` : "";

    $("#specOut").innerHTML = `
      <div class="card">
        <div class="card-h"><span class="sec">SUMMARY</span> ${sel.year} F-150 · ${esc(e.name)} · ${sel.drive.toUpperCase()}</div>
        ${hero}
      </div>
      ${engineCard}${transCard}${fuelCard}${filterCard}${diffCard}${chassisCard}${schedCard}${notesCard}`;

    $$("#specOut .copy").forEach((b) => (b.onclick = () => {
      navigator.clipboard?.writeText(b.dataset.copy).then(() => toast(`Copied ${b.dataset.copy}`));
    }));
  }

  // ---------------- DIY maintenance schedule ----------------
  const normType = (t) => SERVICE_ALIASES[t] || t;
  const resolve = (v, c) => (typeof v === "function" ? v(c) : v);

  function isMyTruck(c) {
    return S.truck && S.truck.year === c.year && S.truck.engine === c.eng.id && S.truck.trans === c.trans.id && S.truck.drive === c.drive;
  }

  function scheduleStatus(item, c) {
    const mi = resolve(item.mi, c), mo = resolve(item.mo, c);
    if (!isMyTruck(c)) return { mi, mo };
    const last = S.log.filter((l) => normType(l.type) === item.type)
      .sort((a, b) => b.date.localeCompare(a.date) || b.miles - a.miles)[0];
    if (!last) return { mi, mo, never: true };
    const odo = S.odo != null ? Math.max(S.odo, last.miles) : last.miles;
    const miLeft = mi ? last.miles + mi - odo : null;
    const dueDate = mo ? addMonths(last.date, mo) : null;
    const dLeft = dueDate ? Math.ceil((dueDate - new Date()) / 864e5) : null;
    const over = (miLeft != null && miLeft <= 0) || (dLeft != null && dLeft <= 0);
    const soon = !over && ((miLeft != null && miLeft <= Math.max(500, mi * 0.1)) || (dLeft != null && dLeft <= 30));
    return { mi, mo, last, miLeft, dueDate, dLeft, lvl: over ? "bad" : soon ? "warn" : "ok", dueMi: mi ? last.miles + mi : null };
  }

  function renderSchedule(c) {
    const mine = isMyTruck(c);
    const items = SCHEDULE.filter((s) => s.when(c));
    const rows = items.map((s) => {
      const st = scheduleStatus(s, c);
      const every = [st.mi ? `${fmtMi(st.mi)} mi` : null, st.mo ? `${st.mo} mo` : null].filter(Boolean).join(" / ") || "Inspect";
      const part = s.part ? resolve(s.part, c) : "";
      const sev = s.severe ? resolve(s.severe, c) : "";
      let status = "";
      if (mine) {
        if (st.never) status = `<span class="chip">NOT LOGGED</span>`;
        else {
          const bits = [];
          if (st.dueMi) bits.push(st.miLeft <= 0 ? `${fmtMi(-st.miLeft)} mi over` : `${fmtMi(st.miLeft)} mi left`);
          if (st.dueDate) bits.push(st.dLeft <= 0 ? "date passed" : `${st.dLeft} d left`);
          status = `<span class="chip ${st.lvl}">${st.lvl === "bad" ? "OVERDUE" : st.lvl === "warn" ? "DUE SOON" : "OK"}</span>
                    <div class="sub">Last ${fmtMi(st.last.miles)} mi · ${fmtDate(st.last.date)} · ${bits.join(" · ")}</div>`;
        }
      }
      return `<li>
        <div class="sx-h"><b>${esc(s.type)}</b><span class="every">${every}</span></div>
        ${part ? `<div class="sub">${esc(part)}</div>` : ""}
        ${sev ? `<div class="sub sev">Severe duty: ${esc(sev)}</div>` : ""}
        ${status}
      </li>`;
    }).join("");
    return `
      <div class="card">
        <div class="card-h"><span class="sec">SEC 08</span> DIY MAINTENANCE SCHEDULE</div>
        <p class="hint">Ford "normal" schedule. Replace at whichever comes first, miles or months.
          ${mine ? "Status comes from your Service Log." : "Tap <b>★ MY TRUCK</b> to see how each item compares with your Service Log."}</p>
        <ul class="sched">${rows}</ul>
      </div>`;
  }

  // ---------------- service tracker ----------------
  function primaryService() {
    const e = S.truck && engById(S.truck.engine);
    return e && e.isEV ? "Tire Rotation" : "Oil & Filter Change";
  }

  function computeDue() {
    if (!S.truck) return null;
    const type = primaryService();
    const last = S.log.filter((l) => normType(l.type) === type).sort((a, b) => b.miles - a.miles || b.date.localeCompare(a.date))[0];
    if (!last) return { type, none: true };
    const mi = +S.settings.mi, mo = +S.settings.mo, warn = +S.settings.warn || 0;
    const dueMiles = last.miles + mi;
    const dueDate = addMonths(last.date, mo);
    const odo = S.odo != null ? Math.max(S.odo, last.miles) : last.miles;
    const milesLeft = dueMiles - odo;
    const daysLeft = Math.ceil((dueDate - new Date()) / 864e5);
    const totalDays = Math.max(1, Math.round((dueDate - new Date(last.date + "T12:00:00")) / 864e5));
    const lvl = (left, w) => (left <= 0 ? "bad" : left <= w ? "warn" : "ok");
    return {
      type, last, dueMiles, dueDate, milesLeft, daysLeft,
      miPct: Math.min(100, Math.max(0, ((odo - last.miles) / mi) * 100)),
      dPct: Math.min(100, Math.max(0, ((totalDays - daysLeft) / totalDays) * 100)),
      miLvl: lvl(milesLeft, warn), dLvl: lvl(daysLeft, 14)
    };
  }

  function renderDue() {
    const d = computeDue(), box = $("#nextDue"), ban = $("#dueBanner");
    ban.className = "banner hidden";
    if (!S.truck) { box.innerHTML = `<div class="empty" style="grid-column:1/-1">Select your truck on the SPECS tab and tap <b>★ MY TRUCK</b>.</div>`; return; }
    if (d.none) { box.innerHTML = `<div class="empty" style="grid-column:1/-1">No ${esc(d.type)} logged yet. Record your last one below to start reminders.</div>`; return; }

    box.innerHTML = `
      <div class="gauge ${d.miLvl}">
        <div class="k">MILES REMAINING</div>
        <div class="v">${d.milesLeft <= 0 ? "OVERDUE" : fmtMi(d.milesLeft)}</div>
        <div class="s">due @ ${fmtMi(d.dueMiles)} mi</div>
        <div class="bar"><i style="width:${d.miPct}%"></i></div>
      </div>
      <div class="gauge ${d.dLvl}">
        <div class="k">DAYS REMAINING</div>
        <div class="v">${d.daysLeft <= 0 ? "OVERDUE" : d.daysLeft}</div>
        <div class="s">due ${d.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
        <div class="bar"><i style="width:${d.dPct}%"></i></div>
      </div>
      <div class="s" style="grid-column:1/-1;font-size:11px;color:var(--muted);text-align:center">
        ${esc(d.type)} · whichever comes first: ${fmtMi(S.settings.mi)} mi or ${S.settings.mo} months · last @ ${fmtMi(d.last.miles)} mi on ${fmtDate(d.last.date)}
      </div>`;

    const worst = [d.miLvl, d.dLvl].includes("bad") ? "bad" : [d.miLvl, d.dLvl].includes("warn") ? "warn" : null;
    if (worst) {
      ban.className = `banner ${worst}`;
      ban.innerHTML = worst === "bad"
        ? `🛢 ${esc(d.type).toUpperCase()} OVERDUE - service your truck now.`
        : `🛢 ${esc(d.type)} due soon - ${d.milesLeft > 0 ? fmtMi(d.milesLeft) + " mi" : ""}${d.milesLeft > 0 && d.daysLeft > 0 ? " / " : ""}${d.daysLeft > 0 ? d.daysLeft + " days" : ""} left.`;
      maybeNotify(d, worst);
    }
  }

  function renderHistory() {
    const h = $("#history");
    if (!S.log.length) { h.innerHTML = `<div class="empty">No services recorded.</div>`; return; }
    const list = [...S.log].sort((a, b) => b.date.localeCompare(a.date) || b.miles - a.miles);
    h.innerHTML = `<ul class="hist">${list.map((l) => `
      <li>
        <div class="ty">${esc(l.type)}</div><div class="mi">${fmtMi(l.miles)} mi</div>
        <div class="dt">${fmtDate(l.date)}${l.cost ? " · $" + Number(l.cost).toFixed(2) : ""}</div>
        <button class="del" data-id="${l.id}">DELETE</button>
        ${l.notes ? `<div class="nt">${esc(l.notes)}</div>` : ""}
      </li>`).join("")}</ul>`;
    $$("#history .del").forEach((b) => (b.onclick = () => {
      if (!confirm("Delete this service record?")) return;
      S.log = S.log.filter((l) => l.id !== b.dataset.id); save(); renderAll();
    }));
  }

  function bindLog() {
    const t = $("#logType"); SERVICE_TYPES.forEach((s) => t.add(new Option(s, s)));
    $("#logDate").value = todayISO();

    $("#logForm").onsubmit = (ev) => {
      ev.preventDefault();
      const miles = +$("#logMiles").value;
      if (!miles || miles < 0) return toast("Enter a valid mileage");
      S.log.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        type: t.value, date: $("#logDate").value, miles,
        cost: $("#logCost").value ? +$("#logCost").value : null,
        notes: $("#logNotes").value.trim()
      });
      if (S.odo == null || miles > S.odo) S.odo = miles;
      S.lastNotified = null;
      save(); $("#logForm").reset(); $("#logDate").value = todayISO();
      renderAll(); toast("Service recorded");
    };

    $("#btnOdo").onclick = () => {
      const v = +$("#odoInput").value;
      if (!v) return toast("Enter odometer reading");
      S.odo = v; save(); $("#odoInput").value = ""; renderAll(); toast("Odometer updated");
    };

    $("#btnExport").onclick = () => {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
      download(blob, `f150-service-${todayISO()}.json`);
    };
    $("#fileImport").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        if (!Array.isArray(d.log)) throw 0;
        if (!confirm(`Import ${d.log.length} records? This replaces current data.`)) return;
        localStorage.setItem(LS, JSON.stringify(d)); S = load(); init(); toast("Data imported");
      } catch { toast("Invalid backup file"); }
      e.target.value = "";
    };

    $("#btnNotify").onclick = async () => {
      if (!("Notification" in window)) return toast("Notifications not supported - use Add to Calendar");
      const p = await Notification.requestPermission();
      toast(p === "granted" ? "Reminders enabled" : "Permission denied");
      if (p === "granted") { S.lastNotified = null; save(); renderDue(); }
    };
    $("#btnIcs").onclick = makeIcs;
  }

  function download(blob, name) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function maybeNotify(d, lvl) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const key = `${d.last.id}:${lvl}:${todayISO()}`;
    if (S.lastNotified === key) return;
    S.lastNotified = key; save();
    const body = lvl === "bad" ? `${d.type} is overdue (due at ${fmtMi(d.dueMiles)} mi).`
      : `${d.type} due in ${fmtMi(Math.max(0, d.milesLeft))} mi or ${Math.max(0, d.daysLeft)} days.`;
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) reg.showNotification("F-150 Service Reminder", { body, icon: "icon.svg", tag: "f150-due" });
      else new Notification("F-150 Service Reminder", { body, icon: "icon.svg" });
    } catch { /* ignore */ }
  }

  // Calendar file with alarms - the most reliable "automatic" reminder on iOS/Android
  function makeIcs() {
    const d = computeDue();
    if (!d || d.none) return toast("Log an oil change first");
    const ymd = (dt) => dt.toISOString().slice(0, 10).replace(/-/g, "");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const nm = S.name ? ` (${S.name})` : "";
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//F150 FSR//EN", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:f150-${d.last.id}@fsr`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(d.dueDate)}`,
      `DTEND;VALUE=DATE:${ymd(new Date(d.dueDate.getTime() + 864e5))}`,
      `SUMMARY:F-150 ${d.type} due${nm}`,
      `DESCRIPTION:${d.type} due by ${fmtMi(d.dueMiles)} mi or this date (whichever first).\\nLast service: ${fmtMi(d.last.miles)} mi on ${d.last.date}.`,
      "BEGIN:VALARM", "TRIGGER:-P7D", "ACTION:DISPLAY", "DESCRIPTION:F-150 service due in 1 week", "END:VALARM",
      "BEGIN:VALARM", "TRIGGER:PT9H", "ACTION:DISPLAY", "DESCRIPTION:F-150 service due today", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    download(new Blob([ics], { type: "text/calendar" }), "f150-service-due.ics");
    toast("Open the file to add to your calendar");
  }

  // ---------------- my truck / settings ----------------
  function renderTruck() {
    const m = $("#myTruck");
    if (!S.truck) { m.innerHTML = `<div class="empty">No truck saved yet.</div>`; }
    else {
      const e = engById(S.truck.engine), t = trById(S.truck.trans);
      m.innerHTML = `<table class="spec">
        ${row("Model year", String(S.truck.year), { big: true })}
        ${row("Engine", e?.name || "-")}
        ${row("Transmission", t?.name || "-")}
        ${row("Driveline", S.truck.drive.toUpperCase())}
        ${row("Odometer", S.odo != null ? fmtMi(S.odo) + " mi" : "---")}
      </table>`;
    }
    $("#setName").value = S.name || "";
    $("#setVin").value = S.vin || "";
    $("#setMi").value = S.settings.mi ?? "";
    $("#setMo").value = S.settings.mo ?? "";
    $("#setWarn").value = S.settings.warn ?? 500;
    $("#odoChip").textContent = S.odo != null ? `${fmtMi(S.odo)} mi` : "--- mi";
  }

  function bindSettings() {
    $("#btnSaveSettings").onclick = () => {
      S.name = $("#setName").value.trim();
      S.vin = $("#setVin").value.trim().toUpperCase();
      const mi = +$("#setMi").value, mo = +$("#setMo").value;
      if (mi > 0) S.settings.mi = mi;
      if (mo > 0) S.settings.mo = mo;
      S.settings.warn = Math.max(0, +$("#setWarn").value || 0);
      S.lastNotified = null; save(); renderAll(); toast("Settings saved");
    };
    $("#btnDefaults").onclick = () => {
      const e = S.truck && engById(S.truck.engine);
      if (!e) return toast("Save a truck first");
      $("#setMi").value = e.intervalMi; $("#setMo").value = e.intervalMo;
    };
    $("#btnWipe").onclick = () => {
      if (!confirm("Erase truck, settings and ALL service history from this device?")) return;
      localStorage.removeItem(LS); S = load(); init(); toast("Data erased");
    };
  }

  // ---------------- tabs ----------------
  function bindTabs() {
    $$(".tabbar button").forEach((b) => (b.onclick = () => {
      $$(".tabbar button").forEach((x) => x.classList.toggle("on", x === b));
      $$(".tab").forEach((t) => t.classList.toggle("active", t.id === "tab-" + b.dataset.tab));
      window.scrollTo(0, 0);
    }));
  }

  function renderAll() { renderDue(); renderHistory(); renderTruck(); renderSpecs(); }

  function init() {
    $("#rev").textContent = "REV " + DATA_VERSION;
    fillYears();
    sel = S.truck ? { ...S.truck } : { year: new Date().getFullYear(), engine: null, trans: null, drive: "4x4" };
    if (sel.year > MAX_YEAR || sel.year < 1990) sel.year = MAX_YEAR - 1;
    $("#selYear").value = sel.year;
    fillEngines(); fillTrans(); setDrive(sel.drive);
    renderSpecs(); renderAll();
  }

  let bound = false;
  function boot() {
    if (!bound) { bindSelector(); bindLog(); bindSettings(); bindTabs(); bound = true; }
    init();
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
    // Re-check reminders whenever the app returns to the foreground
    document.addEventListener("visibilitychange", () => { if (!document.hidden) renderDue(); });
  }
  boot();
  // deep-link: ?tab=log
  const qt = new URLSearchParams(location.search).get("tab");
  if (qt) document.querySelector(`.tabbar button[data-tab="${qt}"]`)?.click();
})();
