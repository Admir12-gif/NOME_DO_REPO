-- Planejamento operacional da rota por viagem
ALTER TABLE viagens
ADD COLUMN IF NOT EXISTS planejamento_rota JSONB;
