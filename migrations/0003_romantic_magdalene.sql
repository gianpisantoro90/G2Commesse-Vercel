ALTER TABLE "files_index" DROP CONSTRAINT "files_index_project_code_projects_code_fk";
--> statement-breakpoint
ALTER TABLE "onedrive_mappings" DROP CONSTRAINT "onedrive_mappings_project_code_projects_code_fk";
--> statement-breakpoint
ALTER TABLE "files_index" ADD CONSTRAINT "files_index_project_code_projects_code_fk" FOREIGN KEY ("project_code") REFERENCES "public"."projects"("code") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "onedrive_mappings" ADD CONSTRAINT "onedrive_mappings_project_code_projects_code_fk" FOREIGN KEY ("project_code") REFERENCES "public"."projects"("code") ON DELETE cascade ON UPDATE cascade;