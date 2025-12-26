/**
 * Call Manager - Gerencia o fluxo completo de chamadas com IA
 */

const AudioSocketServer = require('./audiosocket-server');
const GroqService = require('./services/groq-service');
const MurfService = require('./services/murf-service');
const OpenRouterService = require('./services/openrouter-service');
const fs = require('fs');
const path = require('path');

class CallManager {
  constructor(config, db = null, wsService = null) {
    this.config = config;
    this.db = db;
    this.wsService = wsService;

    // Inicializa serviços
    this.audioServer = new AudioSocketServer(
      config.audioSocket.host,
      config.audioSocket.port
    );

    this.groqService = new GroqService(config.groq.apiKey);
    this.ttsService = new MurfService(
      config.murf.apiKey,
      config.murf.voiceId,
      config.murf.style,
      config.murf.model
    );
    this.openRouterService = new OpenRouterService(
      config.openRouter.apiKey,
      config.openRouter.model
    );

    // Estado das sessões
    this.sessions = new Map();

    // Chamadas pendentes (aguardando AudioSocket conectar)
    this.pendingCalls = new Map();

    // Diretório de gravações
    this.recordingsDir = path.join(__dirname, '..', 'data', 'recordings');
    this.ensureRecordingsDir();

    // Carrega áudio pré-gravado da saudação
    this.greetingAudio = null;
    this.loadGreetingAudio();

    this.setupEventHandlers();
  }

