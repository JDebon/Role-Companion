CREATE TYPE "public"."spell_status" AS ENUM('known', 'prepared');
--> statement-breakpoint
CREATE TABLE "character_spells" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"spell_index" varchar(100) NOT NULL,
	"status" "spell_status" NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "character_spells_character_id_spell_index_unique" UNIQUE("character_id","spell_index")
);
--> statement-breakpoint
CREATE TABLE "spell_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"l1_total" integer DEFAULT 0 NOT NULL,
	"l1_used" integer DEFAULT 0 NOT NULL,
	"l2_total" integer DEFAULT 0 NOT NULL,
	"l2_used" integer DEFAULT 0 NOT NULL,
	"l3_total" integer DEFAULT 0 NOT NULL,
	"l3_used" integer DEFAULT 0 NOT NULL,
	"l4_total" integer DEFAULT 0 NOT NULL,
	"l4_used" integer DEFAULT 0 NOT NULL,
	"l5_total" integer DEFAULT 0 NOT NULL,
	"l5_used" integer DEFAULT 0 NOT NULL,
	"l6_total" integer DEFAULT 0 NOT NULL,
	"l6_used" integer DEFAULT 0 NOT NULL,
	"l7_total" integer DEFAULT 0 NOT NULL,
	"l7_used" integer DEFAULT 0 NOT NULL,
	"l8_total" integer DEFAULT 0 NOT NULL,
	"l8_used" integer DEFAULT 0 NOT NULL,
	"l9_total" integer DEFAULT 0 NOT NULL,
	"l9_used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "spell_slots_character_id_unique" UNIQUE("character_id")
);
--> statement-breakpoint
CREATE TABLE "concentration_tracker" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"spell_index" varchar(100),
	"started_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "concentration_tracker_character_id_unique" UNIQUE("character_id")
);
--> statement-breakpoint
ALTER TABLE "character_spells" ADD CONSTRAINT "character_spells_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spell_slots" ADD CONSTRAINT "spell_slots_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "concentration_tracker" ADD CONSTRAINT "concentration_tracker_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
