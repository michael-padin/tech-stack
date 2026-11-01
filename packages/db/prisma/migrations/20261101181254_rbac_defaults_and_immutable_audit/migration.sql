-- AlterTable
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'viewer';

-- Audit log is append-only: reject UPDATE and DELETE at the database, so not
-- even a bug or a compromised app role can rewrite history. (Deleting a user
-- still works: the FK's ON DELETE SET NULL is an UPDATE of actor_id only, which
-- the trigger allows; actor_email keeps the record readable.)
CREATE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.actor_id IS NULL
     AND OLD.actor_id IS NOT NULL
     AND (to_jsonb(NEW) - 'actor_id') = (to_jsonb(OLD) - 'actor_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_log is append-only (% blocked)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
