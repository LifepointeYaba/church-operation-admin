-- Guests, pastors and visitors who are not in the register, added by hand on the weekly headcount.
ALTER TABLE "service_headcounts" ADD COLUMN "guests" INTEGER NOT NULL DEFAULT 0;

-- Total now counts everyone: Workers + Members + First + Second timers + Children + Guests.
-- Headcounts saved from the register or typed in left children out of the total; add them in.
-- Chart-sheet headcounts keep the total from the sheet.
UPDATE "service_headcounts" h SET "total" = h.workers + h.members + h.first_timers + h.second_timers + h.children
WHERE h.children > 0
  AND h.total = h.workers + h.members + h.first_timers + h.second_timers
  AND (h.from_register OR h.upload_id IS NULL OR EXISTS (SELECT 1 FROM "uploads" u WHERE u.id = h.upload_id AND u.kind = 'attendance'));
