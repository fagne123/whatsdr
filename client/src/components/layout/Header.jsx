import { Phone, LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <div className="header-brand">
        <Phone size={24} />
        <h1>LigAI</h1>
      </div>

      <div className="header-user">
        <span className="user-info">
          <User size={18} />
          {user?.username}
        </span>
        <button onClick={logout} className="btn btn-ghost" title="Sair">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
