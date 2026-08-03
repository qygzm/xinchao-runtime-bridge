import { spawn } from 'node:child_process';

const MAX_STDERR = 8_192;

export class InjectorError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InjectorError';
  }
}

export async function deliverToInjector(
  envelope,
  config,
  { signal, logger, spawnImpl = spawn } = {},
) {
  signal?.throwIfAborted();
  const timeoutSignal = AbortSignal.timeout(config.timeouts.injectMs);
  const childSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const childEnv = { ...process.env };
  delete childEnv.XINCHAO_BRIDGE_MACHINE_TOKEN;

  logger?.info('injector delivery started', {
    deliveryId: envelope.deliveryId,
    reason: envelope.reason,
  });

  await new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnImpl(config.injector.executable, [...config.injector.args], {
        ...(config.injector.workingDirectory ? { cwd: config.injector.workingDirectory } : {}),
        env: childEnv,
        shell: false,
        signal: childSignal,
        stdio: ['pipe', 'ignore', 'pipe'],
      });
    } catch (error) {
      reject(error);
      return;
    }

    let stderr = '';
    let settled = false;
    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-MAX_STDERR);
    });
    child.stdin.on('error', () => undefined);
    child.once('error', (error) => finish(error));
    child.once('exit', (code, exitSignal) => {
      if (code === 0) {
        finish();
        return;
      }
      const detail = stderr.trim();
      finish(new InjectorError(
        `injector exited with code ${String(code)}, signal ${String(exitSignal)}` +
        (detail ? `: ${detail}` : ''),
      ));
    });

    try {
      child.stdin.end(`${JSON.stringify(envelope)}\n`, 'utf8');
    } catch (error) {
      child.kill();
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  });

  logger?.info('injector delivery accepted', {
    deliveryId: envelope.deliveryId,
    reason: envelope.reason,
  });
}
