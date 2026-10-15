// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys, from the `config_schema` of
// `gladys-assistant-integration.json`. This module holds the defaults (they
// MUST match the manifest `default` values, test/manifest.test.js checks it)
// and turns the raw form values into what the code uses: the list of chargers
// to reach, locally or through the go-e cloud.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/** Refresh intervals offered by the form, in seconds (manifest select values). */
export const POLL_INTERVALS = ['10', '15', '30', '60'];

export const DEFAULT_CONFIG = {
  // IP addresses or host names of the chargers on the local network.
  chargers: '',
  // Optional go-e cloud access, for a charger out of reach of the local network.
  cloud_serial: '',
  cloud_token: '',
  poll_interval: '15',
  language: 'fr',
};

// A host as typed in the form: an IPv4 address or a host name, optional port.
// No scheme, no path, no credentials: the local API v2 takes none.
const HOST_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?(?::\d{1,5})?$/;

/**
 * Split the "chargers" field into hosts. Accepts commas, semicolons, spaces or
 * new lines between entries, and forgives a pasted "http://" or a trailing "/".
 * @param {string} raw
 * @returns {{ hosts: string[], invalid: string[] }}
 */
export function parseHosts(raw) {
  const hosts = [];
  const invalid = [];
  for (const entry of String(raw ?? '').split(/[\s,;]+/)) {
    const host = entry.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    if (host === '') {
      continue;
    }
    if (!HOST_PATTERN.test(host)) {
      // Never echo an entry carrying credentials back in a message or a log.
      invalid.push(host.includes('@') ? '***' : host);
      continue;
    }
    if (!hosts.includes(host.toLowerCase())) {
      hosts.push(host.toLowerCase());
    }
  }
  return { hosts, invalid };
}

/**
 * The cloud API addresses a charger by its serial number, 6 digits with
 * leading zeros (go-e cloud API documentation).
 * @param {string} raw
 * @returns {string|null} null when empty or not a serial number
 */
export function normalizeSerial(raw) {
  const digits = String(raw ?? '').trim();
  if (!/^\d{1,12}$/.test(digits)) {
    return null;
  }
  return digits.padStart(6, '0');
}

/**
 * Merge the user config with the defaults and derive what the code uses.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const merged = { ...DEFAULT_CONFIG, ...(raw ?? {}) };
  const { hosts, invalid } = parseHosts(merged.chargers);
  const serial = normalizeSerial(merged.cloud_serial);
  const token = String(merged.cloud_token ?? '').trim();
  const interval = POLL_INTERVALS.includes(String(merged.poll_interval))
    ? String(merged.poll_interval)
    : DEFAULT_CONFIG.poll_interval;
  return {
    chargers: String(merged.chargers ?? ''),
    cloud_serial: serial ?? '',
    cloud_token: token,
    poll_interval: interval,
    language: LANGUAGES.includes(merged.language) ? merged.language : DEFAULT_CONFIG.language,
    hosts,
    invalidHosts: invalid,
    // The cloud access counts only when both halves are there.
    cloud: serial && token ? { serial, token } : null,
    cloudIncomplete: Boolean(merged.cloud_serial || token) && !(serial && token),
  };
}

/** The refresh interval, in milliseconds. */
export function pollIntervalMs(config) {
  return Number(config.poll_interval) * 1000;
}

/** At least one charger to reach. */
export function isConfigured(config) {
  return config.hosts.length > 0 || config.cloud !== null;
}
