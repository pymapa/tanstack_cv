CREATE TABLE "assistant_chat" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_key" text NOT NULL,
	"messages" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "assistant_chat_owner_key_unique" UNIQUE("owner_key")
);
--> statement-breakpoint
CREATE INDEX "assistant_chat_updated_at_idx" ON "assistant_chat" USING btree ("updated_at");