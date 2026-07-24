import React from 'react';

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    textAlign: 'center',
  },
  iconWrap: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: '#f5f5f7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
    fontSize: '32px',
    color: '#b0b0bc',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#4a4a5a',
    marginBottom: '8px',
  },
  description: {
    fontSize: '14px',
    color: '#9a9aa8',
    maxWidth: '320px',
    lineHeight: 1.5,
  },
};

export default function EmptyState({ icon, title, description, className = '' }) {
  return (
    <div className={className} style={styles.wrapper}>
      {icon && <div style={styles.iconWrap}>{icon}</div>}
      {title && <div style={styles.title}>{title}</div>}
      {description && <div style={styles.description}>{description}</div>}
    </div>
  );
}
