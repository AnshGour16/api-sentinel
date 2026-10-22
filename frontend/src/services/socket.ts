import { io, Socket } from 'socket.io-client';
import { getStoredToken } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = getStoredToken();
    socket = io(window.location.origin, {
      auth: { token: token ? `Bearer ${token}` : '' },
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  const token = getStoredToken();
  if (token) {
    s.auth = { token: `Bearer ${token}` };
  }
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
