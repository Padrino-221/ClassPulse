import React, { useMemo } from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, role }) {
  const auth = useMemo(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) return { valid: false };
    try {
      const user = JSON.parse(userStr);
      if (role && user.role !== role) return { valid: false };
      return { valid: true, token, user };
    } catch {
      return { valid: false };
    }
  }, [role]);

  if (!auth.valid) {
    return <Navigate to="/lecturer/login" replace />;
  }

  return children;
}
