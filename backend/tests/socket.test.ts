import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import {
  initSocketServer,
  closeSocketServer,
  emitCheckCompleted,
  emitIncidentOpened,
  emitMonitorStatusChanged,
} from '../src/lib/socket';
import { authService } from '../src/modules/auth/auth.service';

describe('Real-Time Events & Socket.IO Authorization', () => {
  let server: http.Server;
  let port: number;

  const testUser = {
    id: 'user-realtime-777',
    email: 'realtime@example.com',
    name: 'Realtime Tester',
    created_at: new Date(),
  };

  const validToken = authService.generateToken(testUser);

  beforeAll(async () => {
    server = http.createServer();
    initSocketServer(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address() as { port: number };
        port = address.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await closeSocketServer();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('rejects connection when authorization token is missing', async () => {
    await new Promise<void>((resolve) => {
      const client: ClientSocket = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        autoConnect: true,
      });

      client.on('connect_error', (err) => {
        expect(err.message).toContain('Missing authorization token');
        client.disconnect();
        resolve();
      });
    });
  });

  it('rejects connection when authorization token is invalid', async () => {
    await new Promise<void>((resolve) => {
      const client: ClientSocket = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: 'invalid.token.here' },
        autoConnect: true,
      });

      client.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication failed');
        client.disconnect();
        resolve();
      });
    });
  });

  it('authenticates client with valid token and receives room-scoped events', async () => {
    const client: ClientSocket = Client(`http://localhost:${port}`, {
      transports: ['websocket'],
      auth: { token: validToken },
      autoConnect: true,
    });

    await new Promise<void>((resolve) => {
      client.on('connect', () => {
        expect(client.connected).toBe(true);
        resolve();
      });
    });

    // Verify receiving check:completed event
    const checkPromise = new Promise<void>((resolve) => {
      client.on('check:completed', (data) => {
        expect(data.monitorId).toBe('monitor-1');
        expect(data.outcome).toBe('success');
        expect(data.statusCode).toBe(200);
        resolve();
      });
    });

    // Verify receiving incident:opened event
    const incidentPromise = new Promise<void>((resolve) => {
      client.on('incident:opened', (data) => {
        expect(data.monitorId).toBe('monitor-1');
        expect(data.status).toBe('open');
        resolve();
      });
    });

    // Verify receiving monitor:status_changed event
    const statusPromise = new Promise<void>((resolve) => {
      client.on('monitor:status_changed', (data) => {
        expect(data.monitorId).toBe('monitor-1');
        expect(data.status).toBe('unhealthy');
        resolve();
      });
    });

    // Emit events targeted at testUser.id
    emitCheckCompleted(testUser.id, {
      monitorId: 'monitor-1',
      checkId: 'check-1',
      statusCode: 200,
      latencyMs: 15,
      outcome: 'success',
      errorCode: null,
      checkedAt: new Date().toISOString(),
    });

    emitIncidentOpened(testUser.id, {
      incidentId: 'incident-1',
      monitorId: 'monitor-1',
      status: 'open',
      failureCount: 1,
      startedAt: new Date().toISOString(),
      resolvedAt: null,
    });

    emitMonitorStatusChanged(testUser.id, {
      monitorId: 'monitor-1',
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
    });

    await Promise.all([checkPromise, incidentPromise, statusPromise]);

    client.disconnect();
  });
});
