/**
 * In-memory active session cache.
 * Stores active session data for fast cache-first validation
 * (lecture hall geofence + PIN) without hitting PostgreSQL on every student submission.
 *
 * Uses atomic swap on reload — builds new Maps then swaps pointers,
 * so findActiveByPinAndCourse() never sees a partially-cleared cache.
 */
const { getCurrentPin, staticPinFromSeed } = require('./pin');

const MAX_MATRIX_CACHE_SIZE = 500;
const MATRIX_CACHE_TTL_MS = 10000;

class SessionCache {
  constructor() {
    this.sessions = new Map();
    this.byCourse = new Map();
    // Static-PIN fast-path index: `${courseCode}:${staticPin}` -> session entry.
    // Keys match the course code + numeric PIN a student submits, giving O(1)
    // lookups for non-spinning sessions (spinning sessions fall back to the
    // course-scoped linear scan).
    this.byStaticPin = new Map();
    // Memoized rolling (spinning) PIN per session, keyed by the 60s time step
    // so /sessions stops recomputing HMAC-SHA1 for the same window.
    this.spinPinCache = new Map();
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

  _buildEntry(session) {
    const lectureHall = session.lecture_hall_id ? this.lectureHalls.get(session.lecture_hall_id) : null;
    const isSpinning = session.pin_spinning !== false;
    // Derive the static PIN for non-spinning sessions even when the caller
    // didn't supply it, so the static-PIN index is always populated and the
    // O(1) lookup / validation works regardless of the code path that set it.
    const staticPin = isSpinning
      ? null
      : (session.static_pin || (session.pin_seed ? staticPinFromSeed(session.pin_seed) : null));
    return {
      session_id: session.session_id,
      pin_seed: session.pin_seed,
      static_pin: staticPin,
      pin_spinning: isSpinning,
      current_pin: staticPin,
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
  }

  set(session) {
    const entry = this._buildEntry(session);
    this.sessions.set(session.session_id, entry);
    if (!this.byCourse.has(session.course_code)) {
      this.byCourse.set(session.course_code, new Set());
    }
    this.byCourse.get(session.course_code).add(session.session_id);
    if (entry.static_pin) {
      this.byStaticPin.set(`${entry.course_code}:${entry.static_pin}`, entry);
    }
  }

  get(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.expires_at && Date.now() > session.expires_at) {
      session.is_active = false;
      return null;
    }
    return session;
  }

  findActiveByPinAndCourse(pin, courseCode, validatePinFn) {
    // O(1) fast path for static (non-spinning) sessions: the submitted numeric
    // PIN for those is time-independent, so an exact index lookup suffices.
    if (courseCode) {
      const staticEntry = this.byStaticPin.get(`${courseCode}:${pin}`);
      if (
        staticEntry &&
        staticEntry.is_active &&
        !(staticEntry.expires_at && Date.now() > staticEntry.expires_at)
      ) {
        return staticEntry;
      }
    }

    const ids = this.byCourse.get(courseCode);
    if (!ids) return null;
    const now = Date.now();
    const expired = [];
    for (const id of ids) {
      const session = this.sessions.get(id);
      if (!session || !session.is_active) continue;
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
      if (s.static_pin) this.byStaticPin.delete(`${s.course_code}:${s.static_pin}`);
      this.spinPinCache.delete(sessionId);
    }
  }

  async reloadFromDb(pool) {
    await this.loadLectureHalls(pool);
    await this.loadActiveSemester(pool);
    await this.reloadSessionsOnly(pool);
  }

  async reloadSessionsOnly(pool) {
    const res = await pool.query(
      `SELECT s.session_id, s.pin_seed, s.pin_spinning,
              s.lecture_hall_id, s.course_code, c.course_name, s.class_id, cl.class_name, s.week_number, s.is_active, s.expires_at
       FROM active_sessions s
       LEFT JOIN classes cl ON cl.class_id = s.class_id
       LEFT JOIN courses c ON c.id = s.course_id
       WHERE s.is_active = TRUE AND s.expires_at > NOW()`
    );

    // Build new maps atomically — no window where lookups fail
    const newSessions = new Map();
    const newByCourse = new Map();
    const newByStaticPin = new Map();
    for (const row of res.rows) {
      if (row.pin_spinning === false) {
        row.static_pin = staticPinFromSeed(row.pin_seed);
      }
      const entry = this._buildEntry(row);
      newSessions.set(row.session_id, entry);
      if (!newByCourse.has(row.course_code)) {
        newByCourse.set(row.course_code, new Set());
      }
      newByCourse.get(row.course_code).add(row.session_id);
      if (entry.static_pin) {
        newByStaticPin.set(`${entry.course_code}:${entry.static_pin}`, entry);
      }
    }

    // Atomic swap — single pointer assignment, no lookup gap
    this.sessions = newSessions;
    this.byCourse = newByCourse;
    this.byStaticPin = newByStaticPin;
    // Reset memoized rolling PINs — their seeds may have changed on reload
    this.spinPinCache.clear();
    console.log(`SessionCache: loaded ${res.rows.length} active sessions`);
  }

  /**
   * Memoized rolling (spinning) PIN for a session, valid for the current 60s
   * time step. Avoids recomputing HMAC-SHA1 on every request within a window.
   */
  getSpinPin(sessionId, pinSeed) {
    const step = Math.floor(Date.now() / 60000);
    const entry = this.spinPinCache.get(sessionId);
    if (entry && entry.step === step) return entry.pin;
    const pin = getCurrentPin(pinSeed);
    this.spinPinCache.set(sessionId, { step, pin });
    if (this.spinPinCache.size > 500) {
      const firstKey = this.spinPinCache.keys().next().value;
      this.spinPinCache.delete(firstKey);
    }
    return pin;
  }

  // ---- Matrix Result Cache ----

  getMatrix(key) {
    const entry = this.matrixCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > MATRIX_CACHE_TTL_MS) {
      this.matrixCache.delete(key);
      return null;
    }
    return entry.data;
  }

  setMatrix(key, data) {
    if (this.matrixCache.size >= MAX_MATRIX_CACHE_SIZE) {
      const firstKey = this.matrixCache.keys().next().value;
      this.matrixCache.delete(firstKey);
    }
    this.matrixCache.set(key, { data, ts: Date.now() });
  }

  invalidateMatricesForCourse() {
    // TTL-based expiry handles staleness automatically.
  }

  deactivate(sessionId) {
    const s = this.sessions.get(sessionId);
    if (s) {
      const ids = this.byCourse.get(s.course_code);
      if (ids) ids.delete(sessionId);
      if (s.static_pin) this.byStaticPin.delete(`${s.course_code}:${s.static_pin}`);
    }
    this.spinPinCache.delete(sessionId);
    this.sessions.delete(sessionId);
  }
}

module.exports = new SessionCache();
