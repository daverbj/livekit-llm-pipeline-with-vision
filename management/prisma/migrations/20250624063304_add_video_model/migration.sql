-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('UPLOADED', 'EXTRACTING_AUDIO', 'TRANSCRIBING', 'GENERATING_STEPS', 'EMBEDDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "audioPath" TEXT,
    "transcription" TEXT,
    "tutorialSteps" TEXT,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'UPLOADED',
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
