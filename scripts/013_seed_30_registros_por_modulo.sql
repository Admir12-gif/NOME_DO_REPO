-- =====================================================
-- TMS - SEED DE HOMOLOGACAO (30 REGISTROS POR MODULO)
-- Objetivo: popular o sistema para testar comportamento de ponta a ponta.
-- Observacao: este script usa o primeiro usuario de auth.users.
-- =====================================================

BEGIN;

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id
  INTO v_user_id
  FROM auth.users
  ORDER BY created_at NULLS LAST
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuario encontrado em auth.users. Crie um usuario antes de rodar o seed.';
  END IF;

  CREATE TEMP TABLE tmp_clientes (id UUID) ON COMMIT DROP;
  CREATE TEMP TABLE tmp_veiculos (id UUID) ON COMMIT DROP;
  CREATE TEMP TABLE tmp_motoristas (id UUID) ON COMMIT DROP;
  CREATE TEMP TABLE tmp_rotas (id UUID) ON COMMIT DROP;
  CREATE TEMP TABLE tmp_viagens (id UUID) ON COMMIT DROP;

  WITH ins AS (
    INSERT INTO public.clientes (
      user_id,
      nome,
      cidade,
      estado,
      condicao_pagamento,
      forma_pagamento,
      observacoes,
      created_at,
      updated_at
    )
    SELECT
      v_user_id,
      format('Cliente Simulado %s', lpad(gs::text, 2, '0')),
      (ARRAY['Sao Paulo','Campinas','Ribeirao Preto','Belo Horizonte','Curitiba'])[1 + (gs % 5)],
      (ARRAY['SP','SP','SP','MG','PR'])[1 + (gs % 5)],
      (ARRAY['7 dias','14 dias','21 dias','28 dias'])[1 + (gs % 4)],
      (ARRAY['Pix','Transferencia','Boleto'])[1 + (gs % 3)],
      'Seed de homologacao',
      NOW(),
      NOW()
    FROM generate_series(1, 30) AS gs
    RETURNING id
  )
  INSERT INTO tmp_clientes(id)
  SELECT id FROM ins;

  WITH ins AS (
    INSERT INTO public.veiculos (
      user_id,
      placa_cavalo,
      placa_carreta,
      modelo,
      ano,
      hodometro_atual,
      meta_consumo,
      intervalo_manutencao,
      created_at,
      updated_at
    )
    SELECT
      v_user_id,
      format('ABC%s', lpad(gs::text, 4, '0')),
      format('DEF%s', lpad(gs::text, 4, '0')),
      (ARRAY['FH 540','Actros 2651','Scania R450','DAF XF'])[1 + (gs % 4)],
      2015 + (gs % 10),
      (50000 + gs * 1375)::NUMERIC,
      (2.2 + (gs % 7) * 0.1)::NUMERIC(6,2),
      20000,
      NOW(),
      NOW()
    FROM generate_series(1, 30) AS gs
    RETURNING id
  )
  INSERT INTO tmp_veiculos(id)
  SELECT id FROM ins;

  WITH ins AS (
    INSERT INTO public.motoristas (
      user_id,
      nome,
      tipo,
      custo_fixo_mensal,
      custo_variavel_padrao,
      created_at,
      updated_at
    )
    SELECT
      v_user_id,
      format('Motorista Simulado %s', lpad(gs::text, 2, '0')),
      (ARRAY['CLT','Agregado','Terceiro'])[1 + (gs % 3)],
      (2200 + gs * 35)::NUMERIC(12,2),
      (150 + gs * 4)::NUMERIC(12,2),
      NOW(),
      NOW()
    FROM generate_series(1, 30) AS gs
    RETURNING id
  )
  INSERT INTO tmp_motoristas(id)
  SELECT id FROM ins;

  WITH ins AS (
    INSERT INTO public.rotas (
      user_id,
      nome,
      origem_cidade,
      origem_estado,
      destino_cidade,
      destino_estado,
      km_planejado,
      pedagio_planejado,
      tempo_ciclo_esperado_horas,
      locais_abastecimento,
      created_at,
      updated_at
    )
    SELECT
      v_user_id,
      format('Rota Simulada %s', lpad(gs::text, 2, '0')),
      (ARRAY['Sao Paulo','Campinas','Ribeirao Preto','Curitiba','Goiania'])[1 + (gs % 5)],
      (ARRAY['SP','SP','SP','PR','GO'])[1 + (gs % 5)],
      (ARRAY['Belo Horizonte','Uberlandia','Santos','Cuiaba','Vitoria'])[1 + (gs % 5)],
      (ARRAY['MG','MG','SP','MT','ES'])[1 + (gs % 5)],
      (380 + gs * 22)::NUMERIC(12,2),
      (65 + gs * 7)::NUMERIC(12,2),
      (8 + (gs % 10))::NUMERIC(8,2),
      'Postos definidos no planejamento',
      NOW(),
      NOW()
    FROM generate_series(1, 30) AS gs
    RETURNING id
  )
  INSERT INTO tmp_rotas(id)
  SELECT id FROM ins;

  IF to_regclass('public.postos_abastecimento') IS NOT NULL THEN
    INSERT INTO public.postos_abastecimento (
      user_id,
      nome,
      localidade,
      referencia,
      created_at,
      updated_at
    )
    SELECT
      v_user_id,
      format('Posto Simulado %s', lpad(gs::text, 2, '0')),
      (ARRAY['Marginal Tiete','BR-050','Anel Rodoviario','BR-116','BR-381'])[1 + (gs % 5)],
      'Ponto de apoio de seed',
      NOW(),
      NOW()
    FROM generate_series(1, 30) AS gs;
  END IF;

  IF to_regclass('public.rota_postos') IS NOT NULL AND to_regclass('public.postos_abastecimento') IS NOT NULL THEN
    WITH rotas_rank AS (
      SELECT id, row_number() OVER (ORDER BY id) AS rn
      FROM tmp_rotas
    ),
    postos_rank AS (
      SELECT id, row_number() OVER (ORDER BY id) AS rn
      FROM public.postos_abastecimento
      WHERE user_id = v_user_id
      ORDER BY id
      LIMIT 30
    )
    INSERT INTO public.rota_postos (rota_id, posto_id)
    SELECT r.id, p.id
    FROM rotas_rank r
    JOIN postos_rank p ON p.rn = r.rn
    ON CONFLICT DO NOTHING;
  END IF;

  WITH serie AS (
    SELECT generate_series(1, 30) AS gs
  ),
  ins AS (
    INSERT INTO public.viagens (
      user_id,
      data_inicio,
      data_fim,
      cliente_id,
      veiculo_id,
      motorista_id,
      tipo_carga,
      volume_toneladas,
      rota_id,
      rota_avulsa,
      origem_real,
      destino_real,
      planejamento_rota,
      km_real,
      valor_frete,
      status,
      ciclo_id,
      created_at,
      updated_at
    )
    SELECT
      v_user_id,
      NOW() - make_interval(days => (35 - gs)),
      CASE WHEN gs % 4 = 0 THEN NULL ELSE NOW() - make_interval(days => (34 - gs)) END,
      (SELECT id FROM tmp_clientes ORDER BY id OFFSET ((gs - 1) % 30) LIMIT 1),
      (SELECT id FROM tmp_veiculos ORDER BY id OFFSET ((gs - 1) % 30) LIMIT 1),
      (SELECT id FROM tmp_motoristas ORDER BY id OFFSET ((gs - 1) % 30) LIMIT 1),
      (ARRAY['Seca','Refrigerada','Quimica','Fracionada'])[1 + (gs % 4)],
      (14 + gs * 0.45)::NUMERIC(12,3),
      (SELECT id FROM tmp_rotas ORDER BY id OFFSET ((gs - 1) % 30) LIMIT 1),
      FALSE,
      (ARRAY['Sao Paulo/SP','Campinas/SP','Curitiba/PR','Uberlandia/MG'])[1 + (gs % 4)],
      (ARRAY['Belo Horizonte/MG','Santos/SP','Goiania/GO','Vitoria/ES'])[1 + (gs % 4)],
      jsonb_build_object(
        'origem_partida_planejada', NOW() - make_interval(days => (35 - gs)),
        'destino_chegada_planejada', NOW() - make_interval(days => (34 - gs)),
        'pontos_intermediarios', jsonb_build_array(
          jsonb_build_object(
            'nome', format('Parada %s-A', gs),
            'tipo', 'parada',
            'cidade', 'Campinas',
            'uf', 'SP',
            'chegada_planejada', NOW() - make_interval(days => (35 - gs), hours => -4),
            'partida_planejada', NOW() - make_interval(days => (35 - gs), hours => -3)
          )
        )
      ),
      (360 + gs * 19)::NUMERIC(12,2),
      (4200 + gs * 140)::NUMERIC(12,2),
      CASE
        WHEN gs % 6 = 0 THEN 'Cancelada'
        WHEN gs % 5 = 0 THEN 'Em andamento'
        WHEN gs % 2 = 0 THEN 'Concluida'
        ELSE 'Planejada'
      END,
      format('CIC-SEED-%s', lpad(gs::text, 3, '0')),
      NOW(),
      NOW()
    FROM serie
    RETURNING id
  )
  INSERT INTO tmp_viagens(id)
  SELECT id FROM ins;

  WITH viagens_rank AS (
    SELECT id, row_number() OVER (ORDER BY id) AS rn
    FROM tmp_viagens
  )
  INSERT INTO public.custos_viagem (
    user_id,
    viagem_id,
    data,
    categoria,
    valor,
    observacao,
    created_at
  )
  SELECT
    v_user_id,
    vr.id,
    CURRENT_DATE - (vr.rn % 20),
    (ARRAY['Diesel','Pedagio','Diarias','Comissao','Arla','Outros'])[1 + (vr.rn % 6)],
    (250 + vr.rn * 27)::NUMERIC(12,2),
    'Custo simulado para homologacao',
    NOW()
  FROM viagens_rank vr;

  WITH viagens_rank AS (
    SELECT id, row_number() OVER (ORDER BY id) AS rn
    FROM tmp_viagens
  )
  INSERT INTO public.contas_receber (
    user_id,
    cliente_id,
    viagem_id,
    data_emissao,
    data_vencimento,
    valor,
    status,
    data_recebimento,
    forma_pagamento,
    observacao,
    created_at,
    updated_at
  )
  SELECT
    v_user_id,
    (SELECT id FROM tmp_clientes ORDER BY id OFFSET ((vr.rn - 1) % 30) LIMIT 1),
    vr.id,
    CURRENT_DATE - (vr.rn % 15),
    CURRENT_DATE + (5 + (vr.rn % 20)),
    (4100 + vr.rn * 135)::NUMERIC(12,2),
    CASE
      WHEN vr.rn % 5 = 0 THEN 'Recebido'
      WHEN vr.rn % 7 = 0 THEN 'Atrasado'
      ELSE 'Em aberto'
    END,
    CASE WHEN vr.rn % 5 = 0 THEN CURRENT_DATE - (vr.rn % 10) ELSE NULL END,
    (ARRAY['Pix','Boleto','Transferencia'])[1 + (vr.rn % 3)],
    'Conta a receber simulada',
    NOW(),
    NOW()
  FROM viagens_rank vr;

  WITH base AS (
    SELECT generate_series(1, 30) AS gs
  )
  INSERT INTO public.contas_pagar (
    user_id,
    fornecedor,
    categoria,
    data_vencimento,
    valor,
    status,
    data_pagamento,
    motorista_id,
    observacao,
    created_at,
    updated_at
  )
  SELECT
    v_user_id,
    format('Fornecedor Simulado %s', lpad(gs::text, 2, '0')),
    (ARRAY['Diesel','Manutencao','Pedagio','Seguro','Parcela','Salario','Impostos','Adiantamento','Multa','Outros'])[1 + (gs % 10)],
    CURRENT_DATE + (gs % 25),
    (180 + gs * 63)::NUMERIC(12,2),
    CASE
      WHEN gs % 6 = 0 THEN 'Pago'
      WHEN gs % 8 = 0 THEN 'Atrasado'
      ELSE 'Em aberto'
    END,
    CASE WHEN gs % 6 = 0 THEN CURRENT_DATE - (gs % 7) ELSE NULL END,
    (SELECT id FROM tmp_motoristas ORDER BY id OFFSET ((gs - 1) % 30) LIMIT 1),
    'Conta a pagar simulada',
    NOW(),
    NOW()
  FROM base;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'abastecimentos'
      AND column_name = 'viagem_id'
  ) THEN
    WITH viagens_rank AS (
      SELECT id, row_number() OVER (ORDER BY id) AS rn
      FROM tmp_viagens
    )
    INSERT INTO public.abastecimentos (
      user_id,
      veiculo_id,
      viagem_id,
      data,
      hodometro,
      litros,
      valor_total,
      posto,
      observacao,
      created_at
    )
    SELECT
      v_user_id,
      (SELECT id FROM tmp_veiculos ORDER BY id OFFSET ((vr.rn - 1) % 30) LIMIT 1),
      vr.id,
      NOW() - make_interval(days => (vr.rn % 20), hours => (vr.rn % 12)),
      (70000 + vr.rn * 980)::NUMERIC(12,2),
      (120 + (vr.rn % 10) * 8)::NUMERIC(10,2),
      (620 + vr.rn * 33)::NUMERIC(12,2),
      format('Posto Simulado %s', lpad(vr.rn::text, 2, '0')),
      'Abastecimento simulado',
      NOW()
    FROM viagens_rank vr;
  ELSE
    WITH base AS (
      SELECT generate_series(1, 30) AS gs
    )
    INSERT INTO public.abastecimentos (
      user_id,
      veiculo_id,
      data,
      hodometro,
      litros,
      valor_total,
      posto,
      observacao,
      created_at
    )
    SELECT
      v_user_id,
      (SELECT id FROM tmp_veiculos ORDER BY id OFFSET ((gs - 1) % 30) LIMIT 1),
      NOW() - make_interval(days => (gs % 20), hours => (gs % 12)),
      (70000 + gs * 980)::NUMERIC(12,2),
      (120 + (gs % 10) * 8)::NUMERIC(10,2),
      (620 + gs * 33)::NUMERIC(12,2),
      format('Posto Simulado %s', lpad(gs::text, 2, '0')),
      'Abastecimento simulado',
      NOW()
    FROM base;
  END IF;

  WITH base AS (
    SELECT generate_series(1, 30) AS gs
  )
  INSERT INTO public.manutencoes (
    user_id,
    veiculo_id,
    data,
    hodometro,
    tipo,
    sistema,
    descricao,
    custo,
    oficina,
    veiculo_parado,
    dias_parado,
    created_at
  )
  SELECT
    v_user_id,
    (SELECT id FROM tmp_veiculos ORDER BY id OFFSET ((gs - 1) % 30) LIMIT 1),
    CURRENT_DATE - (gs % 40),
    (68000 + gs * 1120)::NUMERIC(12,2),
    CASE WHEN gs % 3 = 0 THEN 'Corretiva' ELSE 'Preventiva' END,
    (ARRAY['Motor','Freios','Pneus','Eletrica','Suspensao','Outros'])[1 + (gs % 6)],
    format('Manutencao simulada %s', lpad(gs::text, 2, '0')),
    (480 + gs * 49)::NUMERIC(12,2),
    format('Oficina %s', (ARRAY['Norte','Sul','Leste','Oeste'])[1 + (gs % 4)]),
    (gs % 4 = 0),
    CASE WHEN gs % 4 = 0 THEN 1 + (gs % 3) ELSE 0 END,
    NOW()
  FROM base;

  IF to_regclass('public.viagem_eventos') IS NOT NULL THEN
    WITH viagens_rank AS (
      SELECT id, row_number() OVER (ORDER BY id) AS rn
      FROM tmp_viagens
    )
    INSERT INTO public.viagem_eventos (
      user_id,
      viagem_id,
      tipo_evento,
      status_evento,
      titulo,
      observacao,
      local,
      previsto_em,
      ocorrido_em,
      impacto_minutos,
      payload,
      created_at,
      updated_at
    )
    SELECT
      v_user_id,
      vr.id,
      (ARRAY['chegada','saida','abastecimento','ocorrencia','pedagio','parada','espera','nova_viagem','manutencao'])[1 + (vr.rn % 9)],
      (ARRAY['concluido','em_andamento','pendente','atrasado'])[1 + (vr.rn % 4)],
      format('Evento simulado %s', lpad(vr.rn::text, 2, '0')),
      'Evento criado pelo seed de homologacao',
      (ARRAY['CD Origem','Posto','Pedagio','Cliente'])[1 + (vr.rn % 4)],
      NOW() - make_interval(days => (vr.rn % 10), hours => 2),
      NOW() - make_interval(days => (vr.rn % 10)),
      (vr.rn % 35),
      jsonb_build_object('seed', true, 'ordem', vr.rn),
      NOW(),
      NOW()
    FROM viagens_rank vr;
  END IF;
END
$$;

COMMIT;
