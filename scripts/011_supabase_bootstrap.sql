-- ============================================================
-- TMS SUPABASE BOOTSTRAP (COPY/PASTE NO SQL EDITOR)
-- Projeto: NOME_DO_REPO
-- Observacao: execute em banco novo ou ambiente de homologacao.
-- ============================================================


-- ============================================================
-- BEGIN scripts/001_create_tms_schema.sql
-- ============================================================

-- TMS (Transportation Management System) Database Schema
-- MVP Version

-- ============================================
-- CADASTROS (Master Data)
-- ============================================

-- Clientes (Customers)
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cidade TEXT,
  estado TEXT,
  condicao_pagamento TEXT, -- ex: "7/14/30 dias"
  forma_pagamento TEXT, -- ex: "Pix, transferência"
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Veiculos (Vehicles - Truck + Trailer)
CREATE TABLE IF NOT EXISTS veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  placa_cavalo TEXT NOT NULL,
  placa_carreta TEXT,
  modelo TEXT,
  ano INTEGER,
  hodometro_atual DECIMAL(12,2) DEFAULT 0, -- km
  meta_consumo DECIMAL(6,2), -- km/L expected
  intervalo_manutencao INTEGER DEFAULT 20000, -- km between preventive maintenance
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Motoristas (Drivers)
CREATE TABLE IF NOT EXISTS motoristas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('CLT', 'Agregado', 'Terceiro')),
  custo_fixo_mensal DECIMAL(12,2) DEFAULT 0,
  custo_variavel_padrao DECIMAL(12,2) DEFAULT 0, -- daily/commission
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rotas (Routes - Planned)
CREATE TABLE IF NOT EXISTS rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, -- ex: "SP → BH"
  origem_cidade TEXT,
  origem_estado TEXT,
  destino_cidade TEXT,
  destino_estado TEXT,
  km_planejado DECIMAL(12,2),
  pedagio_planejado DECIMAL(12,2),
  tempo_ciclo_esperado_horas DECIMAL(8,2), -- hours
  locais_abastecimento TEXT, -- planned stops
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- OPERAÇÃO (Operations - Trips)
-- ============================================

-- Viagens (Trips - The heart of the system)
CREATE TABLE IF NOT EXISTS viagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Info
  data_inicio TIMESTAMPTZ,
  data_fim TIMESTAMPTZ,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  veiculo_id UUID REFERENCES veiculos(id) ON DELETE SET NULL,
  motorista_id UUID REFERENCES motoristas(id) ON DELETE SET NULL,
  tipo_carga TEXT, -- congelado, resfriado, granel, etc.
  volume_toneladas DECIMAL(12,3),
  
  -- Route Info
  rota_id UUID REFERENCES rotas(id) ON DELETE SET NULL,
  rota_avulsa BOOLEAN DEFAULT FALSE,
  origem_real TEXT,
  destino_real TEXT,
  planejamento_rota JSONB,
  km_real DECIMAL(12,2),
  
  -- Financial
  valor_frete DECIMAL(12,2), -- gross revenue
  
  -- Status
  status TEXT DEFAULT 'Planejada' CHECK (status IN ('Planejada', 'Em andamento', 'Concluída', 'Cancelada')),
  
  -- Time tracking (for bottleneck analysis)
  chegada_carregar TIMESTAMPTZ,
  inicio_carregamento TIMESTAMPTZ,
  fim_carregamento TIMESTAMPTZ,
  chegada_descarregar TIMESTAMPTZ,
  inicio_descarga TIMESTAMPTZ,
  fim_descarga TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custos de Viagem (Trip Costs)
CREATE TABLE IF NOT EXISTS custos_viagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viagem_id UUID NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('Diesel', 'Pedágio', 'Diárias/Alimentação', 'Comissão motorista', 'Arla/Lubrificantes', 'Outros')),
  valor DECIMAL(12,2) NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FINANCEIRO (Financial)
-- ============================================

