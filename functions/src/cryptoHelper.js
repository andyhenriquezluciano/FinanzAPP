const crypto = require('crypto');

const KMS_KEY_NAME = process.env.KMS_KEY_NAME || null;
function getLocalKey() {
  const secret = process.env.IMAP_ENCRYPTION_KEY || process.env.ENCRYPTION_SECRET || process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('Configura KMS_KEY_NAME o una IMAP_ENCRYPTION_KEY privada de al menos 32 bytes.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

async function encryptKms(plaintext) {
  if (!plaintext) return null;
  if (!KMS_KEY_NAME) {
    throw new Error('KMS_KEY_NAME no está configurada.');
  }
  const { KeyManagementServiceClient } = require('@google-cloud/kms');
  const kmsClient = new KeyManagementServiceClient();
  const [result] = await kmsClient.encrypt({ name: KMS_KEY_NAME, plaintext: Buffer.from(plaintext) });
  return result.ciphertext.toString('base64');
}

async function decryptKms(ciphertextBase64) {
  if (!ciphertextBase64) return null;
  if (!KMS_KEY_NAME) {
    throw new Error('KMS_KEY_NAME no está configurada.');
  }
  const { KeyManagementServiceClient } = require('@google-cloud/kms');
  const kmsClient = new KeyManagementServiceClient();
  const [result] = await kmsClient.decrypt({ name: KMS_KEY_NAME, ciphertext: Buffer.from(ciphertextBase64, 'base64') });
  return result.plaintext.toString();
}

/**
 * Cifra secretos con KMS si está disponible, o mediante AES-256-GCM localmente.
 * @param {string} plaintext
 * @returns {Promise<string|null>}
 */
async function encryptSecret(plaintext) {
  if (!plaintext) return null;
  if (KMS_KEY_NAME) {
    return encryptKms(plaintext);
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getLocalKey(), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `aes:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Descifra secretos AES-256-GCM o KMS sin aceptar texto plano como alternativa.
 * @param {string} ciphertext
 * @returns {Promise<string|null>}
 */
async function decryptSecret(ciphertext) {
  if (!ciphertext) return null;
  if (typeof ciphertext === 'string' && ciphertext.startsWith('aes:')) {
    const parts = ciphertext.split(':');
    if (parts.length === 4) {
      try {
        const iv = Buffer.from(parts[1], 'hex');
        const authTag = Buffer.from(parts[2], 'hex');
        const encrypted = parts[3];
        const decipher = crypto.createDecipheriv('aes-256-gcm', getLocalKey(), iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch (err) {
        throw new Error('No se pudo descifrar el secreto.', { cause: err });
      }
    }
  }
  if (KMS_KEY_NAME) {
    return decryptKms(ciphertext);
  }
  throw new Error('Formato de secreto no válido o cifrado no configurado.');
}

module.exports = {
  encryptSecret,
  decryptSecret
};

