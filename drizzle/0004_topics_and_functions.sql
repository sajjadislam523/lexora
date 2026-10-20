CREATE TYPE "public"."topic" AS ENUM('education', 'environment', 'health', 'technology', 'work', 'economy', 'government', 'cities', 'transport', 'society');--> statement-breakpoint
ALTER TYPE "public"."discourse_function" ADD VALUE 'comparison' BEFORE 'concession';--> statement-breakpoint
ALTER TYPE "public"."discourse_function" ADD VALUE 'decrease' BEFORE 'emphasis';--> statement-breakpoint
ALTER TYPE "public"."discourse_function" ADD VALUE 'hedging' BEFORE 'importance';--> statement-breakpoint
ALTER TYPE "public"."discourse_function" ADD VALUE 'opinion' BEFORE 'problem';--> statement-breakpoint
ALTER TABLE "senses" ADD COLUMN "topics" "topic"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "senses" ADD CONSTRAINT "senses_topics_max" CHECK (cardinality("senses"."topics") <= 3);