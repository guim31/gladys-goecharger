// -----------------------------------------------------------------------------
// The chargers: where they are, what they last said, and the refresh loop.
//
// Refresh. The devices are published with `should_poll: true` and a valid
// `poll_frequency`, but the core cannot be trusted to call onPoll: Gladys
// 5.2.0/5.2.1 skip a device created without `should_poll`, and a device keeps
// the polling fields it was created with (GladysAssistant/Gladys#3198). So the
// hub reads the chargers on its own timer, and the core's onPoll is a
// fallback: it reads a charger only when the timer has not done it for 90 % of
// a period. One read per charger and period, whoever asks.
//
// States. Only the changes are sent (publishChangedStates), with a heartbeat
// every 6 hours so a stable value (the total energy of a charger nobody uses)
// never shows "no recent value" in Gladys. Only the chargers the user added
// to Gladys are sent: the core drops the states of a device it does not know.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { isConfigured, pollIntervalMs } from './config.js';
import { GoeError, cloudTarget, createClient, describeTarget, localTarget } from './goe/client.js';
import {
  CAR,
  FORCE_MODES,
  MIN_CURRENT,
  PHASE_MODES,
  hardwareMaxCurrent,
  hasPhaseSwitch,
} from './goe/model.js';
import {
  FEATURE,
  buildDevice,
  chargerIds,
  deviceName,
  offlineStates,
  statesFor,
} from './devices.js';
import { MESSAGES, joinMessages } from './i18n.js';
import { createIssueLog } from './issues.js';

const logger = createLogger({ name: 'goe' });

export const HEARTBEAT_MS = 6 * 60 * 60 * 1000;

/** Scene trigger keys (manifest `scene_triggers`): forever once published. */
export const SCENE_TRIGGER = {
  CHARGE_FINISHED: 'charge_finished',
};
export const SCENE_TRIGGER_KEYS = Object.values(SCENE_TRIGGER);

/** Widget keys (manifest `widgets`): forever once published. */
export const WIDGET_KEY = 'charger';

/** A user-facing error: its message is a multi-language object. */
export class UserError extends Error {
  constructor(message) {
    super(message.en);
    this.name = 'UserError';
    this.userMessage = message;
  }
}

/** What the widget shows as text: a change asks it to refresh. */
function widgetFields(charger) {
  const { car, alw, frc, psm, err, amp } = charger.status;
  return JSON.stringify([charger.online, car, alw, frc, psm, err, amp]);
}

