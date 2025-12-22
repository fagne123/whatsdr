import { useState } from 'react';
import { Phone, X } from 'lucide-react';
import { startCall } from '../../services/api';

export default function NewCallModal({ isOpen, onClose }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const formatPhone = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleChange = (e) => {
    setPhoneNumber(formatPhone(e.target.value));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanNumber = phoneNumber.replace(/\D/g, '');

    if (cleanNumber.length < 10) {
      setError('Numero invalido. Digite DDD + numero.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await startCall(cleanNumber);
      setPhoneNumber('');
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao iniciar chamada');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Nova Chamada</h2>
          <button onClick={onClose} className="btn btn-ghost">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="phone">Numero de Telefone</label>
            <input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={handleChange}
              placeholder="(84) 99999-9999"
              className="input"
              autoFocus
            />
            {error && <span className="error-text">{error}</span>}
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Phone size={16} />
              {loading ? 'Iniciando...' : 'Iniciar Chamada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
