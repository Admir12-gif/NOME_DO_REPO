-- =====================================================
-- TMS - ALERTAS AUTOMÁTICOS
-- Cria tabela para gerenciar alertas de manutenção
-- e atrasos de viagem
-- =====================================================

BEGIN;

-- Criar tabela de alertas
CREATE TABLE IF NOT EXISTS public.alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_alerta VARCHAR(50) NOT NULL CHECK (tipo_alerta IN ('Manutencao vencida', 'Viagem atrasada', 'Combustivel baixo', 'Documento vencido')),
  entidade_tipo VARCHAR(50) NOT NULL CHECK (entidade_tipo IN ('Veiculo', 'Viagem', 'Motorista')),
  entidade_id UUID NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  severity VARCHAR(20) DEFAULT 'normal' CHECK (severity IN ('critico', 'alto', 'normal', 'info')),
  resolvido BOOLEAN NOT NULL DEFAULT false,
  data_resolucao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_alertas_user_id ON public.alertas(user_id);
CREATE INDEX idx_alertas_tipo_alerta ON public.alertas(tipo_alerta);
CREATE INDEX idx_alertas_entidade_id ON public.alertas(entidade_id);
CREATE INDEX idx_alertas_resolvido ON public.alertas(resolvido);
CREATE INDEX idx_alertas_severity ON public.alertas(severity);
CREATE INDEX idx_alertas_created_at ON public.alertas(created_at);

-- RLS
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alertas access by user"
  ON public.alertas
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Função para atualizar updated_at
CREATE OR REPLACE TRIGGER update_alertas_updated_at
  BEFORE UPDATE ON public.alertas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de histórico de notificações
CREATE TABLE IF NOT EXISTS public.notificacoes_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alerta_id UUID NOT NULL REFERENCES public.alertas(id) ON DELETE CASCADE,
  tipo_notificacao VARCHAR(50) NOT NULL CHECK (tipo_notificacao IN ('Email', 'SMS', 'Push', 'In-app')),
  enviado BOOLEAN NOT NULL DEFAULT false,
  data_envio TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notificacoes_alertas_user_id ON public.notificacoes_alertas(user_id);
CREATE INDEX idx_notificacoes_alertas_alerta_id ON public.notificacoes_alertas(alerta_id);
CREATE INDEX idx_notificacoes_alertas_enviado ON public.notificacoes_alertas(enviado);

COMMIT;
