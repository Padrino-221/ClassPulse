import React from 'react';

export default function SummaryCards({ cards }) {
  return (
    <div className="metrics-grid">
      {cards.map((card, i) => (
        <div key={i} className="card metric-card">
          <div className="metric-card-icon">
            {card.icon}
          </div>
          <div className="metric-card-text">
            <div className="metric-value">{card.value}</div>
            <div className="metric-label">{card.label}</div>
          </div>
          {card.change != null && (
            <div className={`metric-change ${card.change > 0 ? 'up' : 'down'}`}>
              {card.change > 0 ? '+' : ''}{card.change}%
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
