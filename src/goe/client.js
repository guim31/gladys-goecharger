// -----------------------------------------------------------------------------
// go-e Charger HTTP API v2 client: local (`http://<host>/api/...`) or cloud
// (`https://<serial>.api.v3.go-e.io/api/...`, bearer token).
//
// Two calls only:
//   - GET /api/status?filter=<keys>  read the keys this integration uses
//     (a filtered read: the charger serves the full status slowly, and go-e
//     asks not to poll it unfiltered);
//   - GET /api/set?<key>=<json>      write keys; the answer tells, per key,
//     `true` or an error message.
//
// Every failure becomes a GoeError with a `kind` the rest of the code turns
// into a message in the user's language — the first cause of a failure being
// the local API v2 left disabled in the go-e app.
// -----------------------------------------------------------------------------

/** The keys read on every refresh (comma list: firmware 051.4 or later). */
export const STATUS_KEYS = [
  'sse', // serial number
  'typ', // device type (go-eCharger_V3, go-eCharger_V4...)
  'var', // variant: 11 (kW, 16 A) or 22 (kW, 32 A)
  'fna', // friendly name
  'fwv', // firmware version
  'car', // car state
  'alw', // allowed to charge now
  'nrg', // voltages, currents, powers
  'wh', // energy since the car was connected, Wh
  'eto', // energy total, Wh
  'amp', // requested current, A
  'ama', // maximum current set in the app, A
  'frc', // force state
  'psm', // phase switch mode (absent when the charger cannot switch)
  'err', // error code
  'tma', // temperature sensors, °C
];

export const ERROR_KINDS = {
  UNREACHABLE: 'unreachable',
  API_DISABLED: 'api_disabled',
  CLOUD_DENIED: 'cloud_denied',
  CLOUD_OFFLINE: 'cloud_offline',
  REJECTED: 'rejected',
  HTTP: 'http',
};

export class GoeError extends Error {
  /**
   * @param {string} kind one of ERROR_KINDS
   * @param {string} message
   * @param {object} [details]
   */
  constructor(kind, message, details = {}) {
    super(message);
    this.name = 'GoeError';
    this.kind = kind;
    Object.assign(this, details);
  }
}

/**
 * Where a charger is reached.
 * @typedef {{ kind: 'local', host: string, id: string } | { kind: 'cloud', serial: string, token: string, id: string }} Target
 */

/** @returns {Target} */
export function localTarget(host) {
  return { kind: 'local', host, id: `local:${host}` };
}

/** @returns {Target} */
export function cloudTarget(serial, token) {
  return { kind: 'cloud', serial, token, id: `cloud:${serial}` };
}

/** Where a target is, for the logs and the messages: never the token. */
export function describeTarget(target) {
  return target.kind === 'local' ? target.host : `cloud ${target.serial}`;
}

/**
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {number} [options.timeoutMs]
 */
export function createClient({ fetch: fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
  function baseUrl(target) {
    return target.kind === 'local'
      ? `http://${target.host}`
      : `https://${target.serial}.api.v3.go-e.io`;
  }

  async function request(target, path) {
    const headers = { accept: 'application/json' };
    if (target.kind === 'cloud') {
      headers.authorization = `Bearer ${target.token}`;
    }
    let response;
    try {
      response = await fetchImpl(`${baseUrl(target)}${path}`, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const reason =
        err?.name === 'TimeoutError' ? 'timeout' : (err?.cause?.code ?? err?.code ?? err?.name);
      throw new GoeError(
        ERROR_KINDS.UNREACHABLE,
        `${describeTarget(target)} unreachable (${reason})`,
        { reason },
      );
    }
    const text = await response.text().catch(() => '');
    let body;
    try {
      body = text === '' ? null : JSON.parse(text);
    } catch {
      // An HTML error page: not JSON.
      body = null;
    }
    return { status: response.status, body };
  }

  function httpError(target, status, body) {
    const where = describeTarget(target);
    if (target.kind === 'local') {
      // The charger answers, but not the API v2: it is switched off in the app
      // (or the firmware predates it).
      if (status === 403 || status === 404) {
        return new GoeError(ERROR_KINDS.API_DISABLED, `${where}: local HTTP API v2 is disabled`, {
          status,
        });
      }
    } else {
      if (status === 401 || status === 403) {
        return new GoeError(ERROR_KINDS.CLOUD_DENIED, `${where}: cloud API refused (${status})`, {
          status,
        });
      }
      if (status === 404) {
        return new GoeError(ERROR_KINDS.CLOUD_OFFLINE, `${where}: charger not online`, { status });
      }
    }
    if (status === 422 || (status === 400 && body && typeof body === 'object')) {
      return new GoeError(ERROR_KINDS.REJECTED, `${where}: values refused`, { status, body });
    }
    return new GoeError(ERROR_KINDS.HTTP, `${where}: HTTP ${status}`, { status });
  }

  return {
    /**
     * Read the keys of STATUS_KEYS.
     * @param {Target} target
     * @returns {Promise<Record<string, unknown>>}
     */
    async readStatus(target) {
      const { status, body } = await request(target, `/api/status?filter=${STATUS_KEYS.join(',')}`);
      if (status !== 200) {
        throw httpError(target, status, body);
      }
      if (!body || typeof body !== 'object' || Array.isArray(body) || body.sse === undefined) {
        // An HTML page, the API v1 of an old charger: not the API v2.
        throw new GoeError(
          ERROR_KINDS.API_DISABLED,
          `${describeTarget(target)}: no API v2 status in the answer`,
        );
      }
      return body;
    },

    /**
     * Write keys. Resolves once the charger (or the cloud) accepted every one.
     * @param {Target} target
     * @param {Record<string, number|string|boolean|null>} values
     */
    async set(target, values) {
      const query = Object.entries(values)
        .map(([key, value]) => `${key}=${encodeURIComponent(JSON.stringify(value))}`)
        .join('&');
      const { status, body } = await request(target, `/api/set?${query}`);
      if (target.kind === 'cloud' && status === 202) {
        // Accepted by the cloud; the next read tells what the charger did.
        return;
      }
      if (status !== 200) {
        throw httpError(target, status, body);
      }
      const refused = Object.keys(values).filter((key) => body?.[key] !== true);
      if (refused.length > 0) {
        const reasons = refused
          .map((key) => `${key}: ${typeof body?.[key] === 'string' ? body[key] : 'refused'}`)
          .join(', ');
        throw new GoeError(ERROR_KINDS.REJECTED, `${describeTarget(target)} refused ${reasons}`, {
          body,
        });
      }
    },
  };
}
