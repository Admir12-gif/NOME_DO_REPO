-- =====================================================
-- TMS - COMBUSTÍVEL CONTROL
-- Gerencia cartões de combustível e limites de consumo
-- =====================================================

BEGIN;

-- Tabela de cartões de combustível
CREATE TABLE IF NOT EXISTS public.cartao_combustivel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_cartao VARCHAR(50) NOT NULL,
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  bandeira VARCHAR(50),
  data_validade DATE,
  limite_mensal NUMERIC(12,2) NOT NULL CHECK (limite_mensal >= 0),
  saldo_disponivel NUMERIC(12,2) NOT NULL CHECK (saldo_disponivel >= 0),
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, numero_cartao)
);

CREATE INDEX idx_cartao_combustivel_user_id ON public.cartao_combustivel(user_id);
CREATE INDEX idx_cartao_combustivel_veiculo_id ON public.cartao_combustivel(veiculo_id);
CREATE INDEX idx_cartao_combustivel_ativo ON public.cartao_combustivel(ativo);

-- RLS
ALTER TABLE public.cartao_combustivel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cartao combustivel access by user"
  ON public.cartao_combustivel
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tabela de limites de consumo
CREATE TABLE IF NOT EXISTS public.combustivel_limites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  limite_diario NUMERIC(12,2) NOT NULL CHECK (limite_diario >= 0),
  limite_semanal NUMERIC(12,2) NOT NULL CHECK (limite_semanal >= 0),
  limite_mensal NUMERIC(12,2) NOT NULL CHECK (limite_mensal >= 0),
  alerta_percentual NUMERIC(5,2) NOT NULL DEFAULT 20 CHECK (alerta_percentual >= 0 AND alerta_percentual <= 100),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, veiculo_id)
);

CREATE INDEX idx_combustivel_limites_user_id ON public.combustivel_limites(user_id);
CREATE INDEX idx_combustivel_limites_veiculo_id ON public.combustivel_limites(veiculo_id);

-- RLS
ALTER TABLE public.combustivel_limites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Combustivel limites access by user"
  ON public.combustivel_limites
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Função para atualizar updated_at
CREATE OR REPLACE TRIGGER update_cartao_combustivel_updated_at
  BEFORE UPDATE ON public.cartao_combustivel
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_combustivel_limites_updated_at
  BEFORE UPDATE ON public.combustivel_limites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
