/**
 * In-memory active session cache.
 * Stores active session data for fast cache-first validation
 * (building geofence + PIN) without hitting PostgreSQL on every student submission.
 */
const { getCurrentPin } = require('./pin');

const MAX_MATRIX_CACHE_SIZE = 500;

class SessionCache {
  constructor() {
    this.sessions = new Map();
    this.byCourse = new Map();
    this.matrixCache = new Map();
    this.buildings = new Map();
  }

  // ---- Building Cache ----

  setBuilding(building) {
    this.buildings.set(building.id, {
      id: building.id,
      name: building.name,
      latitude: parseFloat(building.latitude),
      longitude: parseFloat(building.longitude),
      radius: building.radius || 400,
    });
  }

  getBuilding(buildingId) {
    return this.buildings.get(buildingId) || null;
  }

  async loadBuildings(pool) {
    const res = await pool.query('SELECT id, name, latitude, longitude, radius FROM buildings');
    this.buildings.clear();
    for (const row of res.rows) {
      this.setBuilding(row);
    }
    console.log(`SessionCache: loaded ${res.rows.length} buildings`);
  }

  // ---- Active Session Cache ----

  set(session) {
    const building = session.building_id ? this.buildings.get(session.building_id) : null;
    const entry = {
      session_id: session.session_id,
      pin_seed: session.pin_seed,
      static_pin: session.static_pin || null,
      pin_spinning: session.pin_spinning !== false,
      latitude: parseFloat(session.latitude),
      longitude: parseFloat(session.longitude),
      radius_meters: session.radius_meters || 400,
      building_id: session.building_id || null,
      building_name: building ? building.name : null,
      building_latitude: building ? building.latitude : null,
      building_longitude: building ? building.longitude : null,
      building_radius: building ? building.radius : null,
      course_code: session.course_code,
      class_id: session.class_id,
      week_number: session.week_number,
      is_active: session.is_active !== false,
      expires_at: session.expires_at ? new Date(session.expires_at).getTime() : null,
      cachedAt: Date.now(),
    };
    this.sessions.set(session.session_id, entry);
    if (!this.byCourse.has(session.course_code)) {
      this.byCourse.set(session.course_code, new Set());
    }
    this.byCourse.get(session.course_code).add(session.session_id);
  }

  get(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    // Check if session has expired since last cache refresh
    if (session.expires_at && Date.now() > session.expires_at) {
      session.is_active = false;
      return null;
    }
    return session;
  }

  findActiveByPinAndCourse(pin, courseCode, validatePinFn) {
    const ids = this.byCourse.get(courseCode);
    if (!ids) return null;
    const now = Date.now();
    const expired = [];
    for (const id of ids) {
      const session = this.sessions.get(id);
      if (!session || !session.is_active) continue;
      // Skip if session has expired in the DB since last cache refresh
      if (session.expires_at && now > session.expires_at) {
        session.is_active = false;
        expired.push(id);
        continue;
      }
      if (session.static_pin) {
        if (pin === session.static_pin) return session;
      } else {
        if (validatePinFn(session.pin_seed, pin)) return session;
      }
    }
    // Clean up expired session references after iteration
    for (const id of expired) {
      ids.delete(id);
    }
    return null;
  }

  markInactive(sessionId) {
    const s = this.sessions.get(sessionId);
    if (s) {
      s.is_active = false;
      const ids = this.byCourse.get(s.course_code);
      if (ids) ids.delete(sessionId);
    }
  }

  async reloadFromDb(pool) {
    await this.loadBuildings(pool);

    const res = await pool.query(
      `SELECT session_id, pin_seed, pin_spinning, latitude, longitude, radius_meters,
              building_id, course_code, class_id, week_number, is_active, expires_at
       FROM active_sessions
       WHERE is_active = TRUE AND expires_at > NOW()`
    );
    this.sessions.clear();
    this.byCourse.clear();
    for (const row of res.rows) {
      if (row.pin_spinning === false) {
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
    // Evict oldest entries if cache is full
    if (this.matrixCache.size >= MAX_MATRIX_CACHE_SIZE) {
      const firstKey = this.matrixCache.keys().next().value;
      this.matrixCache.delete(firstKey);
    }
    this.matrixCache.set(key, data);
  }

  invalidateMatricesForCourse(courseCode, classId) {
    const key = `${courseCode}:${classId}`;
    this.matrixCache.delete(key);
  }

}

module.exports = new SessionCache();
