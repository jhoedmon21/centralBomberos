-- Tripulación por unidad: bomberos que el chofer carga desde la tablet.
CREATE TABLE IF NOT EXISTS "UnitCrew" (
    "id" SERIAL NOT NULL,
    "unitId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'bombero',
    "status" TEXT NOT NULL DEFAULT 'en_carro',
    "joinCode" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "UnitCrew_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UnitCrew_unitId_leftAt_idx" ON "UnitCrew"("unitId", "leftAt");
CREATE UNIQUE INDEX IF NOT EXISTS "UnitCrew_joinCode_key" ON "UnitCrew"("joinCode");

DO $$
BEGIN
    ALTER TABLE "UnitCrew" ADD CONSTRAINT "UnitCrew_unitId_fkey"
        FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
