CREATE TYPE "public"."limited_action" AS ENUM('bank_write', 'review_answer');--> statement-breakpoint
CREATE TABLE "request_limits" (
	"user_id" text NOT NULL,
	"action" "limited_action" NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "request_limits_user_id_action_pk" PRIMARY KEY("user_id","action")
);
--> statement-breakpoint
ALTER TABLE "request_limits" ADD CONSTRAINT "request_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;