// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';

const require = createRequire(import.meta.url);
const modulePath = require.resolve('../functions/src/cryptoHelper.js');
const loadCrypto = () => {
  delete require.cache[modulePath];
  return require(modulePath);
};

beforeEach(() => {
  for (const name of ['KMS_KEY_NAME', 'IMAP_ENCRYPTION_KEY', 'ENCRYPTION_SECRET', 'SESSION_SECRET']) {
    vi.stubEnv(name, '');
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  delete require.cache[modulePath];
});

describe('Cifrado de credenciales', () => {
  it('rechaza guardar secretos sin configurar cifrado', async () => {
    await expect(loadCrypto().encryptSecret('dato de prueba')).rejects.toThrow('IMAP_ENCRYPTION_KEY');
  });

  it('rechaza una clave local demasiado corta', async () => {
    vi.stubEnv('IMAP_ENCRYPTION_KEY', 'corta');
    await expect(loadCrypto().encryptSecret('dato de prueba')).rejects.toThrow('32 bytes');
  });

  it('cifra con un IV diferente y recupera el contenido original', async () => {
    vi.stubEnv('IMAP_ENCRYPTION_KEY', randomBytes(32).toString('hex'));
    const { encryptSecret, decryptSecret } = loadCrypto();
    const a = await encryptSecret('dato de prueba');
    const b = await encryptSecret('dato de prueba');
    expect(a).not.toEqual(b);
    expect(a).not.toContain('dato de prueba');
    expect(await decryptSecret(a)).toBe('dato de prueba');
  });

  it('rechaza un texto cifrado manipulado', async () => {
    vi.stubEnv('IMAP_ENCRYPTION_KEY', randomBytes(32).toString('hex'));
    const { encryptSecret, decryptSecret } = loadCrypto();
    const encrypted = await encryptSecret('dato de prueba');
    const changed = encrypted.slice(0, -1) + (encrypted.endsWith('0') ? '1' : '0');
    await expect(decryptSecret(changed)).rejects.toThrow();
  });

  it('rechaza descifrar con otra clave', async () => {
    vi.stubEnv('IMAP_ENCRYPTION_KEY', randomBytes(32).toString('hex'));
    const { encryptSecret, decryptSecret } = loadCrypto();
    const encrypted = await encryptSecret('dato de prueba');
    vi.stubEnv('IMAP_ENCRYPTION_KEY', randomBytes(32).toString('hex'));
    await expect(decryptSecret(encrypted)).rejects.toThrow();
  });

  it('no devuelve texto plano como alternativa al cifrado', async () => {
    await expect(loadCrypto().decryptSecret('dato sin cifrar')).rejects.toThrow();
  });

  it('no cambia a otra clave si KMS falla', async () => {
    const functionsRequire = createRequire(new URL('../functions/package.json', import.meta.url));
    const { KeyManagementServiceClient } = functionsRequire('@google-cloud/kms');
    vi.spyOn(KeyManagementServiceClient.prototype, 'encrypt').mockRejectedValue(new Error('KMS no disponible'));
    vi.stubEnv('KMS_KEY_NAME', 'projects/demo/locations/global/keyRings/test/cryptoKeys/test');
    vi.stubEnv('IMAP_ENCRYPTION_KEY', randomBytes(32).toString('hex'));
    await expect(loadCrypto().encryptSecret('dato de prueba')).rejects.toThrow('KMS no disponible');
  });
});
