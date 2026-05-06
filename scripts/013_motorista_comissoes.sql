-- =====================================================
-- TMS - MOTORISTA COMISSÕES
-- Cria tabela para gerenciar comissões por motorista
-- =====================================================

BEGIN;

-- Criar tabela de comissões motorista
CREATE TABLE IF NOT EXISTS public.motorista_comissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motorista_id UUID NOT NULL REFERENCES public.motoristas(id) ON DELETE CASCADE,
  percentual_comissao NUMERIC(5,2) NOT NULL DEFAULT 5.00 CHECK (percentual_comissao >= 0 AND percentual_comissao <= 100),
  tipo_comissao VARCHAR(50) CHECK (tipo_comissao IN ('Fixa', 'Variavel')) DEFAULT 'Variavel',
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, motorista_id)
);

-- Índices
CREATE INDEX idx_motorista_comissoes_user_id ON public.motorista_comissoes(user_id);
CREATE INDEX idx_motorista_comissoes_motorista_id ON public.motorista_comissoes(motorista_id);
CREATE INDEX idx_motorista_comissoes_ativo ON public.motorista_comissoes(ativo);

-- RLS (Row Level Security)
ALTER TABLE public.motorista_comissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Motorista comissoes access by user"
  ON public.motorista_comissoes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Função para atualizar updated_at
CREATE OR REPLACE TRIGGER update_motorista_comissoes_updated_at
  BEFORE UPDATE ON public.motorista_comissoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de histórico de comissões (auditoria)
CREATE TABLE IF NOT EXISTS public.motorista_comissoes_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  motorista_id UUID NOT NULL,
  viagem_id UUID,
  valor_frete NUMERIC(12,2) NOT NULL,
  percentual_aplicado NUMERIC(5,2) NOT NULL,
  valor_comissao NUMERIC(12,2) NOT NULL,
  data_calculo TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contas_pagar_id UUID REFERENCES public.contas_pagar(id) ON DELETE SET NULL
);

CREATE INDEX idx_motorista_comissoes_auditoria_user_id ON public.motorista_comissoes_auditoria(user_id);
CREATE INDEX idx_motorista_comissoes_auditoria_motorista_id ON public.motorista_comissoes_auditoria(motorista_id);
CREATE INDEX idx_motorista_comissoes_auditoria_viagem_id ON public.motorista_comissoes_auditoria(viagem_id);

COMMIT;
