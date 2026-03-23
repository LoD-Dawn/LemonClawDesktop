import crypto from 'crypto';
import { MANAGED_PROVIDER_API_KEY_SECRET_ENV_KEY } from '../../shared/appConstants';

export const decryptManagedProviderApiKey = (
  encryptedValue: string,
  secret: string = MANAGED_PROVIDER_API_KEY_SECRET_ENV_KEY
): string => {
  if (!encryptedValue) {
    return encryptedValue;
  }

  const parts = encryptedValue.split(':');
  if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
    throw new Error('Invalid encrypted API key format');
  }

  const iv = Buffer.from(parts[2], 'base64');
  const authTag = Buffer.from(parts[3], 'base64');
  const ciphertext = Buffer.from(parts[4], 'base64');

  const key = crypto.createHash('sha256').update(secret, 'utf8').digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
};

export const decryptManagedProviderApiKeyIfNeeded = (
  value: string | undefined,
  options?: {
    providerKey?: string;
    secret?: string;
  }
): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return '';
  }

  if (!normalized.startsWith('enc:')) {
    return value ?? '';
  }

  try {
    return decryptManagedProviderApiKey(normalized, options?.secret);
  } catch (error) {
    console.warn(
      '[ModelConfig] Failed to decrypt managed provider api key:',
      JSON.stringify({
        providerKey: options?.providerKey ?? null,
        reason: error instanceof Error ? error.message : String(error),
      })
    );
    return '';
  }
};
