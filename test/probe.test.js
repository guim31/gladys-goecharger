// The probe script against the fake charger: read-only, nothing sensitive.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { FIXTURES, loadFixture, startFakeCharger } from './helpers/fakeCharger.js';

const run = promisify(execFile);
const script = fileURLToPath(new URL('../scripts/probe.mjs', import.meta.url));

test('probe reads the status once, never writes, and masks the serial', async (t) => {
  const charger = await startFakeCharger(loadFixture(FIXTURES.charging));
  t.after(() => charger.close());
  const { stdout } = await run(process.execPath, [script, charger.host]);
  const report = JSON.parse(stdout);
  assert.equal(report.serial, '01****');
  assert.ok(!stdout.includes('012346'));
  assert.equal(report.type, 'go-eCharger_V3');
  assert.deepEqual(report.keys_missing, []);
  assert.equal(report.gladys.power.total, 11048);
  assert.equal(charger.requests.length, 1);
  assert.ok(charger.requests.every((path) => path.startsWith('/api/status?')));
});

test('probe says why a charger does not answer', async (t) => {
  const charger = await startFakeCharger(loadFixture(FIXTURES.idle));
  t.after(() => charger.close());
  charger.apiEnabled = false;
  await assert.rejects(run(process.execPath, [script, charger.host]), (err) => {
    assert.equal(err.code, 1);
    assert.equal(JSON.parse(err.stdout).error, 'api_disabled');
    return true;
  });
});
