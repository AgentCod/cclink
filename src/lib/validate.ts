/**
 * Valid account names: non-empty, no '/', not '.' or '..'
 * Dots within names (e.g. 'john.doe') are allowed.
 */
export function isValidAccountName(name: string): boolean {
  if (!name || name.length === 0) return false;
  if (name === '.' || name === '..') return false;
  if (name.includes('/')) return false;
  return true;
}

export function assertValidAccountName(name: string): void {
  if (!isValidAccountName(name)) {
    console.error(
      `Error: Invalid account name "${name}". ` +
      `Account names must not be empty, '.' or '..', or contain slashes.`
    );
    process.exit(1);
  }
}
