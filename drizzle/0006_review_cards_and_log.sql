CREATE TYPE "public"."answer_match" AS ENUM('expected', 'form', 'accepted', 'mistake', 'unrecognised');--> statement-breakpoint
CREATE TYPE "public"."review_exercise_type" AS ENUM('term', 'preposition', 'mistake');--> statement-breakpoint
CREATE TYPE "public"."review_outcome" AS ENUM('correct', 'incorrect');--> statement-breakpoint
CREATE TABLE "review_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"sense_id" text NOT NULL,
	"box" smallint DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"reviews" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_cards_user_sense_key" UNIQUE("user_id","sense_id"),
	CONSTRAINT "review_cards_box_range" CHECK ("review_cards"."box" between 0 and 5),
	CONSTRAINT "review_cards_counts" CHECK ("review_cards"."reviews" >= 0 and "review_cards"."lapses" >= 0)
);
--> statement-breakpoint
CREATE TABLE "review_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"card_id" uuid NOT NULL,
	"sense_id" text NOT NULL,
	"review_number" integer NOT NULL,
	"exercise_id" text NOT NULL,
	"exercise_type" "review_exercise_type" NOT NULL,
	"outcome" "review_outcome" NOT NULL,
	"answer_match" "answer_match" NOT NULL,
	"answer" text,
	"expected" text NOT NULL,
	"mistake_id" text,
	"box_before" smallint NOT NULL,
	"box_after" smallint NOT NULL,
	"due_after" timestamp with time zone NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_log_card_review_key" UNIQUE("card_id","review_number"),
	CONSTRAINT "review_log_review_number" CHECK ("review_log"."review_number" >= 1),
	CONSTRAINT "review_log_boxes" CHECK ("review_log"."box_before" between 0 and 5 and "review_log"."box_after" between 1 and 5),
	CONSTRAINT "review_log_answer_length" CHECK ("review_log"."answer" is null or char_length("review_log"."answer") <= 80)
);
--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_saved_sense_fk" FOREIGN KEY ("user_id","sense_id") REFERENCES "public"."saved_senses"("user_id","sense_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_sense_id_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_cards_user_due_idx" ON "review_cards" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "review_log_user_reviewed_idx" ON "review_log" USING btree ("user_id","reviewed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "review_log_user_sense_reviewed_idx" ON "review_log" USING btree ("user_id","sense_id","reviewed_at" DESC NULLS LAST);