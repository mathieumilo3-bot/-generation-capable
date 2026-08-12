-- Schéma local SQLite (node:sqlite) — miroir du schéma Postgres cible
-- dans video-editor/db-migrations/0001_init.sql. Objectif : tourner en
-- local sans aucune dépendance externe (même principe que gc-ai-os), tout
-- en documentant la structure de la vraie base de production.
-- JSON stocké en TEXT (pas de type JSON natif en SQLite) — désérialisé
-- côté application via les schémas zod de @video-editor/shared-types.

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rushes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  container TEXT NOT NULL,
  codec TEXT NOT NULL,
  duration_sec REAL NOT NULL,
  has_audio INTEGER NOT NULL,
  proxy_path TEXT,
  proxy_ready INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reference_videos (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  storage_path TEXT NOT NULL,
  duration_sec REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS segments (
  id TEXT PRIMARY KEY,
  rush_id TEXT NOT NULL REFERENCES rushes(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  start_sec REAL NOT NULL,
  end_sec REAL NOT NULL,
  transcript TEXT NOT NULL,
  energy REAL NOT NULL,
  clarity REAL NOT NULL,
  relevance REAL NOT NULL,
  hook_potential REAL NOT NULL,
  visual_quality REAL NOT NULL,
  narrative_interest REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_segments_project ON segments(project_id);

CREATE TABLE IF NOT EXISTS style_profiles (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS briefs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  raw_text TEXT NOT NULL,
  spec_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS story_blueprints (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edit_blueprints (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  story_blueprint_id TEXT NOT NULL REFERENCES story_blueprints(id),
  version INTEGER NOT NULL,
  style_profile_id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS renders (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  edit_blueprint_id TEXT NOT NULL REFERENCES edit_blueprints(id),
  edit_blueprint_version INTEGER NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  file_path TEXT,
  duration_ms INTEGER,
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qc_reports (
  id TEXT PRIMARY KEY,
  render_id TEXT NOT NULL REFERENCES renders(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  scores_json TEXT NOT NULL,
  corrections_json TEXT NOT NULL,
  passed INTEGER NOT NULL,
  threshold REAL NOT NULL,
  human_score REAL,
  human_notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_library (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL, -- 'stock' | 'generated' | 'user'
  project_id TEXT REFERENCES projects(id),
  storage_path TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  embedding_json TEXT,
  created_at TEXT NOT NULL
);

-- Un job = une exécution d'étape de pipeline. Append-only : l'état
-- courant d'un projet est "la dernière ligne par stage", jamais mutée
-- après coup, pour garder une trace d'audit complète (retries inclus).
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_project ON jobs(project_id);

CREATE TABLE IF NOT EXISTS feedback_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  render_id TEXT,
  type TEXT NOT NULL,
  command TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_ledger (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  agent TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  stage TEXT NOT NULL,
  call_type TEXT NOT NULL,
  input_units REAL NOT NULL,
  input_unit_type TEXT NOT NULL,
  output_units REAL NOT NULL,
  output_unit_type TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  cost_micro_usd INTEGER NOT NULL,
  is_stub INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cost_ledger_project ON cost_ledger(project_id);
