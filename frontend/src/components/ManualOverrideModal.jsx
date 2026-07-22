import React, { useState } from 'react';
import api from '../utils/api';

export default function ManualOverrideModal({ sessionId, onClose, onSuccess }) {
  const [form, setForm] = useState({ index_number: '', student_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/api/attendance/manual', {
        session_id: sessionId,
        index_number: form.index_number,
        student_name: form.student_name,
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't mark student.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Add Student Manually</h3>
        <p className="modal-desc">Bypass GPS for students without devices.</p>

        {error && <div className="message error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Index Number</label>
            <input
              name="index_number"
              value={form.index_number}
              onChange={handleChange}
              placeholder="e.g. CS2024001"
              required
            />
          </div>
          <div className="form-group">
            <label>Student Name</label>
            <input
              name="student_name"
              value={form.student_name}
              onChange={handleChange}
              placeholder="Full name"
              required
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Marking...' : 'Mark'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
