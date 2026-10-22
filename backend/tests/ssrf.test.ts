import { describe, expect, it } from 'vitest';
import { isPrivateOrReservedIPv4, isPrivateOrReservedIPv6, validateTargetUrl } from '../src/utils/ssrf';

describe('SSRF & Target URL Security Validator', () => {
  describe('validateTargetUrl', () => {
    it('accepts valid public HTTP and HTTPS URLs', () => {
      const httpsResult = validateTargetUrl('https://api.github.com/users');
      expect(httpsResult.isValid).toBe(true);
      expect(httpsResult.normalizedUrl).toBe('https://api.github.com/users');

      const httpResult = validateTargetUrl('http://example.com/health');
      expect(httpResult.isValid).toBe(true);
      expect(httpResult.normalizedUrl).toBe('http://example.com/health');
    });

    it('rejects unsupported schemes (ftp, file, javascript)', () => {
      expect(validateTargetUrl('ftp://ftp.example.com/file').isValid).toBe(false);
      expect(validateTargetUrl('file:///etc/passwd').isValid).toBe(false);
      expect(validateTargetUrl('javascript:alert(1)').isValid).toBe(false);
    });

    it('rejects embedded credentials in target URL', () => {
      const res = validateTargetUrl('https://admin:secret123@api.example.com/data');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('embedded username or password');
    });

    it('rejects cloud metadata IP 169.254.169.254 and metadata hostnames', () => {
      const ipResult = validateTargetUrl('http://169.254.169.254/latest/meta-data');
      expect(ipResult.isValid).toBe(false);

      const hostResult = validateTargetUrl('http://metadata.google.internal/computeMetadata/v1');
      expect(hostResult.isValid).toBe(false);
    });

    it('rejects private IPv4 address literals', () => {
      // 10.0.0.0/8
      expect(validateTargetUrl('http://10.0.0.1/status').isValid).toBe(false);
      // 172.16.0.0/12
      expect(validateTargetUrl('http://172.20.5.1/status').isValid).toBe(false);
      // 192.168.0.0/16
      expect(validateTargetUrl('http://192.168.1.100/status').isValid).toBe(false);
      // Loopback 127.0.0.2
      expect(validateTargetUrl('http://127.0.0.2:9000/api').isValid).toBe(false);
    });

    it('rejects private IPv6 address literals', () => {
      // Loopback ::1
      expect(validateTargetUrl('http://[::1]:8080/').isValid).toBe(false);
      // Unique local fc00::/7
      expect(validateTargetUrl('http://[fd12:3456:789a:1::1]/').isValid).toBe(false);
    });

    it('allows mock API target configured in development/test', () => {
      // Mock API is configured at http://localhost:8080
      const mockResult = validateTargetUrl('http://localhost:8080/health');
      expect(mockResult.isValid).toBe(true);
    });

    it('rejects empty or malformed strings', () => {
      expect(validateTargetUrl('').isValid).toBe(false);
      expect(validateTargetUrl('not a url').isValid).toBe(false);
    });
  });

  describe('isPrivateOrReservedIPv4', () => {
    it('accurately detects private ranges', () => {
      expect(isPrivateOrReservedIPv4('10.255.0.1')).toBe(true);
      expect(isPrivateOrReservedIPv4('172.16.0.1')).toBe(true);
      expect(isPrivateOrReservedIPv4('172.31.255.255')).toBe(true);
      expect(isPrivateOrReservedIPv4('192.168.0.1')).toBe(true);
      expect(isPrivateOrReservedIPv4('127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIPv4('169.254.1.1')).toBe(true);
      expect(isPrivateOrReservedIPv4('224.0.0.1')).toBe(true); // Multicast
      expect(isPrivateOrReservedIPv4('240.0.0.1')).toBe(true); // Reserved

      // Public IPs
      expect(isPrivateOrReservedIPv4('8.8.8.8')).toBe(false);
      expect(isPrivateOrReservedIPv4('1.1.1.1')).toBe(false);
      expect(isPrivateOrReservedIPv4('172.32.0.1')).toBe(false);
    });
  });

  describe('isPrivateOrReservedIPv6', () => {
    it('accurately detects private IPv6 ranges', () => {
      expect(isPrivateOrReservedIPv6('::1')).toBe(true);
      expect(isPrivateOrReservedIPv6('fe80::1')).toBe(true);
      expect(isPrivateOrReservedIPv6('fc00::1')).toBe(true);
      expect(isPrivateOrReservedIPv6('::ffff:127.0.0.1')).toBe(true);

      // Public IPv6
      expect(isPrivateOrReservedIPv6('2607:f8b0:4005:805::200e')).toBe(false);
    });
  });
});
