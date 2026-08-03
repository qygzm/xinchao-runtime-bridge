import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRuntimeEnvelope,
  parseStreamEvent,
  RUNTIME_PROTOCOL,
  STREAM_PROTOCOL,
} from '../src/protocol.js';

test('parses delivery notifications and runtime envelopes', () => {
  const notice = parseStreamEvent({
    event: 'delivery',
    data: JSON.stringify({ protocol: STREAM_PROTOCOL, deliveryId: 'delivery-001' }),
  });
  assert.deepEqual(notice, { kind: 'delivery', deliveryId: 'delivery-001' });

  const envelope = parseRuntimeEnvelope({
    protocol: RUNTIME_PROTOCOL,
    deliveryId: 'delivery-001',
    reason: 'scheduled_interaction',
    message: '她留下一次拥抱。',
  }, 'delivery-001');
  assert.equal(envelope.message, '她留下一次拥抱。');
});

test('rejects mismatched delivery IDs and oversized messages', () => {
  assert.throws(() => parseRuntimeEnvelope({
    protocol: RUNTIME_PROTOCOL,
    deliveryId: 'delivery-001',
    reason: 'scheduled_interaction',
    message: 'hello',
  }, 'delivery-002'), /mismatch/);

  assert.throws(() => parseRuntimeEnvelope({
    protocol: RUNTIME_PROTOCOL,
    deliveryId: 'delivery-001',
    reason: 'scheduled_interaction',
    message: 'a'.repeat(4097),
  }), /message/);
});
