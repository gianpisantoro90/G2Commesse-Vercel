ALTER TABLE "communications" ADD COLUMN "email_message_id" text;--> statement-breakpoint
ALTER TABLE "communications" ADD COLUMN "email_headers" jsonb;--> statement-breakpoint
ALTER TABLE "communications" ADD COLUMN "email_html" text;--> statement-breakpoint
ALTER TABLE "communications" ADD COLUMN "email_text" text;--> statement-breakpoint
ALTER TABLE "communications" ADD COLUMN "auto_imported" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "communications" ADD COLUMN "ai_suggestions" jsonb;--> statement-breakpoint
ALTER TABLE "communications" ADD COLUMN "ai_suggestions_status" jsonb;--> statement-breakpoint
ALTER TABLE "communications" ADD COLUMN "ai_tasks_status" jsonb;--> statement-breakpoint
ALTER TABLE "communications" ADD COLUMN "imported_at" timestamp;