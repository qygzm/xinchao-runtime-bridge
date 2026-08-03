import { isAbsolute } from 'node:path';

const LEVELS = new Set(['debug', 'info', 'warn', 'error']);

function required(env, key) {
  const value = String(env[key] ?? '').trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function positiveInteger(env, key, fallback, { min = 100, max = 300_000 } = {}) {
  const raw = String(env[key] ?? fallback).trim();
  if (!/^\d+$/.test(raw)) throw new Error(`${key} must be an integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${key} must be between ${min} and ${max}`);
  }
  return value;
}

function parseArgs(raw) {
  if (!raw) return [];
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('XINCHAO_BRIDGE_INJECTOR_ARGS_JSON must be valid JSON');
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error('XINCHAO_BRIDGE_INJECTOR_ARGS_JSON must be a string array');
  }
  return Object.freeze([...value]);
}

function parseBaseUrl(raw) {
  let value;
  try {
    value = new URL(raw);
  } catch {
    throw new Error('XINCHAO_BRIDGE_BASE_URL must be a valid URL');
  }
  if (value.username || value.password || value.search || value.hash) {
    throw new Error('XINCHAO_BRIDGE_BASE_URL must not contain credentials, query, or fragment');
  }
  const local = value.hostname === '127.0.0.1' || value.hostname === 'localhost' || value.hostname === '::1';
  if (value.protocol !== 'https:' && !(local && value.protocol === 'http:')) {
    throw new Error('non-local XINCHAO_BRIDGE_BASE_URL must use HTTPS');
  }
  value.pathname = value.pathname.replace(/\/+$/, '');
  return value;
}

export function loadConfig(env = process.env, { requireInjector = true } = {}) {
  const baseUrl = parseBaseUrl(required(env, 'XINCHAO_BRIDGE_BASE_URL'));
  const machineToken = required(env, 'XINCHAO_BRIDGE_MACHINE_TOKEN');
  if (machineToken.length < 24) throw new Error('XINCHAO_BRIDGE_MACHINE_TOKEN is too short');

  const executable = String(env.XINCHAO_BRIDGE_INJECTOR_EXECUTABLE ?? '').trim();
  if (requireInjector && !executable) {
    throw new Error('XINCHAO_BRIDGE_INJECTOR_EXECUTABLE is required for run');
  }
  const workingDirectory = String(env.XINCHAO_BRIDGE_INJECTOR_WORKING_DIRECTORY ?? '').trim() || null;
  if (workingDirectory && !isAbsolute(workingDirectory)) {
    throw new Error('XINCHAO_BRIDGE_INJECTOR_WORKING_DIRECTORY must be absolute');
  }
  const logLevel = String(env.XINCHAO_BRIDGE_LOG_LEVEL ?? 'info').trim().toLowerCase();
  if (!LEVELS.has(logLevel)) throw new Error('XINCHAO_BRIDGE_LOG_LEVEL is invalid');

  return Object.freeze({
    baseUrl,
    machineToken,
    injector: Object.freeze({
      executable: executable || null,
      args: parseArgs(String(env.XINCHAO_BRIDGE_INJECTOR_ARGS_JSON ?? '')),
      workingDirectory,
    }),
    logLevel,
    timeouts: Object.freeze({
      connectMs: positiveInteger(env, 'XINCHAO_BRIDGE_CONNECT_TIMEOUT_MS', 15_000),
      injectMs: positiveInteger(env, 'XINCHAO_BRIDGE_INJECT_TIMEOUT_MS', 30_000),
    }),
  });
}

export function endpoint(config, path) {
  return new URL(`${config.baseUrl.pathname}${path}`.replace(/\/+/g, '/'), config.baseUrl);
}