-- Contas a Receber (Accounts Receivable)
CREATE TABLE IF NOT EXISTS contas_receber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  viagem_id UUID REFERENCES viagens(id) ON DELETE SET NULL,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'Em aberto' CHECK (status IN ('Em aberto', 'Recebido', 'Atrasado')),
  data_recebimento DATE,
  forma_pagamento TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contas a Pagar (Accounts Payable)
CREATE TABLE IF NOT EXISTS contas_pagar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fornecedor TEXT,
  categoria TEXT CHECK (categoria IN ('Diesel', 'Manutenção', 'Pedágio', 'Seguro', 'Parcela', 'Salário', 'Impostos', 'Adiantamento', 'Multa', 'Outros')),
  data_vencimento DATE NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'Em aberto' CHECK (status IN ('Em aberto', 'Pago', 'Atrasado')),
  data_pagamento DATE,
  motorista_id UUID REFERENCES motoristas(id) ON DELETE SET NULL, -- for advances/fines linked to driver
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FROTA (Fleet - Fueling and Maintenance)
-- ============================================

-- Abastecimentos (Fuel Records)
CREATE TABLE IF NOT EXISTS abastecimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  data TIMESTAMPTZ NOT NULL,
  hodometro DECIMAL(12,2) NOT NULL, -- km at time of fueling
  litros DECIMAL(10,2) NOT NULL,
  valor_total DECIMAL(12,2) NOT NULL,
  posto TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Manutenções (Maintenance Records)
CREATE TABLE IF NOT EXISTS manutencoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  hodometro DECIMAL(12,2) NOT NULL,
  tipo TEXT CHECK (tipo IN ('Preventiva', 'Corretiva')),
  sistema TEXT CHECK (sistema IN ('Motor', 'Freios', 'Pneus', 'Elétrica', 'Suspensão', 'Outros')),
  descricao TEXT,
  custo DECIMAL(12,2) NOT NULL,
  oficina TEXT,
  veiculo_parado BOOLEAN DEFAULT FALSE,
  dias_parado INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE motoristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE viagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE custos_viagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE abastecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE manutencoes ENABLE ROW LEVEL SECURITY;

-- Clientes policies
CREATE POLICY "clientes_select" ON clientes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "clientes_insert" ON clientes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clientes_update" ON clientes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "clientes_delete" ON clientes FOR DELETE USING (auth.uid() = user_id);

-- Veiculos policies
CREATE POLICY "veiculos_select" ON veiculos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "veiculos_insert" ON veiculos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "veiculos_update" ON veiculos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "veiculos_delete" ON veiculos FOR DELETE USING (auth.uid() = user_id);

-- Motoristas policies
CREATE POLICY "motoristas_select" ON motoristas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "motoristas_insert" ON motoristas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "motoristas_update" ON motoristas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "motoristas_delete" ON motoristas FOR DELETE USING (auth.uid() = user_id);

-- Rotas policies
CREATE POLICY "rotas_select" ON rotas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "rotas_insert" ON rotas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rotas_update" ON rotas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "rotas_delete" ON rotas FOR DELETE USING (auth.uid() = user_id);

-- Viagens policies
CREATE POLICY "viagens_select" ON viagens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "viagens_insert" ON viagens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "viagens_update" ON viagens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "viagens_delete" ON viagens FOR DELETE USING (auth.uid() = user_id);

-- Custos viagem policies
CREATE POLICY "custos_viagem_select" ON custos_viagem FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "custos_viagem_insert" ON custos_viagem FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "custos_viagem_update" ON custos_viagem FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "custos_viagem_delete" ON custos_viagem FOR DELETE USING (auth.uid() = user_id);

-- Contas receber policies
CREATE POLICY "contas_receber_select" ON contas_receber FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "contas_receber_insert" ON contas_receber FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contas_receber_update" ON contas_receber FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "contas_receber_delete" ON contas_receber FOR DELETE USING (auth.uid() = user_id);

