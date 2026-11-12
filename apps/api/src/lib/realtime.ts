import type { Server as HttpServer } from 'node:http';
import { parse } from 'node:querystring';
import type { RealtimeEntity } from '@home-hub/shared';
import { Server } from 'socket.io';
import { meFromToken, SESSION_COOKIE } from './auth.js';

let io: Server | null = null;

export function attachRealtime(server: HttpServer, corsOrigins: string[]) {
  io = new Server(server, { cors: corsOrigins.length ? { origin: corsOrigins, credentials: true } : undefined });
  io.use(async (socket, next) => {
    const cookies = parse(socket.handshake.headers.cookie ?? '', '; ');
    const token = cookies[SESSION_COOKIE];
    const me = await meFromToken(typeof token === 'string' ? token : undefined);
    if (!me) return next(new Error('unauthorized'));
    socket.data.me = me;
    socket.join(`household:${me.householdId}`);
    next();
  });
  return io;
}

// Os clientes só recebem "algo mudou em X" e refazem o GET.
// Simples, e não há risco de estado divergente entre o painel e os celulares.
export function broadcast(householdId: number, entity: RealtimeEntity) {
  io?.to(`household:${householdId}`).emit('changed', { entity });
}
