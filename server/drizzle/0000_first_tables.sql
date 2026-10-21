CREATE TABLE "ads" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"name" text NOT NULL,
	"image" text NOT NULL,
	"link" text DEFAULT '' NOT NULL,
	"seconds" integer DEFAULT 5 NOT NULL,
	"when" text DEFAULT 'before' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"views" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"guest_id" integer,
	"mac" text NOT NULL,
	"method" text NOT NULL,
	"minutes" integer NOT NULL,
	"ok" boolean DEFAULT true NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "controllers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"username" text NOT NULL,
	"password_sealed" text NOT NULL,
	"allow_self_signed" boolean DEFAULT false NOT NULL,
	"time_unit" text DEFAULT 'auto' NOT NULL,
	"last_test" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"mac" text NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visits" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"controller_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"site_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"access" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"code" text NOT NULL,
	"batch" text NOT NULL,
	"minutes" integer NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"down_kbps" integer,
	"up_kbps" integer,
	"data_mb" integer,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whitelist" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"mac" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"expires_at" timestamp with time zone,
	"down_kbps" integer,
	"up_kbps" integer,
	"data_mb" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_controller_id_controllers_id_fk" FOREIGN KEY ("controller_id") REFERENCES "public"."controllers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whitelist" ADD CONSTRAINT "whitelist_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connections_site_at" ON "connections" USING btree ("site_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "guests_site_mac" ON "guests" USING btree ("site_id","mac");--> statement-breakpoint
CREATE UNIQUE INDEX "vouchers_site_code" ON "vouchers" USING btree ("site_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "whitelist_site_mac" ON "whitelist" USING btree ("site_id","mac");