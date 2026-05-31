import crypto from 'crypto';
import fetch from 'node-fetch';

const NEXTAUTH_SECRET = "supersecretchangeme123";

function decryptShopifySecret(encryptedValue) {
  try {
    const buffer = Buffer.from(encryptedValue, 'base64');
    const iv = buffer.subarray(0, 16);
    const tag = buffer.subarray(16, 32);
    const encryptedText = buffer.subarray(32);
    const key = crypto.scryptSync(NEXTAUTH_SECRET, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

// I need the encrypted access token from convex
// Wait, I can't query the encrypted access_token because the frontend API `merchants:list` doesn't return it!
