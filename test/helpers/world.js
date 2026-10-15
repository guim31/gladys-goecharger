// -----------------------------------------------------------------------------
// A test world: fake go-e chargers, the SDK's fake Gladys, and the very same
// wiring as index.js (src/app.js). The integration's own logs are silent
// unless LOG_LEVEL is set (LOG_LEVEL=debug npm test shows them).
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { createClient } from '../../src/goe/client.js';
import { FIXTURES, loadFixture, startFakeCharger } from './fakeCharger.js';

process.env.LOG_LEVEL ??= 'silent';

/**
 * @param {object} [options]
 * @param {string[]} [options.fixtures] keys of FIXTURES, one local charger each
 * @param {object} [options.config] extra config values
 * @param {boolean} [options.create] add every discovered device to Gladys
 * @param {typeof fetch} [options.fetch] fetch of the go-e client (fake cloud)
 * @param {boolean} [options.timers]
 * @param {object[]} [options.devices] devices already created in Gladys
 */
export async function createWorld({
  fixtures = ['charging'],
  config = {},
  create = true,
  fetch,
  timers = false,
  devices = [],
} = {}) {
  const chargers = [];
  for (const key of fixtures) {
    chargers.push(await startFakeCharger(loadFixture(FIXTURES[key])));
  }
  const gladys = createFakeGladys({
    config: { chargers: chargers.map((c) => c.host).join(', '), ...config },
    devices,
  });
  const hub = registerHandlers(gladys, {
    client: createClient({ fetch, timeoutMs: 1000 }),
    timers,
  });
  await gladys.connect();
  if (create) {
    for (const device of gladys.fake.discoveredDevices) {
      await gladys.fake.deviceCreated(device);
    }
  }
  return {
    gladys,
    hub,
    chargers,
    fake: gladys.fake,
    async stop() {
      hub.stop();
      await gladys.disconnect();
      await Promise.all(chargers.map((c) => c.close()));
    },
  };
}

/** The last state Gladys received for a feature key of a charger. */
export function lastState(world, serial, key) {
  return world.fake.lastState(`${world.gladys.externalIds('charger', serial).feature(key)}`);
}

/** Capture the log lines (console, as the SDK logger writes) at a level. */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => lines.push(args.map(String).join(' '));
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.mock.method(console, 'warn', record);
  t.mock.method(console, 'info', record);
  t.mock.method(console, 'debug', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}

/** Wait for a condition, without timers (tests may mock them). */
export async function waitFor(condition, what = 'condition', tries = 2000) {
  for (let i = 0; i < tries; i += 1) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`timed out waiting for ${what}`);
}
