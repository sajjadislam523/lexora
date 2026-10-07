CREATE TABLE "saved_senses" (
	"user_id" text NOT NULL,
	"sense_id" text NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_senses_user_id_sense_id_pk" PRIMARY KEY("user_id","sense_id")
);
--> statement-breakpoint
ALTER TABLE "saved_senses" ADD CONSTRAINT "saved_senses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_senses" ADD CONSTRAINT "saved_senses_sense_id_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_senses_user_saved_at_idx" ON "saved_senses" USING btree ("user_id","saved_at");