  loadGreetingAudio() {
    try {
      const greetingPath = path.join(__dirname, '..', 'greeting.pcm');
      if (fs.existsSync(greetingPath)) {
        this.greetingAudio = fs.readFileSync(greetingPath);
        console.log(`✅ Áudio de saudação carregado: ${this.greetingAudio.length} bytes`);
      } else {
        console.log('⚠️  Arquivo greeting.pcm não encontrado');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar áudio de saudação:', error.message);
    }
  }

  ensureRecordingsDir() {
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true });
      console.log(`📁 Diretório de gravações criado: ${this.recordingsDir}`);
    }
  }

  setupEventHandlers() {
    // Nova chamada iniciada
    this.audioServer.on('callStarted', (sessionId, session) => {
      console.log('\n📞 ============ NOVA CHAMADA ============');
      console.log('Session ID:', sessionId);

      const startTime = Date.now();

      // Verifica se há chamada pendente com metadados
      let pendingMeta = null;
      for (const [phone, meta] of this.pendingCalls) {
        // Associa a chamada mais recente pendente (FIFO)
        pendingMeta = meta;
        this.pendingCalls.delete(phone);
        console.log(`📋 Metadados associados: leadId=${meta.leadId}, step=${meta.step}`);
        break;
      }

      // Inicializa estado da sessão
      this.sessions.set(sessionId, {
        audioBuffer: Buffer.alloc(0),
        lastSpeechTime: Date.now(),
        lastHighEnergyTime: null,
        isSpeaking: false,
        isProcessing: false,
        conversationStarted: false,
        isSendingGreeting: false,
        isSendingResponse: false,
        startTime: startTime,
        phoneNumber: pendingMeta?.phone || null,
        transcripts: [],
        // Novos campos para integração
        leadId: pendingMeta?.leadId || null,
        step: pendingMeta?.step || null,
        webhookUrl: pendingMeta?.webhookUrl || null,
        context: pendingMeta?.context || null,
        audioRecording: [],
        callResult: null,
        handshakeCompleted: false
      });

      // Salva no banco de dados
      if (this.db) {
        try {
          if (pendingMeta) {
            this.db.createCallWithMeta(
              sessionId,
              pendingMeta.phone,
              pendingMeta.leadId,
              pendingMeta.step,
              pendingMeta.webhookUrl,
              pendingMeta.context
            );
          } else {
            this.db.createCall(sessionId, null);
          }
        } catch (error) {
          console.error('Erro ao salvar chamada no banco:', error.message);
        }
      }

      // Notifica clientes WebSocket
      this.broadcast('call:started', {
        call: {
          id: sessionId,
          startTime: new Date(startTime).toISOString(),
          status: 'active',
          phoneNumber: pendingMeta?.phone || null,
          leadId: pendingMeta?.leadId || null,
          step: pendingMeta?.step || null
        }
      });
    });

    // Handshake completado - pode enviar áudio
    this.audioServer.on('handshakeComplete', (sessionId) => {
      console.log('✅ Handshake completado - enviando saudação...');

      const session = this.sessions.get(sessionId);
      if (session) {
        session.handshakeCompleted = true;
        session.callResult = 'answered';

        // Marca momento do atendimento no banco
        if (this.db) {
          try {
            this.db.setAnsweredAt(sessionId);
            this.db.updateCallResult(sessionId, 'answered');
          } catch (error) {
            console.error('Erro ao marcar atendimento:', error.message);
          }
        }
      }

      this.sendGreeting(sessionId);
    });

    // Frame de áudio recebido
    this.audioServer.on('audioFrame', (sessionId, frame) => {
      const session = this.sessions.get(sessionId);
      if (!session) return;

      // Grava áudio recebido (do cliente)
      session.audioRecording.push({ type: 'in', data: Buffer.from(frame) });

      // Ignora áudio enquanto IA está falando (evita echo)
      if (session.isSendingGreeting || session.isSendingResponse) {
        return;
      }

      // Processa com IA
      this.handleAudioFrame(sessionId, frame);
    });

    // Chamada encerrada
    this.audioServer.on('callEnded', async (sessionId) => {
      console.log('📞 ============ CHAMADA ENCERRADA ============');
      console.log('Session ID:', sessionId);

      const session = this.sessions.get(sessionId);
      const duration = session ? Math.floor((Date.now() - session.startTime) / 1000) : 0;

      // Determina resultado se não definido
      if (session && !session.callResult) {
        session.callResult = session.handshakeCompleted ? 'answered' : 'not_answered';
      }

      // Salva áudio gravado
      let audioPath = null;
      if (session && session.audioRecording.length > 0) {
        try {
          audioPath = await this.saveAudioRecording(sessionId, session.audioRecording);
          if (this.db && audioPath) {
            this.db.setAudioPath(sessionId, audioPath);
          }
        } catch (error) {
          console.error('Erro ao salvar gravação:', error.message);
        }
      }

      // Finaliza no banco de dados
      if (this.db) {
        try {
          this.db.endCall(sessionId, 'hangup');
          if (session?.callResult) {
            this.db.updateCallResult(sessionId, session.callResult);
          }
        } catch (error) {
          console.error('Erro ao finalizar chamada no banco:', error.message);
        }
      }

      // Dispara webhook se configurado
      if (session?.webhookUrl) {
        this.dispatchWebhook(sessionId, session, duration, audioPath);
      }

      // Notifica clientes WebSocket
      this.broadcast('call:ended', {
        callId: sessionId,
        endReason: 'hangup',
        duration: duration,
        callResult: session?.callResult || 'unknown'
      });

      // Limpa recursos
      this.openRouterService.resetConversation(sessionId);
      this.sessions.delete(sessionId);
    });
  }

  async handleAudioFrame(sessionId, frame) {
    const session = this.sessions.get(sessionId);
    if (!session || session.isProcessing) return;

    // Calcula energia do frame para detectar fala
    const energy = this.calculateAudioEnergy(frame);
    const SPEECH_ENERGY_THRESHOLD = 40;
    const SILENCE_TOLERANCE_MS = 700;

    const now = Date.now();

    // Detecta se há fala neste frame
    const hasSpeech = energy > SPEECH_ENERGY_THRESHOLD;

    if (hasSpeech) {
      session.lastHighEnergyTime = now;
    }

    // Calcula há quanto tempo não detectamos fala
    const timeSinceHighEnergy = session.lastHighEnergyTime
      ? now - session.lastHighEnergyTime
      : Infinity;

    // Captura frame SE houver fala ou dentro da tolerância
    const shouldCapture = hasSpeech ||
                          (session.lastHighEnergyTime &&
                           timeSinceHighEnergy < SILENCE_TOLERANCE_MS &&
                           session.audioBuffer.length > 0);

    if (shouldCapture) {
      session.audioBuffer = Buffer.concat([session.audioBuffer, frame]);
      session.lastSpeechTime = now;

      if (session.audioBuffer.length % 3200 === 0) {
        console.log(`🎙️  Capturando... ${(session.audioBuffer.length / 16000).toFixed(1)}s (energia: ${energy.toFixed(1)})`);
      }
    }

    // Processa quando tiver 2-3 segundos de fala
    const PROCESS_THRESHOLD = 20000;

    if (session.audioBuffer.length >= PROCESS_THRESHOLD) {
      await this.processAudio(sessionId);
    }

    // Timeout: se passou 1s desde última fala forte e tem algo no buffer, processa
    if (session.audioBuffer.length > 8000 && timeSinceHighEnergy > 1000) {
      console.log(`⏱️  Fim de fala detectado (${(session.audioBuffer.length / 16000).toFixed(1)}s) - processando...`);
      await this.processAudio(sessionId);
    }
  }

  calculateAudioEnergy(pcmBuffer) {
    let sum = 0;
    for (let i = 0; i < pcmBuffer.length; i += 2) {
      const sample = pcmBuffer.readInt16LE(i);
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / (pcmBuffer.length / 2));
    return rms;
  }

  async processAudio(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.isProcessing) return;

    session.isProcessing = true;
    const audioToProcess = session.audioBuffer;
    session.audioBuffer = Buffer.alloc(0);

    try {
      // Converte PCM para WAV
      const wavBuffer = this.pcmToWav(audioToProcess);

      // STT: Áudio → Texto
      console.log('🎤 Transcrevendo áudio...');
      const userText = await this.groqService.speechToText(wavBuffer);

      if (!userText || userText.trim().length === 0) {
        console.log('⚠️  Nenhum texto detectado');
        session.isProcessing = false;
        return;
      }

      console.log('👤 Usuário disse:', userText);

      // Salva transcrição do usuário
      this.saveTranscript(sessionId, 'user', userText);

      // IA: Texto → Resposta
      const aiResponse = await this.openRouterService.chat(sessionId, userText);
      console.log('🤖 IA respondeu:', aiResponse);

      // Verifica se IA sinalizou fim da conversa
      const shouldEndCall = aiResponse.includes('[END_CALL]');
      const cleanResponse = aiResponse.replace('[END_CALL]', '').trim();

      // Salva resposta da IA (sem o marcador)
      this.saveTranscript(sessionId, 'assistant', cleanResponse);

      // TTS: Resposta → Áudio (usa resposta limpa)
      console.log('🗣️  Gerando resposta em áudio...');
      const responseAudio = await this.ttsService.textToSpeech(cleanResponse);

      // Envia áudio de volta para o Asterisk
      if (responseAudio.length > 0) {
        console.log('📡 Enviando áudio para Asterisk...');

        session.isSendingResponse = true;

        this.audioServer.stopSilence(sessionId);
        await this.audioServer.sendAudio(sessionId, responseAudio);

        if (this.sessions.has(sessionId)) {
          session.isSendingResponse = false;
          session.audioBuffer = Buffer.alloc(0);

          // Se IA sinalizou fim, encerra a chamada após o áudio
          if (shouldEndCall) {
            console.log('🔚 IA sinalizou fim da conversa - encerrando chamada em 500ms...');
            setTimeout(() => {
              if (this.sessions.has(sessionId)) {
                this.audioServer.sendHangup(sessionId);
                this.endCall(sessionId, 'ai_ended');
              }
            }, 500);
          } else {
            console.log('✅ Resposta enviada - aguardando cliente falar...');
          }
        }
      }

    } catch (error) {
      console.error('❌ Erro ao processar áudio:', error.message);
      if (session) {
        session.isSendingResponse = false;
      }
    }

    session.isProcessing = false;
  }

  saveTranscript(sessionId, role, content) {
    const session = this.sessions.get(sessionId);
    const timestamp = new Date().toISOString();

    // Adiciona ao estado local
    if (session) {
      session.transcripts.push({ role, content, timestamp });
    }

    // Salva no banco de dados
    if (this.db) {
      try {
        this.db.addTranscript(sessionId, role, content);
      } catch (error) {
        console.error('Erro ao salvar transcrição:', error.message);
      }
    }

    // Notifica clientes WebSocket
    this.broadcast('call:transcript', {
      callId: sessionId,
      role,
      content,
      timestamp
    });
  }

  async sendGreeting(sessionId) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      console.log('⚠️  Sessão encerrada antes da saudação');
      return;
    }

    try {
      console.log('👋 Enviando saudação pré-gravada...');

      session.isSendingGreeting = true;

      // Define prompt do sistema para vendas de precatórios
      this.openRouterService.setSystemPrompt(sessionId, `Você é um assistente de IA da Addebitare fazendo uma ligação para comprar precatórios.

Seu objetivo é:
- Confirmar se a pessoa tem precatórios para vender
- Qualificar o precatório (valor, tribunal, estado)
- Agendar uma proposta comercial
- Ser educado e profissional
- Fazer perguntas diretas e objetivas

Importante:
- Sempre responda em português do Brasil
- Mantenha as respostas curtas (máximo 30 palavras)
- Seja natural e conversacional
- Não use emojis ou símbolos especiais
- Se a pessoa disser que não tem precatórios, agradeça e encerre educadamente
- IMPORTANTE: Quando a conversa terminar (agendamento confirmado, pessoa não interessada, ou despedida final), adicione [END_CALL] ao final da sua resposta para encerrar a ligação automaticamente`);

      // Envia áudio pré-gravado
      if (this.greetingAudio && this.sessions.has(sessionId)) {
        await this.audioServer.sendAudio(sessionId, this.greetingAudio);
        console.log('✅ Saudação completa enviada - aguardando resposta do cliente...');

        // Salva saudação como primeira mensagem
        this.saveTranscript(sessionId, 'assistant', 'Olá, aqui é da addebitare, você tem precatórios para vender?');

        if (this.sessions.has(sessionId)) {
          session.isSendingGreeting = false;
          session.audioBuffer = Buffer.alloc(0);
        }
      } else if (!this.greetingAudio) {
        console.log('⚠️  Áudio de saudação não disponível');
        session.isSendingGreeting = false;
      }

    } catch (error) {
      console.error('❌ Erro ao enviar saudação:', error.message);
      if (session) {
        session.isSendingGreeting = false;
      }
    }
  }

  pcmToWav(pcmData) {
    const sampleRate = 8000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.length;

    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);

    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);

    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmData]);
  }

  // === Métodos para Integração (API/Webhook) ===

  async saveAudioRecording(sessionId, audioRecording) {
    if (!audioRecording || audioRecording.length === 0) return null;

    // Combina todos os frames de áudio (entrada e saída)
    const allAudio = [];
    for (const frame of audioRecording) {
      allAudio.push(frame.data);
    }
    const combinedPcm = Buffer.concat(allAudio);

    // Converte para WAV
    const wavBuffer = this.pcmToWav(combinedPcm);

    // Salva arquivo
    const filename = `${sessionId.replace(/[^a-zA-Z0-9-]/g, '_')}.wav`;
    const filePath = path.join(this.recordingsDir, filename);

    fs.writeFileSync(filePath, wavBuffer);
    console.log(`💾 Áudio salvo: ${filePath} (${(wavBuffer.length / 1024).toFixed(1)} KB)`);

    return filePath;
  }

  async dispatchWebhook(sessionId, session, duration, audioPath) {
    if (!session.webhookUrl) return;

    const payload = {
      event: 'call.completed',
      callId: sessionId,
      leadId: session.leadId,
      step: session.step,
      phoneNumber: session.phoneNumber,
      status: 'completed',
      callResult: session.callResult || 'unknown',
      duration: duration,
      transcript: session.transcripts || [],
      audioUrl: audioPath ? `/api/calls/${sessionId}/audio` : null,
      context: session.context,
      timestamp: new Date().toISOString()
    };

    console.log(`🔔 Disparando webhook para: ${session.webhookUrl}`);
    console.log(`   Payload: leadId=${payload.leadId}, result=${payload.callResult}, duration=${duration}s`);

    try {
      const response = await fetch(session.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LigAI-Event': 'call.completed',
          'X-LigAI-CallId': sessionId
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log(`✅ Webhook enviado com sucesso (${response.status})`);
      } else {
        console.error(`❌ Webhook falhou: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao enviar webhook: ${error.message}`);
      // TODO: Implementar fila de retry se necessário
    }
  }

  async originateCallWithMeta(phone, leadId, step, webhookUrl, context, amiService) {
    // Armazena metadados para associar quando AudioSocket conectar
    const callMeta = {
      phone,
      leadId,
      step,
      webhookUrl,
      context,
      createdAt: Date.now()
    };

    this.pendingCalls.set(phone, callMeta);
    console.log(`📋 Chamada pendente registrada: ${phone} (leadId=${leadId})`);

    // Limpa chamadas pendentes antigas (mais de 2 minutos)
    const now = Date.now();
    for (const [p, meta] of this.pendingCalls) {
      if (now - meta.createdAt > 120000) {
        this.pendingCalls.delete(p);
      }
    }

    // Origina chamada via AMI
    const result = await amiService.originateCall(phone);

    return {
      callId: null, // Será definido quando AudioSocket conectar
      actionId: result.actionid,
      phone: phone
    };
  }

  // === Métodos para API ===

  getActiveCalls() {
    const calls = [];

    for (const [sessionId, session] of this.sessions) {
      calls.push({
        id: sessionId,
        phoneNumber: session.phoneNumber,
        startTime: new Date(session.startTime).toISOString(),
        duration: Math.floor((Date.now() - session.startTime) / 1000),
        status: 'active',
        transcripts: session.transcripts || []
      });
    }

    return calls;
  }

  endCall(sessionId, reason = 'user_request') {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Finaliza no banco
    if (this.db) {
      try {
        this.db.endCall(sessionId, reason);
      } catch (error) {
        console.error('Erro ao finalizar chamada:', error.message);
      }
    }

    // Notifica WebSocket
    this.broadcast('call:ended', {
      callId: sessionId,
      endReason: reason,
      duration: Math.floor((Date.now() - session.startTime) / 1000)
    });

    // Tenta encerrar conexão AudioSocket
    try {
      this.audioServer.endSession(sessionId);
    } catch (error) {
      console.error('Erro ao encerrar sessão AudioSocket:', error.message);
    }

    // Limpa recursos
    this.openRouterService.resetConversation(sessionId);
    this.sessions.delete(sessionId);

    return true;
  }

  broadcast(type, data) {
    if (this.wsService) {
      this.wsService.broadcast(type, data);
    }
  }

  start() {
    console.log('\n🚀 ============ LigAI Iniciando ============');
    console.log('📡 AudioSocket:', `${this.config.audioSocket.host}:${this.config.audioSocket.port}`);
    console.log('🤖 IA Model:', this.config.openRouter.model);
    console.log('==========================================\n');

    this.audioServer.start();
  }

  stop() {
    this.audioServer.stop();
    console.log('🛑 LigAI parado');
  }
}

module.exports = CallManager;
