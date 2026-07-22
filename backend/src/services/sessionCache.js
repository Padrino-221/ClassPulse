/**
 * In-memory active session cache.
 * Stores active session data for fast cache-first validation
 * (campus geofence + PIN) without hitting PostgreSQL on every student submission.
 */
class SessionCache {
  constructor() {
    this.sessions = new Map();
    this.matrixCache = new Map();
    this.campuses = new Map();
  }

  // ---- Campus Cache ----

  setCampus(campus) {
    this.campuses.set(campus.id, {
      id: campus.id,
      name: campus.name,
      latitude: parseFloat(campus.latitude),
      longitude: parseFloat(campus.longitude),
      radius: campus.radius || 400,
    });
  }

  getCampus(campusId) {
    return this.campuses.get(campusId) || null;
  }

  async loadCampuses(pool) {
    const res = await pool.query('SELECT id, name, latitude, longitude, radius FROM campuses');
    this.campuses.clear();
    for (const row of res.rows) {
      this.setCampus(row);
    }
    console.log(`SessionCache: loaded ${res.rows.length} campuses`);
  }

  // ---- Active Session Cache ----

  set(session) {
    const campus = session.campus_id ? this.campuses.get(session.campus_id) : null;
    this.sessions.set(session.session_id, {
      session_id: session.session_id,
      pin_seed: session.pin_seed,
      static_pin: session.static_pin || null,
      pin_spinning: session.pin_spinning !== false,
      // Lecturer coordinates (for display only, not geofence)
      latitude: parseFloat(session.latitude),
      longitude: parseFloat(session.longitude),
      radius_meters: session.radius_meters || 400,
      // Campus geofence (for attendance verification)
      campus_id: session.campus_id || null,
      campus_name: campus ? campus.name : null,
      campus_latitude: campus ? campus.latitude : null,
      campus_longitude: campus ? campus.longitude : null,
      campus_radius: campus ? campus.radius : null,
      course_code: session.course_code,
      class_id: session.class_id,
      week_number: session.week_number,
      is_active: session.is_active !== false,
      cachedAt: Date.now(),
    });
  }

  get(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  findActiveByPinAndCourse(pin, courseCode, validatePinFn) {
    for (const session of this.sessions.values()) {
      if (!session.is_active) continue;
      if (session.course_code !== courseCode) continue;
      if (session.static_pin) {
        if (pin === session.static_pin) return session;
      } else {
        if (validatePinFn(session.pin_seed, pin)) return session;
      }
    }
    return null;
  }

  markInactive(sessionId) {
    const s = this.sessions.get(sessionId);
    if (s) s.is_active = false;
  }

  async reloadFromDb(pool) {
    // Reload campuses first
    await this.loadCampuses(pool);

    const res = await pool.query(
      `SELECT session_id, pin_seed, pin_spinning, latitude, longitude, radius_meters,
              campus_id, course_code, class_id, week_number, is_active
       FROM active_sessions
       WHERE is_active = TRUE AND expires_at > NOW()`
    );
    this.sessions.clear();
    for (const row of res.rows) {
      if (row.pin_spinning === false) {
        const { getCurrentPin } = require('./pin');
        row.static_pin = getCurrentPin(row.pin_seed);
      }
      this.set(row);
    }
    console.log(`SessionCache: loaded ${res.rows.length} active sessions`);
  }

  // ---- Matrix Result Cache ----

  getMatrix(key) {
    return this.matrixCache.get(key) || null;
  }

  setMatrix(key, data) {
    this.matrixCache.set(key, data);
  }

  invalidateMatricesForCourse(courseCode, classId) {
    const key = `${courseCode}:${classId}`;
    this.matrixCache.delete(key);
  }

}

module.exports = new SessionCache();
