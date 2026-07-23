import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

const Attend = React.lazy(() => import('./pages/Attend'));
const LecturerLogin = React.lazy(() => import('./pages/LecturerLogin'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const LecturerDashboard = React.lazy(() => import('./pages/LecturerDashboard'));
const LecturerHistory = React.lazy(() => import('./pages/LecturerHistory'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const Profile = React.lazy(() => import('./pages/Profile'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div className="sidebar-brand-icon" style={{ width: 48, height: 48, fontSize: 20, animation: 'pulse 1.5s infinite' }}>C</div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
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
    </Suspense>
  );
}
