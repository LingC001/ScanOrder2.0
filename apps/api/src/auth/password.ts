import { scryptSync, timingSafeEqual } from 'node:crypto';

export function isPasswordHash(value: string): boolean {
  return /^scrypt\$[a-f\d]{32}\$[a-f\d]{128}$/i.test(value);
}

export function verifyPassword(password: string, encoded: string): boolean {
  const match = /^scrypt\$([a-f\d]{32})\$([a-f\d]{128})$/i.exec(encoded);
  if (!match) return false;
  const expected = Buffer.from(match[2]!, 'hex');
  const actual = scryptSync(password, match[1]!, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
