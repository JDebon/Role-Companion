CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"class_name" varchar(100) NOT NULL,
	"subclass_name" varchar(100),
	"race_name" varchar(100) NOT NULL,
	"background_name" varchar(100) DEFAULT '' NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"experience_points" integer DEFAULT 0 NOT NULL,
	"str" integer DEFAULT 10 NOT NULL,
	"dex" integer DEFAULT 10 NOT NULL,
	"con" integer DEFAULT 10 NOT NULL,
	"int" integer DEFAULT 10 NOT NULL,
	"wis" integer DEFAULT 10 NOT NULL,
	"cha" integer DEFAULT 10 NOT NULL,
	"max_hp" integer NOT NULL,
	"current_hp" integer NOT NULL,
	"temporary_hp" integer DEFAULT 0 NOT NULL,
	"armor_class" integer DEFAULT 10 NOT NULL,
	"initiative" integer,
	"speed" integer DEFAULT 30 NOT NULL,
	"skill_proficiencies" jsonb NOT NULL,
	"saving_throw_proficiencies" jsonb NOT NULL,
	"backstory" text,
	"portrait_url" varchar(500),
	"traits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
