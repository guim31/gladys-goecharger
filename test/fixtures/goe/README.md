# go-e Charger fixtures

Answers of `GET /api/status?filter=<STATUS_KEYS>` (see `src/goe/client.js`),
the filtered read the integration makes.

| File                                 | Origin                                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `v4-11kw-idle-055.7.json`            | Real status of a go-eCharger V4, firmware 055.7, from `test/data/charger_status_all.json` of [supermihi/goe](https://github.com/supermihi/goe) (MIT, © 2023 Michael Helmling), reduced to the filtered keys; serial replaced by an invented one. |
| `v3-22kw-charging-056.2.json`        | Built for these tests from the API v2 documentation: a 22 kW V3 charging on three phases at 16 A.                                                                                                                                                |
| `v3-11kw-complete-no-psm-051.4.json` | Built: an 11 kW V3 on an older firmware without phase switching (`psm` absent), charge complete, a temperature sensor reading `null`.                                                                                                            |
| `v4-22kw-error-overtemp-059.4.json`  | Built: a 22 kW V4 in error 13 (overheating), charge forced off.                                                                                                                                                                                  |

Serial numbers are invented. No address, no network detail.
