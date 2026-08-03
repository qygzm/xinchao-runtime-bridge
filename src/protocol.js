export const STREAM_PROTOCOL = 'xinchao-bridge-stream/1';
export const RUNTIME_PROTOCOL = 'xinchao-runtime-wake/1';
export const MAX_REASON_LENGTH = 128;
export const MAX_MESSAGE_LENGTH = 4_096;
export const USER_INTERACTION_REASONS = Object.freeze([
  'user_interaction',
  'user_note',
  'scheduled_interaction',
]);

const DELIVERY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,159}$/;

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseStreamEvent(event) {
  if (!record(event) || typeof event.event !== 'string' || typeof event.data !== 'string') {
    throw new Error('invalid SSE event');
  }
  if (event.event !== 'connected' && event.event !== 'delivery') {
    return Object.freeze({ kind: 'ignored', event: event.event });
  }
  let payload;
  try {
    payload = JSON.parse(event.data);
  } catch {
    throw new Error(`invalid JSON for ${event.event}`);
  }
  if (!record(payload) || payload.protocol !== STREAM_PROTOCOL) {
    throw new Error('unsupported stream protocol');
  }
  if (event.event === 'connected') return Object.freeze({ kind: 'connected' });
  if (typeof payload.deliveryId !== 'string' || !DELIVERY_ID.test(payload.deliveryId)) {
    throw new Error('invalid deliveryId');
  }
  return Object.freeze({ kind: 'delivery', deliveryId: payload.deliveryId });
}

export function parseRuntimeEnvelope(value, expectedDeliveryId = null) {
  if (!record(value) || value.protocol !== RUNTIME_PROTOCOL) {
    throw new Error('unsupported runtime envelope protocol');
  }
  if (typeof value.deliveryId !== 'string' || !DELIVERY_ID.test(value.deliveryId)) {
    throw new Error('invalid runtime deliveryId');
  }
  if (expectedDeliveryId && value.deliveryId !== expectedDeliveryId) {
    throw new Error('runtime envelope deliveryId mismatch');
  }
  if (
    typeof value.reason !== 'string' ||
    !value.reason.trim() ||
    value.reason !== value.reason.trim() ||
    value.reason.length > MAX_REASON_LENGTH
  ) {
    throw new Error('invalid runtime reason');
  }
  if (!USER_INTERACTION_REASONS.includes(value.reason)) {
    throw new Error('runtime bridge accepts user-originated interactions only');
  }
  if (
    typeof value.message !== 'string' ||
    !value.message.trim() ||
    value.message.length > MAX_MESSAGE_LENGTH
  ) {
    throw new Error('invalid runtime message');
  }
  return Object.freeze({
    protocol: RUNTIME_PROTOCOL,
    deliveryId: value.deliveryId,
    reason: value.reason,
    message: value.message,
  });
}
