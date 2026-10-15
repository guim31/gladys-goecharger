// -----------------------------------------------------------------------------
// End to end: fake go-e chargers (real HTTP servers), the SDK's fake Gladys,
// and the wiring of index.js. What a user sees: devices, states, commands,
// the "charge finished" trigger, a charger that goes offline, the logs.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAR, CHARGING_STATE, CONNECTOR_STATUS } from '../src/goe/model.js';
import { FEATURE } from '../src/devices.js';
import { HEARTBEAT_MS, SCENE_TRIGGER } from '../src/hub.js';
import { createFakeCloud, FIXTURES, loadFixture } from './helpers/fakeCharger.js';
import { captureLogs, createWorld, lastState, waitFor } from './helpers/world.js';

const featureOf = (device, key) => device.features.find((f) => f.external_id.endsWith(`:${key}`));

test('one device per charger, named as in the go-e app, keyed on the serial', async (t) => {
  const world = await createWorld({ fixtures: ['charging', 'completeNoPsm'] });
  t.after(() => world.stop());
  const [garage, unnamed] = world.fake.discoveredDevices;
  assert.equal(garage.name, 'Garage');
  assert.equal(garage.external_id, 'ext:test-integration:charger:012346');
  assert.equal(garage.model, 'go-eCharger_V3');
  assert.deepEqual(
    garage.params.find((p) => p.name === 'HOST'),
    { name: 'HOST', value: world.chargers[0].host },
  );
  assert.equal(unnamed.name, 'go-e Charger 012347');
  assert.equal(featureOf(garage, FEATURE.TARGET_CURRENT).max, 32);
  assert.equal(featureOf(unnamed, FEATURE.TARGET_CURRENT).max, 16);
  assert.ok(featureOf(garage, FEATURE.PHASE_MODE), 'phase switching offered');
  assert.equal(featureOf(unnamed, FEATURE.PHASE_MODE), undefined, 'no psm, no phase feature');
  assert.equal(featureOf(garage, FEATURE.POWER).name, 'Puissance de charge', 'French by default');
  assert.deepEqual(
    featureOf(garage, FEATURE.FORCE_MODE).supported_options.map((o) => o.value),
    ['neutral', 'on', 'off'],
  );
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
});

test('a device added to Gladys gets all its states at once, and the widget a nudge', async (t) => {
  const world = await createWorld({ fixtures: ['charging'], create: false });
  t.after(() => world.stop());
  assert.equal(world.fake.states.length, 0, 'nothing sent for a device Gladys does not have');
  const refreshesBefore = world.fake.widgetRefreshes.length;
  await world.fake.deviceCreated(world.fake.discoveredDevices[0]);

  assert.equal(lastState(world, '012346', FEATURE.CONNECTOR_STATUS), CONNECTOR_STATUS.OCCUPIED);
  assert.equal(lastState(world, '012346', FEATURE.CHARGING_STATE), CHARGING_STATE.CHARGING);
  assert.equal(lastState(world, '012346', FEATURE.PLUGGED), 1);
  assert.equal(lastState(world, '012346', FEATURE.POWER), 11048);
  assert.equal(lastState(world, '012346', FEATURE.CURRENT_L2), 16.1);
  assert.equal(lastState(world, '012346', FEATURE.SESSION_ENERGY), 5.32);
  assert.equal(lastState(world, '012346', FEATURE.TOTAL_ENERGY), 1234.567);
  assert.equal(lastState(world, '012346', FEATURE.TARGET_CURRENT), 16);
  assert.equal(lastState(world, '012346', FEATURE.FORCE_MODE), 'neutral');
  assert.equal(lastState(world, '012346', FEATURE.PHASE_MODE), 'auto');
  assert.equal(lastState(world, '012346', FEATURE.TEMPERATURE), 31.5);
  assert.equal(lastState(world, '012346', FEATURE.ERROR), 'Aucune');
  assert.equal(lastState(world, '012346', FEATURE.ONLINE), 1);
  assert.ok(world.fake.widgetRefreshes.length > refreshesBefore);
});

