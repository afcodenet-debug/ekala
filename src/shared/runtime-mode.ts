export type RuntimeMode = 'local' | 'cloud';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

function normalizeInput(value?: string | null): string {
  if (!value) return '';
  return String(value).trim().toLowerCase();
}

export function isLocalRuntimeOrigin(value?: string | null): boolean {
  const input = normalizeInput(value);
  if (!input) return false;

  if (input.startsWith('http://') || input.startsWith('https://')) {
    try {
      const url = new URL(input);
      const host = url.hostname.toLowerCase();
      if (LOCAL_HOSTS.has(host) || host.endsWith('.localhost') || host.endsWith('.local')) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  const host = input.replace(/^(https?:\/\/)/, '').split('/')[0].split(':')[0].replace(/^\[|\]$/g, '');
  return LOCAL_HOSTS.has(host) || host.endsWith('.localhost') || host.endsWith('.local');
}

export function resolveRuntimeMode(value?: string | null): RuntimeMode {
  return isLocalRuntimeOrigin(value) ? 'local' : 'cloud';
}
