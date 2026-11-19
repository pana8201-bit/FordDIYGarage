# DIY Garage - Truck Spec Reference

A quick-reference app for doing your own work on a **1990-present F-150**. You choose the year, engine, transmission and 4x2/4x4, and it shows:

- **Engine oil:** capacity, viscosity, Ford spec, oil filter P/N, drain plug torque
- **Transmission:** fluid type, capacity, drain plug and pan bolt torque
- **Fuel and ignition:** fuel type, tank capacity, spark plug P/N, gap and replacement interval
- **Filters:** engine air, cabin air and fuel filter P/Ns
- **Differentials:** front and rear fluid type and capacity, transfer case fluid
- **Chassis:** lug nut torque, bolt pattern, washer fluid, coolant, brake fluid
- **DIY maintenance schedule:** intervals for each owner-serviceable item, with severe-duty notes

It also includes a **service log** that counts down to the next oil change, shows schedule status for every item, sends reminder notifications, creates calendar (`.ics`) alerts, and exports or imports a JSON backup.

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
| `data.js` | **Spec database** - generations, engines, transmissions, maintenance schedule |
| `app.js` | Selector, spec sheet, service tracker, reminders |
| `sw.js` | Offline cache (network-first). **Bump `CACHE` on each release.** |
| `manifest.webmanifest`, `icon.svg` | PWA install metadata |

## Data accuracy
Values were compiled as reference data and have **not** been checked against official sources. Fields that vary by build date or calibration appear with a **VERIFY** tag. Before final torque, always confirm against the Owner's Manual, oil-fill cap, a VIN lookup on motorcraftservice.com, or a dealer. To correct a value, edit `data.js` and bump `DATA_VERSION` and the `CACHE` name in `sw.js`.

## Disclaimer
This is an independent project. It is **not affiliated with, endorsed by, or sponsored by Ford Motor Company.** Ford, F-150, Motorcraft, EcoBoost, PowerBoost, Power Stroke, Raptor and Lightning are trademarks of their respective owners and appear here only to identify compatible vehicles and parts. The software is provided "as is" with no warranty, and you perform all work at your own risk.
