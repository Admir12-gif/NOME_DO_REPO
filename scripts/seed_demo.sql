-- =============================================================
-- SCRIPT DE DEMO - TransLog TMS
-- 1) Limpa todos os dados (exceto auth.users)
-- 2) Insere 15 viagens realistas do Brasil
--
-- Como usar: cole e execute no SQL Editor do Supabase
-- =============================================================

DO $$
DECLARE
  uid UUID;

  -- Clientes
  c_avivar   UUID; c_frio     UUID; c_saudavel UUID;
  c_natura   UUID; c_resfrio  UUID;

  -- Veículos
  v1 UUID; v2 UUID; v3 UUID; v4 UUID;

  -- Motoristas
  m1 UUID; m2 UUID; m3 UUID; m4 UUID;

  -- Rotas
  r1 UUID; r2 UUID; r3 UUID; r4 UUID; r5 UUID;

  -- Viagens
  vi01 UUID; vi02 UUID; vi03 UUID; vi04 UUID; vi05 UUID;
  vi06 UUID; vi07 UUID; vi08 UUID; vi09 UUID; vi10 UUID;
  vi11 UUID; vi12 UUID; vi13 UUID; vi14 UUID; vi15 UUID;

BEGIN

  -- =========================================================
  -- 0. Pega o primeiro usuário cadastrado
  -- =========================================================
  SELECT id INTO uid FROM auth.users ORDER BY created_at LIMIT 1;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário encontrado. Crie uma conta primeiro.';
  END IF;

  -- =========================================================
  -- 1. LIMPEZA (ordem reversa de FK, com verificação de existência)
  -- =========================================================
  DELETE FROM viagem_documentos;
  DELETE FROM receitas_viagem;
  DELETE FROM viagem_eventos;
  DELETE FROM custos_viagem;
  DELETE FROM contas_receber;
  DELETE FROM contas_pagar;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'motorista_comissoes') THEN
    DELETE FROM motorista_comissoes;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'acerto_caixa') THEN
    DELETE FROM acerto_caixa;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alertas_sistema') THEN
    DELETE FROM alertas_sistema;
  END IF;
  DELETE FROM abastecimentos;
  DELETE FROM manutencoes;
  DELETE FROM viagens;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rota_postos') THEN
    DELETE FROM rota_postos;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'postos_abastecimento') THEN
    DELETE FROM postos_abastecimento;
  END IF;
  DELETE FROM rotas;
  DELETE FROM motoristas;
  DELETE FROM veiculos;
  DELETE FROM clientes;

  -- =========================================================
  -- 2. CLIENTES
  -- =========================================================
  INSERT INTO clientes (id, user_id, nome, cidade, estado, condicao_pagamento, forma_pagamento)
  VALUES
    (gen_random_uuid(), uid, 'Avivar Alimentos Ltda',         'Belém',          'PA', '30 dias',    'Pix')
    RETURNING id INTO c_avivar;

  INSERT INTO clientes (id, user_id, nome, cidade, estado, condicao_pagamento, forma_pagamento)
  VALUES (gen_random_uuid(), uid, 'Frio Sul Distribuidora',       'Porto Alegre',   'RS', '15/30 dias', 'Transferência')
    RETURNING id INTO c_frio;

  INSERT INTO clientes (id, user_id, nome, cidade, estado, condicao_pagamento, forma_pagamento)
  VALUES (gen_random_uuid(), uid, 'Saudável Atacado e Varejo',    'São Paulo',      'SP', '7/14/28',    'Boleto/Pix')
    RETURNING id INTO c_saudavel;

  INSERT INTO clientes (id, user_id, nome, cidade, estado, condicao_pagamento, forma_pagamento)
  VALUES (gen_random_uuid(), uid, 'Natura Distribuição Norte',    'Manaus',         'AM', '30 dias',    'Transferência')
    RETURNING id INTO c_natura;

  INSERT INTO clientes (id, user_id, nome, cidade, estado, condicao_pagamento, forma_pagamento)
  VALUES (gen_random_uuid(), uid, 'Resfrio Centro-Oeste',         'Goiânia',        'GO', '21 dias',    'Pix')
    RETURNING id INTO c_resfrio;

  -- =========================================================
  -- 3. VEÍCULOS
  -- =========================================================
  INSERT INTO veiculos (id, user_id, placa_cavalo, placa_carreta, modelo, ano, hodometro_atual, meta_consumo, intervalo_manutencao)
  VALUES (gen_random_uuid(), uid, 'HMV4A41', 'PAB2E33', 'Scania R450', 2021, 312800, 2.6, 20000)
    RETURNING id INTO v1;

  INSERT INTO veiculos (id, user_id, placa_cavalo, placa_carreta, modelo, ano, hodometro_atual, meta_consumo, intervalo_manutencao)
  VALUES (gen_random_uuid(), uid, 'QJT7B22', 'RDA3F11', 'Volvo FH 500', 2020, 478500, 2.4, 20000)
    RETURNING id INTO v2;

  INSERT INTO veiculos (id, user_id, placa_cavalo, placa_carreta, modelo, ano, hodometro_atual, meta_consumo, intervalo_manutencao)
  VALUES (gen_random_uuid(), uid, 'BRZ9C55', 'PAC5G44', 'Mercedes Actros 2651', 2022, 189600, 2.8, 25000)
    RETURNING id INTO v3;

  INSERT INTO veiculos (id, user_id, placa_cavalo, placa_carreta, modelo, ano, hodometro_atual, meta_consumo, intervalo_manutencao)
  VALUES (gen_random_uuid(), uid, 'STK3D88', 'MNO8H77', 'Volvo FH 460', 2019, 612000, 2.3, 20000)
    RETURNING id INTO v4;

  -- =========================================================
  -- 4. MOTORISTAS
  -- =========================================================
  INSERT INTO motoristas (id, user_id, nome, tipo, custo_fixo_mensal, custo_variavel_padrao)
  VALUES (gen_random_uuid(), uid, 'Roque Ferreira Santos',    'CLT',      4800.00, 0)      RETURNING id INTO m1;

  INSERT INTO motoristas (id, user_id, nome, tipo, custo_fixo_mensal, custo_variavel_padrao)
  VALUES (gen_random_uuid(), uid, 'Edilson Gonçalves Lima',  'Agregado', 0,       0.10)   RETURNING id INTO m2;

  INSERT INTO motoristas (id, user_id, nome, tipo, custo_fixo_mensal, custo_variavel_padrao)
  VALUES (gen_random_uuid(), uid, 'Valdir Pereira da Costa', 'CLT',      5200.00, 0)      RETURNING id INTO m3;

  INSERT INTO motoristas (id, user_id, nome, tipo, custo_fixo_mensal, custo_variavel_padrao)
  VALUES (gen_random_uuid(), uid, 'Josimar Alves Nogueira',  'Terceiro', 0,       0.12)   RETURNING id INTO m4;

  -- =========================================================
  -- 5. ROTAS
  -- =========================================================
  INSERT INTO rotas (id, user_id, nome, origem_cidade, origem_estado, destino_cidade, destino_estado, km_planejado, pedagio_planejado, tempo_ciclo_esperado_horas)
  VALUES (gen_random_uuid(), uid, 'Ponte Nova → Belém',    'Ponte Nova',    'MG', 'Belém',        'PA', 2840, 320.00, 42) RETURNING id INTO r1;

  INSERT INTO rotas (id, user_id, nome, origem_cidade, origem_estado, destino_cidade, destino_estado, km_planejado, pedagio_planejado, tempo_ciclo_esperado_horas)
  VALUES (gen_random_uuid(), uid, 'Porto Alegre → SP',     'Porto Alegre',  'RS', 'São Paulo',    'SP', 1108, 210.00, 18) RETURNING id INTO r2;

  INSERT INTO rotas (id, user_id, nome, origem_cidade, origem_estado, destino_cidade, destino_estado, km_planejado, pedagio_planejado, tempo_ciclo_esperado_horas)
  VALUES (gen_random_uuid(), uid, 'SP → Manaus',           'São Paulo',     'SP', 'Manaus',       'AM', 3900, 180.00, 72) RETURNING id INTO r3;

  INSERT INTO rotas (id, user_id, nome, origem_cidade, origem_estado, destino_cidade, destino_estado, km_planejado, pedagio_planejado, tempo_ciclo_esperado_horas)
  VALUES (gen_random_uuid(), uid, 'Goiânia → Fortaleza',  'Goiânia',       'GO', 'Fortaleza',    'CE', 2240, 195.00, 34) RETURNING id INTO r4;

  INSERT INTO rotas (id, user_id, nome, origem_cidade, origem_estado, destino_cidade, destino_estado, km_planejado, pedagio_planejado, tempo_ciclo_esperado_horas)
  VALUES (gen_random_uuid(), uid, 'Curitiba → Salvador',  'Curitiba',      'PR', 'Salvador',     'BA', 2620, 280.00, 40) RETURNING id INTO r5;

  -- =========================================================
  -- 6. VIAGENS (15 registos)
  -- =========================================================

  -- VI-01: Concluída, MG→PA
  INSERT INTO viagens (id, user_id, cliente_id, veiculo_id, motorista_id, rota_id, origem_real, destino_real, tipo_carga, volume_toneladas, valor_frete, km_real, status, data_inicio, data_fim)
  VALUES (gen_random_uuid(), uid, c_avivar, v1, m1, r1, 'Ponte Nova/MG', 'Belém/PA', 'Congelados', 26.5, 18500.00, 2840, 'Concluida',
          NOW() - INTERVAL '45 days', NOW() - INTERVAL '43 days') RETURNING id INTO vi01;

  -- VI-02: Concluída, RS→SP
  INSERT INTO viagens (id, user_id, cliente_id, veiculo_id, motorista_id, rota_id, origem_real, destino_real, tipo_carga, volume_toneladas, valor_frete, km_real, status, data_inicio, data_fim)
  VALUES (gen_random_uuid(), uid, c_frio, v2, m2, r2, 'Porto Alegre/RS', 'São Paulo/SP', 'Resfriados', 24.0, 9800.00, 1108, 'Concluida',
          NOW() - INTERVAL '38 days', NOW() - INTERVAL '37 days') RETURNING id INTO vi02;

  -- VI-03: Concluída, SP→AM
  INSERT INTO viagens (id, user_id, cliente_id, veiculo_id, motorista_id, rota_id, origem_real, destino_real, tipo_carga, volume_toneladas, valor_frete, km_real, status, data_inicio, data_fim)
  VALUES (gen_random_uuid(), uid, c_natura, v3, m3, r3, 'São Paulo/SP', 'Manaus/AM', 'Produtos secos', 22.0, 32000.00, 3900, 'Concluida',
          NOW() - INTERVAL '30 days', NOW() - INTERVAL '27 days') RETURNING id INTO vi03;

  -- VI-04: Concluída, GO→CE
  INSERT INTO viagens (id, user_id, cliente_id, veiculo_id, motorista_id, rota_id, origem_real, destino_real, tipo_carga, volume_toneladas, valor_frete, km_real, status, data_inicio, data_fim)
  VALUES (gen_random_uuid(), uid, c_resfrio, v4, m4, r4, 'Goiânia/GO', 'Fortaleza/CE', 'Granel seco', 28.0, 14500.00, 2240, 'Concluida',
          NOW() - INTERVAL '25 days', NOW() - INTERVAL '24 days') RETURNING id INTO vi04;

  -- VI-05: Concluída, PR→BA
  INSERT INTO viagens (id, user_id, cliente_id, veiculo_id, motorista_id, rota_id, origem_real, destino_real, tipo_carga, volume_toneladas, valor_frete, km_real, status, data_inicio, data_fim)
  VALUES (gen_random_uuid(), uid, c_saudavel, v1, m1, r5, 'Curitiba/PR', 'Salvador/BA', 'Resfriados', 25.5, 16200.00, 2620, 'Concluida',
          NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days') RETURNING id INTO vi05;

  -- VI-06: Concluída, MG→PA (retorno)
  INSERT INTO viagens (id, user_id, cliente_id, veiculo_id, motorista_id, rota_id, origem_real, destino_real, tipo_carga, volume_toneladas, valor_frete, km_real, status, data_inicio, data_fim)
  VALUES (gen_random_uuid(), uid, c_avivar, v2, m2, r1, 'Ponte Nova/MG', 'Belém/PA', 'Congelados', 27.0, 19000.00, 2840, 'Concluida',
          NOW() - INTERVAL '15 days', NOW() - INTERVAL '13 days') RETURNING id INTO vi06;

  -- VI-07: Concluída, RS→SP
  INSERT INTO viagens (id, user_id, cliente_id, veiculo_id, motorista_id, rota_id, origem_real, destino_real, tipo_carga, volume_toneladas, valor_frete, km_real, status, data_inicio, data_fim)
  VALUES (gen_random_uuid(), uid, c_frio, v3, m3, r2, 'Porto Alegre/RS', 'São Paulo/SP', 'Laticínios', 23.0, 10200.00, 1108, 'Concluida',
          NOW() - INTERVAL '12 days', NOW() - INTERVAL '11 days') RETURNING id INTO vi07;

  -- VI-08: Concluída, GO→CE
  INSERT INTO viagens (id, user_id, cliente_id, veiculo_id, motorista_id, rota_id, origem_real, destino_real, tipo_carga, volume_toneladas, valor_frete, km_real, status, data_inicio, data_fim)
  VALUES (gen_random_uuid(), uid, c_resfrio, v4, m1, r4, 'Goiânia/GO', 'Fortaleza/CE', 'Produtos secos', 26.0, 15000.00, 2240, 'Concluida',
          NOW() - INTERVAL '9 days', NOW() - INTERVAL '8 days') RETURNING id INTO vi08;

  -- VI-09: Em andamento, MG→PA
  INSERT INTO viagens (id, user_id, cliente_id, veiculo_id, motorista_id, rota_id, origem_real, destino_real, tipo_carga, volume_toneladas, valor_frete, status, data_inicio)
  VALUES (gen_random_uuid(), uid, c_avivar, v1, m2, r1, 'Ponte Nova/MG', 'Belém/PA', 'Congelados', 26.0, 18800.00, 'Em andamento',
          NOW() - INTERVAL '1 day') RETURNING id INTO vi09;

  -- VI-10: Em andamento, SP→AM
  INSERT INTO viagens (id, user_id, cliente_id, veiculo_id, motorista_id, rota_id, origem_real, destino_real, tipo_carga, volume_toneladas, valor_frete, status, data_inicio)
  VALUES (gen_random_uuid(), uid, c_natura, v3, m3, r3, 'São Paulo/SP', 'Manaus/AM', 'Produtos secos', 24.5, 31500.00, 'Em andamento',
          NOW() - INTERVAL '2 days') RETURNING id INTO vi10;

  -- VI-11: Em andamento, RS→SP
  INSERT INTO viagens (id, user_id, cliente_id, veiculo_id, motorista_id, rota_id, origem_real, destino_real, tipo_carga, volume_toneladas, valor_frete, status, data_inicio)
  VALUES (gen_random_uuid(), uid, c_frio, v2, m4, r2, 'Porto Alegre/RS', 'São Paulo/SP', 'Resfriados', 22.5, 9500.00, 'Em andamento',
          NOW() - INTERVAL '12 hours') RETURNING id INTO vi11;

  -- VI-12: Planejada, PR→BA
  INSERT INTO viagens (id, user_id, cliente_id, veiculo_id, motorista_id, rota_id, origem_real, destino_real, tipo_carga, volume_toneladas, valor_frete, status, data_inicio)
  VALUES (gen_random_uuid(), uid, c_saudavel, v4, m1, r5, 'Curitiba/PR', 'Salvador/BA', 'Resfriados', 25.0, 16500.00, 'Planejada',
          NOW() + INTERVAL '2 days') RETURNING id INTO vi12;

  -- VI-13: Planejada, MG→PA
  INSERT INTO viagens (id, user_id, cliente_id, veiculo_id, motorista_id, rota_id, origem_real, destino_real, tipo_carga, volume_toneladas, valor_frete, status, data_inicio)
  VALUES (gen_random_uuid(), uid, c_avivar, v2, m2, r1, 'Ponte Nova/MG', 'Belém/PA', 'Congelados', 27.5, 19200.00, 'Planejada',
          NOW() + INTERVAL '4 days') RETURNING id INTO vi13;

  -- VI-14: Planejada, GO→CE
  INSERT INTO viagens (id, user_id, cliente_id, veiculo_id, motorista_id, rota_id, origem_real, destino_real, tipo_carga, volume_toneladas, valor_frete, status, data_inicio)
  VALUES (gen_random_uuid(), uid, c_resfrio, v3, m3, r4, 'Goiânia/GO', 'Fortaleza/CE', 'Granel seco', 28.0, 14800.00, 'Planejada',
          NOW() + INTERVAL '5 days') RETURNING id INTO vi14;

  -- VI-15: Cancelada, SP→AM
  INSERT INTO viagens (id, user_id, cliente_id, veiculo_id, motorista_id, rota_id, origem_real, destino_real, tipo_carga, volume_toneladas, valor_frete, status, data_inicio, data_fim)
  VALUES (gen_random_uuid(), uid, c_natura, v1, m4, r3, 'São Paulo/SP', 'Manaus/AM', 'Produtos secos', 20.0, 30000.00, 'Cancelada',
          NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days') RETURNING id INTO vi15;

  -- =========================================================
  -- 7. EVENTOS DAS VIAGENS (concluídas e em andamento)
  -- =========================================================

  -- VI-01 eventos (concluída)
  INSERT INTO viagem_eventos (user_id, viagem_id, tipo_evento, status_evento, titulo, local, ocorrido_em, previsto_em, impacto_minutos)
  VALUES
    (uid, vi01, 'saida',          'concluido', 'Saída da base',          'Ponte Nova/MG',    NOW()-INTERVAL '45 days',               NOW()-INTERVAL '45 days',                0),
    (uid, vi01, 'abastecimento',  'concluido', 'Abastecimento em rota',  'Posto BR - Goiânia/GO', NOW()-INTERVAL '44 days 18 hours',  NOW()-INTERVAL '44 days 18 hours',       0),
    (uid, vi01, 'parada',         'concluido', 'Parada descanso',        'Marabá/PA',        NOW()-INTERVAL '44 days 6 hours',        NOW()-INTERVAL '44 days 6 hours',        120),
    (uid, vi01, 'chegada',        'concluido', 'Chegada ao destino',     'Belém/PA',         NOW()-INTERVAL '43 days',               NOW()-INTERVAL '43 days',                0);

  -- VI-02 eventos (concluída)
  INSERT INTO viagem_eventos (user_id, viagem_id, tipo_evento, status_evento, titulo, local, ocorrido_em, previsto_em, impacto_minutos)
  VALUES
    (uid, vi02, 'saida',  'concluido', 'Saída de Porto Alegre', 'Porto Alegre/RS', NOW()-INTERVAL '38 days',             NOW()-INTERVAL '38 days',              0),
    (uid, vi02, 'parada', 'concluido', 'Parada operacional',    'Curitiba/PR',     NOW()-INTERVAL '37 days 18 hours',    NOW()-INTERVAL '37 days 18 hours',     60),
    (uid, vi02, 'chegada','concluido', 'Chegada em São Paulo',  'São Paulo/SP',    NOW()-INTERVAL '37 days',             NOW()-INTERVAL '37 days',              0);

  -- VI-09 eventos (em andamento — partiu, ainda em trânsito)
  INSERT INTO viagem_eventos (user_id, viagem_id, tipo_evento, status_evento, titulo, local, ocorrido_em, previsto_em, impacto_minutos)
  VALUES
    (uid, vi09, 'saida',         'concluido',   'Saída de Ponte Nova',   'Ponte Nova/MG',    NOW()-INTERVAL '1 day',          NOW()-INTERVAL '1 day',          0),
    (uid, vi09, 'abastecimento', 'concluido',   'Abastecimento Goiânia', 'Posto Shell - Goiânia/GO', NOW()-INTERVAL '16 hours', NOW()-INTERVAL '16 hours',  0),
    (uid, vi09, 'parada',        'em_andamento','Parada cliente',        'Marabá/PA',        NOW()-INTERVAL '4 hours',        NOW()-INTERVAL '4 hours',        180);

  -- VI-10 eventos (em andamento)
  INSERT INTO viagem_eventos (user_id, viagem_id, tipo_evento, status_evento, titulo, local, ocorrido_em, previsto_em, impacto_minutos)
  VALUES
    (uid, vi10, 'saida',         'concluido', 'Saída de São Paulo',     'São Paulo/SP',  NOW()-INTERVAL '2 days',     NOW()-INTERVAL '2 days',    0),
    (uid, vi10, 'abastecimento', 'concluido', 'Abastecimento Palmas',   'Palmas/TO',     NOW()-INTERVAL '1 day 6 hours', NOW()-INTERVAL '1 day 6 hours', 0);

  -- VI-11 eventos (em andamento — saiu há pouco)
  INSERT INTO viagem_eventos (user_id, viagem_id, tipo_evento, status_evento, titulo, local, ocorrido_em, previsto_em, impacto_minutos)
  VALUES
    (uid, vi11, 'saida', 'concluido', 'Saída de Porto Alegre', 'Porto Alegre/RS', NOW()-INTERVAL '12 hours', NOW()-INTERVAL '12 hours', 0);

  -- =========================================================
  -- 8. CUSTOS DAS VIAGENS (concluídas)
  -- =========================================================
  INSERT INTO custos_viagem (user_id, viagem_id, data, categoria, valor, observacao)
  VALUES
    -- VI-01
    (uid, vi01, (NOW()-INTERVAL '44 days')::date, 'Diesel',               3200.00, 'Abastecimento total 1250L'),
    (uid, vi01, (NOW()-INTERVAL '44 days')::date, 'Outros',                320.00, 'Pedágio Via Dutra + BR-153'),
    (uid, vi01, (NOW()-INTERVAL '44 days')::date, 'Outros',                240.00, 'Diarias/Alimentacao - 2 diarias motorista'),
    -- VI-02
    (uid, vi02, (NOW()-INTERVAL '37 days')::date, 'Diesel',               1200.00, 'Abastecimento total 490L'),
    (uid, vi02, (NOW()-INTERVAL '37 days')::date, 'Outros',                210.00, 'Pedágio BR-116'),
    -- VI-03
    (uid, vi03, (NOW()-INTERVAL '28 days')::date, 'Diesel',               4500.00, 'Abastecimento total 1700L'),
    (uid, vi03, (NOW()-INTERVAL '28 days')::date, 'Outros',                180.00, 'Pedágio BR-364'),
    (uid, vi03, (NOW()-INTERVAL '28 days')::date, 'Outros',                360.00, 'Diarias/Alimentacao - 3 diarias motorista'),
    -- VI-04
    (uid, vi04, (NOW()-INTERVAL '24 days')::date, 'Diesel',               2800.00, 'Abastecimento total 1100L'),
    (uid, vi04, (NOW()-INTERVAL '24 days')::date, 'Outros',                195.00, 'Pedágio BR-153'),
    -- VI-05
    (uid, vi05, (NOW()-INTERVAL '18 days')::date, 'Diesel',               3100.00, 'Abastecimento total 1180L'),
    (uid, vi05, (NOW()-INTERVAL '18 days')::date, 'Outros',                280.00, 'Pedágio BR-116'),
    (uid, vi05, (NOW()-INTERVAL '18 days')::date, 'Outros',                240.00, 'Diarias/Alimentacao - 2 diarias');

  -- =========================================================
  -- 9. RECEITAS DAS VIAGENS
  -- =========================================================
  INSERT INTO receitas_viagem (user_id, viagem_id, data, tipo, descricao, valor)
  VALUES
    (uid, vi01, (NOW()-INTERVAL '43 days')::date, 'Frete principal', 'Frete Ponte Nova→Belém',    18500.00),
    (uid, vi02, (NOW()-INTERVAL '37 days')::date, 'Frete principal', 'Frete Porto Alegre→SP',      9800.00),
    (uid, vi03, (NOW()-INTERVAL '27 days')::date, 'Frete principal', 'Frete SP→Manaus',           32000.00),
    (uid, vi03, (NOW()-INTERVAL '27 days')::date, 'Receita extra',   'Frete retorno Manaus→SP',    8500.00),
    (uid, vi04, (NOW()-INTERVAL '24 days')::date, 'Frete principal', 'Frete Goiânia→Fortaleza',   14500.00),
    (uid, vi05, (NOW()-INTERVAL '18 days')::date, 'Frete principal', 'Frete Curitiba→Salvador',   16200.00),
    (uid, vi06, (NOW()-INTERVAL '13 days')::date, 'Frete principal', 'Frete Ponte Nova→Belém',    19000.00),
    (uid, vi07, (NOW()-INTERVAL '11 days')::date, 'Frete principal', 'Frete Porto Alegre→SP',     10200.00),
    (uid, vi08, (NOW()-INTERVAL '8 days')::date,  'Frete principal', 'Frete Goiânia→Fortaleza',   15000.00);

  -- =========================================================
  -- 10. CONTAS A RECEBER (viagens concluídas)
  -- =========================================================
  INSERT INTO contas_receber (user_id, cliente_id, viagem_id, data_emissao, data_vencimento, valor, status, data_recebimento, forma_pagamento)
  VALUES
    (uid, c_avivar,   vi01, (NOW()-INTERVAL '43 days')::date, (NOW()-INTERVAL '13 days')::date, 18500.00, 'Recebido', (NOW()-INTERVAL '14 days')::date, 'Pix'),
    (uid, c_frio,     vi02, (NOW()-INTERVAL '37 days')::date, (NOW()-INTERVAL '7 days')::date,   9800.00, 'Recebido', (NOW()-INTERVAL '8 days')::date,  'Transferência'),
    (uid, c_natura,   vi03, (NOW()-INTERVAL '27 days')::date, (NOW()+INTERVAL '3 days')::date,  40500.00, 'Em aberto', NULL, 'Transferência'),
    (uid, c_resfrio,  vi04, (NOW()-INTERVAL '24 days')::date, (NOW()-INTERVAL '3 days')::date,  14500.00, 'Atrasado',  NULL, 'Pix'),
    (uid, c_saudavel, vi05, (NOW()-INTERVAL '18 days')::date, (NOW()+INTERVAL '2 days')::date,  16200.00, 'Em aberto', NULL, 'Boleto'),
    (uid, c_avivar,   vi06, (NOW()-INTERVAL '13 days')::date, (NOW()+INTERVAL '17 days')::date, 19000.00, 'Em aberto', NULL, 'Pix'),
    (uid, c_frio,     vi07, (NOW()-INTERVAL '11 days')::date, (NOW()+INTERVAL '4 days')::date,  10200.00, 'Em aberto', NULL, 'Transferência'),
    (uid, c_resfrio,  vi08, (NOW()-INTERVAL '8 days')::date,  (NOW()+INTERVAL '13 days')::date, 15000.00, 'Em aberto', NULL, 'Pix');

  -- =========================================================
  -- 11. CONTAS A PAGAR (despesas gerais)
  -- =========================================================
  INSERT INTO contas_pagar (user_id, fornecedor, categoria, data_vencimento, valor, status, data_pagamento, observacao)
  VALUES
    (uid, 'Posto Ipiranga Xinguara',   'Diesel',      (NOW()-INTERVAL '5 days')::date,   3200.00, 'Pago',     (NOW()-INTERVAL '5 days')::date,  'Combustível VI-01'),
    (uid, 'AutoPecas Maraba',           'Outros',      (NOW()+INTERVAL '10 days')::date,  1800.00, 'Em aberto', NULL, 'Manutencao - Troca filtros HMV4A41'),
    (uid, 'Seguradora Mapfre',         'Seguro',      (NOW()+INTERVAL '15 days')::date,  2400.00, 'Em aberto', NULL, 'Seguro frota mensal'),
    (uid, 'DETRAN/ANTT',               'Impostos',    (NOW()+INTERVAL '20 days')::date,   890.00, 'Em aberto', NULL, 'Licenciamento veículos'),
    (uid, 'Oficina Mecanica Central',  'Outros',      (NOW()-INTERVAL '2 days')::date,   3500.00, 'Atrasado',  NULL, 'Manutencao - Revisao STK3D88'),
    (uid, 'Banco do Brasil',           'Parcela',     (NOW()+INTERVAL '5 days')::date,   4200.00, 'Em aberto', NULL, 'Parcela financiamento Volvo FH');

  RAISE NOTICE '✅ Seed concluído com sucesso para o usuário: %', uid;
  RAISE NOTICE '   → 5 clientes, 4 veículos, 4 motoristas, 5 rotas';
  RAISE NOTICE '   → 15 viagens (8 concluídas, 3 em andamento, 2 planejadas, 1 cancelada, 1 a mais)';
  RAISE NOTICE '   → Eventos, custos, receitas, contas a receber e a pagar inseridos';

END $$;
