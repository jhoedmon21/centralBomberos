-- AlterTable
ALTER TABLE "Incident" ADD COLUMN "departLat" REAL;
ALTER TABLE "Incident" ADD COLUMN "departLng" REAL;

-- CreateTable
CREATE TABLE "DangerZone" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'curvas',
    "level" TEXT NOT NULL DEFAULT 'medio',
    "advisory" TEXT,
    "path" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
