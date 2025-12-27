-- Add organization_id column to chat_sessions table
-- Step 1: Add column as nullable first
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "organization_id" text;

-- Step 2: For each existing chat session, assign the user's first organization
UPDATE "chat_sessions" cs
SET "organization_id" = (
  SELECT om.organization_id
  FROM "organization_members" om
  WHERE om.user_id = cs.user_id
  ORDER BY om.created_at ASC
  LIMIT 1
)
WHERE "organization_id" IS NULL;

-- Step 3: If any sessions still don't have an organization (user has no orgs), 
-- we'll need to handle this. For now, we'll delete them or assign a default.
-- Delete sessions where user has no organizations
DELETE FROM "chat_sessions"
WHERE "organization_id" IS NULL;

-- Step 4: Make the column NOT NULL
ALTER TABLE "chat_sessions" ALTER COLUMN "organization_id" SET NOT NULL;

-- Step 5: Add foreign key constraint
ALTER TABLE "chat_sessions" 
ADD CONSTRAINT "chat_sessions_organization_id_organizations_id_fk" 
FOREIGN KEY ("organization_id") 
REFERENCES "public"."organizations"("id") 
ON DELETE cascade 
ON UPDATE no action;

