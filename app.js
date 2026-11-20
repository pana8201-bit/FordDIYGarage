/* DIY Garage - F-Series (F-150 / F-250 / F-350) reference - application logic */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const LS = "f150fsr.v1";            // kept for backward compatibility with saved data
  const MAX_YEAR = new Date().getFullYear() + 1;

  // ---------------- state ----------------
  const defaults = {
    truck: null,              // {model, year, engine, trans, drive}
    name: "", vin: "",
    odo: null,
    settings: { mi: null, mo: null, warn: 500 },
    log: [],
    expenses: [],
    lastNotified: null
  };
  let S = load();
  let sel = { model: "F-150", year: null, engine: null, trans: null, drive: "4x2" };

  function load() {
    const base = JSON.parse(JSON.stringify(defaults));
    try {
      const d = JSON.parse(localStorage.getItem(LS)) || {};
      const s = Object.assign(base, d, { settings: Object.assign(base.settings, d.settings || {}) });
      if (s.truck && !s.truck.model) s.truck.model = "F-150";
      if (!Array.isArray(s.expenses)) s.expenses = [];
      return s;
    } catch { return base; }
  }
  function save() { localStorage.setItem(LS, JSON.stringify(S)); }

  // ---------------- helpers ----------------
  const inRange = (y, r) => y >= r[0] && y <= r[1];
  const genFor = (y, m = sel.model) => GENERATIONS.find((g) => g.models.includes(m) && inRange(y, g.years));
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

  function enginesFor(y, m = sel.model) { return ENGINES.filter((e) => e.models.includes(m) && inRange(y, e.years)); }
  const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  // short value for summary tiles
  const short = (v) => (/confirm/i.test(v || "") ? "See VIN" : String(v || "-").replace("Motorcraft ", "").split(" (")[0]);
  const truckLabel = (t) => `${t.year} ${t.model || "F-150"}`;
  const CONFIRM_TXT = "Confirm in Owner's Manual";
  function transFor(y, eng) {
    return eng.trans
      .map(trById)
      .filter((t) => t && inRange(y, (eng.transYears && eng.transYears[t.id]) || t.years));
  }

  // ---------------- selector ----------------
  function yearsFor(m) {
    const out = [];
    for (let y = MAX_YEAR; y >= 1990; y--) if (genFor(y, m) && enginesFor(y, m).length) out.push(y);
    return out;
  }
  function fillYears() {
    const s = $("#selYear"); s.innerHTML = "";
    const ys = yearsFor(sel.model);
    ys.forEach((y) => s.add(new Option(y, y)));
    if (!ys.includes(sel.year)) sel.year = ys.reduce((a, b) => (Math.abs(b - sel.year) < Math.abs(a - sel.year) ? b : a), ys[0]);
    s.value = sel.year;
  }
  const catOf = (m) => (CATALOG.find((x) => x.id === m) || CATALOG[0]).cat;
  function fillCats() {
    $("#segCat").innerHTML = CATEGORIES.map((c) => `<button data-v="${c}">${c}</button>`).join("");
    $$("#segCat button").forEach((b) => (b.onclick = () => {
      const first = CATALOG.find((x) => x.cat === b.dataset.v);
      setModel(first.id); refreshAll();
    }));
  }
  function setModel(m) {
    if (!CATALOG.some((x) => x.id === m)) m = "F-150";
    sel.model = m;
    const cat = catOf(m);
    $$("#segCat button").forEach((b) => b.classList.toggle("on", b.dataset.v === cat));
    const s = $("#selModel"); s.innerHTML = "";
    CATALOG.filter((x) => x.cat === cat).forEach((x) => s.add(new Option(x.id, x.id)));
    s.value = m;
  }
  // drive types valid for this model + engine + year
  function drivesFor() {
    const base = (CATALOG.find((x) => x.id === sel.model) || {}).drives || ["4x2", "4x4"];
    const e = engById(sel.engine);
    let d = base;
    if (e && e.drives) d = d.filter((x) => e.drives.includes(x));
    if (e && e.drivesFor) d = d.filter((x) => e.drivesFor(sel.year).includes(x));
    return d.length ? d : base;
  }
  function fillDrives() {
    const ds = drivesFor();
    $("#segDrive").innerHTML = ds.map((d) => `<button data-v="${d}">${d}</button>`).join("");
    $$("#segDrive button").forEach((b) => (b.onclick = () => { setDrive(b.dataset.v); renderSpecs(); }));
    setDrive(ds.includes(sel.drive) ? sel.drive : ds[ds.length - 1]);
  }
  function refreshAll() { fillYears(); fillEngines(); fillTrans(); fillDrives(); renderSpecs(); }
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
    $("#selYear").onchange = (e) => { sel.year = +e.target.value; fillEngines(); fillTrans(); fillDrives(); renderSpecs(); };
    $("#selEngine").onchange = (e) => { sel.engine = e.target.value; fillTrans(); fillDrives(); renderSpecs(); };
    $("#selTrans").onchange = (e) => { sel.trans = e.target.value; renderSpecs(); };
    $("#selModel").onchange = (e) => { setModel(e.target.value); refreshAll(); };
    $("#btnSaveTruck").onclick = () => {
      const prev = S.truck && engById(S.truck.engine);
      S.truck = { ...sel };
      const e = engById(sel.engine);
      // reset the oil interval when the engine changes (e.g. gas -> diesel)
      if (S.settings.mi == null || !prev || prev.id !== e.id) { S.settings.mi = e.intervalMi; S.settings.mo = e.intervalMo; }
      save(); renderAll(); toast(`Saved ${truckLabel(sel)} as your vehicle`);
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
    const ctx = { year: sel.year, gen: g, eng: e, trans: t, drive: sel.drive };
    const comps = driveComps(ctx);

    $("#genLine").textContent =
      `${sel.model} · ${g.code} · ${g.platform} · MY ${g.years[0]}-${g.years[1] > 2090 ? "present" : g.years[1]} · ${e.family}`;

    const hero = e.isEV ? `
      <div class="hero">
        <div class="kpi"><div class="k">LUG NUT TORQUE</div><div class="v">${esc(g.lugTorque.split(" (")[0])}</div></div>
        <div class="kpi"><div class="k">WASHER FLUID</div><div class="v">${esc(g.washer)}</div></div>
        <div class="kpi"><div class="k">DRIVE</div><div class="v">${esc(sel.drive)}</div></div>
        <div class="kpi"><div class="k">INTERVAL</div><div class="v">${fmtMi(e.intervalMi)} mi</div></div>
      </div>` : `
      <div class="hero">
        <div class="kpi"><div class="k">OIL CAPACITY</div><div class="v">${esc(short(e.oilCap))}</div></div>
        <div class="kpi"><div class="k">OIL GRADE</div><div class="v">${esc(short(e.oilVisc).replace("SAE ", ""))}</div></div>
        <div class="kpi"><div class="k">OIL FILTER</div><div class="v">${esc(short(e.filter))}</div></div>
        <div class="kpi"><div class="k">LUG TORQUE</div><div class="v">${esc(short(g.lugTorque))}</div></div>
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
          ${e.isEV || e.isDiesel ? "" : row("Spark plug", e.plug, { big: true, flag: ev("plug"), copy: true })}
          ${e.isEV || e.isDiesel ? "" : row("Spark plug gap", e.gap, { flag: ev("gap") })}
          ${e.isDiesel ? row("Ignition", "Compression ignition - glow plugs (not a routine DIY item)") : ""}
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

    const has = (c) => comps.includes(c);
    const drvRows = [
      has("rear") ? row("Rear differential fluid", g.rearAxle, { big: true, flag: gv("rearAxle") }) : "",
      has("rear") ? row("Rear differential capacity", g.rearAxleCap, { flag: gv("rearAxleCap") }) : "",
      has("front") ? row("Front differential fluid", g.frontDiff, { big: true, flag: gv("frontDiff") }) : "",
      has("front") ? row("Front differential capacity", g.frontDiffCap, { flag: gv("frontDiffCap") }) : "",
      has("tcase") ? row("Transfer case", g.transferCase, { flag: gv("transferCase") }) : "",
      has("ptu") ? row("Power transfer unit (PTU)", g.ptu || CONFIRM_TXT, { big: true }) : "",
      has("ptu") ? row("PTU capacity", g.ptuCap || CONFIRM_TXT) : "",
      has("rdu") ? row("Rear drive unit (RDU)", g.rdu || CONFIRM_TXT, { big: true }) : "",
      has("rdu") ? row("RDU capacity", g.rduCap || CONFIRM_TXT) : ""
    ].join("");
    const diffCard = e.isEV ? "" : !comps.length ? `
      <div class="card">
        <div class="card-h"><span class="sec">SEC 06</span> DRIVELINE</div>
        <p class="hint" style="margin-bottom:12px">FWD: the differential is inside the transaxle and shares its fluid. See Transmission above.</p>
      </div>` : `
      <div class="card">
        <div class="card-h"><span class="sec">SEC 06</span> DRIVELINE · DIFFERENTIALS</div>
        <table class="spec">
          ${drvRows}
          ${row("Fill level", "To the bottom edge of the fill-plug hole, vehicle level (unless the manual says otherwise)")}
        </table>
        ${sel.drive === "4x2" && (CATALOG.find((x) => x.id === sel.model) || {}).drives.includes("4x4")
          ? '<p class="hint" style="margin-bottom:12px">Select 4x4 to see front differential and transfer case specs.</p>' : ""}
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

    const schedCard = renderSchedule(ctx);
    const prelim = g.preliminary ? `
      <div class="prelim">⚠ <b>PRELIMINARY DATA.</b> Specs for the ${esc(sel.model)} were added recently and are incomplete.
        Many values say "confirm" - always check your Owner's Manual or do a VIN lookup at motorcraftservice.com.</div>` : "";

    const notes = [...(e.notes || []), ...(g.notes || [])];
    const notesCard = notes.length ? `
      <div class="card">
        <div class="card-h"><span class="sec">SEC 09</span> ENGINEERING NOTES</div>
        <ul class="notes">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
      </div>` : "";

    $("#specOut").innerHTML = `${prelim}
      <div class="card">
        <div class="card-h"><span class="sec">SUMMARY</span> ${sel.year} ${sel.model} · ${esc(e.name)} · ${sel.drive.toUpperCase()}</div>
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
    return S.truck && (S.truck.model || "F-150") === sel.model && S.truck.year === c.year && S.truck.engine === c.eng.id && S.truck.trans === c.trans.id && S.truck.drive === c.drive;
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
          ${mine ? "Status comes from your Service Log." : "Tap <b>★ SAVE AS MINE</b> to see how each item compares with your Service Log."}</p>
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
    if (!S.truck) { box.innerHTML = `<div class="empty" style="grid-column:1/-1">Select your vehicle on the SPECS tab and tap <b>★ SAVE AS MINE</b>.</div>`; return; }
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
        id: newId(),
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
      download(blob, `truck-backup-${todayISO()}.json`);
    };
    $("#fileImport").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        if (!Array.isArray(d.log)) throw 0;
        if (!confirm(`Import ${d.log.length} service records and ${(d.expenses || []).length} expenses? This replaces current data.`)) return;
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
      const title = `${S.truck.model || "F-150"} Service Reminder`;
      if (reg) reg.showNotification(title, { body, icon: "icon.svg", tag: "truck-due" });
      else new Notification(title, { body, icon: "icon.svg" });
    } catch { /* ignore */ }
  }

  // Calendar file with alarms - the most reliable "automatic" reminder on iOS/Android
  function makeIcs() {
    const d = computeDue();
    if (!d || d.none) return toast("Log an oil change first");
    const ymd = (dt) => dt.toISOString().slice(0, 10).replace(/-/g, "");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const nm = S.name ? ` (${S.name})` : "";
    const md = S.truck.model || "F-150";
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DIY Garage//EN", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:truck-${d.last.id}@diygarage`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(d.dueDate)}`,
      `DTEND;VALUE=DATE:${ymd(new Date(d.dueDate.getTime() + 864e5))}`,
      `SUMMARY:${md} ${d.type} due${nm}`,
      `DESCRIPTION:${d.type} due by ${fmtMi(d.dueMiles)} mi or this date (whichever first).\\nLast service: ${fmtMi(d.last.miles)} mi on ${d.last.date}.`,
      "BEGIN:VALARM", "TRIGGER:-P7D", "ACTION:DISPLAY", `DESCRIPTION:${md} service due in 1 week`, "END:VALARM",
      "BEGIN:VALARM", "TRIGGER:PT9H", "ACTION:DISPLAY", `DESCRIPTION:${md} service due today`, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    download(new Blob([ics], { type: "text/calendar" }), "truck-service-due.ics");
    toast("Open the file to add to your calendar");
  }

  // ---------------- expenses ----------------
  const EXP_CATS = ["Modification", "Maintenance", "Repair", "Parts", "Tools", "Tires & Wheels",
    "Accessories", "Detailing", "Insurance", "Registration / Fees", "Fuel", "Other"];
  const CAT_COLORS = ["#1700F4", "#2D96CD", "#c41e1e", "#0a7d38", "#c77700", "#6b3fa0",
    "#00838f", "#ad1457", "#5d4037", "#455a64", "#7cb342", "#8a96ad"];

  // all money spent: manual expenses + costs entered on service log records
  function allExpenses() {
    const svc = S.log.filter((l) => l.cost > 0).map((l) => ({
      id: "svc-" + l.id, date: l.date, amount: +l.cost, category: "Maintenance",
      desc: normType(l.type), vendor: "", miles: l.miles, notes: l.notes || "", fromLog: true
    }));
    return [...S.expenses, ...svc].sort((a, b) => b.date.localeCompare(a.date));
  }

  function expPeriodFilter(list) {
    const p = $("#expPeriod").value, now = new Date();
    if (p === "all") return list;
    if (p === "ytd") return list.filter((x) => x.date.slice(0, 4) === String(now.getFullYear()));
    const days = +p;
    const cut = new Date(now.getTime() - days * 864e5).toISOString().slice(0, 10);
    return list.filter((x) => x.date >= cut);
  }

  function renderExpenses() {
    const cat = $("#expFilterCat").value;
    const all = allExpenses();
    let list = expPeriodFilter(all);
    const periodTotal = list.reduce((s, x) => s + x.amount, 0);
    const byCat = {};
    list.forEach((x) => (byCat[x.category] = (byCat[x.category] || 0) + x.amount));
    if (cat !== "all") list = list.filter((x) => x.category === cat);

    // cost per mile (lifetime): needs a span of mileage readings
    const miles = all.map((x) => x.miles).filter((m) => m > 0);
    if (S.odo) miles.push(S.odo);
    const span = miles.length > 1 ? Math.max(...miles) - Math.min(...miles) : 0;
    const lifetime = all.reduce((s, x) => s + x.amount, 0);
    const mods = all.filter((x) => x.category === "Modification").reduce((s, x) => s + x.amount, 0);
    const maint = all.filter((x) => ["Maintenance", "Repair"].includes(x.category)).reduce((s, x) => s + x.amount, 0);

    $("#expKpis").innerHTML = `
      <div class="kpi"><div class="k">PERIOD TOTAL</div><div class="v">${money(periodTotal)}</div></div>
      <div class="kpi"><div class="k">LIFETIME</div><div class="v">${money(lifetime)}</div></div>
      <div class="kpi"><div class="k">MODS (ALL TIME)</div><div class="v">${money(mods)}</div></div>
      <div class="kpi"><div class="k">MAINT + REPAIR</div><div class="v">${money(maint)}</div></div>
      <div class="kpi wide"><div class="k">COST PER MILE (LIFETIME)</div><div class="v">${span > 0 ? "$" + (lifetime / span).toFixed(3) + " / mi" : "—"}</div>
        <div class="kk">${span > 0 ? `over ${fmtMi(span)} logged miles` : "Add mileage to entries to calculate"}</div></div>`;

    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const max = cats.length ? cats[0][1] : 1;
    $("#expBreakdown").innerHTML = cats.length ? `<ul class="bars">${cats.map(([c, v]) => {
      const col = CAT_COLORS[EXP_CATS.indexOf(c)] || "#8a96ad";
      return `<li><span class="bl">${esc(c)}</span><span class="bt"><i style="width:${(v / max) * 100}%;background:${col}"></i></span>
        <span class="bv">${money(v)}</span><span class="bp">${periodTotal ? Math.round((v / periodTotal) * 100) : 0}%</span></li>`;
    }).join("")}</ul>` : `<div class="empty">No expenses in this period.</div>`;

    $("#expList").innerHTML = list.length ? `<ul class="hist">${list.map((x) => `
      <li>
        <div class="ty">${esc(x.desc || x.category)}</div><div class="mi">${money(x.amount)}</div>
        <div class="dt"><span class="cat" style="background:${CAT_COLORS[EXP_CATS.indexOf(x.category)] || "#8a96ad"}">${esc(x.category)}</span>
          ${fmtDate(x.date)}${x.miles ? " · " + fmtMi(x.miles) + " mi" : ""}${x.vendor ? " · " + esc(x.vendor) : ""}</div>
        ${x.fromLog ? `<span class="src">SERVICE LOG</span>` : `<button class="del" data-id="${x.id}">DELETE</button>`}
        ${x.notes ? `<div class="nt">${esc(x.notes)}</div>` : ""}
      </li>`).join("")}</ul>` : `<div class="empty">No expenses recorded.</div>`;

    $$("#expList .del").forEach((b) => (b.onclick = () => {
      if (!confirm("Delete this expense?")) return;
      S.expenses = S.expenses.filter((x) => x.id !== b.dataset.id); save(); renderExpenses();
    }));
  }

  function bindExpenses() {
    const c = $("#expCat"), f = $("#expFilterCat");
    EXP_CATS.forEach((x) => { c.add(new Option(x, x)); f.add(new Option(x, x)); });
    $("#expDate").value = todayISO();
    $("#expPeriod").onchange = renderExpenses;
    f.onchange = renderExpenses;

    $("#expForm").onsubmit = (ev) => {
      ev.preventDefault();
      const amount = +$("#expAmt").value;
      if (!(amount > 0)) return toast("Enter an amount");
      const miles = +$("#expMiles").value || null;
      S.expenses.push({
        id: newId(), date: $("#expDate").value, amount, category: c.value,
        desc: $("#expDesc").value.trim(), vendor: $("#expVendor").value.trim(),
        miles, notes: $("#expNotes").value.trim()
      });
      if (miles && (S.odo == null || miles > S.odo)) S.odo = miles;
      save(); $("#expForm").reset(); $("#expDate").value = todayISO();
      renderExpenses(); renderTruck(); toast("Expense recorded");
    };

    $("#btnExpCsv").onclick = () => {
      const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const rows = [["Date", "Category", "Description", "Vendor", "Amount", "Mileage", "Notes", "Source"]]
        .concat(allExpenses().map((x) => [x.date, x.category, x.desc, x.vendor, x.amount.toFixed(2), x.miles || "", x.notes, x.fromLog ? "Service Log" : "Expense"]));
      download(new Blob([rows.map((r) => r.map(q).join(",")).join("\r\n")], { type: "text/csv" }), `truck-expenses-${todayISO()}.csv`);
    };
  }

  // ---------------- my truck / settings ----------------
  function renderTruck() {
    const m = $("#myTruck");
    if (!S.truck) { m.innerHTML = `<div class="empty">No vehicle saved yet.</div>`; }
    else {
      const e = engById(S.truck.engine), t = trById(S.truck.trans);
      m.innerHTML = `<table class="spec">
        ${row("Vehicle", truckLabel(S.truck), { big: true })}
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
      if (!confirm("Erase truck, settings, ALL service history and ALL expenses from this device?")) return;
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

  function renderAll() { renderDue(); renderHistory(); renderTruck(); renderSpecs(); renderExpenses(); }

  function init() {
    $("#rev").textContent = "REV " + DATA_VERSION;
    sel = S.truck ? { model: "F-150", ...S.truck } : { model: "F-150", year: new Date().getFullYear(), engine: null, trans: null, drive: "4x4" };
    if (sel.year > MAX_YEAR || sel.year < 1990) sel.year = MAX_YEAR - 1;
    setModel(sel.model);
    fillYears(); fillEngines(); fillTrans(); fillDrives();
    renderAll();
  }

  let bound = false;
  function boot() {
    if (!bound) { fillCats(); bindSelector(); bindLog(); bindExpenses(); bindSettings(); bindTabs(); bound = true; }
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
