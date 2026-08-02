/**
 * In-memory active session cache.
 * Stores active session data for fast cache-first validation
 * (lecture hall geofence + PIN) without hitting PostgreSQL on every student submission.
 */
const { getCurrentPin, staticPinFromSeed } = require('./pin');

const MAX_MATRIX_CACHE_SIZE = 500;

class SessionCache {
  constructor() {
    this.sessions = new Map();
    this.byCourse = new Map();
    this.matrixCache = new Map();
    this.lectureHalls = new Map();
    this.activeSemester = null;
  }

  // ---- Lecture Hall Cache ----

  setLectureHall(lectureHall) {
    this.lectureHalls.set(lectureHall.id, {
      id: lectureHall.id,
      name: lectureHall.name,
      latitude: parseFloat(lectureHall.latitude),
      longitude: parseFloat(lectureHall.longitude),
      radius: lectureHall.radius || 400,
    });
  }

  getLectureHall(lectureHallId) {
    return this.lectureHalls.get(parseInt(lectureHallId)) || null;
  }

  async loadLectureHalls(pool) {
    const res = await pool.query('SELECT id, name, latitude, longitude, radius FROM lecture_halls');
    this.lectureHalls.clear();
    for (const row of res.rows) {
      this.setLectureHall(row);
    }
    console.log(`SessionCache: loaded ${res.rows.length} lecture halls`);
  }

  async loadActiveSemester(pool) {
    const res = await pool.query(
      `SELECT s.*, ay.label AS year_label, ay.start_year, ay.end_year
       FROM semesters s
       JOIN academic_years ay ON ay.id = s.academic_year_id
       WHERE s.is_active = true
       LIMIT 1`
    );
    this.activeSemester = res.rows[0] || null;
    console.log(`SessionCache: active semester ${this.activeSemester ? this.activeSemester.label : 'none'}`);
  }

  // ---- Active Session Cache ----

  set(session) {
    const lectureHall = session.lecture_hall_id ? this.lectureHalls.get(session.lecture_hall_id) : null;
    const entry = {
      session_id: session.session_id,
      pin_seed: session.pin_seed,
      static_pin: session.static_pin || null,
      pin_spinning: session.pin_spinning !== false,
      lecture_hall_id: session.lecture_hall_id || null,
      lecture_hall_name: lectureHall ? lectureHall.name : null,
      lecture_hall_latitude: lectureHall ? lectureHall.latitude : null,
      lecture_hall_longitude: lectureHall ? lectureHall.longitude : null,
      lecture_hall_radius: lectureHall ? lectureHall.radius : null,
      course_code: session.course_code,
      course_name: session.course_name || null,
      class_id: session.class_id,
      class_name: session.class_name || null,
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
    await this.loadLectureHalls(pool);
    await this.loadActiveSemester(pool);

    const res = await pool.query(
      `SELECT s.session_id, s.pin_seed, s.pin_spinning,
              s.lecture_hall_id, s.course_code, c.course_name, s.class_id, cl.class_name, s.week_number, s.is_active, s.expires_at
       FROM active_sessions s
       LEFT JOIN classes cl ON cl.class_id = s.class_id
       LEFT JOIN courses c ON c.id = s.course_id
       WHERE s.is_active = TRUE AND s.expires_at > NOW()`
    );
    this.sessions.clear();
    this.byCourse.clear();
    for (const row of res.rows) {
      if (row.pin_spinning === false) {
        row.static_pin = staticPinFromSeed(row.pin_seed);
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

  deactivate(sessionId) {
    const s = this.sessions.get(sessionId);
    if (s) {
      const ids = this.byCourse.get(s.course_code);
      if (ids) ids.delete(sessionId);
    }
    this.sessions.delete(sessionId);
  }

}

module.exports = new SessionCache();
