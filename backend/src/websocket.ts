import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// Keep track of active sockets by organisationId
const orgClients = new Map<string, Set<WebSocket>>();

export function initWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded || !decoded.organisationId) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, decoded.organisationId);
      });
    } catch (e) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, organisationId: string) => {
    if (!orgClients.has(organisationId)) {
      orgClients.set(organisationId, new Set());
    }
    orgClients.get(organisationId)!.add(ws);

    ws.on('close', () => {
      const clients = orgClients.get(organisationId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          orgClients.delete(organisationId);
        }
      }
    });

    ws.on('error', () => {
      const clients = orgClients.get(organisationId);
      if (clients) {
        clients.delete(ws);
      }
    });
  });
}

export function broadcastToOrganisation(organisationId: string, event: { type: string; data?: any }) {
  const clients = orgClients.get(organisationId);
  if (!clients) return;

  const payload = JSON.stringify(event);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}