test('the states refresh on the integration timer, without any onPoll from Gladys', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
  const world = await createWorld({ fixtures: ['charging'], timers: true });
  t.after(() => world.stop());
  const polls = world.fake.wsMessages.filter((m) => m.type === 'poll');
  assert.equal(polls.length, 0);

  world.chargers[0].status.nrg[11] = 7400.4;
  world.chargers[0].status.amp = 10;
  t.mock.timers.tick(15000);
  await waitFor(() => lastState(world, '012346', FEATURE.POWER) === 7400, 'the new power');
  assert.equal(lastState(world, '012346', FEATURE.TARGET_CURRENT), 10);

  // And again one period later.
  world.chargers[0].status.nrg[11] = 0;
  t.mock.timers.tick(15000);
  await waitFor(() => lastState(world, '012346', FEATURE.POWER) === 0, 'the next period');
});

test("the core's onPoll is a fallback: skipped right after the timer, read when stale", async (t) => {
  let clock = 1_000_000;
  const world = await createWorld({ fixtures: ['charging'] });
  t.after(() => world.stop());
  world.hub.now = () => clock;
  await world.hub.cycle({ force: true });
  const device = world.fake.discoveredDevices[0];
  const before = world.chargers[0].requests.length;

  await world.fake.poll(device);
  assert.equal(world.chargers[0].requests.length, before, 'read just now: skipped');

  clock += 14000; // 93 % of the 15 s period
  world.chargers[0].status.amp = 12;
  await world.fake.poll(device);
  assert.equal(world.chargers[0].requests.length, before + 1);
  assert.equal(lastState(world, '012346', FEATURE.TARGET_CURRENT), 12);
});

test('only the changes are sent, and a stable value again after the heartbeat', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-15T08:00:00Z') });
  const world = await createWorld({ fixtures: ['charging'] });
  t.after(() => world.stop());
  const count = () => world.fake.states.length;

  const afterCreate = count();
  await world.hub.cycle({ force: true });
  assert.equal(count(), afterCreate, 'nothing changed, nothing sent');

  world.chargers[0].status.tma = [33, 29];
  await world.hub.cycle({ force: true });
  assert.equal(count(), afterCreate + 1, 'one change, one state');

  assert.ok(HEARTBEAT_MS <= 12 * 60 * 60 * 1000, 'at least every 12 hours');
  t.mock.timers.tick(HEARTBEAT_MS + 1000);
  await world.hub.cycle({ force: true });
  assert.ok(count() > afterCreate + 10, 'every value sent again after the heartbeat');
});

test('commands: current, charging mode, phases — written, then read back', async (t) => {
  const world = await createWorld({ fixtures: ['charging', 'completeNoPsm'] });
  t.after(() => world.stop());
  const [garage, older] = world.fake.discoveredDevices;

  assert.deepEqual(
    await world.fake.setValue(garage, featureOf(garage, FEATURE.TARGET_CURRENT), 20),
    {
      success: true,
    },
  );
  assert.equal(world.chargers[0].status.amp, 20);
  assert.equal(lastState(world, '012346', FEATURE.TARGET_CURRENT), 20);

  await world.fake.setValue(garage, featureOf(garage, FEATURE.FORCE_MODE), 'off');
  assert.equal(world.chargers[0].status.frc, 1);
  assert.equal(lastState(world, '012346', FEATURE.FORCE_MODE), 'off');

  await world.fake.setValue(garage, featureOf(garage, FEATURE.PHASE_MODE), 'one');
  assert.equal(world.chargers[0].status.psm, 1);
  assert.equal(lastState(world, '012346', FEATURE.PHASE_MODE), 'one');

  const tooHigh = await world.fake.setValue(older, featureOf(older, FEATURE.TARGET_CURRENT), 20);
  assert.equal(tooHigh.success, false);
  assert.match(tooHigh.error, /between 6 and 16 A/);
  assert.equal(world.chargers[1].status.amp, 10, 'nothing sent to the charger');

  // The app limit (ama = 16) is lower than the hardware: the charger refuses.
  world.chargers[1].status.ama = 12;
  const refused = await world.fake.setValue(older, featureOf(older, FEATURE.TARGET_CURRENT), 14);
  assert.equal(refused.success, false);
  assert.match(refused.error, /refused/);

  const readOnly = await world.fake.setValue(garage, featureOf(garage, FEATURE.POWER), 1);
  assert.equal(readOnly.success, false);
});

