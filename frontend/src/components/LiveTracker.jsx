import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';

export default function LiveTracker({ sessionId }) {
  const [records, setRecords] = useState([]);
  const [count, setCount] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await api.get(`/api/lecturer/session/${sessionId}/live`);
        setRecords(res.data.records);
        setCount(res.data.count);
      } catch {
        // Silently ignore polling errors
      }
    };

    fetchLive();
    intervalRef.current = setInterval(fetchLive, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionId]);

  return (
    <div className="live-tracker">
      <h4>Live ({count} students)</h4>
      <div className="table-container">
        <table className="matrix-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Index Number</th>
              <th>Name</th>
              <th>Method</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={5}>No students marked yet.</td>
              </tr>
            )}
            {records.map((r, i) => (
              <tr key={r.record_id}>
                <td>{i + 1}</td>
                <td>{r.index_number}</td>
                <td>{r.student_name}</td>
                <td>
                  <span className={`badge badge-${r.verification_method === 'GPS' ? 'success' : 'warning'}`}>
                    {r.verification_method}
                  </span>
                </td>
                <td>{new Date(r.timestamp).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
