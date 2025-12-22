const express = require('express');
const { authMiddleware } = require('./auth');

function setupRoutes(app, authService, db, callManager, amiService) {
  const router = express.Router();
  const auth = authMiddleware(authService);

  // === Auth Routes ===

  router.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    const result = await authService.login(username, password);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    res.json(result);
  });

  router.get('/auth/me', auth, (req, res) => {
    const user = db.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json({ user });
  });

  // === Calls Routes ===

  router.get('/calls/active', auth, (req, res) => {
    try {
      const activeCalls = callManager.getActiveCalls();
      res.json({ calls: activeCalls });
    } catch (error) {
      console.error('Erro ao buscar chamadas ativas:', error);
      res.status(500).json({ error: 'Erro ao buscar chamadas ativas' });
    }
  });

  router.get('/calls/history', auth, (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = db.getCallHistory(page, limit);

      // Adiciona transcrições a cada chamada
      result.calls = result.calls.map(call => ({
        ...call,
        transcripts: db.getTranscriptsByCallId(call.id)
      }));

      res.json(result);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
  });

  router.delete('/calls/history', auth, (req, res) => {
    try {
      db.clearCallHistory();
      res.json({ success: true, message: 'Histórico limpo com sucesso' });
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
      res.status(500).json({ error: 'Erro ao limpar histórico' });
    }
  });

  router.get('/calls/:id', auth, (req, res) => {
    try {
      const call = db.getCallById(req.params.id);

      if (!call) {
        return res.status(404).json({ error: 'Chamada não encontrada' });
      }

      const transcripts = db.getTranscriptsByCallId(req.params.id);

      res.json({ call: { ...call, transcripts } });
    } catch (error) {
      console.error('Erro ao buscar chamada:', error);
      res.status(500).json({ error: 'Erro ao buscar chamada' });
    }
  });

  router.post('/calls/start', auth, async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Número de telefone é obrigatório' });
    }

    // Limpa o número (remove caracteres não numéricos)
    const cleanNumber = phoneNumber.replace(/\D/g, '');

    if (cleanNumber.length < 10) {
      return res.status(400).json({ error: 'Número de telefone inválido' });
    }

    try {
      const result = await amiService.originateCall(cleanNumber);
      res.json({
        success: true,
        message: 'Chamada iniciada',
        phoneNumber: cleanNumber,
        actionId: result.actionid
      });
    } catch (error) {
      console.error('Erro ao iniciar chamada:', error);
      res.status(500).json({ error: 'Erro ao iniciar chamada: ' + error.message });
    }
  });

  router.post('/calls/:id/end', auth, async (req, res) => {
    try {
      const callId = req.params.id;
      const call = db.getCallById(callId);

      if (!call) {
        return res.status(404).json({ error: 'Chamada não encontrada' });
      }

      if (call.status !== 'active') {
        return res.status(400).json({ error: 'Chamada já finalizada' });
      }

      // Tenta encerrar via CallManager
      const ended = callManager.endCall(callId, 'user_request');

      if (ended) {
        res.json({ success: true, message: 'Chamada encerrada' });
      } else {
        res.status(500).json({ error: 'Não foi possível encerrar a chamada' });
      }
    } catch (error) {
      console.error('Erro ao encerrar chamada:', error);
      res.status(500).json({ error: 'Erro ao encerrar chamada' });
    }
  });

  // === Stats Route ===

  router.get('/stats', auth, (req, res) => {
    try {
      const stats = db.getStats();
      res.json({ stats });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
  });

  // === Health Check ===

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  app.use('/api', router);
}

module.exports = setupRoutes;
