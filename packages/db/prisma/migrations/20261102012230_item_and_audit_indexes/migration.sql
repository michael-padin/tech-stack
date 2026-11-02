-- pg_trgm powers the GIN index on items.title (ILIKE %term% search). Available
-- on Postgres 9.1+ and on Neon, Supabase, RDS and Railway.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- DropIndex
DROP INDEX "idx_items_deleted";

-- DropIndex
DROP INDEX "idx_items_status";

-- CreateIndex
CREATE INDEX "idx_audit_action_created" ON "audit_log"("action", "created_at");

-- CreateIndex
CREATE INDEX "idx_items_status_created" ON "items"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_items_created" ON "items"("created_at");

-- CreateIndex
CREATE INDEX "idx_items_title_trgm" ON "items" USING GIN ("title" gin_trgm_ops);
