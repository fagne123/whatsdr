const net = require('net');
const EventEmitter = require('events');

class AMIService extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      host: config.host || '127.0.0.1',
      port: config.port || 5038,
      username: config.username || 'ligai',
      password: config.password || 'ligai2025'
    };
    this.socket = null;
    this.connected = false;
    this.authenticated = false;
    this.bannerReceived = false;
    this.buffer = '';
    this.actionId = 0;
    this.pendingActions = new Map();
    this.reconnectTimer = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.socket) {
        this.socket.destroy();
      }

      // Reset state for new connection
      this.bannerReceived = false;
      this.buffer = '';
      this.socket = new net.Socket();

      this.socket.connect(this.config.port, this.config.host, () => {
        this.connected = true;
      });

      this.socket.on('data', (data) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      this.socket.on('close', () => {
        const wasAuthenticated = this.authenticated;
        this.connected = false;
        this.authenticated = false;
        if (wasAuthenticated) {
          console.log('📞 AMI desconectado');
          this.scheduleReconnect();
        }
      });

      this.socket.on('error', (err) => {
        console.error('📞 AMI erro:', err.message);
        this.connected = false;
        this.authenticated = false;
      });

      // Wait for connection and authentication
      const timeout = setTimeout(() => {
        if (!this.authenticated) {
          reject(new Error('Timeout ao conectar ao AMI'));
        }
      }, 10000);

      this.once('authenticated', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.once('authFailed', (msg) => {
        clearTimeout(timeout);
        reject(new Error(`Autenticação AMI falhou: ${msg}`));
      });
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
        console.log('📞 AMI reconectado com sucesso');
      } catch (err) {
        console.error('📞 Falha ao reconectar AMI:', err.message);
        this.scheduleReconnect();
      }
    }, 5000);
  }

  processBuffer() {
    // Handle initial banner (ends with \r\n, not \r\n\r\n)
    if (!this.bannerReceived && this.buffer.includes('Asterisk Call Manager')) {
      const bannerEnd = this.buffer.indexOf('\r\n');
      if (bannerEnd > 0) {
        this.buffer = this.buffer.substring(bannerEnd + 2);
        this.bannerReceived = true;
        this.login();
      }
      return;
    }

    const messages = this.buffer.split('\r\n\r\n');
    this.buffer = messages.pop() || '';

    for (const msg of messages) {
      if (!msg.trim()) continue;

      const parsed = this.parseMessage(msg);

      // Handle responses
      if (parsed.Response) {
        if (parsed.ActionID) {
          const callback = this.pendingActions.get(parsed.ActionID);
          if (callback) {
            this.pendingActions.delete(parsed.ActionID);
            if (parsed.Response === 'Success') {
              callback.resolve(parsed);
            } else {
              callback.reject(new Error(parsed.Message || 'Action failed'));
            }
          }
        }

        // Handle login response
        if (parsed.Message === 'Authentication accepted') {
          this.authenticated = true;
          console.log('📞 AMI conectado ao Asterisk');
          this.emit('authenticated');
        } else if (parsed.Message === 'Authentication failed') {
          this.emit('authFailed', parsed.Message);
        }
      }

      // Handle events
      if (parsed.Event) {
        this.emit('event', parsed);
        this.emit(`event:${parsed.Event}`, parsed);
      }
    }
  }

  parseMessage(msg) {
    const result = { raw: msg };
    const lines = msg.split('\r\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        result[key] = value;
      }
    }

    return result;
  }

  login() {
    const loginMsg = [
      'Action: Login',
      `Username: ${this.config.username}`,
      `Secret: ${this.config.password}`,
      '',
      ''
    ].join('\r\n');

    this.socket.write(loginMsg);
  }

  sendAction(action) {
    return new Promise((resolve, reject) => {
      if (!this.authenticated) {
        reject(new Error('AMI não está conectado'));
        return;
      }

      const actionId = `ligai-${++this.actionId}`;
      action.ActionID = actionId;

      const lines = [];
      for (const [key, value] of Object.entries(action)) {
        if (typeof value === 'object') {
          for (const [k, v] of Object.entries(value)) {
            lines.push(`Variable: ${k}=${v}`);
          }
        } else {
          lines.push(`${key}: ${value}`);
        }
      }
      lines.push('', '');

      this.pendingActions.set(actionId, { resolve, reject });

      // Timeout for action
      setTimeout(() => {
        if (this.pendingActions.has(actionId)) {
          this.pendingActions.delete(actionId);
          reject(new Error('Action timeout'));
        }
      }, 30000);

      this.socket.write(lines.join('\r\n'));
    });
  }

  async originateCall(phoneNumber) {
    if (!this.authenticated) {
      throw new Error('AMI não está conectado');
    }

    // Remove caracteres não numéricos
    let cleanNumber = phoneNumber.replace(/\D/g, '');

    // Adiciona 55 (Brasil) se não tiver código do país
    if (!cleanNumber.startsWith('55') && cleanNumber.length <= 11) {
      cleanNumber = '55' + cleanNumber;
    }

    const result = await this.sendAction({
      Action: 'Originate',
      Channel: `Local/${cleanNumber}@outbound-calls-ai`,
      Application: 'Wait',
      Data: '60',
      CallerID: `LigAI <${cleanNumber}>`,
      Timeout: 30000,
      Async: 'true',
      Variable: {
        LIGAI_PHONE: cleanNumber
      }
    });

    console.log(`📞 Chamada iniciada para: ${cleanNumber}`);
    return result;
  }

  async hangupChannel(channel) {
    if (!this.authenticated) {
      throw new Error('AMI não está conectado');
    }

    return this.sendAction({
      Action: 'Hangup',
      Channel: channel
    });
  }

  async getActiveChannels() {
    if (!this.authenticated) {
      throw new Error('AMI não está conectado');
    }

    return this.sendAction({
      Action: 'CoreShowChannels'
    });
  }

  async ping() {
    return this.sendAction({
      Action: 'Ping'
    });
  }

  isConnected() {
    return this.authenticated;
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.sendAction({ Action: 'Logoff' }).catch(() => {});
      setTimeout(() => {
        if (this.socket) {
          this.socket.destroy();
          this.socket = null;
        }
      }, 500);
      this.connected = false;
      this.authenticated = false;
      console.log('📞 AMI desconectado');
    }
  }
}

module.exports = AMIService;
