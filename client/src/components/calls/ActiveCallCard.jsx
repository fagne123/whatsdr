import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Clock, MessageSquare } from 'lucide-react';
import { endCall } from '../../services/api';

export default function ActiveCallCard({ call, onSelect }) {
  const [duration, setDuration] = useState(0);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const startTime = new Date(call.startTime).getTime();

    const updateDuration = () => {
      setDuration(Math.floor((Date.now() - startTime) / 1000));
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [call.startTime]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = async (e) => {
    e.stopPropagation();
    if (ending) return;

    setEnding(true);
    try {
      await endCall(call.id);
    } catch (error) {
      console.error('Erro ao encerrar chamada:', error);
      setEnding(false);
    }
  };

  const lastTranscript = call.transcripts?.[call.transcripts.length - 1];

  return (
    <div className="call-card" onClick={() => onSelect?.(call)}>
      <div className="call-card-header">
        <div className="call-status">
          <span className="status-indicator active"></span>
          <Phone size={16} />
          <span>{call.phoneNumber || 'Numero desconhecido'}</span>
        </div>
        <div className="call-duration">
          <Clock size={14} />
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {lastTranscript && (
        <div className="call-last-message">
          <MessageSquare size={14} />
          <span className={`message-role ${lastTranscript.role}`}>
            {lastTranscript.role === 'user' ? 'Cliente' : 'IA'}:
          </span>
          <span className="message-content">
            {lastTranscript.content.substring(0, 50)}
            {lastTranscript.content.length > 50 ? '...' : ''}
          </span>
        </div>
      )}

      <div className="call-card-footer">
        <span className="transcript-count">
          {call.transcripts?.length || 0} mensagens
        </span>
        <button
          onClick={handleEndCall}
          className="btn btn-danger btn-sm"
          disabled={ending}
        >
          <PhoneOff size={14} />
          {ending ? 'Encerrando...' : 'Encerrar'}
        </button>
      </div>
    </div>
  );
}
