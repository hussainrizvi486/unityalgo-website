CREATE TABLE "SiteModuleApp" (
	"id" text PRIMARY KEY NOT NULL,
	"siteId" text NOT NULL,
	"appId" text NOT NULL,
	"userId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "appType" text DEFAULT 'application' NOT NULL;--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD COLUMN "modules" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "SiteModuleApp" ADD CONSTRAINT "SiteModuleApp_appId_AppCatalog_id_fk" FOREIGN KEY ("appId") REFERENCES "public"."AppCatalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SiteModuleApp" ADD CONSTRAINT "SiteModuleApp_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "SiteModuleApp_site_app_key" ON "SiteModuleApp" USING btree ("siteId","appId");--> statement-breakpoint
CREATE INDEX "SiteModuleApp_siteId_idx" ON "SiteModuleApp" USING btree ("siteId");--> statement-breakpoint
ALTER TABLE "AppCatalog" ADD CONSTRAINT "AppCatalog_appType" CHECK ("appType" in ('application', 'module'));