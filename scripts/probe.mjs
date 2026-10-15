#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Read-only probe of a real go-e Charger, with the integration's own client.
//
//   node scripts/probe.mjs <ip[:port]>
//   GOE_CLOUD_TOKEN=... node scripts/probe.mjs --cloud <serial>
//
// One GET /api/status?filter=<the integration's keys>: never /api/set. Prints
// what the integration would read and show, without the token, the full
// serial number or anything about the network. Exit code 0 when the charger
// answered, 1 otherwise.
// -----------------------------------------------------------------------------

import { createClient, cloudTarget, localTarget, STATUS_KEYS } from '../src/goe/client.js';
import { hardwareMaxCurrent, hasPhaseSwitch, readings } from '../src/goe/model.js';
import { normalizeSerial, parseHosts } from '../src/config.js';

function usage() {
  console.error('usage: node scripts/probe.mjs <ip[:port]>');
  console.error('       GOE_CLOUD_TOKEN=<token> node scripts/probe.mjs --cloud <serial>');
  process.exit(2);
}

const args = process.argv.slice(2);
let target;
if (args[0] === '--cloud') {
  const serial = normalizeSerial(args[1]);
  const token = process.env.GOE_CLOUD_TOKEN?.trim();
  if (!serial || !token) {
    usage();
  }
  target = cloudTarget(serial, token);
} else {
  const { hosts } = parseHosts(args[0] ?? '');
  if (hosts.length !== 1) {
    usage();
  }
  target = localTarget(hosts[0]);
}

const mask = (serial) => `${String(serial).slice(0, 2)}****`;

try {
  const started = Date.now();
  const status = await createClient({ timeoutMs: 8000 }).readStatus(target);
  const r = readings(status);
  const missing = STATUS_KEYS.filter((key) => !(key in status));
  console.log(
    JSON.stringify(
      {
        answered_in_ms: Date.now() - started,
        serial: mask(status.sse),
        type: status.typ,
        variant_kw: status.var,
        firmware: status.fwv,
        keys_missing: missing,
        phase_switch: hasPhaseSwitch(status),
        current_range_a: [6, hardwareMaxCurrent(status)],
        raw: {
          car: status.car,
          alw: status.alw,
          frc: status.frc,
          psm: status.psm,
          err: status.err,
          amp: status.amp,
          ama: status.ama,
          nrg: status.nrg,
          wh: status.wh,
          eto: status.eto,
          tma: status.tma,
        },
        gladys: r,
      },
      null,
      2,
    ),
  );
} catch (err) {
  console.log(JSON.stringify({ error: err.kind ?? 'unexpected', message: err.message }, null, 2));
  process.exit(1);
}
