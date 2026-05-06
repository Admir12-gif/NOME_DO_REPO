-- =====================================================
-- TMS - ACERTO DE CAIXA
-- Gerencia reconciliação entre Contas a Receber e Contas a Pagar
-- =====================================================

BEGIN;

-- Tabela de acertos de caixa
CREATE TABLE IF NOT EXISTS public.acerto_caixa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conta_receber_id UUID REFERENCES public.contas_receber(id) ON DELETE SET NULL,
  conta_pagar_id UUID REFERENCES public.contas_pagar(id) ON DELETE SET NULL,
  data_acerto TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valor_acertado NUMERIC(12,2) NOT NULL,
  saldo_pendente NUMERIC(12,2) DEFAULT 0,
  observacao TEXT,
  status VARCHAR(50) DEFAULT 'Acertado' CHECK (status IN ('Acertado', 'Parcial', 'Revertido')),
  acertado_por VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_acerto_caixa_user_id ON public.acerto_caixa(user_id);
CREATE INDEX idx_acerto_caixa_conta_receber_id ON public.acerto_caixa(conta_receber_id);
CREATE INDEX idx_acerto_caixa_conta_pagar_id ON public.acerto_caixa(conta_pagar_id);
CREATE INDEX idx_acerto_caixa_data_acerto ON public.acerto_caixa(data_acerto);
CREATE INDEX idx_acerto_caixa_status ON public.acerto_caixa(status);

-- RLS
ALTER TABLE public.acerto_caixa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acerto caixa access by user"
  ON public.acerto_caixa
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Função para atualizar updated_at
CREATE OR REPLACE TRIGGER update_acerto_caixa_updated_at
  BEFORE UPDATE ON public.acerto_caixa
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- View para resumo de acertos pendentes
CREATE OR REPLACE VIEW v_acerto_caixa_pendente AS
SELECT
  user_id,
  COUNT(*) as quantidade_acertos,
  SUM(CASE WHEN status = 'Acertado' THEN valor_acertado ELSE 0 END) as valor_acertado_total,
  SUM(saldo_pendente) as saldo_pendente_total,
  MAX(data_acerto) as ultima_data_acerto
FROM public.acerto_caixa
WHERE status IN ('Acertado', 'Parcial')
GROUP BY user_id;

COMMIT;
