// -----------------------------------------------------------------------------
// A fake go-e Charger, for end-to-end tests: a real HTTP server on 127.0.0.1
// speaking the local API v2 (`/api/status?filter=`, `/api/set?`), and a fake
// `fetch` playing the go-e cloud in front of it.
//
// It behaves like the documented API: a filtered status carries only the keys
// asked for (and the ones the firmware has), `/api/set` answers one entry per
// key, `true` or an error text; with the API v2 off, the charger answers 404.
// -----------------------------------------------------------------------------

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

export function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`../fixtures/goe/${name}.json`, import.meta.url), 'utf8'));
}

export const FIXTURES = {
  idle: 'v4-11kw-idle-055.7',
  charging: 'v3-22kw-charging-056.2',
  completeNoPsm: 'v3-11kw-complete-no-psm-051.4',
  error: 'v4-22kw-error-overtemp-059.4',
};

/** The charger logic, shared by the local server and the fake cloud. */
function createChargerState(fixture) {
  const charger = {
    status: structuredClone(fixture),
    apiEnabled: true,
    requests: [],

    /** @returns {{ status: number, body: unknown }} */
    handle(pathname, searchParams) {
      charger.requests.push(`${pathname}?${searchParams.toString()}`);
      if (!charger.apiEnabled) {
        return { status: 404, body: '<html>Not found</html>' };
      }
      if (pathname === '/api/status') {
        const filter = searchParams.get('filter');
        if (!filter) {
          return { status: 200, body: charger.status };
        }
        const body = {};
        for (const key of filter.split(',')) {
          if (key in charger.status) {
            body[key] = charger.status[key];
          }
        }
        return { status: 200, body };
      }
      if (pathname === '/api/set') {
        const body = {};
        for (const [key, raw] of searchParams) {
          body[key] = charger.write(key, raw);
        }
        return { status: 200, body };
      }
      return { status: 404, body: 'Not found' };
    },

    write(key, raw) {
      let value;
      try {
        value = JSON.parse(raw);
      } catch {
        return 'Could not parse json';
      }
      const max = charger.status.var === 11 ? 16 : 32;
      switch (key) {
        case 'amp':
          if (!Number.isInteger(value) || value < 6 || value > Math.min(max, charger.status.ama)) {
            return 'value out of range';
          }
          break;
        case 'frc':
          if (![0, 1, 2].includes(value)) {
            return 'value out of range';
          }
          break;
        case 'psm':
          if (!('psm' in charger.status)) {
            return 'unknown key';
          }
          if (![0, 1, 2].includes(value)) {
            return 'value out of range';
          }
          break;
        default:
          return 'unknown key';
      }
      charger.status[key] = value;
      return true;
    },
  };
  return charger;
}

/**
 * Start a local fake charger.
 * @param {object} fixture a status (test/fixtures/goe)
 */
export async function startFakeCharger(fixture) {
  const charger = createChargerState(fixture);
  const sockets = new Set();
  let port = 0;
  let server = null;

  async function listen() {
    server = createServer((req, res) => {
      const url = new URL(req.url, 'http://charger');
      const { status, body } = charger.handle(url.pathname, url.searchParams);
      const text = typeof body === 'string' ? body : JSON.stringify(body);
      res.writeHead(status, {
        'content-type': typeof body === 'string' ? 'text/html' : 'application/json',
      });
      res.end(text);
    });
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
    port = server.address().port;
  }

  await listen();

  return Object.assign(charger, {
    get host() {
      return `127.0.0.1:${port}`;
    },
    /** Power cut: the address stops answering (connection refused). */
    async powerOff() {
      for (const socket of sockets) {
        socket.destroy();
      }
      await new Promise((resolve) => server.close(resolve));
    },
    /** Back on the same address. */
    async powerOn() {
      await listen();
    },
    async close() {
      if (server.listening) {
        await charger.powerOff();
      }
    },
  });
}

/**
 * A fake `fetch` for the go-e cloud (`https://<serial>.api.v3.go-e.io`), in
 * front of chargers built from fixtures. Anything else goes to the real fetch
 * (the local fake chargers).
 * @param {Record<string, object>} chargersBySerial serial → fixture
 * @param {string} token the valid API token
 */
export function createFakeCloud(chargersBySerial, token) {
  const chargers = new Map(
    Object.entries(chargersBySerial).map(([serial, fixture]) => [
      serial,
      Object.assign(createChargerState(fixture), { online: true }),
    ]),
  );
  const calls = [];

  async function fetch(url, init = {}) {
    const parsed = new URL(url);
    const match = parsed.hostname.match(/^(\d{6})\.api\.v3\.go-e\.io$/);
    if (!match) {
      return globalThis.fetch(url, init);
    }
    calls.push({ url, headers: init.headers });
    const json = (status, body) =>
      new Response(body === undefined ? '' : JSON.stringify(body), { status });
    const charger = chargers.get(match[1]);
    const auth = init.headers?.authorization;
    if (!charger || auth !== `Bearer ${token}`) {
      return json(403, { error: 'forbidden' });
    }
    if (!charger.online) {
      return json(404, { error: 'not online' });
    }
    const { status, body } = charger.handle(parsed.pathname, parsed.searchParams);
    if (parsed.pathname === '/api/set') {
      const accepted = Object.values(body).some((value) => value === true);
      return json(accepted ? 202 : 422, body);
    }
    return json(status, body);
  }

  return { fetch, chargers, calls };
}
