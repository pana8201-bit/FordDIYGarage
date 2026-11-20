/* =====================================================================
   MAINTENANCE SCHEDULE (from Ford owner's manuals / scheduled
   maintenance guides) + WIPER BLADE DATA
   ---------------------------------------------------------------------
   Loaded after data.js, data-hd.js and data-ford.js.

   Ford documents checked (fordservicecontent.com, Nov 2026):
     F21  2021 F-150 Owner's Manual - Scheduled Maintenance
     F18  2018 F-150 Owner's Manual - Scheduled Maintenance
     F12  2012 F-150 Owner's Guide - Scheduled Maintenance
     G09  2009 & 2010 Ford Scheduled Maintenance Guides
     G04  2004 & 2007 Ford Scheduled Maintenance Guides
     SD20 2020 Super Duty Owner's Manual - Scheduled Maintenance
     M22  2022 Maverick Owner's Manual - Scheduled Maintenance

   How sure each interval is (shown in the app):
     confirmed - read from the Ford document for this model and year
     inferred  - from a Ford document for the same model, nearby year
     assumed   - Ford's common schedule from another model; this
                 vehicle's own manual wasn't checked
     general   - Ford doesn't schedule this item (or no Ford value was
                 found); typical DIY practice
   Intervals are "whichever comes first" (miles or months).
   ===================================================================== */

const SCHED_SOURCES = {
  F21: "Ford 2021 F-150 Owner's Manual",
  F18: "Ford 2018 F-150 Owner's Manual",
  F12: "Ford 2012 F-150 Owner's Guide",
  G09: "Ford 2009/2010 Scheduled Maintenance Guide",
  G04: "Ford 2004/2007 Scheduled Maintenance Guides",
  SD20: "Ford 2020 Super Duty Owner's Manual",
  M22: "Ford 2022 Maverick Owner's Manual",
  COMMON: "Ford's common schedule (2021 F-150 / 2022 Maverick manuals)",
  GEN: "Not in Ford's schedule - typical practice"
};
const CONF_RANK = { confirmed: 3, inferred: 2, assumed: 1, general: 0 };
const CONF_LABEL = { confirmed: "FORD MANUAL", inferred: "FORD · NEARBY YEAR", assumed: "FORD COMMON SCHEDULE", general: "NOT A FORD ITEM" };
const minConf = (a, b) => (CONF_RANK[a] <= CONF_RANK[b] ? a : b);

const SEVERE_DEF = "Ford's \"special operating conditions\": towing, extended idling or low-speed driving, dusty / sandy / off-road roads, " +
  "short trips in freezing weather, and extreme heat.";

/* Which Ford schedule applies to a vehicle */
function schedEra(c) {
  const y = c.year, m = c.model || c.gen.models[0];
  const hd = c.gen.models.includes("F-250");
  const f150 = m === "F-150";
  if (hd) {
    if (y >= 2011) return { k: "sd", src: "SD20", conf: y === 2020 ? "confirmed" : y >= 2017 && y <= 2022 ? "inferred" : "assumed" };
    if (y >= 2009) return { k: "f09", src: "G09", conf: "inferred" };
    if (y >= 1999) return { k: "f04", src: "G04", conf: "inferred" };
    return { k: "f04", src: "G04", conf: "assumed" };
  }
  if (f150) {
    if (y >= 2021) return { k: "m21", src: "F21", conf: y === 2021 ? "confirmed" : "inferred" };
    if (y >= 2015) return { k: "i15", src: "F18", conf: y === 2018 ? "confirmed" : "inferred" };
    if (y >= 2011) return { k: "i11", src: "F12", conf: y === 2012 ? "confirmed" : "inferred" };
    if (y >= 2009) return { k: "f09", src: "G09", conf: "confirmed" };
    if (y >= 1997) return { k: "f04", src: "G04", conf: y === 2004 || y === 2007 ? "confirmed" : "inferred" };
    return { k: "f04", src: "G04", conf: "assumed" };
  }
  if (m === "Maverick") return { k: "m21", src: "M22", conf: y === 2022 ? "confirmed" : "inferred" };
  if (m === "Transit" && y <= 2020) return { k: "i15", src: "COMMON", conf: "assumed" };
  return { k: "m21", src: "COMMON", conf: "assumed" };
}

const iv = (mi, mo) => ({ mi: mi || null, mo: mo || null });
const IOLM = "Ford: change oil when the Intelligent Oil-Life Monitor says so (within 2 weeks / 500 mi of the message), " +
  "never more than 1 year or 10,000 mi. If the monitor isn't working: every 6 months or 5,000 mi. " +
  "The tracker reminds you at the maximum unless you set your own interval.";

