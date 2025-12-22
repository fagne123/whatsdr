import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Phone, History } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <nav>
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/calls" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Phone size={20} />
          <span>Chamadas Ativas</span>
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <History size={20} />
          <span>Historico</span>
        </NavLink>
      </nav>
    </aside>
  );
}
