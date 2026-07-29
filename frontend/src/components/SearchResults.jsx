import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, UserCheck, BookOpen, Users, MapPin, Clock, Pulse } from '@phosphor-icons/react';

const typeConfig = {
  student: { icon: GraduationCap, color: '#7C3AED' },
  lecturer: { icon: UserCheck, color: '#2563EB' },
  course: { icon: BookOpen, color: '#059669' },
  class: { icon: Users, color: '#D97706' },
  lecture_hall: { icon: MapPin, color: '#DC2626' },
  session: { icon: Pulse, color: '#DC2626' },
};

const groupOrder = ['student', 'lecturer', 'course', 'class', 'lecture_hall', 'session'];

const groupLabels = {
  student: 'Students',
  lecturer: 'Lecturers',
  course: 'Courses',
  class: 'Classes',
  lecture_hall: 'Lecture Halls',
  session: 'Sessions',
};

export default function SearchResults({ results, loading, query, onClose }) {
  const navigate = useNavigate();

  if (!query || query.length < 2) return null;

  const grouped = {};
  for (const r of results) {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  }

  const hasResults = results.length > 0;
  const groups = groupOrder.filter((t) => grouped[t]);

  const handleSelect = (route) => {
    navigate(route);
    onClose();
  };

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 8px)',
      left: 0,
      right: 0,
      background: 'var(--bg-card, #ffffff)',
      border: '1px solid var(--border-light, #e0e0e0)',
      borderRadius: 12,
      boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
      zIndex: 200,
      maxHeight: 400,
      overflowY: 'auto',
      padding: '0.375rem',
    }}>
      {loading ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted, #999)', fontSize: '0.8125rem' }}>
          Searching...
        </div>
      ) : !hasResults ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted, #999)', fontSize: '0.8125rem' }}>
          No results for "{query}"
        </div>
      ) : (
        groups.map((type) => {
          const Icon = typeConfig[type]?.icon || BookOpen;
          const color = typeConfig[type]?.color || '#666';
          return (
            <div key={type}>
              <div style={{
                padding: '0.5rem 0.75rem 0.25rem',
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted, #999)',
              }}>
                {groupLabels[type]}
              </div>
              {grouped[type].map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(r.route)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: 'none',
                    background: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #f5f5f5)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: `${color}18`,
                    color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon weight="duotone" size={14} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--text-primary, #1a1a1a)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {r.label}
                    </span>
                    {r.sub && (
                      <span style={{
                        display: 'block',
                        fontSize: '0.6875rem',
                        color: 'var(--text-muted, #999)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {r.sub}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
