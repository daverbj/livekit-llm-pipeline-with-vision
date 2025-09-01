/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `projects` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[collectionName]` on the table `projects` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `collectionName` to the `projects` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable - Add column with default value first
ALTER TABLE "projects" ADD COLUMN "collectionName" TEXT;

-- Update existing rows to set collectionName = name
UPDATE "projects" SET "collectionName" = "name" WHERE "collectionName" IS NULL;

-- Make the column NOT NULL now that it has values
ALTER TABLE "projects" ALTER COLUMN "collectionName" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "projects_name_key" ON "projects"("name");

-- CreateIndex
CREATE UNIQUE INDEX "projects_collectionName_key" ON "projects"("collectionName");
