import { randomBytes } from "crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function generateShareToken(length = 14): string {
  const bytes = randomBytes(length);
  let token = "";
  for (let i = 0; i < length; i++) {
    token += BASE62[bytes[i] % 62];
  }
  return token;
}
