-- Full-text search expression indexes for Portuguese language queries
-- These use expression-based GIN indexes so no schema column changes are needed.
-- The tsvector is computed at query time and the index accelerates the @@ operator.

CREATE INDEX IF NOT EXISTS "tickets_search_idx" ON "tickets"
  USING GIN (to_tsvector('portuguese', coalesce("title", '') || ' ' || coalesce("description", '')));--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "suppliers_search_idx" ON "suppliers"
  USING GIN (to_tsvector('portuguese', coalesce("name", '') || ' ' || coalesce("category", '') || ' ' || coalesce("notes", '')));--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "maintenance_records_search_idx" ON "maintenance_records"
  USING GIN (to_tsvector('portuguese', coalesce("title", '') || ' ' || coalesce("description", '')));
