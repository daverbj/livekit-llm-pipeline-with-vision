/*
  Warnings:

  - A unique constraint covering the columns `[name,tenantId]` on the table `projects` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[collectionName,tenantId]` on the table `projects` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,tenantId]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username,tenantId]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tenantId` to the `projects` table without a default value. This is not possible if the table is not empty.

*/

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_name_key" ON "tenants"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants"("domain");

-- Insert a default tenant for existing data
INSERT INTO "tenants" ("id", "name", "createdAt", "updatedAt") 
VALUES ('default-tenant-id', 'Default Tenant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterEnum: Add new enum value
COMMIT;
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- DropIndex
DROP INDEX "projects_collectionName_key";

-- DropIndex
DROP INDEX "projects_name_key";

-- DropIndex
DROP INDEX "users_email_key";

-- DropIndex
DROP INDEX "users_username_key";

-- AlterTable: Add tenantId column with default value for existing records
ALTER TABLE "projects" ADD COLUMN "tenantId" TEXT;

-- Update existing projects to use the default tenant
UPDATE "projects" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;

-- Make tenantId required
ALTER TABLE "projects" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable: Add tenantId column to users (nullable for super admin)
ALTER TABLE "users" ADD COLUMN "tenantId" TEXT;

-- Update existing users to use the default tenant
UPDATE "users" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "projects_name_tenantId_key" ON "projects"("name", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_collectionName_tenantId_key" ON "projects"("collectionName", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_tenantId_key" ON "users"("email", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_tenantId_key" ON "users"("username", "tenantId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
