import { useState, useEffect } from 'react';
import { Phone, Clock, MessageSquare, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { getCallHistory, clearCallHistory } from '../services/api';
import TranscriptView from '../components/calls/TranscriptView';

export default function CallHistory() {
  const [calls, setCalls] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);

  useEffect(() => {
    loadHistory(1);
  }, []);

  const loadHistory = async (page) => {
    setLoading(true);
    try {
      const data = await getCallHistory(page, 10);
      setCalls(data.calls || []);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Erro ao carregar historico:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds < 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'completed': return 'status-success';
      case 'failed': return 'status-error';
      case 'cancelled': return 'status-warning';
      default: return '';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed': return 'Concluida';
      case 'failed': return 'Falhou';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Tem certeza que deseja limpar todo o historico de chamadas?')) {
      try {
        await clearCallHistory();
        setCalls([]);
        setSelectedCall(null);
        setPagination({ page: 1, totalPages: 1 });
      } catch (error) {
        console.error('Erro ao limpar historico:', error);
        alert('Erro ao limpar historico');
      }
    }
  };

  return (
    <div className="history-page">
      <div className="page-header">
        <h1>Historico de Chamadas</h1>
        {calls.length > 0 && (
          <button className="btn btn-danger" onClick={handleClearHistory}>
            <Trash2 size={18} />
            Limpar Historico
          </button>
        )}
      </div>

      <div className="history-layout">
        <div className="history-list-section">
          {loading ? (
            <div className="loading">Carregando...</div>
          ) : calls.length === 0 ? (
            <div className="empty-state">
              <Phone size={48} />
              <p>Nenhuma chamada no historico</p>
            </div>
          ) : (
            <>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Numero</th>
                    <th>Data/Hora</th>
                    <th>Duracao</th>
                    <th>Status</th>
                    <th>Mensagens</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map(call => (
                    <tr
                      key={call.id}
                      onClick={() => setSelectedCall(call)}
                      className={selectedCall?.id === call.id ? 'selected' : ''}
                    >
                      <td>
                        <Phone size={14} />
                        {call.phone_number || 'Desconhecido'}
                      </td>
                      <td>{formatDate(call.started_at)}</td>
                      <td>
                        <Clock size={14} />
                        {formatDuration(call.duration_seconds)}
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusClass(call.status)}`}>
                          {getStatusLabel(call.status)}
                        </span>
                      </td>
                      <td>
                        <MessageSquare size={14} />
                        {call.transcripts?.length || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pagination">
                <button
                  onClick={() => loadHistory(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="btn btn-ghost"
                >
                  <ChevronLeft size={18} />
                  Anterior
                </button>
                <span className="page-info">
                  Pagina {pagination.page} de {pagination.totalPages}
                </span>
                <button
                  onClick={() => loadHistory(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="btn btn-ghost"
                >
                  Proxima
                  <ChevronRight size={18} />
                </button>
              </div>
            </>
          )}
        </div>

        {selectedCall && (
          <div className="call-detail-section">
            <div className="detail-header">
              <h2>
                <Phone size={20} />
                {selectedCall.phone_number || 'Numero desconhecido'}
              </h2>
              <span className="detail-date">{formatDate(selectedCall.started_at)}</span>
            </div>
            <TranscriptView transcripts={selectedCall.transcripts} />
          </div>
        )}
      </div>
    </div>
  );
}
