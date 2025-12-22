import { useState } from 'react';
import { Phone, Plus, X } from 'lucide-react';
import { useCalls } from '../context/CallsContext';
import ActiveCallCard from '../components/calls/ActiveCallCard';
import TranscriptView from '../components/calls/TranscriptView';
import NewCallModal from '../components/calls/NewCallModal';

export default function ActiveCalls() {
  const { activeCalls, loading } = useCalls();
  const [selectedCall, setSelectedCall] = useState(null);
  const [showNewCall, setShowNewCall] = useState(false);

  const handleSelectCall = (call) => {
    setSelectedCall(call);
  };

  const handleCloseDetail = () => {
    setSelectedCall(null);
  };

  // Atualiza o selectedCall quando os transcripts mudam
  const currentCall = selectedCall
    ? activeCalls.find(c => c.id === selectedCall.id)
    : null;

  return (
    <div className="active-calls-page">
      <div className="page-header">
        <h1>Chamadas Ativas</h1>
        <button onClick={() => setShowNewCall(true)} className="btn btn-primary">
          <Plus size={18} />
          Nova Chamada
        </button>
      </div>

      <div className="calls-layout">
        <div className="calls-list-section">
          {loading ? (
            <div className="loading">Carregando...</div>
          ) : activeCalls.length === 0 ? (
            <div className="empty-state">
              <Phone size={48} />
              <p>Nenhuma chamada ativa</p>
              <button onClick={() => setShowNewCall(true)} className="btn btn-primary">
                <Plus size={18} />
                Iniciar Chamada
              </button>
            </div>
          ) : (
            <div className="calls-list">
              {activeCalls.map(call => (
                <ActiveCallCard
                  key={call.id}
                  call={call}
                  onSelect={handleSelectCall}
                />
              ))}
            </div>
          )}
        </div>

        {currentCall && (
          <div className="call-detail-section">
            <div className="detail-header">
              <h2>
                <Phone size={20} />
                {currentCall.phoneNumber || 'Numero desconhecido'}
              </h2>
              <button onClick={handleCloseDetail} className="btn btn-ghost">
                <X size={20} />
              </button>
            </div>
            <TranscriptView transcripts={currentCall.transcripts} />
          </div>
        )}
      </div>

      <NewCallModal isOpen={showNewCall} onClose={() => setShowNewCall(false)} />
    </div>
  );
}
