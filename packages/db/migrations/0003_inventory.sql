CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"srd_equipment_index" varchar(100),
	"srd_magic_item_index" varchar(100),
	"custom_name" varchar(200),
	"custom_description" text,
	"custom_weight" real,
	"quantity" integer DEFAULT 1 NOT NULL,
	"is_equipped" boolean DEFAULT false NOT NULL,
	"is_attuned" boolean DEFAULT false NOT NULL,
	"notes" text,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_currency" (
	"character_id" uuid PRIMARY KEY NOT NULL,
	"pp" integer DEFAULT 0 NOT NULL,
	"gp" integer DEFAULT 0 NOT NULL,
	"ep" integer DEFAULT 0 NOT NULL,
	"sp" integer DEFAULT 0 NOT NULL,
	"cp" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "character_currency" ADD CONSTRAINT "character_currency_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
