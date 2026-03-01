-- Relaciona abastecimentos ao cadastro de postos
ALTER TABLE abastecimentos
ADD COLUMN IF NOT EXISTS posto_id UUID REFERENCES postos_abastecimento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_abastecimentos_posto_id ON abastecimentos(posto_id);

-- Backfill opcional: vincula automaticamente por nome exato (case-insensitive)
UPDATE abastecimentos a
SET posto_id = p.id
FROM postos_abastecimento p
WHERE a.posto_id IS NULL
  AND a.posto IS NOT NULL
  AND lower(trim(a.posto)) = lower(trim(p.nome));
