import { useEffect, useRef } from 'react';
import { User, Bot } from 'lucide-react';

export default function TranscriptView({ transcripts = [] }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcripts]);

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (transcripts.length === 0) {
    return (
      <div className="transcript-empty">
        <p>Nenhuma mensagem ainda</p>
      </div>
    );
  }

  return (
    <div className="transcript-container" ref={containerRef}>
      {transcripts.map((transcript, index) => (
        <div
          key={index}
          className={`transcript-message ${transcript.role}`}
        >
          <div className="message-icon">
            {transcript.role === 'user' ? <User size={16} /> : <Bot size={16} />}
          </div>
          <div className="message-body">
            <div className="message-header">
              <span className="message-role">
                {transcript.role === 'user' ? 'Cliente' : 'IA'}
              </span>
              <span className="message-time">
                {formatTime(transcript.timestamp)}
              </span>
            </div>
            <p className="message-text">{transcript.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
