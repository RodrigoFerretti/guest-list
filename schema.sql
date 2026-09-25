-- Esquema do banco (D1 / SQLite). Idempotente: pode ser aplicado mais de uma vez.

CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,          -- nome normalizado, evita duplicatas
  note TEXT,
  present INTEGER NOT NULL DEFAULT 0 CHECK (present IN (0, 1)),
  present_changed_at TEXT,                -- ISO 8601, última mudança de presença
  present_changed_by TEXT,                -- usuário que mudou (admin ou porta)
  added_by TEXT NOT NULL,                 -- usuário que adicionou
  added_at TEXT NOT NULL,                 -- ISO 8601
  removed_at TEXT                         -- remoção lógica
);

CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_id INTEGER NOT NULL REFERENCES guests(id),
  present INTEGER NOT NULL CHECK (present IN (0, 1)),
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_checkins_guest ON checkins(guest_id, id);
CREATE INDEX IF NOT EXISTS idx_checkins_time ON checkins(changed_at);
