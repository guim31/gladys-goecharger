# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- go-e Charger stations (V3 and V4) over their local HTTP API v2: one device per
  charger with the charging station state (connector, charging state), car
  plugged in, total and per-phase power, per-phase current, session energy,
  total energy for Gladys' energy monitoring, temperature, error and online
  status.
- Commands: charging current, charging mode (automatic, forced charge, forced
  stop) and, on chargers able to switch, one or three phases.
- Optional access through the go-e cloud API, for a charger out of reach of the
  local network.
- A dashboard widget with the state, power, session energy and current, and
  charge, stop, auto and current buttons (Gladys 5.2.0 or later).
- A "go-e charge finished" scene trigger with the energy of the session, and a
  "Set the go-e charging mode" scene action.
- A "Test the connection" button that says, for each charger, whether it
  answers, or that the local API v2 is off and where to turn it on.
- Documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-goecharger/commits/main
