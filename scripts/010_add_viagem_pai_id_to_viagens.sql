-- Add viagem_pai_id column to viagens table to support sub-viagens (child trips)
-- This allows tracking parent-child relationships for trips within the same cycle

ALTER TABLE viagens 
ADD COLUMN viagem_pai_id UUID REFERENCES viagens(id) ON DELETE CASCADE;

-- Index for efficient lookups by parent viagem
CREATE INDEX idx_viagens_viagem_pai_id ON viagens(viagem_pai_id);
