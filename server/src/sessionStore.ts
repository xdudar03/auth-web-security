import session from "express-session";
import { db } from "./database.ts";

type SessionRow = {
  sess: string;
  expires: number;
};

const defaultSessionTtlMs = 24 * 60 * 60 * 1000;

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expires INTEGER NOT NULL
  )
`);

const getSessionQuery = db.prepare(
  `SELECT sess, expires FROM sessions WHERE sid = ?`,
);
const setSessionQuery = db.prepare(`
  INSERT INTO sessions (sid, sess, expires)
  VALUES (?, ?, ?)
  ON CONFLICT(sid) DO UPDATE SET
    sess = excluded.sess,
    expires = excluded.expires
`);
const touchSessionQuery = db.prepare(
  `UPDATE sessions SET expires = ? WHERE sid = ?`,
);
const deleteSessionQuery = db.prepare(`DELETE FROM sessions WHERE sid = ?`);
const deleteExpiredSessionsQuery = db.prepare(
  `DELETE FROM sessions WHERE expires <= ?`,
);

function getSessionExpiresAt(sess: session.SessionData) {
  const cookieExpires = sess.cookie.expires;
  if (cookieExpires) {
    const expiresAt = new Date(cookieExpires).getTime();
    if (Number.isFinite(expiresAt)) {
      return expiresAt;
    }
  }

  return Date.now() + (sess.cookie.originalMaxAge ?? defaultSessionTtlMs);
}

export class SqliteSessionStore extends session.Store {
  get(sid: string, callback: (err: unknown, session?: session.SessionData | null) => void) {
    try {
      const row = getSessionQuery.get(sid) as SessionRow | undefined;

      if (!row) {
        callback(null, null);
        return;
      }

      if (row.expires <= Date.now()) {
        deleteSessionQuery.run(sid);
        callback(null, null);
        return;
      }

      callback(null, JSON.parse(row.sess) as session.SessionData);
    } catch (error) {
      callback(error);
    }
  }

  set(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void) {
    try {
      setSessionQuery.run(sid, JSON.stringify(sess), getSessionExpiresAt(sess));
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  destroy(sid: string, callback?: (err?: unknown) => void) {
    try {
      deleteSessionQuery.run(sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void) {
    try {
      touchSessionQuery.run(getSessionExpiresAt(sess), sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  clearExpired() {
    deleteExpiredSessionsQuery.run(Date.now());
  }
}

export function createSessionStore() {
  const store = new SqliteSessionStore();
  store.clearExpired();
  return store;
}