-- Contas pagar policies
CREATE POLICY "contas_pagar_select" ON contas_pagar FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "contas_pagar_insert" ON contas_pagar FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contas_pagar_update" ON contas_pagar FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "contas_pagar_delete" ON contas_pagar FOR DELETE USING (auth.uid() = user_id);

-- Abastecimentos policies
CREATE POLICY "abastecimentos_select" ON abastecimentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "abastecimentos_insert" ON abastecimentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "abastecimentos_update" ON abastecimentos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "abastecimentos_delete" ON abastecimentos FOR DELETE USING (auth.uid() = user_id);

-- Manutencoes policies
CREATE POLICY "manutencoes_select" ON manutencoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "manutencoes_insert" ON manutencoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "manutencoes_update" ON manutencoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "manutencoes_delete" ON manutencoes FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- INDEXES for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_user_id ON veiculos(user_id);
CREATE INDEX IF NOT EXISTS idx_motoristas_user_id ON motoristas(user_id);
CREATE INDEX IF NOT EXISTS idx_rotas_user_id ON rotas(user_id);
CREATE INDEX IF NOT EXISTS idx_viagens_user_id ON viagens(user_id);
CREATE INDEX IF NOT EXISTS idx_viagens_status ON viagens(status);
CREATE INDEX IF NOT EXISTS idx_viagens_data_inicio ON viagens(data_inicio);
CREATE INDEX IF NOT EXISTS idx_custos_viagem_viagem_id ON custos_viagem(viagem_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_user_id ON contas_receber(user_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_status ON contas_receber(status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_user_id ON contas_pagar(user_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_veiculo_id ON abastecimentos(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculo_id ON manutencoes(veiculo_id);

-- ============================================================
-- END scripts/001_create_tms_schema.sql
-- ============================================================


-- ============================================================
-- BEGIN scripts/002_add_postos_abastecimento.sql
-- ============================================================

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

-- ============================================================
-- END scripts/002_add_postos_abastecimento.sql
-- ============================================================


-- ============================================================
-- BEGIN scripts/003_add_viagem_id_to_abastecimentos.sql
-- ============================================================

-- Add viagem_id column to abastecimentos table
ALTER TABLE abastecimentos 
ADD COLUMN IF NOT EXISTS viagem_id UUID REFERENCES viagens(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_abastecimentos_viagem_id ON abastecimentos(viagem_id);

-- ============================================================
-- END scripts/003_add_viagem_id_to_abastecimentos.sql
-- ============================================================


-- ============================================================
-- BEGIN scripts/004_cockpit_viagem_eta_docs.sql
-- ============================================================

-- Cockpit Viagem (Operacao, Financeiro, Docs, ETA)

-- ============================================
-- OPERACAO - EVENTOS DA VIAGEM
-- ============================================

CREATE TABLE IF NOT EXISTS viagem_eventos (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	viagem_id UUID NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
	tipo_evento TEXT NOT NULL CHECK (
		tipo_evento IN ('chegada', 'saida', 'abastecimento', 'ocorrencia', 'pedagio', 'parada', 'espera')
	),
	status_evento TEXT NOT NULL DEFAULT 'concluido' CHECK (
		status_evento IN ('concluido', 'em_andamento', 'pendente', 'atrasado')
	),
	titulo TEXT NOT NULL,
	observacao TEXT,
	local TEXT,
	previsto_em TIMESTAMPTZ,
	ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	impacto_minutos INTEGER NOT NULL DEFAULT 0,
	comprovante_url TEXT,
	payload JSONB,
	created_at TIMESTAMPTZ DEFAULT NOW(),
	updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FINANCEIRO - RECEITAS DA VIAGEM
-- ============================================

CREATE TABLE IF NOT EXISTS receitas_viagem (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	viagem_id UUID NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
	data DATE NOT NULL,
	tipo TEXT NOT NULL CHECK (tipo IN ('Frete principal', 'Receita extra', 'Ajuste', 'Desconto')),
	descricao TEXT,
	valor DECIMAL(12,2) NOT NULL,
	created_at TIMESTAMPTZ DEFAULT NOW(),
	updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DOCS - DOCUMENTOS DA VIAGEM
-- ============================================

CREATE TABLE IF NOT EXISTS viagem_documentos (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	viagem_id UUID NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
	tipo_documento TEXT NOT NULL CHECK (
		tipo_documento IN ('NF', 'CTE', 'MDFE', 'CANHOTO', 'COMPROVANTE_ABASTECIMENTO', 'PEDAGIO', 'OCORRENCIA', 'FOTO', 'OUTRO')
	),
	nome_arquivo TEXT NOT NULL,
	arquivo_url TEXT NOT NULL,
	observacao TEXT,
	metadata JSONB,
	created_at TIMESTAMPTZ DEFAULT NOW(),
	updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ETA - PARAMETROS POR ESCOPO
-- ============================================

CREATE TABLE IF NOT EXISTS eta_parametros (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	escopo TEXT NOT NULL CHECK (escopo IN ('global', 'rota', 'motorista', 'veiculo')),
	entidade_id UUID,
	velocidade_media_carregado DECIMAL(6,2) NOT NULL DEFAULT 55,
	velocidade_media_vazio DECIMAL(6,2) NOT NULL DEFAULT 65,
	parada_abastecimento_min INTEGER NOT NULL DEFAULT 25,
	parada_pedagio_min INTEGER NOT NULL DEFAULT 10,
	parada_descarga_min INTEGER NOT NULL DEFAULT 120,
	parada_coleta_min INTEGER NOT NULL DEFAULT 120,
	parada_espera_min INTEGER NOT NULL DEFAULT 60,
	ativo BOOLEAN NOT NULL DEFAULT TRUE,
	created_at TIMESTAMPTZ DEFAULT NOW(),
	updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AJUSTES NA TABELA VIAGENS (ETA)
-- ============================================

ALTER TABLE viagens
	ADD COLUMN IF NOT EXISTS eta_destino_em TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS eta_proximo_ponto_em TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS eta_calculado_em TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS atraso_estimado_minutos INTEGER,
	ADD COLUMN IF NOT EXISTS velocidade_media_kmh DECIMAL(6,2),
	ADD COLUMN IF NOT EXISTS km_restante DECIMAL(12,2),
	ADD COLUMN IF NOT EXISTS carregado BOOLEAN DEFAULT TRUE;

ALTER TABLE contas_pagar
	ADD COLUMN IF NOT EXISTS viagem_id UUID REFERENCES viagens(id) ON DELETE SET NULL;

-- ============================================
-- RLS
-- ============================================

ALTER TABLE viagem_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas_viagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE viagem_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE eta_parametros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viagem_eventos_select" ON viagem_eventos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "viagem_eventos_insert" ON viagem_eventos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "viagem_eventos_update" ON viagem_eventos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "viagem_eventos_delete" ON viagem_eventos FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "receitas_viagem_select" ON receitas_viagem FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "receitas_viagem_insert" ON receitas_viagem FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "receitas_viagem_update" ON receitas_viagem FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "receitas_viagem_delete" ON receitas_viagem FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "viagem_documentos_select" ON viagem_documentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "viagem_documentos_insert" ON viagem_documentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "viagem_documentos_update" ON viagem_documentos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "viagem_documentos_delete" ON viagem_documentos FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "eta_parametros_select" ON eta_parametros FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "eta_parametros_insert" ON eta_parametros FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "eta_parametros_update" ON eta_parametros FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "eta_parametros_delete" ON eta_parametros FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_viagem_eventos_viagem_id ON viagem_eventos(viagem_id);
CREATE INDEX IF NOT EXISTS idx_viagem_eventos_ocorrido_em ON viagem_eventos(ocorrido_em DESC);
CREATE INDEX IF NOT EXISTS idx_receitas_viagem_viagem_id ON receitas_viagem(viagem_id);
CREATE INDEX IF NOT EXISTS idx_viagem_documentos_viagem_id ON viagem_documentos(viagem_id);
CREATE INDEX IF NOT EXISTS idx_eta_parametros_user_escopo ON eta_parametros(user_id, escopo);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_viagem_id ON contas_pagar(viagem_id);
CREATE INDEX IF NOT EXISTS idx_viagens_eta_destino_em ON viagens(eta_destino_em);

-- ============================================================
-- END scripts/004_cockpit_viagem_eta_docs.sql
-- ============================================================


-- ============================================================
-- BEGIN scripts/005_add_posto_id_to_abastecimentos.sql
-- ============================================================

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

-- ============================================================
-- END scripts/005_add_posto_id_to_abastecimentos.sql
-- ============================================================


-- ============================================================
-- BEGIN scripts/005_create_viagem_documentos_bucket.sql
-- ============================================================

-- Storage bucket para documentos de viagem

INSERT INTO storage.buckets (id, name, public)
VALUES ('viagem-documentos', 'viagem-documentos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso por usuário (baseadas no prefixo do caminho: {user_id}/...)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'viagem_documentos_storage_select'
  ) THEN
    CREATE POLICY "viagem_documentos_storage_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'viagem-documentos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'viagem_documentos_storage_insert'
  ) THEN
    CREATE POLICY "viagem_documentos_storage_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'viagem-documentos'
      AND split_part(name, '/', 1) = auth.uid()::text
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'viagem_documentos_storage_update'
  ) THEN
    CREATE POLICY "viagem_documentos_storage_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'viagem-documentos'
      AND split_part(name, '/', 1) = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'viagem-documentos'
      AND split_part(name, '/', 1) = auth.uid()::text
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'viagem_documentos_storage_delete'
  ) THEN
    CREATE POLICY "viagem_documentos_storage_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'viagem-documentos'
      AND split_part(name, '/', 1) = auth.uid()::text
    );
  END IF;
END
$$;

-- ============================================================
-- END scripts/005_create_viagem_documentos_bucket.sql
-- ============================================================


-- ============================================================
-- BEGIN scripts/006_change_abastecimentos_data_to_timestamptz.sql
-- ============================================================

-- Ajusta abastecimentos para armazenar data e hora
ALTER TABLE abastecimentos
ALTER COLUMN data TYPE TIMESTAMPTZ
USING (data::timestamp AT TIME ZONE 'UTC');

-- ============================================================
-- END scripts/006_change_abastecimentos_data_to_timestamptz.sql
-- ============================================================


-- ============================================================
-- BEGIN scripts/007_add_planejamento_rota_to_viagens.sql
-- ============================================================

-- Planejamento operacional da rota por viagem
ALTER TABLE viagens
ADD COLUMN IF NOT EXISTS planejamento_rota JSONB;

-- ============================================================
-- END scripts/007_add_planejamento_rota_to_viagens.sql
-- ============================================================


-- ============================================================
-- BEGIN scripts/008_add_ciclo_id_to_viagens.sql
-- ============================================================

-- Permite agrupar varias viagens no mesmo ciclo operacional.
ALTER TABLE viagens
  ADD ciclo_id VARCHAR(64);

-- Backfill para viagens antigas: cada viagem passa a ter um ciclo padrao proprio.
UPDATE viagens
SET ciclo_id = CONCAT('CIC-', UPPER(SUBSTRING(CAST(id AS VARCHAR(64)), 1, 8)))
WHERE ciclo_id IS NULL;

CREATE INDEX idx_viagens_ciclo_id ON viagens(ciclo_id);

-- ============================================================
-- END scripts/008_add_ciclo_id_to_viagens.sql
-- ============================================================


-- ============================================================
-- BEGIN scripts/009_add_fechamento_evento_id_to_viagens.sql
-- ============================================================

ALTER TABLE viagens
ADD fechamento_evento_id VARCHAR(64);

CREATE INDEX idx_viagens_fechamento_evento_id
ON viagens(fechamento_evento_id);

-- ============================================================
-- END scripts/009_add_fechamento_evento_id_to_viagens.sql
-- ============================================================


-- ============================================================
-- BEGIN scripts/010_add_viagem_pai_id_to_viagens.sql
-- ============================================================

-- Add viagem_pai_id column to viagens table to support sub-viagens (child trips)
-- This allows tracking parent-child relationships for trips within the same cycle

ALTER TABLE viagens 
ADD COLUMN viagem_pai_id UUID REFERENCES viagens(id) ON DELETE CASCADE;

-- Index for efficient lookups by parent viagem
CREATE INDEX idx_viagens_viagem_pai_id ON viagens(viagem_pai_id);

-- ============================================================
-- END scripts/010_add_viagem_pai_id_to_viagens.sql
-- ============================================================


-- ============================================================
-- COMPAT PATCHES PARA O APP ATUAL
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.rotas
ADD COLUMN IF NOT EXISTS pontos_intermediarios JSONB;

DO $$
DECLARE c RECORD;
BEGIN
  IF to_regclass('public.viagens') IS NOT NULL THEN
    FOR c IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.viagens'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
      EXECUTE format('ALTER TABLE public.viagens DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE public.viagens
    ADD CONSTRAINT viagens_status_check
    CHECK (status IN ('Planejada','Em andamento','Concluida','Cancelada'));
  END IF;
END
$$;

DO $$
DECLARE c RECORD;
BEGIN
  IF to_regclass('public.viagem_eventos') IS NOT NULL THEN
    FOR c IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.viagem_eventos'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%tipo_evento%'
    LOOP
      EXECUTE format('ALTER TABLE public.viagem_eventos DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE public.viagem_eventos
    ADD CONSTRAINT viagem_eventos_tipo_evento_check
    CHECK (tipo_evento IN ('chegada','saida','abastecimento','ocorrencia','pedagio','parada','espera','nova_viagem','manutencao'));
  END IF;
END
$$;

DO $$
DECLARE c RECORD;
BEGIN
  IF to_regclass('public.custos_viagem') IS NOT NULL THEN
    FOR c IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.custos_viagem'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%categoria%'
    LOOP
      EXECUTE format('ALTER TABLE public.custos_viagem DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE public.custos_viagem
    ADD CONSTRAINT custos_viagem_categoria_check
    CHECK (
      categoria IN (
        'Diesel',
        'Pedagio',
        'Diarias','Diarias/Alimentacao',
        'Comissao','Comissao motorista',
        'Arla','Arla/Lubrificantes',
        'Outros'
      )
    );
  END IF;
END
$$;

DO $$
DECLARE c RECORD;
BEGIN
  IF to_regclass('public.contas_pagar') IS NOT NULL THEN
    FOR c IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.contas_pagar'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%categoria%'
    LOOP
      EXECUTE format('ALTER TABLE public.contas_pagar DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE public.contas_pagar
    ADD CONSTRAINT contas_pagar_categoria_check
    CHECK (
      categoria IN (
        'Diesel',
        'Manutencao',
        'Pedagio',
        'Seguro',
        'Parcela',
        'Salario',
        'Impostos',
        'Adiantamento',
        'Multa',
        'Outros'
      )
    );
  END IF;
END
$$;

DO $$
DECLARE c RECORD;
BEGIN
  IF to_regclass('public.manutencoes') IS NOT NULL THEN
    FOR c IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.manutencoes'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%sistema%'
    LOOP
      EXECUTE format('ALTER TABLE public.manutencoes DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE public.manutencoes
    ADD CONSTRAINT manutencoes_sistema_check
    CHECK (sistema IN ('Motor','Freios','Pneus','Eletrica','Suspensao','Outros'));
  END IF;
END
$$;

