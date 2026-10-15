# go-e Charger for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) external integration for
**go-e Charger** EV charging stations (go-eCharger V3 and V4: HOME+ and HOMEfix
V3, Gemini, Gemini flex), over their **local HTTP API v2**. The go-e cloud API
is an option for a charger Gladys cannot reach on the local network.

> **Developed without the hardware: feedback welcome.** Written from the go-e
> API documentation and real status answers published by other projects, and
> tested against a fake charger. Please open an issue with the integration logs
> if your charger behaves differently.

Not affiliated with go-e GmbH. "go-e" and "go-eCharger" are trademarks of their
owner.

## What it does

One Gladys device per charger, keyed on its serial number:

- **Charging station state** (Gladys 5.2 `charging-station` features): connector
  (available, occupied, unavailable, faulted) and charging state (charging,
  vehicle connected, paused by the vehicle when the charge is complete, paused
  by the charger, idle), plus **car plugged in**;
- **power** (total and per phase), **current** per phase, **session energy**,
  **total energy** as an index (Gladys' energy monitoring computes the
  consumption and its cost), **temperature**, **error** in words, **online**;
- **commands**: charging current (6 A to the hardware maximum, 16 or 32 A),
  charging mode (automatic as set in the go-e app, forced charge, forced stop),
  and one or three phases on chargers able to switch.

Plus a **dashboard widget** (state, power, session energy, current, and charge /
stop / auto / current buttons), a **"charge finished" scene trigger** with the
energy of the session, a **"set the charging mode" scene action**, and a **Test
the connection** button in the Configuration screen.

Solar ("eco") charging stays in the go-e app or in evcc: this integration does
not duplicate it. The cable lock and the RFID cards are deliberately not
exposed.

The full user documentation, in four languages, is in [`docs/`](docs/en.md):
[English](docs/en.md), [Français](docs/fr.md), [Deutsch](docs/de.md),
[Español](docs/es.md).

## Requirements

- A go-e Charger V3 or later, firmware 051.4 or later.
- The **local HTTP API v2** turned on in the go-e app (Internet → Advanced
  settings, or Settings → Connection → API settings in the newer app).
- A fixed IP address for the charger (DHCP reservation in the router).
- Gladys **5.2.0** or later (the widget's current button opens a form).

## Installation

In Gladys: **Integrations → Install from GitHub**, enter
`https://github.com/guim31/gladys-goecharger`, then open the Configuration
tab, enter the charger's IP address and add the device from the Discovery tab.

## How it works

- Every refresh is one filtered request, `GET /api/status?filter=…` with the 16
  keys the integration uses (go-e advises against the full status and against
  more than one request per second). Commands are `GET /api/set?amp=…`,
  `frc=…`, `psm=…`, each read back right after.
- The integration refreshes the chargers on its own timer (10 s to 1 min,
  15 s by default): Gladys 5.2.x does not reliably poll external devices
  (GladysAssistant/Gladys#3198). Gladys' own poll is kept as a fallback and
  skipped when the timer has just read the charger.
- Only changed values are sent to Gladys, with every value sent again every 6
  hours.
- Logs stay quiet: nothing at info level for a normal refresh, one line when a
  charger stops answering and one when it is back. `LOG_LEVEL=debug` shows
  every read. The cloud token never appears in the logs.

## Limits

- One charger per address; the cloud access serves one charger.
- Feature names and the maximum current are fixed when the device is added.
- No RFID cards, schedules, cable lock, solar or load-balancing settings.
- The local API v2 has no authentication: anyone on the network can use it.
- Not tested on real hardware yet.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
node scripts/probe.mjs 192.0.2.10   # read-only check of a real charger
```

The tests run against a fake charger (a real HTTP server, `test/helpers/`)
and the SDK's fake Gladys, on fixtures described in
[`test/fixtures/goe/README.md`](test/fixtures/goe/README.md).
`test/gladys-rules.test.js` checks every device against the feature table of
the Gladys core. Project rules: [`CLAUDE.md`](CLAUDE.md).

Releases go through **Actions → Release** (version bump, changelog, multi-arch
image on `ghcr.io`, GitHub Release): never edit the version by hand.

## Credits

- [go-e API v2 documentation](https://github.com/goecharger/go-eCharger-API-v2)
  by go-e: the API keys, the HTTP and cloud endpoints.
- [ha-goecharger-api2](https://github.com/marq24/ha-goecharger-api2) by marq24
  (Apache-2.0), the Home Assistant integration: how to read and write the
  keys, the phase switch mode values, the app settings to turn the API on.
- [goe](https://github.com/supermihi/goe) by Michael Helmling (MIT): the real
  V4 status used as a test fixture.
- [Gladys Assistant](https://github.com/GladysAssistant/Gladys) and its
  [integration SDK](https://github.com/GladysAssistant/integration-sdk-js).

## License

[Apache-2.0](LICENSE)
