-- Headcounts kept in step with the attendance register (uploads and marking attendance).
ALTER TABLE "service_headcounts" ADD COLUMN "from_register" BOOLEAN NOT NULL DEFAULT false;

UPDATE "service_headcounts" h SET "from_register" = true
FROM "uploads" u WHERE u.id = h.upload_id AND u.kind = 'attendance';