export class ChargerHub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {object} [options.client] go-e client (tests: one with a fake fetch)
   * @param {boolean} [options.timers] run the refresh timer (tests may turn it off)
   * @param {() => number} [options.now]
   */
  constructor({ gladys, client = createClient(), timers = true, now = () => Date.now() }) {
    this.gladys = gladys;
    this.client = client;
    this.timers = timers;
    this.now = now;
    this.config = null;
    /** @type {Map<string, { serial: string, target: object, status: object, online: boolean, polledAt: number }>} */
    this.chargers = new Map();
    /** Target id → serial, once the target answered (or a created device says it). */
    this.serialOf = new Map();
    /** Target id → its last failure (GoeError), cleared when it answers. */
    this.failures = new Map();
    /** Target id → poll in progress. */
    this.inFlight = new Map();
    /** Target id → when it was last read. */
    this.polledAt = new Map();
    this.issues = createIssueLog(logger);
    this.announced = new Set();
    this.lastConnectionStatus = null;
    this.timer = null;
    this.stopped = false;
  }

  // --- Configuration and discovery -------------------------------------------

  /** The targets of the configuration: local hosts first, then the cloud. */
  targets() {
    const targets = this.config.hosts.map((host) => localTarget(host));
    if (this.config.cloud) {
      targets.push(cloudTarget(this.config.cloud.serial, this.config.cloud.token));
    }
    return targets;
  }

  /**
   * (Re)start with a configuration: read every charger, publish the devices,
   * report the connection status, and start the timer over.
   */
  async start(config) {
    this.config = config;
    this.stopped = false;
    this.chargers.clear();
    this.serialOf.clear();
    this.failures.clear();
    this.polledAt.clear();
    this.lastConnectionStatus = null;
    this.rememberCreatedChargers();
    if (!isConfigured(config)) {
      logger.info('Not configured yet: waiting for a charger address or a cloud access');
      this.schedule();
      await this.reportConnection();
      return;
    }
    await this.cycle({ force: true, publish: false });
    await this.publishDevices();
    this.schedule();
  }

  /**
   * The chargers the user added to Gladys know their serial and, for a local
   * one, their address (device params): a charger off at startup still gets
   * its "offline" state, and is found again when it answers.
   */
  rememberCreatedChargers() {
    for (const device of this.gladys.devices ?? []) {
      const params = Object.fromEntries((device.params ?? []).map((p) => [p.name, p.value]));
      if (params.SERIAL && params.HOST) {
        this.serialOf.set(localTarget(params.HOST).id, params.SERIAL);
      }
    }
    if (this.config?.cloud) {
      this.serialOf.set(cloudTarget(this.config.cloud.serial, '').id, this.config.cloud.serial);
    }
  }

  /** Publish the device of every charger that answered at least once. */
  async publishDevices() {
    const devices = [...this.chargers.values()].map((charger) =>
      buildDevice(this.gladys, charger, this.config),
    );
    await this.gladys.publishDiscoveredDevices(devices);
  }

  /** The created devices, by external id. */
  createdDeviceIds() {
    return new Set((this.gladys.devices ?? []).map((device) => device.external_id));
  }

  // --- Refresh ----------------------------------------------------------------

  schedule() {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.timers || this.stopped) {
      return;
    }
    this.timer = setTimeout(async () => {
      this.timer = null;
      try {
        await this.cycle();
      } catch (err) {
        logger.error(`Refresh cycle failed (${err.message})`);
      } finally {
        this.schedule();
      }
    }, pollIntervalMs(this.config));
    this.timer.unref?.();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = null;
  }

  /**
   * One refresh of every charger. Errors are logged, never thrown.
   * @param {object} [options]
   * @param {boolean} [options.force] read even a charger read less than half a period ago
   * @param {boolean} [options.publish] publish the devices when a charger appears
   */
  async cycle({ force = false, publish = true } = {}) {
    if (this.gladys.connected === false) {
      logger.debug('Gladys unreachable: refresh skipped');
      return;
    }
    const knownBefore = new Set(this.chargers.keys());
    await Promise.all(this.targets().map((target) => this.pollTarget(target, { force })));
    await this.reportConnection();
    // A charger seen for the first time (off at startup): publish its device.
    const appeared = [...this.chargers.keys()].some((serial) => !knownBefore.has(serial));
    if (appeared && publish) {
      await this.publishDevices().catch((err) =>
        logger.error(`Publishing the devices failed: ${err.message}`),
      );
    }
  }

  /**
   * Read one target, unless it was read less than `minGap` periods ago.
   * Forced: waits for a read in progress, then reads again.
   */
  async pollTarget(target, { force = false, minGap = 0.5 } = {}) {
    let running = this.inFlight.get(target.id);
    while (running && force) {
      await running;
      running = this.inFlight.get(target.id);
    }
    if (running) {
      return running;
    }
    const last = this.polledAt.get(target.id);
    if (!force && last !== undefined && this.now() - last < pollIntervalMs(this.config) * minGap) {
      logger.debug(`${describeTarget(target)}: read ${this.now() - last} ms ago, skipped`);
      return undefined;
    }
    this.polledAt.set(target.id, this.now());
    const run = this.readTarget(target).finally(() => this.inFlight.delete(target.id));
    this.inFlight.set(target.id, run);
    return run;
  }

  async readTarget(target) {
    const where = describeTarget(target);
    let status;
    try {
      status = await this.client.readStatus(target);
    } catch (err) {
      if (!(err instanceof GoeError)) {
        throw err;
      }
      this.failures.set(target.id, err);
      this.issues.fail(target.id, `${where}: ${err.message}`);
      await this.markOffline(target);
      return;
    }

    const serial = String(status.sse);
    this.failures.delete(target.id);
    this.serialOf.set(target.id, serial);
    const previous = this.chargers.get(serial);
    const charger = { serial, target, status, online: true, polledAt: this.now() };
    this.chargers.set(serial, charger);
    if (!this.issues.isFailing(target.id) && !this.announced.has(target.id)) {
      this.announced.add(target.id);
      logger.info(
        `${deviceName(charger)} (${status.typ ?? 'go-eCharger'}, firmware ${status.fwv ?? '?'}) ` +
          `answers at ${where}`,
      );
    }
    this.issues.ok(target.id, `${where}: the charger answers again`);
    logger.debug(`${where}: car=${status.car} amp=${status.amp} frc=${status.frc}`);

    await this.publishStates(charger);
    await this.detectEvents(previous, charger);
    if (previous && widgetFields(previous) !== widgetFields(charger)) {
      // The widget's status rows are texts, not live tiles: nudge it.
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  }

  async publishStates(charger) {
    const ids = chargerIds(this.gladys, charger.serial);
    if (!this.createdDeviceIds().has(ids.device)) {
      return;
    }
    const states = statesFor(this.gladys, charger, this.config.language);
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
    } catch (err) {
      // Sent again by the next read (the SDK remembers only what Gladys took).
      this.issues.fail(`publish:${charger.serial}`, `Publishing the states failed: ${err.message}`);
      return;
    }
    this.issues.ok(`publish:${charger.serial}`, 'Publishing the states works again');
  }

  async markOffline(target) {
    const serial = this.serialOf.get(target.id);
    if (!serial) {
      return;
    }
    const charger = this.chargers.get(serial);
    if (charger?.online) {
      charger.online = false;
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    }
    if (!this.createdDeviceIds().has(chargerIds(this.gladys, serial).device)) {
      return;
    }
    await this.gladys
      .publishChangedStates(offlineStates(this.gladys, serial), { heartbeat: HEARTBEAT_MS })
      .catch((err) => logger.debug(`Publishing the offline state failed: ${err.message}`));
  }

  /**
   * "Charge finished": the car stopped drawing after a charge (go-e `car`
   * from Charging to Complete). The states alone cannot tell it: Gladys'
   * charging state says "paused by the vehicle" for a car that is full and
   * for one that only pauses, and a scene on it would also fire at startup.
   */
  async detectEvents(previous, charger) {
    if (!previous || !previous.online) {
      return;
    }
    if (previous.status.car !== CAR.CHARGING || charger.status.car !== CAR.COMPLETE) {
      return;
    }
    const ids = chargerIds(this.gladys, charger.serial);
    if (!this.createdDeviceIds().has(ids.device)) {
      return;
    }
    const wh = Number(charger.status.wh);
    const data = {
      device: ids.device,
      charger: deviceName(charger),
      energy_kwh: Number.isFinite(wh) ? Math.round(wh / 10) / 100 : null,
    };
    logger.info(`${data.charger}: charge finished (${data.energy_kwh} kWh)`);
    await this.gladys
      .publishSceneEvent(SCENE_TRIGGER.CHARGE_FINISHED, data)
      .catch((err) => logger.error(`Scene event charge_finished refused: ${err.message}`));
  }

  /** The connection status of the Configuration screen, sent when it changes. */
  async reportConnection() {
    const notes = [];
    if (this.config.invalidHosts.length > 0) {
      notes.push(MESSAGES.invalidHosts(this.config.invalidHosts.join(', ')));
    }
    if (this.config.cloudIncomplete) {
      notes.push(MESSAGES.cloudIncomplete);
    }
    let connected;
    let messages;
    if (!isConfigured(this.config)) {
      connected = false;
      messages = [MESSAGES.notConfigured, ...notes];
    } else {
      const failures = this.targets()
        .map((target) => [target, this.failures.get(target.id)])
        .filter(([, err]) => err);
      connected = failures.length === 0;
      messages = [
        ...failures.map(([target, err]) =>
          (MESSAGES.failure[err.kind] ?? MESSAGES.failure.http)(describeTarget(target)),
        ),
        ...notes,
      ];
    }
    const message = messages.length > 0 ? joinMessages(messages) : undefined;
    const key = JSON.stringify({ connected, message });
    if (key === this.lastConnectionStatus) {
      return;
    }
    this.lastConnectionStatus = key;
    await this.gladys
      .setConnectionStatus(connected, message)
      .catch((err) => logger.debug(`Connection status not sent: ${err.message}`));
  }

  // --- Gladys asking ----------------------------------------------------------

  /** The charger of a Gladys device external id, or null. */
  chargerOfDevice(deviceExternalId) {
    for (const charger of this.chargers.values()) {
      if (chargerIds(this.gladys, charger.serial).device === deviceExternalId) {
        return charger;
      }
    }
    return null;
  }

  /** The configured target of a created device, even when it never answered. */
  targetOfDevice(deviceExternalId) {
    const charger = this.chargerOfDevice(deviceExternalId);
    if (charger) {
      return charger.target;
    }
    return (
      this.targets().find((target) => {
        const serial = this.serialOf.get(target.id);
        return serial && chargerIds(this.gladys, serial).device === deviceExternalId;
      }) ?? null
    );
  }

  /** The core's onPoll (fallback): reads unless the timer just did. */
  async pollFromCore(device) {
    const target = this.config ? this.targetOfDevice(device.external_id) : null;
    if (!target) {
      logger.debug(`onPoll ignored for ${device.external_id}`);
      return;
    }
    await this.pollTarget(target, { minGap: 0.9 });
    await this.reportConnection();
  }

  /**
   * A device was just added (or updated) in Gladys: the SDK forgot what it had
   * published for it, so everything is sent again now.
   */
  async deviceCreated(device) {
    const target = this.config ? this.targetOfDevice(device.external_id) : null;
    if (!target) {
      return;
    }
    await this.pollTarget(target, { force: true });
    this.gladys.requestWidgetRefresh(WIDGET_KEY);
  }

  /** The charger a command is for: known and answering. */
  commandTarget(deviceExternalId) {
    const charger = this.chargerOfDevice(deviceExternalId);
    if (!charger) {
      throw new Error(`Unknown charger ${deviceExternalId}`);
    }
    return charger;
  }

  /** Write, then read back so Gladys shows what the charger did. */
  async write(charger, values, what) {
    try {
      await this.client.set(charger.target, values);
    } catch (err) {
      if (err instanceof GoeError) {
        throw new UserError(
          (MESSAGES.failure[err.kind] ?? MESSAGES.failure.http)(deviceName(charger)),
        );
      }
      throw err;
    }
    logger.info(`${deviceName(charger)}: ${what}`);
    await this.pollTarget(charger.target, { force: true });
  }

  /** @returns {Promise<object>} the message to show */
  async setCurrent(deviceExternalId, value) {
    const charger = this.commandTarget(deviceExternalId);
    const amps = Math.round(Number(value));
    const max = hardwareMaxCurrent(charger.status);
    if (!Number.isFinite(amps) || amps < MIN_CURRENT || amps > max) {
      throw new UserError(MESSAGES.currentOutOfRange(MIN_CURRENT, max));
    }
    await this.write(charger, { amp: amps }, `charging current set to ${amps} A`);
    return MESSAGES.currentSet(amps);
  }

  async setForceMode(deviceExternalId, mode) {
    const charger = this.commandTarget(deviceExternalId);
    if (!(mode in FORCE_MODES)) {
      throw new Error(`Unknown charging mode ${mode}`);
    }
    await this.write(charger, { frc: FORCE_MODES[mode] }, `charging mode set to ${mode}`);
    return MESSAGES.modeSet[mode];
  }

  async setPhaseMode(deviceExternalId, mode) {
    const charger = this.commandTarget(deviceExternalId);
    if (!hasPhaseSwitch(charger.status)) {
      throw new UserError(MESSAGES.noPhaseSwitch);
    }
    if (!(mode in PHASE_MODES)) {
      throw new Error(`Unknown phase mode ${mode}`);
    }
    await this.write(charger, { psm: PHASE_MODES[mode] }, `phase mode set to ${mode}`);
  }

  /** onSetValue: dispatch by feature. */
  async setValue(device, feature, value) {
    const ids = chargerIds(this.gladys, this.commandTarget(device.external_id).serial);
    switch (feature.external_id) {
      case ids.feature(FEATURE.TARGET_CURRENT):
        return this.setCurrent(device.external_id, value);
      case ids.feature(FEATURE.FORCE_MODE):
        return this.setForceMode(device.external_id, String(value));
      case ids.feature(FEATURE.PHASE_MODE):
        return this.setPhaseMode(device.external_id, String(value));
      default:
        throw new Error(`${feature.external_id} is read-only`);
    }
  }

  /** The "Test the connection" action: one line per charger. */
  async testConnection() {
    if (!isConfigured(this.config)) {
      return MESSAGES.notConfigured;
    }
    const lines = [];
    for (const target of this.targets()) {
      try {
        const status = await this.client.readStatus(target);
        const charger = { serial: String(status.sse), status };
        lines.push(MESSAGES.testOk(deviceName(charger), charger.serial, String(status.fwv ?? '?')));
      } catch (err) {
        if (!(err instanceof GoeError)) {
          throw err;
        }
        lines.push((MESSAGES.failure[err.kind] ?? MESSAGES.failure.http)(describeTarget(target)));
      }
    }
    if (this.config.invalidHosts.length > 0) {
      lines.push(MESSAGES.invalidHosts(this.config.invalidHosts.join(', ')));
    }
    if (this.config.cloudIncomplete) {
      lines.push(MESSAGES.cloudIncomplete);
    }
    logger.info('Action test_connection');
    return joinMessages(lines);
  }
}
