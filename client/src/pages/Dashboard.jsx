import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Phone, PhoneCall, Clock, BarChart3, Plus } from 'lucide-react';
import { getStats } from '../services/api';
import { useCalls } from '../context/CallsContext';
import ActiveCallCard from '../components/calls/ActiveCallCard';
import NewCallModal from '../components/calls/NewCallModal';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [showNewCall, setShowNewCall] = useState(false);
  const { activeCalls } = useCalls();

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const data = await getStats();
      setStats(data.stats);
    } catch (error) {
      console.error('Erro ao carregar estatisticas:', error);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <button onClick={() => setShowNewCall(true)} className="btn btn-primary">
          <Plus size={18} />
          Nova Chamada
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <PhoneCall size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{activeCalls.length}</span>
            <span className="stat-label">Chamadas Ativas</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Phone size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats?.todayCalls || 0}</span>
            <span className="stat-label">Chamadas Hoje</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <BarChart3 size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats?.totalCalls || 0}</span>
            <span className="stat-label">Total de Chamadas</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{formatDuration(stats?.avgDurationSeconds)}</span>
            <span className="stat-label">Duracao Media</span>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2>Chamadas Ativas</h2>
          {activeCalls.length > 0 && (
            <Link to="/calls" className="link">Ver todas</Link>
          )}
        </div>

        {activeCalls.length === 0 ? (
          <div className="empty-state">
            <Phone size={48} />
            <p>Nenhuma chamada ativa no momento</p>
            <button onClick={() => setShowNewCall(true)} className="btn btn-primary">
              <Plus size={18} />
              Iniciar Chamada
            </button>
          </div>
        ) : (
          <div className="calls-grid">
            {activeCalls.slice(0, 4).map(call => (
              <ActiveCallCard key={call.id} call={call} />
            ))}
          </div>
        )}
      </div>

      <NewCallModal isOpen={showNewCall} onClose={() => setShowNewCall(false)} />
    </div>
  );
}
