import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, role }) {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    return <Navigate to="/lecturer/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);
    if (role && user.role !== role) {
      return <Navigate to="/lecturer/login" replace />;
    }
  } catch {
    return <Navigate to="/lecturer/login" replace />;
  }

  return children;
}
