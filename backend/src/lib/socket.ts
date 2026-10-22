import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { env } from '../config/env';
import { logger } from './logger';
import { authService } from '../modules/auth/auth.service';
import { CheckOutcome } from '../modules/checks/checks.types';
import { IncidentStatus } from '../modules/incidents/incidents.types';

export interface CheckCompletedPayload {
  monitorId: string;
  checkId: string;
  statusCode: number | null;
  latencyMs: number | null;
  outcome: CheckOutcome;
  errorCode: string | null;
  checkedAt: string;
}

export interface MonitorStatusChangedPayload {
  monitorId: string;
  status: 'healthy' | 'unhealthy';
  timestamp: string;
}

export interface IncidentPayload {
  incidentId: string;
  monitorId: string;
  status: IncidentStatus;
  failureCount: number;
  startedAt: string;
  resolvedAt: string | null;
}

let ioInstance: SocketIOServer | null = null;

export function initSocketServer(httpServer: http.Server): SocketIOServer {
  if (ioInstance) {
    return ioInstance;
  }

  ioInstance = new SocketIOServer(httpServer, {
    cors: {
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // 1. Authenticate Socket.IO connections before handshake completion
  ioInstance.use((socket: Socket, next) => {
    try {
      const authHeader =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.headers.authorization as string | undefined);

      if (!authHeader) {
        return next(new Error('Authentication failed: Missing authorization token'));
      }

      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
      if (!token) {
        return next(new Error('Authentication failed: Token is empty'));
      }

      const decoded = authService.verifyToken(token);
      socket.data.userId = decoded.userId;
      socket.data.email = decoded.email;

      next();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid token';
      return next(new Error(`Authentication failed: ${msg}`));
    }
  });

  ioInstance.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;

    // 2. Associate each connection with its authenticated user and isolate to user room
    const userRoom = `user:${userId}`;
    socket.join(userRoom);

    logger.info({ socketId: socket.id, userId }, 'Authenticated client connected to Socket.IO and joined user room');

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, userId, reason }, 'Socket.IO client disconnected');
    });
  });

  return ioInstance;
}

export function getSocketServer(): SocketIOServer | null {
  return ioInstance;
}

/**
 * Dispatches an event exclusively to the authorized user's room.
 * Never broadcasts private monitoring or incident data globally.
 */
function emitToUser<T>(userId: string, eventName: string, data: T): void {
  if (!ioInstance) return;

  const room = `user:${userId}`;
  ioInstance.to(room).emit(eventName, data);

  logger.debug({ userId, eventName }, 'Dispatched real-time Socket.IO event to user room');
}

export function emitCheckCompleted(userId: string, payload: CheckCompletedPayload): void {
  emitToUser(userId, 'check:completed', payload);
}

export function emitMonitorStatusChanged(userId: string, payload: MonitorStatusChangedPayload): void {
  emitToUser(userId, 'monitor:status_changed', payload);
}

export function emitIncidentOpened(userId: string, payload: IncidentPayload): void {
  emitToUser(userId, 'incident:opened', payload);
}

export function emitIncidentUpdated(userId: string, payload: IncidentPayload): void {
  emitToUser(userId, 'incident:updated', payload);
}

export function emitIncidentResolved(userId: string, payload: IncidentPayload): void {
  emitToUser(userId, 'incident:resolved', payload);
}

export async function closeSocketServer(): Promise<void> {
  if (ioInstance) {
    logger.info('Closing Socket.IO server...');
    await new Promise<void>((resolve) => {
      ioInstance?.close(() => {
        logger.info('Socket.IO server closed');
        resolve();
      });
    });
    ioInstance = null;
  }
}
