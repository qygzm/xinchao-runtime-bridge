import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverToInjector } from '../src/injector.js';

test('delivers one JSON line without shell or bridge token', async () => {
  let invocation;
  let input = '';
  const spawnImpl = (executable, args, options) => {
    invocation = { executable, args, options };
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => true;
    child.stdin.setEncoding('utf8');
    child.stdin.on('data', (chunk) => { input += chunk; });
    child.stdin.on('finish', () => queueMicrotask(() => child.emit('exit', 0, null)));
    return child;
  };
  const previous = process.env.XINCHAO_BRIDGE_MACHINE_TOKEN;
  process.env.XINCHAO_BRIDGE_MACHINE_TOKEN = 'must-not-leak';
  try {
    await deliverToInjector({
      protocol: 'xinchao-runtime-wake/1',
      deliveryId: 'delivery-001',
      reason: 'scheduled_interaction',
      message: 'hello',
    }, {
      injector: { executable: 'node', args: ['adapter.mjs'], workingDirectory: null },
      timeouts: { injectMs: 1000 },
    }, { spawnImpl });
  } finally {
    if (previous === undefined) delete process.env.XINCHAO_BRIDGE_MACHINE_TOKEN;
    else process.env.XINCHAO_BRIDGE_MACHINE_TOKEN = previous;
  }

  assert.equal(invocation.options.shell, false);
  assert.equal(invocation.options.env.XINCHAO_BRIDGE_MACHINE_TOKEN, undefined);
  assert.equal(JSON.parse(input).deliveryId, 'delivery-001');
  assert.ok(input.endsWith('\n'));
});
