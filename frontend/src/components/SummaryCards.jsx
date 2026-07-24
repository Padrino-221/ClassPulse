import React from 'react';

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '20px',
    marginBottom: '28px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '22px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid #f0f0f0',
  },
  iconCircle: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '20px',
  },
  text: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  value: {
    fontSize: '26px',
    fontWeight: 700,
    color: '#1a1a2e',
    lineHeight: 1.2,
  },
  label: {
    fontSize: '13px',
    color: '#8c8c9a',
    fontWeight: 500,
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
              background: card.bg || '#f0f4ff',
              color: card.color || '#4a6cf7',
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
