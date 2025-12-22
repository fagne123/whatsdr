/**
 * LigAI - Sistema de IA de Ligações em Tempo Real
 *
 * Arquitetura:
 * Asterisk → AudioSocket → Node.js → Groq (STT) → OpenRouter (IA) → Eleven Labs (TTS) → Asterisk
 *
 * Interface Web:
 * React Client → Express API + WebSocket → CallManager
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');

const CallManager = require('./src/call-manager');
const DatabaseService = require('./src/db/database');
const { AuthService } = require('./src/api/auth');
const WebSocketService = require('./src/api/websocket');
const AMIService = require('./src/services/ami-service');
const setupRoutes = require('./src/api/routes');

// Configuração
const config = {
  audioSocket: {
    host: process.env.AUDIOSOCKET_HOST || '0.0.0.0',
    port: parseInt(process.env.AUDIOSOCKET_PORT) || 9092
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY
  },
  murf: {
    apiKey: process.env.MURF_API_KEY,
    voiceId: process.env.MURF_VOICE_ID || 'Isadora',
    style: process.env.MURF_STYLE || 'Conversational',
    model: process.env.MURF_MODEL || 'GEN2'
  },
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.AI_MODEL || 'anthropic/claude-3.5-sonnet'
  },
  api: {
    port: parseInt(process.env.API_PORT) || 3001
  },
  ami: {
    host: process.env.AMI_HOST || '127.0.0.1',
    port: parseInt(process.env.AMI_PORT) || 5038,
    username: process.env.AMI_USERNAME || 'ligai',
    password: process.env.AMI_PASSWORD || 'ligai2025'
  }
};

// Valida configuração
function validateConfig() {
  const required = [
    'GROQ_API_KEY',
    'MURF_API_KEY',
    'OPENROUTER_API_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Variáveis de ambiente faltando:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n💡 Copie .env.example para .env e preencha as chaves de API');
    process.exit(1);
  }
}

// Verifica se ffmpeg está instalado
function checkFFmpeg() {
  const { execSync } = require('child_process');
  try {
    execSync('which ffmpeg', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ ffmpeg não encontrado!');
    console.error('💡 Instale com: sudo apt-get install -y ffmpeg');
    process.exit(1);
  }
}

// Inicializa sistema
async function main() {
  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║              🤖  LigAI - Sistema de IA                    ║
  ║           Sistema de Ligações com IA em Tempo Real       ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `);

  validateConfig();
  checkFFmpeg();

  // Inicializa banco de dados
  const db = new DatabaseService();
  db.connect();

  // Inicializa serviço de autenticação
  const authService = new AuthService(db);

  // Inicializa AMI
  const amiService = new AMIService(config.ami);
  try {
    await amiService.connect();
  } catch (error) {
    console.warn('⚠️  AMI não conectado:', error.message);
    console.warn('   Chamadas via interface web não funcionarão');
  }

  // Cria Express app
  const app = express();
  app.use(express.json());

  // CORS para desenvolvimento
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Cria servidor HTTP
  const server = http.createServer(app);

  // Inicializa WebSocket
  const wsService = new WebSocketService(server, authService);

  // Inicializa CallManager com referências
  const callManager = new CallManager(config, db, wsService);
  callManager.start();

  // Configura rotas da API
  setupRoutes(app, authService, db, callManager, amiService);

  // Serve React build em produção
  const clientBuildPath = path.join(__dirname, 'client', 'dist');
  app.use(express.static(clientBuildPath));

  // Fallback para SPA (Express 5 syntax)
  app.get('/{*splat}', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    }
  });

  // Inicia servidor HTTP/API
  server.listen(config.api.port, () => {
    console.log(`\n🌐 API/WebSocket rodando em http://localhost:${config.api.port}`);
    console.log(`   - REST API: http://localhost:${config.api.port}/api`);
    console.log(`   - WebSocket: ws://localhost:${config.api.port}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n\n🛑 Encerrando LigAI...');
    callManager.stop();
    amiService.disconnect();
    db.close();
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Tratamento de erros
process.on('unhandledRejection', (error) => {
  console.error('❌ Erro não tratado:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Exceção não capturada:', error);
  process.exit(1);
});

// Inicia
main().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