test('"charge finished" fires once, on the transition from charging to complete', async (t) => {
  const world = await createWorld({ fixtures: ['charging', 'completeNoPsm'] });
  t.after(() => world.stop());
  assert.equal(world.fake.sceneEvents.length, 0, 'a charger already complete at startup: no event');

  world.chargers[0].status.car = CAR.COMPLETE;
  world.chargers[0].status.wh = 23456;
  await world.hub.cycle({ force: true });
  await world.hub.cycle({ force: true });
  assert.deepEqual(world.fake.sceneEvents, [
    {
      key: SCENE_TRIGGER.CHARGE_FINISHED,
      data: {
        device: 'ext:test-integration:charger:012346',
        charger: 'Garage',
        energy_kwh: 23.46,
      },
    },
  ]);
  assert.equal(
    lastState(world, '012346', FEATURE.CHARGING_STATE),
    CHARGING_STATE.PAUSED_BY_VEHICLE,
  );

  // Unplugged then plugged again: waiting is not finishing.
  world.chargers[0].status.car = CAR.IDLE;
  await world.hub.cycle({ force: true });
  world.chargers[0].status.car = CAR.WAIT_CAR;
  await world.hub.cycle({ force: true });
  assert.equal(world.fake.sceneEvents.length, 1);
});

test('a charger that stops answering: offline, one warning, one line on its return', async (t) => {
  const world = await createWorld({ fixtures: ['charging'] });
  t.after(() => world.stop());
  const lines = captureLogs(t, 'info');

  await world.chargers[0].powerOff();
  for (let i = 0; i < 3; i += 1) {
    await world.hub.cycle({ force: true });
  }
  assert.equal(lastState(world, '012346', FEATURE.ONLINE), 0);
  assert.equal(lastState(world, '012346', FEATURE.CONNECTOR_STATUS), CONNECTOR_STATUS.UNAVAILABLE);
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.fr, /pas de réponse/);
  assert.equal(lines.filter((l) => l.includes('[WARN]')).length, 1, lines.join('\n'));

  await world.chargers[0].powerOn();
  await world.hub.cycle({ force: true });
  assert.equal(lastState(world, '012346', FEATURE.ONLINE), 1);
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
  assert.equal(lines.filter((l) => l.includes('answers again')).length, 1, lines.join('\n'));
});

test('the local API v2 switched off: the status says where to turn it on', async (t) => {
  const world = await createWorld({ fixtures: ['idle'] });
  t.after(() => world.stop());
  world.chargers[0].apiEnabled = false;
  await world.hub.cycle({ force: true });
  const { message } = world.fake.connectionStatus;
  assert.match(message.en, /local HTTP API v2 is off.*go-e app \(Internet → Advanced settings\)/);
  assert.match(message.fr, /API HTTP v2 locale est désactivée/);
  assert.match(message.de, /lokale HTTP-API v2 ist aus/);
  assert.match(message.es, /API HTTP v2 local está desactivada/);
});

test('a charger off at startup is known from its device, and published when it answers', async (t) => {
  // First run: the charger answered, the user added it.
  const first = await createWorld({ fixtures: ['charging'] });
  const created = first.fake.discoveredDevices[0];
  const charger = first.chargers[0];
  first.hub.stop();
  await first.gladys.disconnect();
  await charger.powerOff();

  // Gladys restarts the container while the charger is off.
  const { createFakeGladys } = await import('@gladysassistant/integration-sdk/testing');
  const { registerHandlers } = await import('../src/app.js');
  const gladys = createFakeGladys({ config: { chargers: charger.host }, devices: [created] });
  const hub = registerHandlers(gladys, { timers: false });
  t.after(async () => {
    hub.stop();
    await gladys.disconnect();
    await charger.close();
  });
  await gladys.connect();
  assert.equal(gladys.fake.discoveredDevices.length, 0);
  assert.equal(gladys.fake.lastState(`${created.external_id}:online`), 0);

  await charger.powerOn();
  await hub.cycle({ force: true });
  assert.equal(gladys.fake.discoveredDevices.length, 1);
  assert.equal(gladys.fake.lastState(`${created.external_id}:online`), 1);
});

