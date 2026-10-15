// The go-e status → Gladys values mapping, on the fixtures.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAR,
  CHARGING_STATE,
  CONNECTOR_STATUS,
  chargingState,
  connectorStatus,
  hardwareMaxCurrent,
  hasPhaseSwitch,
  readings,
} from '../src/goe/model.js';
import { FIXTURES, loadFixture } from './helpers/fakeCharger.js';

test('the Gladys enums are the ones of the core (server/utils/constants.js, 5.2.1)', () => {
  assert.deepEqual(CONNECTOR_STATUS, {
    AVAILABLE: 0,
    OCCUPIED: 1,
    RESERVED: 2,
    UNAVAILABLE: 3,
    FAULTED: 4,
  });
  assert.equal(CHARGING_STATE.CHARGING, 0);
  assert.equal(CHARGING_STATE.EV_CONNECTED, 1);
  assert.equal(CHARGING_STATE.PAUSED_BY_VEHICLE, 2);
  assert.equal(CHARGING_STATE.PAUSED_BY_CHARGER, 3);
  assert.equal(CHARGING_STATE.IDLE, 4);
});

test('car state → connector status and charging state', () => {
  const cases = [
    [{ car: CAR.IDLE, err: 0 }, CONNECTOR_STATUS.AVAILABLE, CHARGING_STATE.IDLE],
    [{ car: CAR.CHARGING, err: 0 }, CONNECTOR_STATUS.OCCUPIED, CHARGING_STATE.CHARGING],
    [
      { car: CAR.WAIT_CAR, alw: true, err: 0 },
      CONNECTOR_STATUS.OCCUPIED,
      CHARGING_STATE.EV_CONNECTED,
    ],
    [
      { car: CAR.WAIT_CAR, alw: false, err: 0 },
      CONNECTOR_STATUS.OCCUPIED,
      CHARGING_STATE.PAUSED_BY_CHARGER,
    ],
    [{ car: CAR.COMPLETE, err: 0 }, CONNECTOR_STATUS.OCCUPIED, CHARGING_STATE.PAUSED_BY_VEHICLE],
    [{ car: CAR.ERROR, err: 0 }, CONNECTOR_STATUS.FAULTED, CHARGING_STATE.IDLE],
    [{ car: CAR.CHARGING, err: 5 }, CONNECTOR_STATUS.FAULTED, CHARGING_STATE.CHARGING],
    [{ car: null, err: null }, CONNECTOR_STATUS.UNAVAILABLE, CHARGING_STATE.IDLE],
    [{ car: CAR.UNKNOWN, err: 0 }, CONNECTOR_STATUS.UNAVAILABLE, CHARGING_STATE.IDLE],
  ];
  for (const [status, connector, charging] of cases) {
    assert.equal(connectorStatus(status), connector, JSON.stringify(status));
    assert.equal(chargingState(status), charging, JSON.stringify(status));
  }
});

test('a charging 22 kW V3: powers, currents, energies, modes', () => {
  const r = readings(loadFixture(FIXTURES.charging));
  assert.deepEqual(r.power, { total: 11048, l1: 3676, l2: 3700, l3: 3672 });
  assert.deepEqual(r.current, { l1: 15.9, l2: 16.1, l3: 15.8 });
  assert.equal(r.sessionKwh, 5.32);
  assert.equal(r.totalKwh, 1234.567);
  assert.equal(r.targetCurrent, 16);
  assert.equal(r.force, 'neutral');
  assert.equal(r.phaseMode, 'auto');
  assert.equal(r.plugged, 1);
  assert.equal(r.temperature, 31.5);
  assert.equal(r.error, 0);
  assert.equal(hardwareMaxCurrent(loadFixture(FIXTURES.charging)), 32);
});

test('the real V4 status (supermihi/goe): idle 11 kW with phase switching', () => {
  const status = loadFixture(FIXTURES.idle);
  const r = readings(status);
  assert.equal(r.connectorStatus, CONNECTOR_STATUS.AVAILABLE);
  assert.equal(r.plugged, 0);
  assert.equal(r.power.total, 0);
  assert.equal(r.totalKwh, 0.006);
  assert.equal(hardwareMaxCurrent(status), 16);
  assert.equal(hasPhaseSwitch(status), true);
});

test('an older firmware without psm, a null temperature sensor', () => {
  const status = loadFixture(FIXTURES.completeNoPsm);
  const r = readings(status);
  assert.equal(hasPhaseSwitch(status), false);
  assert.equal(r.phaseMode, null);
  assert.equal(r.temperature, 22.5);
  assert.equal(r.chargingState, CHARGING_STATE.PAUSED_BY_VEHICLE);
  assert.equal(r.sessionKwh, 18.24);
});

test('a charger in error, forced off', () => {
  const r = readings(loadFixture(FIXTURES.error));
  assert.equal(r.connectorStatus, CONNECTOR_STATUS.FAULTED);
  assert.equal(r.error, 13);
  assert.equal(r.force, 'off');
  assert.equal(r.phaseMode, 'three');
});

test('a status missing keys gives nulls, never NaN', () => {
  const r = readings({ sse: '012345' });
  assert.deepEqual(r.power, { total: null, l1: null, l2: null, l3: null });
  assert.equal(r.sessionKwh, null);
  assert.equal(r.totalKwh, null);
  assert.equal(r.temperature, null);
  assert.equal(r.force, null);
});
