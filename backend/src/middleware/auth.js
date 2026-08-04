const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

function verifyToken(requiredRole = null) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = header.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;

      if (requiredRole && req.user.role !== requiredRole) {
        return res.status(403).json({ error: "You don't have permission to do this." });
      }

      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
  };
}

// Scope enforcement middleware for admin routes.
// Ensures the admin can only access data within their scope.
function verifyScope() {
  return (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { admin_level, university_id, school_id, department_id } = req.user;

    if (!admin_level || !['university', 'school', 'department'].includes(admin_level)) {
      return res.status(403).json({ error: 'Invalid admin scope.' });
    }

    // Validate scope completeness per admin level
    if (admin_level === 'university' && !university_id) {
      return res.status(403).json({ error: 'Admin not assigned to a university.' });
    }
    if (admin_level === 'school' && !school_id) {
      return res.status(403).json({ error: 'School admin not assigned to a school.' });
    }
    if (admin_level === 'department' && !department_id) {
      return res.status(403).json({ error: 'Department admin not assigned to a department.' });
    }

    // Attach scope info to request for downstream use
    req.scope = {
      level: admin_level,
      university_id: university_id || null,
      school_id: school_id || null,
      department_id: department_id || null,
    };

    next();
  };
}

module.exports = { verifyToken, verifyScope };
