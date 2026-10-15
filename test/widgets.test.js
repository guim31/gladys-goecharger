// The "charger" widget: content within the core budget, bound to features
// that exist, the current mode marked by its icon, and its buttons.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { boundFeatureIds, WIDGET_ACTION } from '../src/widgets.js';
import { FEATURE } from '../src/devices.js';
import { createWorld, lastState } from './helpers/world.js';

const LANGS = ['en', 'fr', 'de', 'es'];

async function content(world, device, language = 'fr') {
  const ack = await world.fake.widgetGet('charger', {
    settings: { charger: device.external_id },
    language,
    units: 'metric',
  });
  assert.equal(ack.success, true, ack.error);
  return ack.data.content;
}

test('the content fits the core budget, in every language and every state', async (t) => {
  const world = await createWorld({ fixtures: ['idle', 'charging', 'completeNoPsm', 'error'] });
  t.after(() => world.stop());
  for (const device of world.fake.discoveredDevices) {
    for (const language of LANGS) {
      const widget = await content(world, device, language);
      assert.deepEqual(validateWidgetContent(widget), [], `${device.name} (${language})`);
      assert.ok(widget.components.length <= 8);
      // Every tile is bound to a feature the device really has.
      const featureIds = new Set(device.features.map((f) => f.external_id));
      for (const id of boundFeatureIds(widget)) {
        assert.ok(featureIds.has(id), `${id} is not a feature of ${device.name}`);
      }
    }
  }
});

test('the status says the go-e state, the mode, the phases and an error', async (t) => {
  const world = await createWorld({ fixtures: ['charging', 'error'] });
  t.after(() => world.stop());
  const [garage, carport] = world.fake.discoveredDevices;

  const charging = await content(world, garage, 'fr');
  const status = charging.components.find((c) => c.type === 'status');
  assert.deepEqual(
    status.items.map((i) => [i.label, i.value, i.color]),
    [
      ['État', 'En charge', 'success'],
      ['Mode', 'Automatique (appli)', 'neutral'],
      ['Phases', 'Automatique', 'neutral'],
    ],
  );
  const buttons = charging.components.filter((c) => c.type === 'button');
  assert.deepEqual(
    buttons.map((b) => [b.action.key, b.icon]),
    [
      [WIDGET_ACTION.FORCE_ON, 'zap'],
      [WIDGET_ACTION.FORCE_OFF, 'pause-circle'],
      [WIDGET_ACTION.NEUTRAL, 'check-circle'],
      [WIDGET_ACTION.SET_CURRENT, 'sliders'],
    ],
  );
  assert.ok(
    buttons.every((b) => b.style !== 'primary'),
    'primary is invisible in dark mode',
  );
  const form = buttons[3].action.fields[0];
  assert.deepEqual([form.min, form.max, form.default], [6, 32, 16]);

  const error = await content(world, carport, 'en');
  const items = error.components.find((c) => c.type === 'status').items;
  assert.deepEqual(items.at(-1), { label: 'Error', value: 'Overheating', color: 'danger' });
  assert.equal(
    error.components.find((c) => c.action?.key === WIDGET_ACTION.FORCE_OFF).icon,
    'check-circle',
  );
});

test('the buttons drive the charger and answer a toast', async (t) => {
  const world = await createWorld({ fixtures: ['charging'] });
  t.after(() => world.stop());
  const device = world.fake.discoveredDevices[0];
  const settings = { charger: device.external_id };

  const on = await world.fake.widgetAction('charger', WIDGET_ACTION.FORCE_ON, {}, { settings });
  assert.equal(on.success, true);
  assert.equal(world.chargers[0].status.frc, 2);
  assert.equal(lastState(world, '012346', FEATURE.FORCE_MODE), 'on');

  const current = await world.fake.widgetAction(
    'charger',
    WIDGET_ACTION.SET_CURRENT,
    {},
    { settings, values: { amps: 24 } },
  );
  assert.equal(current.success, true);
  assert.equal(world.chargers[0].status.amp, 24);

  const outOfRange = await world.fake.widgetAction(
    'charger',
    WIDGET_ACTION.SET_CURRENT,
    {},
    { settings, values: { amps: 40 } },
  );
  assert.equal(outOfRange.success, true, 'a toast, not a failed action');
  assert.match(JSON.stringify(outOfRange.data), /between 6 and 32 A/);

  const oldCore = await world.fake.widgetAction(
    'charger',
    WIDGET_ACTION.SET_CURRENT,
    {},
    {
      settings,
    },
  );
  assert.equal(oldCore.success, false, 'a core without action forms sends no values');
});

test('no charger picked, a charger gone, a charger offline', async (t) => {
  const world = await createWorld({ fixtures: ['charging'] });
  t.after(() => world.stop());
  const pick = await world.fake.widgetGet('charger', { settings: {}, language: 'de' });
  assert.match(JSON.stringify(pick.data.content), /Wähle eine Ladestation/);

  const gone = await world.fake.widgetGet('charger', {
    settings: { charger: 'ext:test-integration:charger:999999' },
    language: 'es',
  });
  assert.match(JSON.stringify(gone.data.content), /ya no está configurado/);

  await world.chargers[0].powerOff();
  await world.hub.cycle({ force: true });
  const offline = await content(world, world.fake.discoveredDevices[0], 'fr');
  assert.deepEqual(validateWidgetContent(offline), []);
  assert.match(JSON.stringify(offline), /Hors ligne/);
  assert.equal(offline.components.filter((c) => c.type === 'button').length, 0);
});
