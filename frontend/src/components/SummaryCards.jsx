import React from 'react';

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  card: {
    background: 'var(--bg-card, #ffffff)',
    borderRadius: 'var(--radius-lg, 8px)',
    padding: '1.25rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    boxShadow: 'none',
    border: '1px solid var(--border-light, #f0f0f0)',
    transition: 'all 0.2s ease',
  },
  iconCircle: {
    width: '52px',
    height: '52px',
    borderRadius: 'var(--radius-lg, 8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '22px',
  },
  text: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  value: {
    fontSize: '2rem',
    fontWeight: 800,
    color: 'var(--text-primary, #1a1a2e)',
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  label: {
    fontSize: '0.6875rem',
    color: 'var(--text-secondary, #8c8c9a)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  responsive: `
    @media (max-width: 1100px) {
      .summary-grid { grid-template-columns: repeat(2, 1fr) !important; }
    }
    @media (max-width: 600px) {
      .summary-grid { grid-template-columns: 1fr !important; }
    }
  `,
};

function injectResponsiveStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('summary-cards-responsive')) return;
  const tag = document.createElement('style');
  tag.id = 'summary-cards-responsive';
  tag.textContent = styles.responsive;
  document.head.appendChild(tag);
}

injectResponsiveStyles();

export default function SummaryCards({ cards }) {
  return (
    <div className="summary-grid" style={styles.grid}>
      {cards.map((card, i) => (
        <div key={i} style={styles.card}>
          <div
            style={{
              ...styles.iconCircle,
              background: card.bg || 'var(--kpi-icon-bg, #f0f4ff)',
              color: card.color || 'var(--brand, #4a6cf7)',
            }}
          >
            {card.icon}
          </div>
          <div style={styles.text}>
            <span style={styles.value}>{card.value}</span>
            <span style={styles.label}>{card.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
