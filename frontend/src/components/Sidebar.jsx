import React, { useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Pulse,
  Clock,
  BookOpen,
  Users,
  UserCheck,
  GraduationCap,
  House,
  MapPin,
  ChartBar,
  SignOut,
} from '@phosphor-icons/react';

const navItems = [
  {
    section: 'Lecturer',
    links: [
      { to: '/lecturer/dashboard', label: 'Live Session', icon: Pulse },
      { to: '/lecturer/history', label: 'History', icon: Clock },
    ],
  },
  {
    section: 'Admin',
    links: [
      { to: '/admin', label: 'Dashboard', icon: House },
      { to: '/admin/courses', label: 'Courses', icon: BookOpen },
      { to: '/admin/classes', label: 'Classes', icon: Users },
      { to: '/admin/lecturers', label: 'Lecturers', icon: UserCheck },
      { to: '/admin/students', label: 'Students', icon: GraduationCap },
      { to: '/admin/buildings', label: 'Buildings', icon: MapPin },
      { to: '/admin/reports', label: 'Reports', icon: ChartBar },
    ],
  },
];

function getUser() {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
}

export default React.memo(function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useMemo(getUser, []);

  const isAdminRoute = location.pathname.startsWith('/admin');

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/lecturer/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">C</div>
        <span className="sidebar-brand-text">ClassPulse</span>
      </div>

      <nav className="sidebar-nav">
        {navItems
          .filter((section) => {
            if (isAdminRoute) return section.section === 'Admin';
            return section.section === 'Lecturer' || section.section === 'Settings';
          })
          .map((section) => (
            <div key={section.section} className="sidebar-nav-section">
              <div className="nav-section-label">{section.section}</div>
              {section.links.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === '/admin'}
                    className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                  >
                    <span className="sidebar-link-icon">
                      <Icon weight="duotone" size={20} />
                    </span>
                    {link.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-signout" onClick={handleSignOut}>
          <span className="sidebar-link-icon">
            <SignOut weight="duotone" size={18} />
          </span>
          Sign Out
        </button>
      </div>
    </aside>
  );
});
