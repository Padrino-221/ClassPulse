import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useSearch } from '../context/SearchContext';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass, Moon, Sun, CaretDown } from '@phosphor-icons/react';

export default function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const { searchQuery, setSearchQuery } = useSearch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : '??';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/lecturer/login');
  };

  return (
    <header className="topbar">
      <div className="search-box">
        <MagnifyingGlass className="search-icon" weight="duotone" size={16} />
        <input
          type="text"
          placeholder="Search students, courses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="search-clear" onClick={() => setSearchQuery('')}>
            &times;
          </button>
        )}
      </div>

      <div className="topbar-right">
        <button className="theme-toggle-btn" onClick={toggleTheme}
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
          {theme === 'light' ? (
            <Moon weight="duotone" size={18} />
          ) : (
            <Sun weight="duotone" size={18} />
          )}
        </button>

        <div className="profile-dropdown" ref={menuRef} onClick={() => setMenuOpen(!menuOpen)}>
          <div className="profile-avatar">{initials}</div>
          <div>
            <div className="profile-name">{user?.name || 'User'}</div>
            <div className="profile-role">{user?.role || ''}</div>
          </div>
          <CaretDown className="profile-chevron" weight="duotone" size={14} />

          {menuOpen && (
            <div className="dropdown-menu">
              <div className="dropdown-item" style={{ cursor: 'default' }}>
                {user?.email || ''}
              </div>
              <hr />
              <button className="dropdown-item" onClick={() => { setMenuOpen(false); navigate(user?.role === 'admin' ? '/admin/profile' : '/lecturer/profile'); }}>
                Profile
              </button>
              <button className="dropdown-item danger" onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
