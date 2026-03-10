CREATE TYPE "public"."entity_type" AS ENUM('monster', 'item', 'rule');
--> statement-breakpoint
CREATE TABLE "custom_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"name" varchar(200) NOT NULL,
	"base_index" varchar(100),
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_entities" ADD CONSTRAINT "custom_entities_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "custom_entities" ADD CONSTRAINT "custom_entities_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
