import React, { useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import ClassPulseLogo from './ClassPulseLogo';
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
  Wrench,
  CalendarBlank,
  Buildings,
  TreeEvergreen,
  ShieldCheck,

} from '@phosphor-icons/react';

const navItems = [
  {
    section: 'Lecturer',
    links: [
      { to: '/lecturer/dashboard', label: 'Dashboard', icon: House },
      { to: '/lecturer/live-session', label: 'Live Session', icon: Pulse },
      { to: '/lecturer/history', label: 'History', icon: Clock },
    ],
  },
  {
    section: 'Admin',
    links: [
      { to: '/admin', label: 'Dashboard', icon: House },
      { to: '/admin/schools', label: 'Schools', icon: Buildings, minLevel: 'university' },
      { to: '/admin/departments', label: 'Departments', icon: TreeEvergreen, minLevel: 'school' },
      { to: '/admin/courses', label: 'Courses', icon: BookOpen, maxLevel: 'school' },
      { to: '/admin/classes', label: 'Classes', icon: Users, maxLevel: 'school' },
      { to: '/admin/lecturers', label: 'Lecturers', icon: UserCheck, maxLevel: 'school' },
      { to: '/admin/students', label: 'Students', icon: GraduationCap, maxLevel: 'school' },
      { to: '/admin/lecture-halls', label: 'Lecture Halls', icon: MapPin, minLevel: 'university' },
      { to: '/admin/academic-terms', label: 'Academic Terms', icon: CalendarBlank, minLevel: 'university' },
      { to: '/admin/reports', label: 'Reports', icon: ChartBar },
      { to: '/admin/tools', label: 'Tools', icon: Wrench },
    ],
  },
];

const levelOrder = { university: 3, school: 2, department: 1 };

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
  const adminLevel = user?.admin_level || 'university';

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/lecturer/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <ClassPulseLogo size={38} />
        <span className="sidebar-brand-text">ClassPulse</span>
      </div>

      <nav className="sidebar-nav">
        {navItems
          .filter((section) => {
            if (isAdminRoute) {
              if (section.section === 'System') return adminLevel === 'university';
              return section.section === 'Admin';
            }
            return section.section === 'Lecturer' || section.section === 'Settings';
          })
          .map((section) => (
            <div key={section.section} className="sidebar-nav-section">
              <div className="nav-section-label">
                {isAdminRoute && user?.role === 'admin' && section.section === 'Admin'
                  ? `${adminLevel} Admin`
                  : section.section}
              </div>
              {section.links
                .filter((link) => {
                  if (link.minLevel && levelOrder[adminLevel] < levelOrder[link.minLevel]) return false;
                  if (link.maxLevel && levelOrder[adminLevel] > levelOrder[link.maxLevel]) return false;
                  return true;
                })
                .map((link) => {
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
