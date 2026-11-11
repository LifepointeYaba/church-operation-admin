-- User management: named users with roles, generated temporary passwords, forced password change.
ALTER TABLE "users" ADD COLUMN "name" TEXT;
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "temp_password_expires_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "created_by_id" TEXT;
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'viewer';

-- Every audit entry records who did it.
ALTER TABLE "audit_log" ADD COLUMN "actor_id" TEXT;
ALTER TABLE "audit_log" ADD COLUMN "actor_email" TEXT;
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log"("actor_id");

