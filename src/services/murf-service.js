/**
 * Murf.ai Service - Text-to-Speech
 * Documentação: https://murf.ai/api/docs/introduction/overview
 */

class MurfService {
  constructor(apiKey, voiceId = 'Isadora', style = 'Conversational', model = 'GEN2') {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
    this.style = style;
    this.model = model;
    this.baseUrl = 'https://api.murf.ai/v1';
  }

  /**
   * Converte texto em fala
   * @param {string} text - Texto para converter
   * @returns {Promise<Buffer>} Áudio em formato PCM 8kHz 16-bit mono
   */
  async textToSpeech(text) {
    if (!text || text.trim().length === 0) {
      return Buffer.alloc(0);
    }

    try {
      console.log('🗣️  Gerando TTS (Murf.ai):', text);

      const response = await fetch(`${this.baseUrl}/speech/stream`, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          voiceId: this.voiceId,
          style: this.style,
          model: this.model,
          format: 'PCM',
          sampleRate: 8000,
          channelType: 'MONO'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Murf API error ${response.status}: ${errorText}`);
      }

      // Converte stream para buffer
      const arrayBuffer = await response.arrayBuffer();
      const pcmBuffer = Buffer.from(arrayBuffer);

      console.log('✅ TTS gerado:', pcmBuffer.length, 'bytes');
      return pcmBuffer;

    } catch (error) {
      console.error('❌ Erro no TTS (Murf.ai):', error.message);
      return Buffer.alloc(0);
    }
  }

  /**
   * Lista vozes disponíveis
   */
  async listVoices() {
    try {
      const response = await fetch(`${this.baseUrl}/speech/voices`, {
        method: 'GET',
        headers: {
          'api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Murf API error ${response.status}`);
      }

      const data = await response.json();
      return data.voices || data;
    } catch (error) {
      console.error('❌ Erro ao listar vozes:', error.message);
      return [];
    }
  }
}

module.exports = MurfService;
