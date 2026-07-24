import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useSearch } from '../context/SearchContext';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass, Moon, Sun, CaretDown, SignOut, User } from '@phosphor-icons/react';

function getUser() {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
}

const styles = {
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 2rem',
    background: 'var(--bg-card, #ffffff)',
    borderBottom: '1px solid var(--border-light, #f0f0f0)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
    transition: 'background 0.2s',
  },
  left: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    minWidth: 0,
    flexShrink: 0,
  },
  greeting: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: 'var(--text-primary, #1a1a1a)',
    lineHeight: 1.3,
    margin: 0,
  },
  date: {
    fontSize: '0.8125rem',
    color: 'var(--text-muted, #999)',
    fontWeight: 400,
    margin: 0,
  },
  center: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    maxWidth: 480,
    margin: '0 2rem',
  },
  searchBox: {
    width: '100%',
    position: 'relative',
  },
  searchInput: {
    width: '100%',
    padding: '0.625rem 1rem 0.625rem 2.75rem',
    background: 'var(--bg-global, #f5f5f5)',
    border: '1px solid transparent',
    borderRadius: 9999,
    fontSize: '0.875rem',
    color: 'var(--text-primary, #1a1a1a)',
    outline: 'none',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  },
  searchIcon: {
    position: 'absolute',
    left: '1rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted, #999)',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  clearBtn: {
    position: 'absolute',
    right: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'var(--border-light, #e0e0e0)',
    border: 'none',
    borderRadius: '50%',
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--text-muted, #999)',
    fontSize: '0.75rem',
    lineHeight: 1,
    padding: 0,
    transition: 'background 0.15s',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexShrink: 0,
  },
  themeBtn: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary, #666)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
  },
  profileBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '0.375rem 0.75rem 0.375rem 0.375rem',
    borderRadius: 9999,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'background 0.15s',
    position: 'relative',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'var(--brand, #6366f1)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8125rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'left',
    lineHeight: 1.3,
  },
  profileName: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--text-primary, #1a1a1a)',
    margin: 0,
  },
  profileRole: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted, #999)',
    textTransform: 'capitalize',
    margin: 0,
  },
  chevron: {
    color: 'var(--text-muted, #999)',
    transition: 'transform 0.2s',
    flexShrink: 0,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 90,
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    minWidth: 200,
    background: 'var(--bg-card, #ffffff)',
    border: 'none',
    borderRadius: 12,
    boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
    padding: '0.375rem',
    zIndex: 100,
    overflow: 'hidden',
  },
  dropdownEmail: {
    padding: '0.625rem 0.75rem',
    fontSize: '0.8125rem',
    color: 'var(--text-muted, #999)',
    borderBottom: '1px solid var(--border-light, #f0f0f0)',
    marginBottom: '0.25rem',
    wordBreak: 'break-all',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.5rem 0.75rem',
    border: 'none',
    background: 'none',
    color: 'var(--text-primary, #1a1a1a)',
    fontSize: '0.8125rem',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'background 0.1s',
  },
  dangerItem: {
    color: 'var(--error, #ef4444)',
  },
};

function formatDate() {
  const d = new Date();
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default React.memo(function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const { searchQuery, setSearchQuery } = useSearch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const user = useMemo(getUser, []);

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
    <header style={styles.topbar}>
      <div style={styles.left}>
        <p style={styles.greeting}>Hey, {user?.name?.split(' ')[0] || 'User'}</p>
        <p style={styles.date}>{formatDate()}</p>
      </div>

      <div style={styles.center}>
        <div style={styles.searchBox}>
          <span style={styles.searchIcon}>
            <MagnifyingGlass weight="duotone" size={18} />
          </span>
          <input
            type="text"
            placeholder="Search students, courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--brand, #6366f1)';
              e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'transparent';
              e.target.style.boxShadow = 'none';
            }}
          />
          {searchQuery && (
            <button
              style={styles.clearBtn}
              onClick={() => setSearchQuery('')}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--text-muted, #999)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--border-light, #e0e0e0)'; e.currentTarget.style.color = 'var(--text-muted, #999)'; }}
            >
              &times;
            </button>
          )}
        </div>
      </div>

      <div style={styles.right}>
        <button
          style={styles.themeBtn}
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #f0f0f0)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {theme === 'light' ? <Moon weight="duotone" size={20} /> : <Sun weight="duotone" size={20} />}
        </button>

        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            style={styles.profileBtn}
            onClick={() => setMenuOpen(!menuOpen)}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #f0f0f0)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={styles.avatar}>{initials}</div>
            <div style={styles.profileInfo}>
              <p style={styles.profileName}>{user?.name || 'User'}</p>
              <p style={styles.profileRole}>{user?.role || ''}</p>
            </div>
            <CaretDown
              weight="duotone"
              size={14}
              style={{
                ...styles.chevron,
                transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          {menuOpen && (
            <>
              <div style={styles.overlay} onClick={() => setMenuOpen(false)} />
              <div style={styles.dropdown}>
                <div style={styles.dropdownEmail}>{user?.email || ''}</div>
                <button
                  style={styles.dropdownItem}
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(user?.role === 'admin' ? '/admin/profile' : '/lecturer/profile');
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #f0f0f0)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  <User weight="duotone" size={16} />
                  Profile
                </button>
                <button
                  style={{ ...styles.dropdownItem, ...styles.dangerItem }}
                  onClick={handleLogout}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #f0f0f0)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  <SignOut weight="duotone" size={16} />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
});
