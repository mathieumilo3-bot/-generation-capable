-- Bibliothèque média cloud (imports iCloud / Google Drive → Cloudflare R2).
-- Miroir Postgres des tables ajoutées dans packages/db/src/schema.sql.

CREATE TABLE IF NOT EXISTS media_imports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('icloud_shared_album', 'icloud_shared_collection', 'icloud_link', 'google_drive')),
  source_title TEXT,
  mode TEXT NOT NULL DEFAULT 'probe' CHECK (mode IN ('probe', 'full')),
  sample_size INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'queued',
  total_items INTEGER NOT NULL DEFAULT 0,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  worker_id TEXT,
  worker_pid INTEGER,
  heartbeat_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_imports_user ON media_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_media_imports_status ON media_imports(status);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL REFERENCES media_imports(id),
  external_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('video', 'photo', 'other')),
  mime_type TEXT,
  size_bytes BIGINT,
  sha256 TEXT,
  width INTEGER,
  height INTEGER,
  duration_sec DOUBLE PRECISION,
  video_codec TEXT,
  container TEXT,
  has_audio BOOLEAN,
  taken_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  object_key TEXT,
  thumb_key TEXT,
  analysis JSONB,
  position INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_media_assets_import ON media_assets(import_id, position);

CREATE TABLE IF NOT EXISTS rush_library_links (
  rush_id TEXT PRIMARY KEY REFERENCES rushes(id),
  asset_id TEXT NOT NULL REFERENCES media_assets(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  start_sec DOUBLE PRECISION,
  end_sec DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rush_library_links_asset ON rush_library_links(asset_id);
CREATE INDEX IF NOT EXISTS idx_rush_library_links_project ON rush_library_links(project_id);
