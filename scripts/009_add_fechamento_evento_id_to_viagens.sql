ALTER TABLE viagens
ADD fechamento_evento_id VARCHAR(64);

CREATE INDEX idx_viagens_fechamento_evento_id
ON viagens(fechamento_evento_id);