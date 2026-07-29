import React, { useState, useEffect } from 'react';
import Pagination from './Pagination';

const PAGE_SIZE = 15;

function CellIcon({ status }) {
  if (status === 'present') return <span className="cell-present">&#10003;</span>;
  if (status === 'absent') return <span className="cell-absent">&#10007;</span>;
  return <span className="cell-future">&mdash;</span>;
}

export default function AttendanceMatrix({ data }) {
  const { students, weeks, matrix, percentages, at_risk, min_attendance_pct } = data;
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [students]);

  const totalPages = Math.ceil(students.length / PAGE_SIZE);
  const startIdx = (page - 1) * PAGE_SIZE;
  const pageStudents = students.slice(startIdx, startIdx + PAGE_SIZE);

  return (
    <div>
      <div className="table-container matrix-wrapper">
        <table className="matrix-table">
          <thead>
            <tr>
              <th className="sticky-col">Student</th>
              <th className="sticky-col">Index No.</th>
              {weeks.map((w) => (
                <th key={w} className="week-col">W{w}</th>
              ))}
              <th className="pct-col">%</th>
              {at_risk && <th style={{ width: '3rem' }} title={`Min ${min_attendance_pct || 70}%`}>&#9888;</th>}
            </tr>
          </thead>
          <tbody>
            {pageStudents.map((student) => {
              const pct = percentages[student.id] || 0;
              const isAtRisk = at_risk?.[student.id];
              return (
                <tr key={student.id} className={isAtRisk ? 'at-risk-row' : ''}>
                  <td className="sticky-col">{student.student_name}</td>
                  <td className="sticky-col">{student.index_number}</td>
                  {weeks.map((week) => (
                    <td key={week} className="week-col">
                      <CellIcon status={matrix[student.id]?.[week] || 'future'} />
                    </td>
                  ))}
                  <td className={`pct-col${isAtRisk ? ' at-risk-pct' : ''}`}>{pct}%</td>
                  {at_risk && (
                    <td className={`at-risk-icon${isAtRisk ? ' at-risk-active' : ''}`}>
                      {isAtRisk ? <span title={`${pct}% < ${min_attendance_pct || 70}% required`}>&#9888;</span> : '--'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}
