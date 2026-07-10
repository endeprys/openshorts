import os
import sqlite3
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "openshorts.db")

def get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS projects (
            id          TEXT PRIMARY KEY,
            title       TEXT NOT NULL DEFAULT '',
            source_url  TEXT,
            source_type TEXT DEFAULT 'url',
            duration    REAL,
            status      TEXT DEFAULT 'done',
            model_used  TEXT,
            lang        TEXT,
            transcript  TEXT,
            cost_data   TEXT,
            thumbnail   TEXT,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS clips (
            id          TEXT PRIMARY KEY,
            project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            clip_index  INTEGER NOT NULL,
            video_url   TEXT NOT NULL,
            start_time  REAL,
            end_time    REAL,
            duration    REAL,
            title       TEXT,
            description_tiktok  TEXT,
            description_instagram TEXT,
            hook_text   TEXT,
            thumbnail   TEXT,
            created_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS schedules (
            id              TEXT PRIMARY KEY,
            clip_id         TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
            project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            scheduled_for   TEXT NOT NULL,
            timezone        TEXT DEFAULT 'UTC',
            title           TEXT,
            description     TEXT,
            privacy_status  TEXT DEFAULT 'public',
            youtube_refresh_token  TEXT,
            youtube_client_id      TEXT,
            youtube_client_secret  TEXT,
            status          TEXT DEFAULT 'pending',
            video_url       TEXT,
            error           TEXT,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_clips_project ON clips(project_id);
        CREATE INDEX IF NOT EXISTS idx_schedules_clip ON schedules(clip_id);
        CREATE INDEX IF NOT EXISTS idx_schedules_project ON schedules(project_id);
        CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
        CREATE INDEX IF NOT EXISTS idx_schedules_for ON schedules(scheduled_for);
    """)
    conn.commit()
    conn.close()

def now_iso():
    return datetime.now(timezone.utc).isoformat()

# ── Projects ──────────────────────────────────────────────

def create_project(pid: str, title: str = "", source_url: str = "", source_type: str = "url",
                   duration: float = 0, status: str = "done", model_used: str = "",
                   lang: str = "", transcript: str = "", cost_data: str = "",
                   thumbnail: str = "") -> dict:
    conn = get_conn()
    ts = now_iso()
    conn.execute("""
        INSERT INTO projects (id, title, source_url, source_type, duration, status,
                              model_used, lang, transcript, cost_data, thumbnail, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (pid, title, source_url, source_type, duration, status, model_used, lang,
          transcript, cost_data, thumbnail, ts, ts))
    conn.commit()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    conn.close()
    return dict(row) if row else None

def get_project(pid: str) -> Optional[dict]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    conn.close()
    return dict(row) if row else None

def list_projects(limit: int = 50, offset: int = 0) -> List[dict]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM projects ORDER BY created_at DESC LIMIT ? OFFSET ?",
                        (limit, offset)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def update_project(pid: str, **kwargs) -> Optional[dict]:
    if not kwargs:
        return get_project(pid)
    kwargs['updated_at'] = now_iso()
    sets = ", ".join(f"{k}=?" for k in kwargs)
    vals = list(kwargs.values()) + [pid]
    conn = get_conn()
    conn.execute(f"UPDATE projects SET {sets} WHERE id=?", vals)
    conn.commit()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    conn.close()
    return dict(row) if row else None

def delete_project(pid: str) -> bool:
    conn = get_conn()
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("DELETE FROM projects WHERE id=?", (pid,))
    affected = conn.total_changes
    conn.commit()
    conn.close()
    return affected > 0

# ── Clips ─────────────────────────────────────────────────

def create_clip(cid: str, project_id: str, clip_index: int, video_url: str,
                start_time: float = 0, end_time: float = 0, duration: float = 0,
                title: str = "", description_tiktok: str = "",
                description_instagram: str = "", hook_text: str = "",
                thumbnail: str = "") -> dict:
    conn = get_conn()
    ts = now_iso()
    conn.execute("""
        INSERT INTO clips (id, project_id, clip_index, video_url, start_time, end_time,
                          duration, title, description_tiktok, description_instagram,
                          hook_text, thumbnail, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (cid, project_id, clip_index, video_url, start_time, end_time, duration,
          title, description_tiktok, description_instagram, hook_text, thumbnail, ts))
    conn.commit()
    row = conn.execute("SELECT * FROM clips WHERE id=?", (cid,)).fetchone()
    conn.close()
    return dict(row) if row else None

def list_clips(project_id: str) -> List[dict]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM clips WHERE project_id=? ORDER BY clip_index", (project_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_clip_by_project_and_index(project_id: str, clip_index: int):
    conn = get_conn()
    row = conn.execute("SELECT * FROM clips WHERE project_id=? AND clip_index=?", (project_id, clip_index)).fetchone()
    conn.close()
    return dict(row) if row else None

def get_clip(clip_id: str):
    conn = get_conn()
    row = conn.execute("SELECT * FROM clips WHERE id=?", (clip_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def update_clip(clip_id: str, **kwargs):
    conn = get_conn()
    sets = ", ".join(f"{k}=?" for k in kwargs)
    vals = list(kwargs.values()) + [clip_id]
    conn.execute(f"UPDATE clips SET {sets} WHERE id=?", vals)
    conn.commit()
    row = conn.execute("SELECT * FROM clips WHERE id=?", (clip_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def update_clip_video_url(clip_id: str, video_url: str):
    conn = get_conn()
    conn.execute("UPDATE clips SET video_url=? WHERE id=?", (video_url, clip_id))
    conn.commit()
    conn.close()

def delete_clips_by_project(project_id: str):
    conn = get_conn()
    conn.execute("DELETE FROM clips WHERE project_id=?", (project_id,))
    conn.commit()
    conn.close()

# ── Schedules ─────────────────────────────────────────────

def create_schedule(sid: str, clip_id: str, project_id: str, scheduled_for: str,
                    timezone: str = "UTC", title: str = "", description: str = "",
                    privacy_status: str = "public",
                    youtube_refresh_token: str = "",
                    youtube_client_id: str = "",
                    youtube_client_secret: str = "") -> dict:
    conn = get_conn()
    ts = now_iso()
    conn.execute("""
        INSERT INTO schedules (id, clip_id, project_id, scheduled_for, timezone,
                              title, description, privacy_status,
                              youtube_refresh_token, youtube_client_id, youtube_client_secret,
                              status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    """, (sid, clip_id, project_id, scheduled_for, timezone, title, description,
          privacy_status, youtube_refresh_token, youtube_client_id, youtube_client_secret, ts, ts))
    conn.commit()
    row = conn.execute("SELECT * FROM schedules WHERE id=?", (sid,)).fetchone()
    conn.close()
    return dict(row) if row else None

def list_schedules(project_id: Optional[str] = None, status: Optional[str] = None,
                   date_from: Optional[str] = None, date_to: Optional[str] = None,
                   limit: int = 100) -> List[dict]:
    conn = get_conn()
    where = []
    vals = []
    if project_id:
        where.append("s.project_id=?")
        vals.append(project_id)
    if status:
        where.append("s.status=?")
        vals.append(status)
    if date_from:
        where.append("s.scheduled_for>=?")
        vals.append(date_from)
    if date_to:
        where.append("s.scheduled_for<=?")
        vals.append(date_to)
    w = "WHERE " + " AND ".join(where) if where else ""
    rows = conn.execute(f"""
        SELECT s.*, c.video_url as clip_video_url, c.thumbnail as clip_thumbnail,
               c.title as clip_title, p.title as project_title
        FROM schedules s
        LEFT JOIN clips c ON c.id = s.clip_id
        LEFT JOIN projects p ON p.id = s.project_id
        {w}
        ORDER BY s.scheduled_for ASC
        LIMIT ?
    """, vals + [limit]).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_schedule(sid: str) -> Optional[dict]:
    conn = get_conn()
    row = conn.execute("""
        SELECT s.*, c.video_url as clip_video_url, c.thumbnail as clip_thumbnail,
               c.title as clip_title, p.title as project_title
        FROM schedules s
        LEFT JOIN clips c ON c.id = s.clip_id
        LEFT JOIN projects p ON p.id = s.project_id
        WHERE s.id=?
    """, (sid,)).fetchone()
    conn.close()
    return dict(row) if row else None

def update_schedule(sid: str, **kwargs) -> Optional[dict]:
    if not kwargs:
        return get_schedule(sid)
    kwargs['updated_at'] = now_iso()
    sets = ", ".join(f"{k}=?" for k in kwargs)
    vals = list(kwargs.values()) + [sid]
    conn = get_conn()
    conn.execute(f"UPDATE schedules SET {sets} WHERE id=?", vals)
    conn.commit()
    row = conn.execute("SELECT * FROM schedules WHERE id=?", (sid,)).fetchone()
    conn.close()
    return dict(row) if row else None

def delete_schedule(sid: str) -> bool:
    conn = get_conn()
    conn.execute("DELETE FROM schedules WHERE id=?", (sid,))
    affected = conn.total_changes
    conn.commit()
    conn.close()
    return affected > 0

def get_due_schedules(limit: int = 2) -> List[dict]:
    conn = get_conn()
    rows = conn.execute("""
        SELECT * FROM schedules
        WHERE status='pending' AND scheduled_for <= ?
        ORDER BY scheduled_for ASC
        LIMIT ?
    """, (now_iso(), limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def mark_overdue_schedules():
    conn = get_conn()
    conn.execute("""
        UPDATE schedules SET status='overdue', updated_at=?
        WHERE status='pending' AND scheduled_for <= ?
    """, (now_iso(), now_iso()))
    conn.commit()
    conn.close()

def get_calendar(date_from: str, date_to: str) -> List[dict]:
    conn = get_conn()
    rows = conn.execute("""
        SELECT s.id, s.scheduled_for, s.status, s.title, s.privacy_status,
               s.error, s.video_url, c.clip_index, c.thumbnail as clip_thumbnail,
               p.title as project_title, p.id as project_id
        FROM schedules s
        LEFT JOIN clips c ON c.id = s.clip_id
        LEFT JOIN projects p ON p.id = s.project_id
        WHERE s.scheduled_for >= ? AND s.scheduled_for < ?
        ORDER BY s.scheduled_for ASC
    """, (date_from, date_to)).fetchall()
    conn.close()
    return [dict(r) for r in rows]
