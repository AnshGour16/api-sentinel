import { env } from '../config/env';

/**
 * Validates target URLs to prevent Server-Side Request Forgery (SSRF),
 * credential exposure, and access to internal or reserved IP addresses.
 */

// Cloud metadata and special reserved addresses
const PROHIBITED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '169.254.169.254', // AWS/GCP/Azure instance metadata
  'metadata.google.internal',
  'metadata',
]);

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl?: string;
  error?: string;
}

/**
 * Checks if an IPv4 address belongs to a private, loopback, or reserved range.
 */
export function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(isNaN) || parts.some((p) => p < 0 || p > 255)) {
    return false;
  }

  const [b0, b1] = parts;

  // 0.0.0.0/8 (Current network)
  if (b0 === 0) return true;

  // 10.0.0.0/8 (Private)
  if (b0 === 10) return true;

  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;

  // 169.254.0.0/16 (Link-local / Cloud metadata)
  if (b0 === 169 && b1 === 254) return true;

  // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.168.0.0/16 (Private)
  if (b0 === 192 && b1 === 168) return true;

  // 224.0.0.0/4 (Multicast)
  if (b0 >= 224 && b0 <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future use)
  if (b0 >= 240) return true;

  return false;
}

/**
 * Checks if an IPv6 address is loopback, unique-local, or link-local.
 */
export function isPrivateOrReservedIPv6(ip: string): boolean {
  const cleanIp = ip.toLowerCase().trim().replace(/^\[|\]$/g, '');

  if (cleanIp === '::1' || cleanIp === '::') return true;
  if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd')) return true; // Unique local (fc00::/7)
  if (cleanIp.startsWith('fe80:')) return true; // Link-local (fe80::/10)

  // IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (cleanIp.startsWith('::ffff:')) {
    const v4Part = cleanIp.slice(7);
    if (v4Part.includes('.')) {
      return isPrivateOrReservedIPv4(v4Part);
    }
  }

  return false;
}

/**
 * Validates target URLs according to SSRF prevention rules in Section 8 of backend.md:
 * 1. Allow only HTTP and HTTPS schemes.
 * 2. Reject embedded credentials in URLs (user:pass@host).
 * 3. Reject loopback, private, link-local, multicast, and reserved IP destinations.
 * 4. Reject cloud metadata endpoints (169.254.169.254, metadata.google.internal).
 * 5. Allow explicit mock API target in development/test environments.
 */
export function validateTargetUrl(rawUrl: string): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, error: 'Target URL must be a non-empty string' };
  }

  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, error: 'Target URL is malformed or invalid' };
  }

  // 1. Only allow HTTP and HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      error: `Unsupported protocol "${parsed.protocol}". Only "http:" and "https:" are allowed`,
    };
  }

  // 2. Reject embedded credentials
  if (parsed.username || parsed.password) {
    return {
      isValid: false,
      error: 'Target URL must not contain embedded username or password credentials',
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 5. Allow mock API target in development or test environments
  if (env.NODE_ENV !== 'production' && env.MOCK_API_URL) {
    try {
      const mockParsed = new URL(env.MOCK_API_URL);
      if (
        (parsed.hostname === mockParsed.hostname || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
        parsed.port === mockParsed.port
      ) {
        return { isValid: true, normalizedUrl: parsed.toString() };
      }
    } catch {
      // Mock API URL parsing fallback
    }
  }

  // 3. Reject known prohibited hostnames and metadata endpoints
  if (PROHIBITED_HOSTS.has(hostname)) {
    return {
      isValid: false,
      error: `Target host "${hostname}" is prohibited for security reasons`,
    };
  }

  // Reject localhost subdomains or variations (e.g., localhost.localdomain)
  if (hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    return {
      isValid: false,
      error: `Target host "${hostname}" is prohibited`,
    };
  }

  // 4. Check if hostname is an IPv4 literal
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(hostname)) {
    if (isPrivateOrReservedIPv4(hostname)) {
      return {
        isValid: false,
        error: `Target IP "${hostname}" is in a private, loopback, or reserved range`,
      };
    }
  }

  // Check if hostname is IPv6 literal
  if (hostname.includes(':') || hostname.startsWith('[')) {
    if (isPrivateOrReservedIPv6(hostname)) {
      return {
        isValid: false,
        error: `Target IP "${hostname}" is in a private, loopback, or reserved range`,
      };
    }
  }

  return {
    isValid: true,
    normalizedUrl: parsed.toString(),
  };
}