/* Ford's interval for one item. Returns { n, s, first, note, sNote, conf, src } or null. */
function fordItem(id, c) {
  const E = schedEra(c), k = E.k, e = c.eng, t = c.trans;
  const is62 = e.id === "62v8";
  const diesel = !!e.isDiesel;
  const raptor = ["35eb_ho_g2", "35eb_ho_g3", "52sc"].includes(e.id);
  let r = null, cap = "confirmed", src = E.src;
  const oil = () => {
    if (k === "f04") return diesel ? { n: iv(5000, 6), s: iv(3000, 3), capd: "assumed" } : { n: iv(5000, 6), s: iv(3000, 3), sNote: "Also every 200 engine hours." };
    if (k === "f09") return diesel ? { n: iv(5000, 6), s: iv(3000, 3), capd: "assumed" } : { n: iv(7500, 6), s: iv(5000, 6), sNote: "Also every 200 engine hours." };
    if (k === "i11" && is62) return { n: iv(7500, 6), s: iv(5000, 6), note: "6.2L has no oil-life monitor: fixed interval." };
    if (k === "sd") return diesel
      ? { n: iv(10000, 12), s: iv(5000, 6), note: IOLM + " Diesel: also no more than 350 engine hours. Ultra-high-sulfur fuel: every 2,500 mi / 3 months.", sCap: "assumed" }
      : { n: iv(10000, 12), s: iv(5000, 6), note: "Super Duty gas: fixed interval - 10,000 mi, 12 months or 450 engine hours.", sNote: "Extended idling: also every 200 engine hours." };
    return { n: iv(10000, 12), s: iv(5000, 6), note: IOLM, sNote: "Ford lists 5,000 mi / 6 months for dusty or off-road use." };
  };
  switch (id) {
    case "oil": {
      const o = oil();
      r = { n: o.n, s: o.s, note: o.note, sNote: o.sNote };
      if (o.capd) cap = o.capd;
      break;
    }
    case "rot": {
      const o = oil();
      if (k === "f04") r = { n: iv(5000), s: null };
      else if (k === "f09") r = { n: iv(7500), s: iv(5000) };
      else r = { n: iv(o.n.mi), s: iv(5000), note: "Ford: rotate tires at every oil change." };
      if (o.capd) cap = "assumed";
      break;
    }
    case "air":
      r = { n: iv(30000), s: null, sNote: "Ford: inspect frequently and replace as needed when idling a lot or on dusty / off-road roads." };
      break;
    case "cabin":
      r = { n: iv(k === "f04" || k === "f09" || is62 ? 15000 : 20000), s: null };
      break;
    case "fuel": {
      const own = e.fuelFilterMi ?? c.gen.fuelFilterMi;
      if (!own) return null;
      if (diesel && (k === "sd" || k === "i15" || k === "m21")) r = { n: iv(30000), s: iv(15000, 6), sNote: "Severe: every 15,000 mi, 6 months or 600 engine hours." };
      else if (!diesel && k === "f04") r = { n: iv(30000), s: iv(15000), sNote: "Extended idling or dusty conditions." };
      else { r = { n: iv(own), s: null }; cap = "general"; }
      break;
    }
    case "sep":
      if (!diesel) return null;
      r = { n: iv(oil().n.mi), s: null, note: "Ford: drain the fuel/water separator at each oil change if needed, or right away when the message center asks." };
      if (k !== "sd") cap = "assumed";
      break;
    case "plugs": {
      if (!e.plugMi) return null;
      if (e.plugMi < 60000) { r = { n: iv(e.plugMi), s: null, note: "Older engine with conventional plugs - interval not confirmed in a Ford document." }; cap = "general"; break; }
      if (k === "f09") r = { n: iv(90000), s: iv(60000), sNote: "Extended idling or low-speed driving." };
      else if (is62) r = { n: iv(97500), s: iv(60000) };
      else r = { n: iv(100000), s: iv(60000), sNote: "Towing or extended idling." };
      if (k === "m21" && c.model === "F-150") r.note = "Ford: 60,000 mi on trucks with the pickup-bed power outlet (Pro Power Onboard).";
      break;
    }
    case "brake":
      r = { n: iv(null, 36), s: null };
      if (k !== "m21" && k !== "sd") { cap = "general"; r.note = "Not in this era's Ford schedule. Many shops recommend every 2-3 years."; }
      break;
    case "coolant":
      if (k === "m21" || k === "sd") r = { n: iv(100000, 60), first: iv(200000, 120), s: null,
        note: "Ford: first change at 10 years / 200,000 mi, then every 5 years / 100,000 mi." };
      else if (k === "i11" && is62) r = { n: iv(45000, 36), first: iv(105000, 72), s: null };
      else if (k === "i11" || k === "i15") r = { n: iv(50000, 36), first: iv(100000, 72), s: null,
        note: "Ford: first change at 6 years / 100,000 mi, then every 3 years / 50,000 mi." };
      else if (k === "f09") r = { n: iv(45000, 36), first: iv(105000, 72), s: null };
      else if (c.year >= 2004) r = { n: iv(50000, 36), first: c.year === 2004 ? iv(100000, 60) : iv(100000, 72), s: null };
      else { r = { n: iv(c.gen.coolantMi, c.gen.coolantMo), s: null, note: "Green coolant era - interval not confirmed in a Ford document." }; cap = "general"; }
      if (diesel && k === "sd") r.sNote = "Diesel, severe: 60,000 mi / 2,400 h, then every 45,000 mi / 1,800 h.";
      break;
    case "trans": {
      if (t.type === "EV") return null;
      const sixR = ["6r80", "5r110w", "6r140"].includes(t.id);
      if (k === "f04") r = { n: iv(150000), s: iv(30000) };
      else if (k === "f09") r = sixR ? { n: iv(150000), s: null, note: "Ford: severe-duty changes not required for 6R / TorqShift transmissions." } : { n: iv(150000), s: iv(30000) };
      else if (k === "m21" && E.src === "M22") r = { n: iv(150000), s: iv(30000), sNote: "Towing, idling or dusty conditions." };
      else r = { n: iv(150000), s: null };
      if (t.type === "Manual") { cap = "assumed"; r.note = "Manual transmission - check your manual for its own interval."; }
      break;
    }
    case "rear":
      r = { n: iv(150000), s: null, note: k === "m21" ? "Ford: change not required unless a leak is suspected or the axle has been under water." : undefined,
        sNote: k === "f04" ? "Non-synthetic axle used for extended hot-weather towing at wide-open throttle: every 3,000 mi / 3 months."
          : k === "sd" ? "Non-synthetic axle used for hot-weather towing: every 30,000 mi." : undefined };
      break;
    case "front":
      r = { n: iv(150000), s: raptor && k === "m21" ? iv(30000, 24) : null,
        sNote: raptor && k === "m21" ? "Raptor driven off-road." : undefined,
        note: k === "m21" ? "Ford: change not required unless a leak is suspected or the axle has been under water." : undefined };
      break;
    case "tcase":
      if (k === "m21") r = { n: iv(150000), s: raptor ? iv(30000, 24) : null, sNote: raptor ? "Raptor driven off-road." : undefined };
      else r = { n: iv(150000), s: iv(60000), sNote: k === "sd" ? "Towing." : undefined };
      break;
    case "ptu": case "rdu":
      r = { n: iv(150000), s: null, note: "AWD crossover unit - not listed separately in the Ford documents checked." };
      cap = "assumed";
      break;
    case "belt":
      if (k === "sd") r = diesel ? { n: iv(150000), s: null, note: "Ford: inspect at 90,000 mi; replace at 150,000 mi." }
        : { n: iv(100000), s: null, note: "Ford: inspect at 100,000 mi, then every 15,000 mi; replace as needed." };
      else if (k === "m21") r = { n: iv(150000), s: null, note: "Ford: inspect at 100,000 mi, then every other oil change; replace at 150,000 mi." };
      else if (k === "f09") r = { n: iv(150000), s: null, note: "Ford: inspect at 90,000 and 120,000 mi; replace at 150,000 mi if not replaced in the last 100,000 mi." };
      else r = { n: iv(150000), s: null, note: "Ford: inspect at 100,000 mi; replace at 150,000 mi if not replaced in the last 100,000 mi." };
      break;
    case "wiper":
      r = { n: iv(null, 6), s: null, note: "Ford: check the blades and washer spray every 6 months, and clean or replace the blades as needed. Ford sets no fixed replacement interval - many owners replace them every 6-12 months." };
      if (k === "f04") cap = "assumed";
      break;
    case "battery":
      r = { n: iv(null, 12), s: null, note: "Have the 12V battery load-tested yearly once it's 3+ years old." };
      cap = "general"; src = "GEN";
      break;
    default: return null;
  }
  r.conf = minConf(E.conf, cap);
  if (r.conf === "general" && src !== "GEN") r.srcNote = SCHED_SOURCES.GEN;
  r.src = src;
  return r;
}

