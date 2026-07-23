import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { Eye, EyeSlash } from '@phosphor-icons/react';

export default function LecturerLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/api/auth/login', form);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      if (res.data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/lecturer/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-split">
      <div className="login-brand-panel">
        <div className="login-brand-content">
          <div className="login-brand-logo">CP</div>
          <h1 className="login-brand-title">ClassPulse</h1>
          <p className="login-brand-subtitle">Smart Attendance Management</p>
          <div className="login-brand-features">
            <div className="login-brand-feature">
              <span className="login-brand-feature-icon">&#10003;</span>
              <span>Real-time attendance tracking</span>
            </div>
            <div className="login-brand-feature">
              <span className="login-brand-feature-icon">&#10003;</span>
              <span>GPS & Rolling Pin</span>
            </div>
            <div className="login-brand-feature">
              <span className="login-brand-feature-icon">&#10003;</span>
              <span>Instant analytics dashboard</span>
            </div>
          </div>
        </div>
      </div>

      <div className="login-form-panel">
        <div className="login-card-new">
          <h2>Welcome back</h2>
          <p className="login-card-desc">Sign in to your account to continue</p>

          {error && <div className="message error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="login-password-wrapper">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeSlash weight="duotone" size={18} />
                  ) : (
                    <Eye weight="duotone" size={18} />
                  )}
                </button>
              </div>
            </div>
            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? (
                <span className="login-btn-loading">
                  <span className="login-spinner" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="login-card-footer">
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
