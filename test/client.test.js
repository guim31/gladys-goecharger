// The go-e client against the fake charger (a real HTTP server) and the fake
// go-e cloud.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ERROR_KINDS,
  STATUS_KEYS,
  cloudTarget,
  createClient,
  localTarget,
} from '../src/goe/client.js';
import { FIXTURES, createFakeCloud, loadFixture, startFakeCharger } from './helpers/fakeCharger.js';

const client = createClient({ timeoutMs: 1000 });

test('readStatus asks only for the keys it uses', async (t) => {
  const charger = await startFakeCharger(loadFixture(FIXTURES.charging));
  t.after(() => charger.close());
  const status = await client.readStatus(localTarget(charger.host));
  assert.equal(status.sse, '012346');
  assert.equal(charger.requests.length, 1);
  assert.equal(charger.requests[0], `/api/status?filter=${STATUS_KEYS.join('%2C')}`);
});

test('set sends JSON values and resolves when every key is accepted', async (t) => {
  const charger = await startFakeCharger(loadFixture(FIXTURES.charging));
  t.after(() => charger.close());
  await client.set(localTarget(charger.host), { amp: 20, frc: 2 });
  assert.equal(charger.status.amp, 20);
  assert.equal(charger.status.frc, 2);
  assert.equal(charger.requests.at(-1), '/api/set?amp=20&frc=2');
});

test('set rejects with the charger reason', async (t) => {
  const charger = await startFakeCharger(loadFixture(FIXTURES.completeNoPsm));
  t.after(() => charger.close());
  await assert.rejects(client.set(localTarget(charger.host), { psm: 1 }), (err) => {
    assert.equal(err.kind, ERROR_KINDS.REJECTED);
    assert.match(err.message, /psm: unknown key/);
    return true;
  });
});

test('API v2 switched off in the app: api_disabled', async (t) => {
  const charger = await startFakeCharger(loadFixture(FIXTURES.idle));
  t.after(() => charger.close());
  charger.apiEnabled = false;
  await assert.rejects(client.readStatus(localTarget(charger.host)), {
    kind: ERROR_KINDS.API_DISABLED,
  });
});

test('nothing listening: unreachable', async (t) => {
  const charger = await startFakeCharger(loadFixture(FIXTURES.idle));
  const host = charger.host;
  await charger.powerOff();
  t.after(() => charger.close());
  await assert.rejects(client.readStatus(localTarget(host)), (err) => {
    assert.equal(err.kind, ERROR_KINDS.UNREACHABLE);
    assert.match(err.message, /ECONNREFUSED/);
    return true;
  });
});

test('cloud: bearer token, 403 refused, 404 offline, 202 accepted', async () => {
  const cloud = createFakeCloud({ '012346': loadFixture(FIXTURES.charging) }, 'good-token');
  const cloudClient = createClient({ fetch: cloud.fetch });

  const status = await cloudClient.readStatus(cloudTarget('012346', 'good-token'));
  assert.equal(status.amp, 16);
  assert.match(cloud.calls[0].url, /^https:\/\/012346\.api\.v3\.go-e\.io\/api\/status\?filter=/);
  assert.equal(cloud.calls[0].headers.authorization, 'Bearer good-token');
  assert.ok(!cloud.calls[0].url.includes('good-token'), 'the token never goes in the URL');

  await assert.rejects(cloudClient.readStatus(cloudTarget('012346', 'bad-token')), (err) => {
    assert.equal(err.kind, ERROR_KINDS.CLOUD_DENIED);
    assert.ok(!err.message.includes('bad-token'), 'no token in the error message');
    return true;
  });

  await cloudClient.set(cloudTarget('012346', 'good-token'), { amp: 10 });
  assert.equal(cloud.chargers.get('012346').status.amp, 10);

  cloud.chargers.get('012346').online = false;
  await assert.rejects(cloudClient.readStatus(cloudTarget('012346', 'good-token')), {
    kind: ERROR_KINDS.CLOUD_OFFLINE,
  });
});
