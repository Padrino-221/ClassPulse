import React, { useState, useEffect, useRef } from 'react';
import { UserCheck } from '@phosphor-icons/react';
import api from '../utils/api';
import Pagination from './Pagination';

const PAGE_SIZE = 15;

export default function LiveTracker({ sessionId }) {
  const [records, setRecords] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
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

  const totalPages = Math.ceil(records.length / PAGE_SIZE);
  const startIdx = (page - 1) * PAGE_SIZE;
  const pageRecords = records.slice(startIdx, startIdx + PAGE_SIZE);

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
            {pageRecords.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="entity-empty" style={{ padding: '2rem 1rem' }}>
                    <div className="entity-empty-icon">
                      <UserCheck weight="duotone" size={40} />
                    </div>
                    <div className="entity-empty-title">No check-ins yet</div>
                    <div className="entity-empty-desc">Students will appear here as they check in.</div>
                  </div>
                </td>
              </tr>
            )}
            {pageRecords.map((r, i) => (
              <tr key={r.record_id}>
                <td>{startIdx + i + 1}</td>
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
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
