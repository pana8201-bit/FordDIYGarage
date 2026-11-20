# DIY Garage - Truck Spec Reference

A quick-reference app for doing your own work on **current US Ford vehicles**, plus **1990-present F-150, F-250 and F-350** pickups. You choose the category, model, year, engine, transmission and driveline, and it shows:

- **Engine oil:** capacity, viscosity, Ford spec, oil filter P/N, drain plug torque
- **Transmission:** fluid type, capacity, drain plug and pan bolt torque
- **Fuel and ignition:** fuel type (gas / diesel / DEF), tank capacity, spark plug P/N, gap and replacement interval
- **Filters:** engine air, cabin air and fuel filter P/Ns (including diesel filter / water separator)
- **Driveline:** front and rear differentials, transfer case, and the power transfer unit (PTU) / rear drive unit (RDU) on AWD crossovers
- **Chassis:** lug nut torque, bolt pattern, washer fluid, coolant, brake fluid
- **DIY maintenance schedule:** intervals for each owner-serviceable item, with severe-duty notes

Coverage:
- **F-150:** 1990-present, gas, hybrid, 3.0L diesel and Lightning EV
- **F-250 / F-350:** OBS (1990-97) and Super Duty (1999-present), including the 4.9L I6, 5.8L, 7.5L, 5.4L, 6.8L V10, 6.2L, 7.3L and 6.8L gas engines, and the 7.3L IDI, 7.3L, 6.0L, 6.4L and 6.7L Power Stroke diesels
- **Current US lineup (current generation only, PRELIMINARY data):** Ranger (2024+), Maverick (2022+), Bronco (2021+), Bronco Sport (2021+), Explorer (2020+), Expedition (2025+), Mustang (2024+), Mustang Mach-E (2021+), Transit / E-Transit (2015+) and E-Series cutaway (2021+)
- Not included because production has ended: Escape (final MY2026), Edge (2024), F-150 Lightning (2022-2025 is covered under F-150)

Trackers:
- **Service log:** counts down to the next oil change, shows schedule status for every item, sends reminder notifications and creates calendar (`.ics`) alerts
- **Expense tracker:** logs mods, maintenance, repairs, parts, tools, tires, accessories and more. Shows totals by period, a category breakdown, mods vs. maintenance spend and lifetime cost per mile, with CSV export. Costs entered on service records are included automatically.
- **Backup:** JSON export/import of the truck, service history and expenses

It is a static Progressive Web App (plain HTML/CSS/JS, no build step, works offline). All user data stays on the device in `localStorage`.

**Live app:** https://pana8201-bit.github.io/FordDIYGarage/

## Install on your phone
Open the live link, then:
- **iPhone (Safari):** Share → *Add to Home Screen*
- **Android (Chrome):** ⋮ menu → *Install app* / *Add to Home screen*

## Run locally
```
python -m http.server 8150
```
Then open http://localhost:8150

## Files
| File | Purpose |
|---|---|
| `index.html` | Layout / tabs |
| `styles.css` | Theme |
| `data.js` | F-150 spec database + maintenance schedule |
| `data-hd.js` | F-250 / F-350 spec database (loaded after `data.js`) |
| `data-ford.js` | Current US Ford lineup + vehicle catalog (loaded last) |
| `app.js` | Selector, spec sheet, service tracker, expenses, reminders |
| `sw.js` | Offline cache (network-first). **Bump `CACHE` on each release.** |
| `manifest.webmanifest`, `icon.svg` | PWA install metadata |

## Data accuracy
Values were compiled as reference data and have **not** been checked against official sources. Fields that vary by build date, axle or calibration appear with a **VERIFY** tag. Part numbers we're not confident about read "confirm P/N by VIN" instead of being guessed. Super Duty specs vary a lot by SRW/DRW, axle and wheelbase, so check the axle tag and Owner's Manual. Before final torque, always confirm against the Owner's Manual, oil-fill cap, a VIN lookup on motorcraftservice.com, or a dealer. Everything in `data-ford.js` is marked **preliminary** in the app: many values deliberately say "confirm" and are waiting to be filled in from Owner's Manuals. To correct a value, edit `data.js` / `data-hd.js` / `data-ford.js` and bump `DATA_VERSION` and the `CACHE` name in `sw.js`.

## Disclaimer
This is an independent project. It is **not affiliated with, endorsed by, or sponsored by Ford Motor Company.** Ford, F-150, F-250, F-350, Super Duty, Ranger, Maverick, Bronco, Bronco Sport, Explorer, Expedition, Mustang, Mustang Mach-E, Transit, E-Transit, E-Series, Motorcraft, EcoBoost, PowerBoost, Power Stroke, TorqShift, Raptor, Tremor and Lightning are trademarks of their respective owners and appear here only to identify compatible vehicles and parts. The software is provided "as is" with no warranty, and you perform all work at your own risk.
