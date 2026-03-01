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
