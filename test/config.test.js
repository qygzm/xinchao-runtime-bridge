import test from 'node:test';
import assert from 'node:assert/strict';
import { endpoint, loadConfig } from '../src/config.js';

const BASE = {
  XINCHAO_BRIDGE_BASE_URL: 'https://xinchao.example/platform',
  XINCHAO_BRIDGE_MACHINE_TOKEN: 'machine-token-with-enough-entropy',
  XINCHAO_BRIDGE_INJECTOR_EXECUTABLE: 'node',
  XINCHAO_BRIDGE_INJECTOR_ARGS_JSON: '["adapter.mjs"]',
};

test('loads a safe bridge configuration', () => {
  const config = loadConfig(BASE);
  assert.equal(config.baseUrl.href, 'https://xinchao.example/platform');
  assert.deepEqual(config.injector.args, ['adapter.mjs']);
  assert.equal(endpoint(config, '/bridge/v1/health').href, 'https://xinchao.example/platform/bridge/v1/health');
});

test('check mode does not require an injector', () => {
  const config = loadConfig({
    XINCHAO_BRIDGE_BASE_URL: 'http://127.0.0.1:3000',
    XINCHAO_BRIDGE_MACHINE_TOKEN: 'machine-token-with-enough-entropy',
  }, { requireInjector: false });
  assert.equal(config.injector.executable, null);
});

test('rejects insecure remote URLs and short tokens', () => {
  assert.throws(() => loadConfig({ ...BASE, XINCHAO_BRIDGE_BASE_URL: 'http://example.com' }), /HTTPS/);
  assert.throws(() => loadConfig({ ...BASE, XINCHAO_BRIDGE_MACHINE_TOKEN: 'short' }), /too short/);
});
