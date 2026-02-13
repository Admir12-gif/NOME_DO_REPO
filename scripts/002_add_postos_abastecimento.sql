-- Create postos_abastecimento table
CREATE TABLE IF NOT EXISTS postos_abastecimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  localidade TEXT,
  referencia TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create junction table for rota -> postos_abastecimento relationship
CREATE TABLE IF NOT EXISTS rota_postos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id UUID NOT NULL REFERENCES rotas(id) ON DELETE CASCADE,
  posto_id UUID NOT NULL REFERENCES postos_abastecimento(id) ON DELETE CASCADE,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rota_id, posto_id)
);

-- Enable Row Level Security
ALTER TABLE postos_abastecimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE rota_postos ENABLE ROW LEVEL SECURITY;

-- Create policies for postos_abastecimento
CREATE POLICY postos_abastecimento_select ON postos_abastecimento
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY postos_abastecimento_insert ON postos_abastecimento
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY postos_abastecimento_update ON postos_abastecimento
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY postos_abastecimento_delete ON postos_abastecimento
  FOR DELETE
  USING (user_id = auth.uid());

-- Create policies for rota_postos
CREATE POLICY rota_postos_select ON rota_postos
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM rotas WHERE id = rota_postos.rota_id AND user_id = auth.uid()));

CREATE POLICY rota_postos_insert ON rota_postos
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM rotas WHERE id = rota_postos.rota_id AND user_id = auth.uid()));

CREATE POLICY rota_postos_delete ON rota_postos
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM rotas WHERE id = rota_postos.rota_id AND user_id = auth.uid()));
