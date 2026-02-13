-- Add viagem_id column to abastecimentos table
ALTER TABLE abastecimentos 
ADD COLUMN IF NOT EXISTS viagem_id UUID REFERENCES viagens(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_abastecimentos_viagem_id ON abastecimentos(viagem_id);