test('the go-e cloud as an option, for a charger off the local network', async (t) => {
  const cloud = createFakeCloud({ '012346': loadFixture(FIXTURES.charging) }, 'cloud-secret-1');
  const world = await createWorld({
    fixtures: [],
    config: { cloud_serial: '12346', cloud_token: 'cloud-secret-1' },
    fetch: cloud.fetch,
  });
  t.after(() => world.stop());
  const [device] = world.fake.discoveredDevices;
  assert.equal(device.external_id, 'ext:test-integration:charger:012346');
  assert.equal(
    device.params.find((p) => p.name === 'HOST'),
    undefined,
  );
  assert.equal(lastState(world, '012346', FEATURE.POWER), 11048);

  await world.fake.setValue(device, featureOf(device, FEATURE.FORCE_MODE), 'on');
  assert.equal(cloud.chargers.get('012346').status.frc, 2);
});

test('a normal cycle writes nothing at info, and no secret ever reaches the logs', async (t) => {
  const cloud = createFakeCloud({ '012346': loadFixture(FIXTURES.charging) }, 'cloud-secret-2');
  const world = await createWorld({
    fixtures: ['idle'],
    config: { cloud_serial: '012346', cloud_token: 'cloud-secret-2' },
    fetch: cloud.fetch,
  });
  t.after(() => world.stop());

  const info = captureLogs(t, 'info');
  for (let i = 0; i < 3; i += 1) {
    world.chargers[0].status.nrg[11] = 100 * i;
    await world.hub.cycle({ force: true });
  }
  await world.fake.poll(world.fake.discoveredDevices[0]);
  assert.deepEqual(info, [], 'a normal cycle is silent at info');

  // Everything, debug included, while the cloud refuses a wrong token.
  const all = captureLogs(t, 'debug');
  await world.fake.configUpdated({
    chargers: world.chargers[0].host,
    cloud_serial: '012346',
    cloud_token: 'wrong-secret-3',
  });
  await world.hub.cycle({ force: true });
  await world.fake.action('test_connection', {});
  const text = all.join('\n');
  assert.ok(all.length > 0);
  for (const secret of ['cloud-secret-2', 'wrong-secret-3']) {
    assert.ok(!text.includes(secret), `the token ${secret} leaked into the logs`);
  }
  assert.ok(
    !JSON.stringify(world.fake.connectionStatuses).includes('wrong-secret-3'),
    'nor into the status',
  );
});

test('test_connection reports every charger in the four languages', async (t) => {
  const world = await createWorld({
    fixtures: ['charging', 'idle'],
    config: { cloud_token: 'only-a-token' },
  });
  t.after(() => world.stop());
  world.chargers[1].apiEnabled = false;
  const { success, data } = await world.fake.action('test_connection', {});
  assert.equal(success, true);
  const lines = data.message.fr.split('\n');
  assert.match(lines[0], /^Garage \(n° 012346, micrologiciel 056\.2\) : connectée\.$/);
  assert.match(lines[1], /API HTTP v2 locale est désactivée/);
  assert.match(lines[2], /numéro de série et le jeton/);
  assert.equal(data.message.en.split('\n').length, 3);
});

test('not configured: says what to enter, and starts once the address is given', async (t) => {
  const world = await createWorld({ fixtures: [] });
  t.after(() => world.stop());
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.en, /Enter the IP address/);

  const { startFakeCharger } = await import('./helpers/fakeCharger.js');
  const charger = await startFakeCharger(loadFixture(FIXTURES.idle));
  t.after(() => charger.close());
  await world.fake.configUpdated({ chargers: charger.host, language: 'de' });
  assert.equal(world.fake.discoveredDevices.length, 1);
  assert.equal(featureOf(world.fake.discoveredDevices[0], FEATURE.PLUGGED).name, 'Auto angesteckt');
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
});

test('the scene action sets the charging mode, and fails plainly on a bad charger', async (t) => {
  const world = await createWorld({ fixtures: ['charging'] });
  t.after(() => world.stop());
  const device = world.fake.discoveredDevices[0];
  const ok = await world.fake.sceneAction('set_charge_mode', {
    charger: device.external_id,
    mode: 'on',
  });
  assert.equal(ok.success, true);
  assert.equal(world.chargers[0].status.frc, 2);

  const unknown = await world.fake.sceneAction('set_charge_mode', {
    charger: 'ext:test-integration:charger:999999',
    mode: 'off',
  });
  assert.equal(unknown.success, false);
});
