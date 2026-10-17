-- AlterTable
ALTER TABLE "Hydrant" ADD COLUMN "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN "acceptedAt" DATETIME;

-- AlterTable
ALTER TABLE "UnitItem" ADD COLUMN "compartment" TEXT;

-- CreateTable
CREATE TABLE "AppUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'unidad',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unitId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scope" TEXT NOT NULL,
    "opId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MissionReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "incidentId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "injured" INTEGER NOT NULL DEFAULT 0,
    "observations" TEXT,
    "photoUrl" TEXT,
    "closedByUnitAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissionReport_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentCheck" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unitId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipmentCheck_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "UnitItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Unit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'bomba',
    "status" TEXT NOT NULL DEFAULT 'disponible',
    "statusAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusSource" TEXT NOT NULL DEFAULT 'sistema',
    "station" TEXT,
    "crew" INTEGER,
    "lat" REAL,
    "lng" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Unit" ("code", "createdAt", "crew", "id", "lat", "lng", "name", "station", "status", "type") SELECT "code", "createdAt", "crew", "id", "lat", "lng", "name", "station", "status", "type" FROM "Unit";
DROP TABLE "Unit";
ALTER TABLE "new_Unit" RENAME TO "Unit";
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");
CREATE INDEX "Unit_status_idx" ON "Unit"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_unitId_idx" ON "PushSubscription"("unitId");

-- CreateIndex
CREATE INDEX "Operation_createdAt_idx" ON "Operation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_scope_opId_key" ON "Operation"("scope", "opId");

-- CreateIndex
CREATE INDEX "MissionReport_incidentId_idx" ON "MissionReport"("incidentId");

-- CreateIndex
CREATE INDEX "EquipmentCheck_unitId_idx" ON "EquipmentCheck"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentCheck_unitId_itemId_day_key" ON "EquipmentCheck"("unitId", "itemId", "day");

-- CreateIndex
CREATE INDEX "Incident_unitId_status_idx" ON "Incident"("unitId", "status");
