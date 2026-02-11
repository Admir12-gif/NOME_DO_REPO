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
  data DATE NOT NULL,
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
