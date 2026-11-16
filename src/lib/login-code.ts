/** Auth-issued codes must be submitted whole, never truncated to six digits. */
export const LOGIN_CODE_MAX_LENGTH = 8;

export function isValidLoginCode(code: string): boolean {
  return /^(?:\d{6}|\d{8})$/.test(code);
}