-- =====================================================
-- TMS - PATCH COMPLEMENTAR POS UPDATE (SEM CONFLITO)
-- Execute este arquivo APENAS se voce ja rodou o script
-- "TMS - UPDATE PARA BANCO EXISTENTE".
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- 1) COLUNA USADA NO APP DE ROTAS
-- -----------------------------------------------------
ALTER TABLE public.rotas
  ADD COLUMN IF NOT EXISTS pontos_intermediarios JSONB;

-- -----------------------------------------------------
-- 2) CHECK DE tipo_evento (inclui manutencao)
-- -----------------------------------------------------
DO $$
DECLARE
  c RECORD;
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
      CHECK (
        tipo_evento IN (
          'chegada',
          'saida',
          'abastecimento',
          'ocorrencia',
          'pedagio',
          'parada',
          'espera',
          'nova_viagem',
          'manutencao'
        )
      );
  END IF;
END
$$;

-- -----------------------------------------------------
-- 3) CHECK DE custos_viagem.categoria (compat app)
-- -----------------------------------------------------
DO $$
DECLARE
  c RECORD;
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
          'Diarias',
          'Diarias/Alimentacao',
          'Comissao',
          'Comissao motorista',
          'Arla',
          'Arla/Lubrificantes',
          'Outros'
        )
      );
  END IF;
END
$$;

-- -----------------------------------------------------
-- 4) CHECK DE contas_pagar.categoria (compat app)
-- -----------------------------------------------------
DO $$
DECLARE
  c RECORD;
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

-- -----------------------------------------------------
-- 5) CHECK DE manutencoes.sistema (compat app)
-- -----------------------------------------------------
DO $$
DECLARE
  c RECORD;
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
      CHECK (
        sistema IN (
          'Motor',
          'Freios',
          'Pneus',
          'Eletrica',
          'Suspensao',
          'Outros'
        )
      );
  END IF;
END
$$;

COMMIT;
