CREATE TYPE "public"."cefr_level" AS ENUM('A2', 'B1', 'B2', 'C1', 'C2');--> statement-breakpoint
CREATE TYPE "public"."complement" AS ENUM('noun', 'ing', 'noun_or_ing', 'person', 'clause');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TYPE "public"."discourse_function" AS ENUM('addition', 'cause', 'concession', 'contrast', 'emphasis', 'example', 'importance', 'increase', 'problem', 'result');--> statement-breakpoint
CREATE TYPE "public"."form_type" AS ENUM('lemma', 'inflection', 'spelling_variant', 'contraction');--> statement-breakpoint
CREATE TYPE "public"."ielts_relevance" AS ENUM('core', 'high', 'useful');--> statement-breakpoint
CREATE TYPE "public"."ielts_task" AS ENUM('writing-1', 'writing-2', 'speaking-1', 'speaking-2', 'speaking-3');--> statement-breakpoint
CREATE TYPE "public"."item_kind" AS ENUM('word', 'phrase', 'collocation', 'preposition_pattern', 'linker', 'sentence_pattern', 'functional_expression');--> statement-breakpoint
CREATE TYPE "public"."linker_connects" AS ENUM('sentences', 'clauses', 'both');--> statement-breakpoint
CREATE TYPE "public"."linker_position" AS ENUM('start', 'middle', 'end');--> statement-breakpoint
CREATE TYPE "public"."mistake_type" AS ENUM('preposition', 'collocation', 'word_form', 'countability', 'punctuation', 'register', 'confusion', 'grammar');--> statement-breakpoint
CREATE TYPE "public"."part_of_speech" AS ENUM('noun', 'verb', 'adjective', 'adverb', 'conjunction', 'preposition', 'noun_phrase', 'verb_phrase', 'adjective_phrase', 'adverbial_phrase', 'prepositional_phrase', 'clause_frame');--> statement-breakpoint
CREATE TYPE "public"."region" AS ENUM('gb', 'us');--> statement-breakpoint
CREATE TYPE "public"."register" AS ENUM('academic', 'formal', 'neutral', 'informal');--> statement-breakpoint
CREATE TYPE "public"."relation_type" AS ENUM('synonym', 'alternative', 'stronger', 'weaker', 'more_formal', 'more_natural', 'opposite', 'confusable', 'has_component', 'component_of', 'derived_form', 'related');--> statement-breakpoint
CREATE TYPE "public"."review_level" AS ENUM('editorial', 'expert');--> statement-breakpoint
CREATE TYPE "public"."sense_status" AS ENUM('published', 'retired');--> statement-breakpoint
CREATE TYPE "public"."skill" AS ENUM('writing', 'speaking');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('editorial', 'open_dataset', 'licensed', 'public_domain', 'reference');--> statement-breakpoint
CREATE TYPE "public"."source_use" AS ENUM('definitions', 'examples', 'relations', 'notes', 'frequency', 'candidates', 'mistakes');--> statement-breakpoint
CREATE TABLE "collocations" (
	"id" text PRIMARY KEY NOT NULL,
	"sense_id" text NOT NULL,
	"phrase" text NOT NULL,
	"normalized" text NOT NULL,
	"pattern" text,
	"note" text,
	"registers" "register"[],
	"skills" "skill"[],
	"item_id" text,
	"position" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"git_sha" text,
	"checksum" text NOT NULL,
	"counts" jsonb NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "source_kind" NOT NULL,
	"licence" text NOT NULL,
	"licence_url" text,
	"attribution" text,
	"url" text,
	"permitted_uses" "source_use"[] NOT NULL,
	"verified_on" date
);
--> statement-breakpoint
CREATE TABLE "examples" (
	"id" text PRIMARY KEY NOT NULL,
	"sense_id" text NOT NULL,
	"text" text NOT NULL,
	"highlights" jsonb NOT NULL,
	"skill" "skill" NOT NULL,
	"ielts_task" "ielts_task",
	"collocation_id" text,
	"preposition_pattern_id" text,
	"position" smallint NOT NULL,
	"source_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "frames" (
	"id" text PRIMARY KEY NOT NULL,
	"sense_id" text NOT NULL,
	"parts" jsonb NOT NULL,
	"display" text NOT NULL,
	"head_normalized" text NOT NULL,
	"position" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intent_entries" (
	"intent_id" text NOT NULL,
	"sense_id" text NOT NULL,
	"group_label" text NOT NULL,
	"position" smallint NOT NULL,
	"fit_note" text NOT NULL,
	CONSTRAINT "intent_entries_intent_id_sense_id_pk" PRIMARY KEY("intent_id","sense_id")
);
--> statement-breakpoint
CREATE TABLE "intent_triggers" (
	"intent_id" text NOT NULL,
	"phrase" text NOT NULL,
	"normalized" text NOT NULL,
	CONSTRAINT "intent_triggers_intent_id_normalized_pk" PRIMARY KEY("intent_id","normalized")
);
--> statement-breakpoint
CREATE TABLE "intents" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"function" "discourse_function"
);
--> statement-breakpoint
CREATE TABLE "item_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"form" text NOT NULL,
	"normalized" text NOT NULL,
	"form_type" "form_type" NOT NULL,
	"region" "region",
	"is_default" boolean DEFAULT false NOT NULL,
	CONSTRAINT "item_forms_item_normalized_key" UNIQUE("item_id","normalized")
);
--> statement-breakpoint
CREATE TABLE "item_slug_history" (
	"slug" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "language_items" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"kind" "item_kind" NOT NULL,
	"headword" text NOT NULL,
	"normalized" text NOT NULL,
	"status" "content_status" NOT NULL,
	"replaced_by" text,
	"regional_note" text,
	"source_id" text NOT NULL,
	"informed_by" text[] DEFAULT '{}'::text[] NOT NULL,
	"authored_by" text NOT NULL,
	"reviewed_by" text,
	"reviewed_on" date,
	"review_level" "review_level",
	"release_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "language_items_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "linker_details" (
	"sense_id" text PRIMARY KEY NOT NULL,
	"connects" "linker_connects" NOT NULL,
	"positions" "linker_position"[] NOT NULL,
	"punctuation" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mistakes" (
	"id" text PRIMARY KEY NOT NULL,
	"sense_id" text NOT NULL,
	"wrong" text NOT NULL,
	"wrong_normalized" text NOT NULL,
	"right" text NOT NULL,
	"explanation" text NOT NULL,
	"type" "mistake_type" NOT NULL,
	"position" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preposition_patterns" (
	"id" text PRIMARY KEY NOT NULL,
	"sense_id" text NOT NULL,
	"base" text NOT NULL,
	"base_normalized" text NOT NULL,
	"preposition" text NOT NULL,
	"pattern" text NOT NULL,
	"complement" "complement" NOT NULL,
	"note" text,
	"mistake_id" text,
	"position" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relations" (
	"from_sense_id" text NOT NULL,
	"to_sense_id" text NOT NULL,
	"type" "relation_type" NOT NULL,
	"note" text,
	"context_note" text,
	"weight" smallint NOT NULL,
	"is_inverse" boolean NOT NULL,
	"source_id" text NOT NULL,
	CONSTRAINT "relations_from_sense_id_to_sense_id_type_pk" PRIMARY KEY("from_sense_id","to_sense_id","type"),
	CONSTRAINT "relations_weight_range" CHECK ("relations"."weight" between 1 and 3),
	CONSTRAINT "relations_not_self" CHECK ("relations"."from_sense_id" <> "relations"."to_sense_id")
);
--> statement-breakpoint
CREATE TABLE "senses" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"position" smallint NOT NULL,
	"status" "sense_status" DEFAULT 'published' NOT NULL,
	"replaced_by" text,
	"label" text,
	"definition" text NOT NULL,
	"part_of_speech" "part_of_speech" NOT NULL,
	"cefr" "cefr_level" NOT NULL,
	"registers" "register"[] NOT NULL,
	"skills" "skill"[] NOT NULL,
	"ielts_relevance" "ielts_relevance" NOT NULL,
	"ielts_tasks" "ielts_task"[] NOT NULL,
	"strength" smallint,
	"functions" "discourse_function"[] DEFAULT '{}' NOT NULL,
	"best_when" text NOT NULL,
	"avoid_when" text,
	"skill_note" text,
	"standalone_reason" text,
	"search_vector" "tsvector",
	CONSTRAINT "senses_strength_range" CHECK ("senses"."strength" is null or "senses"."strength" between 1 and 3)
);
--> statement-breakpoint
ALTER TABLE "collocations" ADD CONSTRAINT "collocations_sense_id_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collocations" ADD CONSTRAINT "collocations_item_id_language_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."language_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examples" ADD CONSTRAINT "examples_sense_id_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examples" ADD CONSTRAINT "examples_collocation_id_collocations_id_fk" FOREIGN KEY ("collocation_id") REFERENCES "public"."collocations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examples" ADD CONSTRAINT "examples_preposition_pattern_id_preposition_patterns_id_fk" FOREIGN KEY ("preposition_pattern_id") REFERENCES "public"."preposition_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examples" ADD CONSTRAINT "examples_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frames" ADD CONSTRAINT "frames_sense_id_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_entries" ADD CONSTRAINT "intent_entries_intent_id_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_entries" ADD CONSTRAINT "intent_entries_sense_id_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_triggers" ADD CONSTRAINT "intent_triggers_intent_id_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_forms" ADD CONSTRAINT "item_forms_item_id_language_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."language_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_slug_history" ADD CONSTRAINT "item_slug_history_item_id_language_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."language_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "language_items" ADD CONSTRAINT "language_items_replaced_by_language_items_id_fk" FOREIGN KEY ("replaced_by") REFERENCES "public"."language_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "language_items" ADD CONSTRAINT "language_items_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "language_items" ADD CONSTRAINT "language_items_release_id_content_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."content_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linker_details" ADD CONSTRAINT "linker_details_sense_id_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_sense_id_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preposition_patterns" ADD CONSTRAINT "preposition_patterns_sense_id_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preposition_patterns" ADD CONSTRAINT "preposition_patterns_mistake_id_mistakes_id_fk" FOREIGN KEY ("mistake_id") REFERENCES "public"."mistakes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_from_sense_id_senses_id_fk" FOREIGN KEY ("from_sense_id") REFERENCES "public"."senses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_to_sense_id_senses_id_fk" FOREIGN KEY ("to_sense_id") REFERENCES "public"."senses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "senses" ADD CONSTRAINT "senses_item_id_language_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."language_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "senses" ADD CONSTRAINT "senses_replaced_by_senses_id_fk" FOREIGN KEY ("replaced_by") REFERENCES "public"."senses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collocations_sense_idx" ON "collocations" USING btree ("sense_id");--> statement-breakpoint
CREATE INDEX "collocations_normalized_idx" ON "collocations" USING btree ("normalized");--> statement-breakpoint
CREATE INDEX "collocations_normalized_trgm_idx" ON "collocations" USING gin ("normalized" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "examples_sense_position_idx" ON "examples" USING btree ("sense_id","position");--> statement-breakpoint
CREATE INDEX "frames_head_normalized_idx" ON "frames" USING btree ("head_normalized");--> statement-breakpoint
CREATE INDEX "intent_triggers_normalized_trgm_idx" ON "intent_triggers" USING gin ("normalized" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "item_forms_normalized_idx" ON "item_forms" USING btree ("normalized");--> statement-breakpoint
CREATE INDEX "item_forms_normalized_trgm_idx" ON "item_forms" USING gin ("normalized" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "language_items_status_idx" ON "language_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mistakes_wrong_normalized_idx" ON "mistakes" USING btree ("wrong_normalized");--> statement-breakpoint
CREATE INDEX "mistakes_wrong_normalized_trgm_idx" ON "mistakes" USING gin ("wrong_normalized" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "preposition_patterns_base_normalized_idx" ON "preposition_patterns" USING btree ("base_normalized");--> statement-breakpoint
CREATE INDEX "preposition_patterns_base_normalized_trgm_idx" ON "preposition_patterns" USING gin ("base_normalized" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "relations_from_type_idx" ON "relations" USING btree ("from_sense_id","type");--> statement-breakpoint
CREATE INDEX "senses_item_position_idx" ON "senses" USING btree ("item_id","position");--> statement-breakpoint
CREATE INDEX "senses_search_vector_idx" ON "senses" USING gin ("search_vector");