const WebSocket = require('ws');
const url = require('url');

class WebSocketService {
  constructor(server, authService) {
    this.authService = authService;
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map(); // userId -> Set<WebSocket>

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    console.log('🔌 WebSocket server inicializado');
  }

  handleConnection(ws, req) {
    // Extrai token da query string
    const queryParams = url.parse(req.url, true).query;
    const token = queryParams.token;

    if (!token) {
      ws.close(4001, 'Token não fornecido');
      return;
    }

    const decoded = this.authService.verifyToken(token);
    if (!decoded) {
      ws.close(4002, 'Token inválido');
      return;
    }

    // Armazena conexão do usuário
    ws.userId = decoded.userId;
    ws.username = decoded.username;

    if (!this.clients.has(decoded.userId)) {
      this.clients.set(decoded.userId, new Set());
    }
    this.clients.get(decoded.userId).add(ws);

    console.log(`🔌 WebSocket conectado: ${decoded.username}`);

    // Envia confirmação de conexão
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Conectado ao servidor de chamadas'
    }));

    // Handler de mensagens (para futuras expansões)
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('Erro ao processar mensagem WebSocket:', error);
      }
    });

    // Handler de desconexão
    ws.on('close', () => {
      console.log(`🔌 WebSocket desconectado: ${decoded.username}`);
      const userConnections = this.clients.get(decoded.userId);
      if (userConnections) {
        userConnections.delete(ws);
        if (userConnections.size === 0) {
          this.clients.delete(decoded.userId);
        }
      }
    });

    // Handler de erro
    ws.on('error', (error) => {
      console.error(`WebSocket erro (${decoded.username}):`, error);
    });
  }

  handleMessage(ws, message) {
    // Placeholder para mensagens do cliente
    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      default:
        console.log(`Mensagem não tratada: ${message.type}`);
    }
  }

  // Broadcast para todos os clientes conectados
  broadcast(type, data) {
    const message = JSON.stringify({ type, ...data, timestamp: new Date().toISOString() });

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Envia para um usuário específico
  sendToUser(userId, type, data) {
    const userConnections = this.clients.get(userId);
    if (!userConnections) return;

    const message = JSON.stringify({ type, ...data, timestamp: new Date().toISOString() });

    userConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  // Retorna número de clientes conectados
  getConnectedCount() {
    return this.wss.clients.size;
  }
}

module.exports = WebSocketService;