/* Display order + applicability. `part` = what to buy / use. */
const SCHEDULE = [
  { id: "oil", type: "Oil & Filter Change", when: (c) => !c.eng.isEV,
    part: (c) => (c.eng.oilVisc && c.eng.oilVisc !== "N/A" ? `${c.eng.oilCap} ${c.eng.oilVisc.split(" (")[0]} · ${c.eng.filter}` : "") },
  { id: "rot", type: "Tire Rotation", when: () => true },
  { id: "air", type: "Engine Air Filter", when: (c) => !c.eng.isEV, part: (c) => c.eng.airFilter ?? c.gen.airFilter },
  { id: "cabin", type: "Cabin Air Filter", when: (c) => !/^Not equipped/.test(c.gen.cabinFilter || ""), part: (c) => c.gen.cabinFilter },
  { id: "fuel", type: "Fuel Filter", when: (c) => !!(c.eng.fuelFilterMi ?? c.gen.fuelFilterMi), part: (c) => c.eng.fuelFilter || c.gen.fuelFilter },
  { id: "sep", type: "Fuel/Water Separator Drain", when: (c) => !!c.eng.isDiesel },
  { id: "plugs", type: "Spark Plugs", when: (c) => !!c.eng.plugMi, part: (c) => `${c.eng.plug} · gap ${c.eng.gap}` },
  { id: "brake", type: "Brake Fluid", when: () => true, part: (c) => c.gen.brakeFluid },
  { id: "coolant", type: "Coolant Flush", when: (c) => !c.eng.isEV, part: (c) => c.gen.coolant },
  { id: "trans", type: "Transmission Fluid", when: (c) => c.trans.type !== "EV", part: (c) => c.trans.fluid },
  { id: "rear", type: "Rear Differential Fluid", when: (c) => driveComps(c).includes("rear"), part: (c) => c.gen.rearAxle },
  { id: "front", type: "Front Differential Fluid", when: (c) => driveComps(c).includes("front"), part: (c) => c.gen.frontDiff },
  { id: "tcase", type: "Transfer Case Fluid", when: (c) => driveComps(c).includes("tcase"), part: (c) => c.gen.transferCase },
  { id: "ptu", type: "PTU Fluid", when: (c) => driveComps(c).includes("ptu"), part: (c) => c.gen.ptu },
  { id: "rdu", type: "Rear Drive Unit Fluid", when: (c) => driveComps(c).includes("rdu"), part: (c) => c.gen.rdu },
  { id: "belt", type: "Drive Belt", when: (c) => !c.eng.isEV },
  { id: "wiper", type: "Wiper Blades", when: () => true, part: (c) => { const w = wipersFor(c.gen, c.year); return w ? wiperShort(w) : ""; } },
  { id: "battery", type: "Battery Test", when: () => true }
];

