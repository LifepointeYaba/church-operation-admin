-- Public first-timer form links (one per Sunday) and their submissions.
CREATE TABLE "first_timer_links" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "service_date" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "first_timer_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "first_timer_links_token_key" ON "first_timer_links"("token");
CREATE UNIQUE INDEX "first_timer_links_service_date_key" ON "first_timer_links"("service_date");

CREATE TABLE "first_timer_responses" (
    "id" SERIAL NOT NULL,
    "link_id" INTEGER NOT NULL,
    "member_id" INTEGER,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phone_key" TEXT,
    "email" TEXT,
    "gender" TEXT,
    "birthday" TEXT,
    "address" TEXT,
    "how_heard" TEXT,
    "church_home" TEXT,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "growth" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prayer_request" TEXT,
    "comments" TEXT,
    "improve" TEXT,
    "on_whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "matched_existing" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "first_timer_responses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "first_timer_responses_link_id_phone_key_key" ON "first_timer_responses"("link_id", "phone_key");
CREATE INDEX "first_timer_responses_member_id_idx" ON "first_timer_responses"("member_id");
ALTER TABLE "first_timer_responses" ADD CONSTRAINT "first_timer_responses_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "first_timer_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "first_timer_responses" ADD CONSTRAINT "first_timer_responses_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
