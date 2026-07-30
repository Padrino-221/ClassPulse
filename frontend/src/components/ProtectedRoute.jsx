import React, { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { getStoredToken, getStoredUser } from '../utils/api';

export default function ProtectedRoute({ children, role }) {
  const auth = useMemo(() => {
    const token = getStoredToken();
    const user = getStoredUser();
    if (!token || !user) return { valid: false };
    if (role && user.role !== role) return { valid: false };
    return { valid: true, token, user };
  }, [role]);

  if (!auth.valid) {
    return <Navigate to="/lecturer/login" replace />;
  }

  return children;
}
