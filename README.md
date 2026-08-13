# FlightScope Prototype — V0.2

A Tauri v2 + Vite mobile prototype for an aircraft tracking companion.

## V0.2 interactive shell

- Authentic ATC-style radar scope with range rings, rotating sweep, tracks, labels and trails.
- Map view with selectable aircraft.
- Rich "Trump Card" aircraft view.
- Aircraft detail page with route, altitude, speed, heading, vertical rate, registration and squawk.
- Saved aircraft support.
- Search by flight, callsign, registration, type, airline or airport.
- Altitude filters.
- Radar range control.
- Toggleable trails and labels.
- Mobile-first bottom navigation.
- Demo aircraft data so the APK works independently of live ADS-B data.

## Run locally

```bash
npm install
npm run tauri dev
```

## Android

Tauri v2 requires the Android SDK, NDK and Rust Android targets. Then:

```bash
npm install
npm run tauri android init
npm run tauri android build -- --apk
```

The repository includes `.github/workflows/android-apk.yml`, which is intended to build an installable debug APK through GitHub Actions.

## V0.2 status

This is deliberately a functional application shell rather than a production flight-data client. The next architecture step is to replace the demo data array with a provider interface for ADS-B / OpenSky / local receiver / other sources while leaving the UI and interaction model intact.