/* All applicable schedule items with Ford data */
function scheduleFor(c) {
  return SCHEDULE.filter((s) => s.when(c)).map((s) => ({ ...s, ford: fordItem(s.id, c) })).filter((s) => s.ford);
}

/* =====================================================================
   WIPER BLADES
   Sizes from blade-maker application guides (Rain-X / Bosch / Trico),
   retailer fitment charts and genuine Motorcraft part listings,
   cross-checked Nov 2026. conf: high = 2+ independent sources agree,
   medium = one good source or a minor conflict, low = sources
   disagree / not confirmed.
   conn = arm connector. Most Ford trucks use the common 9x3 J-hook;
   many newer Fords use a push-button (pinch-tab) arm.
   ===================================================================== */
const WIPERS = {
  g8:  [{ years: [1990, 1991], d: 18, p: 18, r: null, conn: "Side pin (some sources list J-hook)", conf: "medium" }],
  g9:  [{ years: [1992, 1993], d: 18, p: 18, r: null, conn: "Side pin", conf: "high" },
        { years: [1994, 1996], d: 18, p: 18, r: null, conn: "9x3 J-hook", conf: "high" }],
  g10: [{ years: [1997, 1997], d: 22, p: 22, r: null, conn: "9x3 J-hook", conf: "medium", note: "1997 is an unusual one-year size - measure your blades." },
        { years: [1998, 2003], d: 20, p: 20, r: null, conn: "9x3 J-hook", conf: "high" }],
  g11: [{ years: [2004, 2007], d: 20, p: 20, r: null, conn: "9x3 J-hook", conf: "high" },
        { years: [2008, 2008], d: 20, p: 20, r: null, conn: "9x3 J-hook", conf: "low", alt: "Some sources list 22\" for 2008 - measure your blades." }],
  g12: [{ years: [2009, 2014], d: 22, p: 22, r: null, conn: "9x3 J-hook", conf: "high" }],
  g13: [{ years: [2015, 2020], d: 22, p: 22, r: null, conn: "9x3 J-hook", conf: "high" }],
  g14: [{ years: [2021, 2099], d: 22, p: 22, r: null, conn: "9x3 J-hook", conf: "high" }],
  hd_obs: [{ years: [1990, 1993], d: 18, p: 18, r: null, conn: "Side pin", conf: "medium" },
           { years: [1994, 1997], d: 18, p: 18, r: null, conn: "9x3 J-hook", conf: "high" }],
  sd1: [{ years: [1999, 2007], d: 20, p: 20, r: null, conn: "9x3 J-hook", conf: "high" }],
  sd2: [{ years: [2008, 2010], d: 22, p: 22, r: null, conn: "9x3 J-hook", conf: "high" }],
  sd3: [{ years: [2011, 2016], d: 22, p: 22, r: null, conn: "9x3 J-hook", conf: "high" }],
  sd4: [{ years: [2017, 2022], d: 22, p: 22, r: null, conn: "9x3 J-hook", conf: "high" }],
  sd5: [{ years: [2023, 2099], d: 22, p: 22, r: null, conn: "Push button or 9x3 J-hook (sources disagree)", conf: "medium",
          note: "Check your wiper arm before buying - sources disagree on the connector." }],
  ranger6: [{ years: [2024, 2099], d: 25, p: 17, r: null, conn: "Push button (narrow)", conf: "medium", alt: "Some charts list 26\" / 16\"." }],
  mav1: [{ years: [2022, 2099], d: 22, p: 21, r: null, conn: "Push button (narrow)", conf: "high" }],
  bronco6: [{ years: [2021, 2099], d: 17, p: 17, r: "≈ 8 (not confirmed)", conn: "Push button / pinch tab (sources differ)", conf: "medium",
              note: "Rear blade size not confirmed - check the blade on your tailgate." }],
  bsport1: [{ years: [2021, 2099], d: "22-24 (sources disagree)", p: 21, r: "Not confirmed", conn: "Push button", conf: "low",
              alt: "The genuine Motorcraft driver blade is listed as 23\". Measure your blade." }],
  expl6: [{ years: [2020, 2099], d: 26, p: 21, r: 11, conn: "Pinch tab / push button (sources differ)", conf: "high" }],
  exped5: [{ years: [2025, 2099], d: 22, p: 22, r: 11, conn: "Push button", conf: "high" }],
  mus7: [{ years: [2024, 2099], d: 22, p: 20, r: null, conn: "Pinch tab (sources differ)", conf: "medium", alt: "Some sources list 21\" / 19\"." }],
  mache1: [{ years: [2021, 2099], d: 24, p: 20, r: "11-12 (not confirmed)", conn: "Push button", conf: "medium" }],
  transit4: [{ years: [2015, 2099], d: 28, p: 21, r: "Most US Transit vans have none", conn: "Push button", conf: "medium",
               alt: "Some charts list a 20\" passenger blade; the driver blade can differ by roof height." }],
  eseries: [{ years: [2021, 2099], d: 20, p: 20, r: null, conn: "9x3 J-hook", conf: "high" }]
};

function wipersFor(gen, year) {
  const list = WIPERS[gen && gen.id] || [];
  return list.find((w) => year >= w.years[0] && year <= w.years[1]) || null;
}
const inch = (v) => (typeof v === "number" ? v + "\"" : v);
function wiperShort(w) {
  return `Driver ${inch(w.d)} · Passenger ${inch(w.p)}${w.r ? " · Rear " + inch(w.r) : ""} · ${w.conn.split(" (")[0]}`;
}
function wiperStyles(w) {
  if (/J-hook/i.test(w.conn) && !/push/i.test(w.conn)) return "Conventional (frame), beam (frameless) or hybrid blades all fit a 9x3 J-hook arm - most blades include this adapter.";
  if (/side pin/i.test(w.conn)) return "Choose a blade listed for side-pin arms (many conventional blades include a side-pin adapter).";
  return "Beam or hybrid blades with the matching push-button / pinch-tab adapter. Check the blade's fit list for your model.";
}
