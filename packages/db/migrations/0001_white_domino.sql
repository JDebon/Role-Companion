CREATE TABLE "srd_backgrounds" (
	"index" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srd_classes" (
	"index" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srd_conditions" (
	"index" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srd_damage_types" (
	"index" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srd_equipment" (
	"index" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"equipment_category" varchar(100) NOT NULL,
	"weapon_category" varchar(100),
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srd_magic_items" (
	"index" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"rarity" varchar(50) NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srd_magic_schools" (
	"index" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srd_monsters" (
	"index" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"challenge_rating" numeric(6, 3) NOT NULL,
	"monster_type" varchar(100) NOT NULL,
	"size" varchar(50) NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srd_races" (
	"index" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srd_skills" (
	"index" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srd_spells" (
	"index" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"level" integer NOT NULL,
	"school" varchar(100) NOT NULL,
	"concentration" boolean DEFAULT false NOT NULL,
	"ritual" boolean DEFAULT false NOT NULL,
	"classes" text[] DEFAULT '{}' NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srd_weapon_properties" (
	"index" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"data" jsonb NOT NULL
);
