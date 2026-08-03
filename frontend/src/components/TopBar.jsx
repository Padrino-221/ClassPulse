import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useSearch } from '../context/SearchContext';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass, Moon, Sun, CaretDown, SignOut, User } from '@phosphor-icons/react';
import api, { getStoredUser, clearStoredAuth } from '../utils/api';
import SearchResults from './SearchResults';

function getUser() {
  return getStoredUser();
}

const styles = {
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.875rem 1.5rem',
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
    gap: '0.0625rem',
    minWidth: 0,
    flexShrink: 0,
  },
  greeting: {
    fontSize: '1.125rem',
    fontWeight: 800,
    color: 'var(--text-primary, #1a1a1a)',
    lineHeight: 1.2,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  date: {
    fontSize: '0.75rem',
    color: 'var(--text-muted, #999)',
    fontWeight: 500,
    margin: 0,
  },
  center: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    maxWidth: 400,
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
    border: '1px solid var(--border-light, #e0e0e0)',
    borderRadius: 6,
    fontSize: '0.8125rem',
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
    gap: '0.625rem',
    flexShrink: 0,
  },
  themeBtn: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    border: '1px solid var(--border-light, #e0e0e0)',
    background: 'var(--bg-card, #ffffff)',
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
    padding: '0.375rem 0.875rem 0.375rem 0.375rem',
    borderRadius: 6,
    border: '1px solid var(--border-light, #e0e0e0)',
    background: 'var(--bg-card, #ffffff)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    position: 'relative',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'var(--brand, #DC2626)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'left',
    lineHeight: 1.2,
  },
  profileName: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: 'var(--text-primary, #1a1a1a)',
    margin: 0,
  },
  profileRole: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted, #999)',
    textTransform: 'capitalize',
    margin: 0,
    fontWeight: 500,
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
    border: '1px solid var(--border-light, #f0f0f0)',
    borderRadius: 16,
    padding: '0.375rem',
    zIndex: 100,
    overflow: 'hidden',
  },
  dropdownEmail: {
    padding: '0.625rem 0.75rem',
    fontSize: '0.75rem',
    color: 'var(--text-muted, #999)',
    borderBottom: '1px solid var(--border-light, #f0f0f0)',
    marginBottom: '0.25rem',
    wordBreak: 'break-all',
    fontWeight: 500,
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
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    fontWeight: 500,
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
  const searchRef = useRef(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const debounceRef = useRef(null);

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

  useEffect(() => {
    function handleClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchSearch = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    setSearchLoading(true);
    setSearchOpen(true);
    try {
      const res = await api.get('/api/search', { params: { q } });
      setSearchResults(res.data.results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSearch(val), 300);
  };

  const handleSearchClose = () => {
    setSearchOpen(false);
    setSearchResults([]);
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : '??';

  const handleLogout = () => {
    clearStoredAuth();
    navigate('/lecturer/login');
  };

  return (
    <header style={styles.topbar}>
      <div style={styles.left}>
        <p style={styles.greeting}>{user?.institution_name || 'ClassPulse'}</p>
        <p style={styles.date}>{formatDate()}</p>
      </div>

      <div style={styles.center} ref={searchRef}>
        <div style={styles.searchBox}>
          <span style={styles.searchIcon}>
            <MagnifyingGlass weight="duotone" size={18} />
          </span>
          <input
            type="text"
            placeholder="Search students, courses..."
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => { if (searchQuery.length >= 2) setSearchOpen(true); }}
            style={styles.searchInput}
          />
          {searchQuery && (
            <button
              aria-label="Clear search"
              style={styles.clearBtn}
              onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchOpen(false); }}
              className="topbar-clear-btn"
            >
              &times;
            </button>
          )}
          {searchOpen && (
            <SearchResults
              results={searchResults}
              loading={searchLoading}
              query={searchQuery}
              onClose={handleSearchClose}
            />
          )}
        </div>
      </div>

      <div style={styles.right}>
        <button
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          style={styles.themeBtn}
          onClick={toggleTheme}
          className="topbar-theme-btn"
        >
          {theme === 'light' ? <Moon weight="duotone" size={20} /> : <Sun weight="duotone" size={20} />}
        </button>

        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            aria-label="User menu"
            style={styles.profileBtn}
            onClick={() => setMenuOpen(!menuOpen)}
            className="topbar-profile-btn"
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
                  className="dropdown-item"
                  style={styles.dropdownItem}
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(user?.role === 'admin' ? '/admin/profile' : '/lecturer/profile');
                  }}
                >
                  <User weight="duotone" size={16} />
                  Profile
                </button>
                <button
                  className="dropdown-item dropdown-item-danger"
                  style={{ ...styles.dropdownItem, ...styles.dangerItem }}
                  onClick={handleLogout}
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
