-- Ajusta abastecimentos para armazenar data e hora
ALTER TABLE abastecimentos
ALTER COLUMN data TYPE TIMESTAMPTZ
USING (data::timestamp AT TIME ZONE 'UTC');
