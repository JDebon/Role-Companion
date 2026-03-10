CREATE TYPE "public"."encounter_status" AS ENUM('preparing', 'active', 'completed');
--> statement-breakpoint
CREATE TYPE "public"."combatant_type" AS ENUM('player_character', 'srd_monster', 'custom_monster', 'npc');
--> statement-breakpoint
CREATE TABLE "npcs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"monster_index" varchar(100),
	"custom_entity_id" uuid,
	"notes" text NOT NULL DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "encounters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"status" "encounter_status" NOT NULL DEFAULT 'preparing',
	"current_turn_index" integer NOT NULL DEFAULT 0,
	"round" integer NOT NULL DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "combatants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"encounter_id" uuid NOT NULL,
	"type" "combatant_type" NOT NULL,
	"character_id" uuid,
	"monster_index" varchar(100),
	"custom_entity_id" uuid,
	"npc_id" uuid,
	"display_name" varchar(200) NOT NULL,
	"max_hp" integer NOT NULL,
	"current_hp" integer NOT NULL,
	"armor_class" integer NOT NULL,
	"initiative" integer,
	"is_unconscious" boolean NOT NULL DEFAULT false,
	"sort_order" integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "npcs" ADD CONSTRAINT "npcs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "npcs" ADD CONSTRAINT "npcs_custom_entity_id_custom_entities_id_fk" FOREIGN KEY ("custom_entity_id") REFERENCES "public"."custom_entities"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "combatants" ADD CONSTRAINT "combatants_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "combatants" ADD CONSTRAINT "combatants_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "combatants" ADD CONSTRAINT "combatants_custom_entity_id_custom_entities_id_fk" FOREIGN KEY ("custom_entity_id") REFERENCES "public"."custom_entities"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "combatants" ADD CONSTRAINT "combatants_npc_id_npcs_id_fk" FOREIGN KEY ("npc_id") REFERENCES "public"."npcs"("id") ON DELETE set null ON UPDATE no action;
