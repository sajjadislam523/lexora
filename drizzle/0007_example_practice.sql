CREATE TYPE "public"."practice_blank" AS ENUM('term', 'preposition');--> statement-breakpoint
ALTER TABLE "examples" ADD COLUMN "practice_accept" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "examples" ADD COLUMN "practice_accept_preposition" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "examples" ADD COLUMN "practice_exclude" "practice_blank"[] DEFAULT '{}'::practice_blank[] NOT NULL;