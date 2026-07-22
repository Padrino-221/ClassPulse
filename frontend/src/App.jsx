import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Attend from './pages/Attend';
import LecturerLogin from './pages/LecturerLogin';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import LecturerDashboard from './pages/LecturerDashboard';
import LecturerHistory from './pages/LecturerHistory';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/attend" element={<Attend />} />
      <Route path="/lecturer/login" element={<LecturerLogin />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/lecturer/dashboard"
        element={
          <ProtectedRoute role="lecturer">
            <LecturerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lecturer/history"
        element={
          <ProtectedRoute role="lecturer">
            <LecturerHistory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lecturer/profile"
        element={
          <ProtectedRoute role="lecturer">
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/profile"
        element={
          <ProtectedRoute role="admin">
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/attend" replace />} />
      <Route path="*" element={<Navigate to="/attend" replace />} />
    </Routes>
  );
}
