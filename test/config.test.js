import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  isConfigured,
  normalizeConfig,
  normalizeSerial,
  parseHosts,
  pollIntervalMs,
} from '../src/config.js';

test('parseHosts accepts the usual ways of typing addresses', () => {
  assert.deepEqual(parseHosts('192.0.2.10, 192.0.2.11;go-echarger.local\nhttp://192.0.2.12/'), {
    hosts: ['192.0.2.10', '192.0.2.11', 'go-echarger.local', '192.0.2.12'],
    invalid: [],
  });
  assert.deepEqual(parseHosts('192.0.2.10:8080 192.0.2.10:8080'), {
    hosts: ['192.0.2.10:8080'],
    invalid: [],
  });
  assert.deepEqual(parseHosts(''), { hosts: [], invalid: [] });
});

test('parseHosts refuses paths and never echoes credentials', () => {
  const { hosts, invalid } = parseHosts('192.0.2.10/api, user:secret@192.0.2.11, 192.0.2.12');
  assert.deepEqual(hosts, ['192.0.2.12']);
  assert.deepEqual(invalid, ['192.0.2.10/api', '***']);
});

test('normalizeSerial pads to the 6 digits the cloud expects', () => {
  assert.equal(normalizeSerial('12345'), '012345');
  assert.equal(normalizeSerial(' 012345 '), '012345');
  assert.equal(normalizeSerial('abc'), null);
  assert.equal(normalizeSerial(''), null);
});

test('normalizeConfig fills the defaults and derives the targets', () => {
  const empty = normalizeConfig();
  assert.equal(empty.language, 'fr');
  assert.equal(empty.poll_interval, DEFAULT_CONFIG.poll_interval);
  assert.equal(isConfigured(empty), false);
  assert.equal(pollIntervalMs(empty), 15000);

  const config = normalizeConfig({
    chargers: '192.0.2.10',
    cloud_serial: '4242',
    cloud_token: ' token ',
    poll_interval: '30',
    language: 'xx',
  });
  assert.deepEqual(config.hosts, ['192.0.2.10']);
  assert.deepEqual(config.cloud, { serial: '004242', token: 'token' });
  assert.equal(config.cloudIncomplete, false);
  assert.equal(config.language, 'fr');
  assert.equal(pollIntervalMs(config), 30000);

  const half = normalizeConfig({ cloud_token: 'token' });
  assert.equal(half.cloud, null);
  assert.equal(half.cloudIncomplete, true);
  assert.equal(normalizeConfig({ poll_interval: '300' }).poll_interval, '15');
});
