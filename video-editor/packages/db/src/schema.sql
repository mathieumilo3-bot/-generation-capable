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

-- Render Queue : l'unité de travail de bout en bout d'UN projet (§2 du
-- brief factory). Distincte de `jobs` (trace d'audit par étape) : cette
-- table pilote QUAND et SUR QUEL worker un projet s'exécute, avec
-- priorité, reprise après crash (heartbeat) et exécution unique garantie
-- (claim atomique côté application). Conçue pour être migrable telle
-- quelle vers Postgres (SELECT … FOR UPDATE SKIP LOCKED) ou Redis.
CREATE TABLE IF NOT EXISTS render_queue (
  job_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',
  profile TEXT NOT NULL DEFAULT 'balanced',
  payload TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  current_stage TEXT,
  estimated_remaining_ms INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  worker_id TEXT,
  worker_pid INTEGER,
  heartbeat_at TEXT,
  error TEXT,
  output_path TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_render_queue_status ON render_queue(status);
CREATE INDEX IF NOT EXISTS idx_render_queue_project ON render_queue(project_id);
-- Dispatch : file d'attente triée par priorité puis ancienneté.
CREATE INDEX IF NOT EXISTS idx_render_queue_dispatch ON render_queue(status, priority DESC, created_at ASC);

-- Métriques par rendu (§20) : comprendre POURQUOI un montage est lent.
CREATE TABLE IF NOT EXISTS render_metrics (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  project_id TEXT NOT NULL,
  render_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  duration_total_ms INTEGER NOT NULL,
  duration_cut_ms INTEGER,
  duration_concat_ms INTEGER,
  duration_habillage_ms INTEGER,
  duration_encode_ms INTEGER,
  frames_rendered INTEGER,
  fps REAL,
  used_remotion INTEGER NOT NULL DEFAULT 0,
  memory_peak_mb REAL,
  worker_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_render_metrics_project ON render_metrics(project_id);

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
