-- Permite agrupar varias viagens no mesmo ciclo operacional.
ALTER TABLE viagens
  ADD ciclo_id VARCHAR(64);

-- Backfill para viagens antigas: cada viagem passa a ter um ciclo padrao proprio.
UPDATE viagens
SET ciclo_id = CONCAT('CIC-', UPPER(SUBSTRING(CAST(id AS VARCHAR(64)), 1, 8)))
WHERE ciclo_id IS NULL;

CREATE INDEX idx_viagens_ciclo_id ON viagens(ciclo_id);
