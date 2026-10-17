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
    "sessionEpoch" INTEGER NOT NULL DEFAULT 0,
    "station" TEXT,
    "crew" INTEGER,
    "lat" REAL,
    "lng" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Unit" ("code", "createdAt", "crew", "id", "lat", "lng", "name", "station", "status", "statusAt", "statusSource", "type") SELECT "code", "createdAt", "crew", "id", "lat", "lng", "name", "station", "status", "statusAt", "statusSource", "type" FROM "Unit";
DROP TABLE "Unit";
ALTER TABLE "new_Unit" RENAME TO "Unit";
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");
CREATE INDEX "Unit_status_idx" ON "Unit"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
