const { pool } = require('../config/db');

// Middleware factory: logs an audit entry after the response finishes.
// Usage: router.post('/courses', auditLog('create', 'course'), handler)
function auditLog(action, entityType) {
  return (req, res, next) => {
    // Capture the original json method to intercept the response
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      // Only log successful mutations (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entityId = req.params.id || req.params.code || body?.id || body?.session_id || null;
        const details = {
          method: req.method,
          path: req.originalUrl,
          body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
          response: body?.message || body?.error || undefined,
        };
        // Fire-and-forget: don't block the response
        pool.query(
          `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, details, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            req.user?.id || null,
            action,
            entityType,
            entityId ? String(entityId) : null,
            JSON.stringify(details),
            req.ip,
          ]
        ).catch((err) => {
          console.error('Audit log error:', err.message);
        });
      }
      return originalJson(body);
    };
    next();
  };
}

// Remove sensitive fields from audit body
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const sanitized = { ...body };
  delete sanitized.password;
  delete sanitized.password_hash;
  delete sanitized.token;
  return sanitized;
}

module.exports = { auditLog };
