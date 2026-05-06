// lib/supabase/viagem-operations.ts
// Comprehensive viagem operations including alerts and comissões

import { createClient } from '@supabase/supabase-js'
import type { Viagem, Veiculo } from '@/lib/types'
import {
  verificarManutencaoVencida,
  criarAlertaManutencao,
  verificarViagemAtrasada,
  criarAlertaViagemAtrasada
} from './alertas'
import { criarComissaoViagemEmAcerto } from './comissoes'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function atualizarViagemComOperacoes(
  userId: string,
  viagemId: string,
  updates: Partial<Viagem>,
  veiculo?: Veiculo
): Promise<boolean> {
  try {
    // 1. Atualizar viagem
    const { error: errorUpdate } = await supabase
      .from('viagens')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', viagemId)
      .eq('user_id', userId)

    if (errorUpdate) {
      console.error('Erro ao atualizar viagem:', errorUpdate)
      return false
    }

    // 2. Se viagem foi marcada como Concluída e tem motorista, criar comissão
    if (updates.status === 'Concluida') {
      const { data: viagemData } = await supabase
        .from('viagens')
        .select('id, motorista_id, valor_frete, status')
        .eq('id', viagemId)
        .single()

      if (viagemData) {
        const result = await criarComissaoViagemEmAcerto(
          viagemData as Viagem,
          userId
        )
        if (result) {
          console.log('Comissão criada:', result.contaPagerId)
        }
      }
    }

    // 3. Verificar atrasos e criar alertas
    if (updates.atraso_estimado_minutos !== undefined && updates.atraso_estimado_minutos > 0) {
      const { data: viagemAtrasada } = await supabase
        .from('viagens')
        .select('id, numero, atraso_estimado_minutos')
        .eq('id', viagemId)
        .single()

      if (viagemAtrasada && viagemAtrasada.atraso_estimado_minutos) {
        await criarAlertaViagemAtrasada(
          userId,
          viagemAtrasada as Viagem,
          viagemAtrasada.atraso_estimado_minutos
        )
      }
    }

    // 4. Verificar manutenção do veículo associado
    if (veiculo || updates.veiculo_id) {
      const veiculoId = veiculo?.id || updates.veiculo_id
      if (veiculoId) {
        const { data: veiculoData } = await supabase
          .from('veiculos')
          .select('*')
          .eq('id', veiculoId)
          .eq('user_id', userId)
          .single()

        if (veiculoData) {
          const manутencaoVencida = await verificarManutencaoVencida(userId, veiculoData)
          if (manутencaoVencida) {
            await criarAlertaManutencao(
              userId,
              veiculoData,
              `Hodômetro atual: ${veiculoData.hodometro_atual} km - Intervalo de manutenção: ${veiculoData.intervalo_manutencao} km`
            )
          }
        }
      }
    }

    return true
  } catch (error) {
    console.error('Erro ao atualizar viagem com operações:', error)
    return false
  }
}

export async function atualizarOdometroComAlertos(
  userId: string,
  veiculoId: string,
  novoOdometro: number
): Promise<boolean> {
  try {
    // 1. Atualizar hodômetro
    const { error: errorUpdate } = await supabase
      .from('veiculos')
      .update({
        hodometro_atual: novoOdometro,
        updated_at: new Date().toISOString()
      })
      .eq('id', veiculoId)
      .eq('user_id', userId)

    if (errorUpdate) {
      console.error('Erro ao atualizar hodômetro:', errorUpdate)
      return false
    }

    // 2. Verificar manutenção necessária
    const { data: veiculo } = await supabase
      .from('veiculos')
      .select('*')
      .eq('id', veiculoId)
      .eq('user_id', userId)
      .single()

    if (veiculo) {
      const manутencaoVencida = await verificarManutencaoVencida(userId, veiculo)
      if (manутencaoVencida) {
        await criarAlertaManutencao(
          userId,
          veiculo,
          `Hodômetro atingiu ${novoOdometro} km - Próxima manutenção vencida`
        )
      }
    }

    return true
  } catch (error) {
    console.error('Erro ao atualizar hodômetro com alertas:', error)
    return false
  }
}

export async function fecharViagemComOperacoes(
  userId: string,
  viagemId: string,
  hodometroFinal?: number,
  veiculo_id?: string
): Promise<boolean> {
  try {
    // Buscar viagem completa
    const { data: viagem, error: errViagem } = await supabase
      .from('viagens')
      .select(
        `
        *,
        veiculo:veiculo_id(id, nome, placa_cavalo, hodometro_atual, intervalo_manutencao)
      `
      )
      .eq('id', viagemId)
      .eq('user_id', userId)
      .single()

    if (errViagem || !viagem) {
      console.error('Erro ao buscar viagem:', errViagem)
      return false
    }

    // Preparar updates
    const updates: Record<string, unknown> = {
      status: 'Concluida',
      data_fim: new Date().toISOString()
    }

    // Se tem hodômetro final, atualizar veiculo
    if (hodometroFinal && veiculo_id) {
      await atualizarOdometroComAlertos(userId, veiculo_id, hodometroFinal)
    }

    // Atualizar viagem e disparar todas as operações
    return atualizarViagemComOperacoes(userId, viagemId, updates, viagem.veiculo)
  } catch (error) {
    console.error('Erro ao fechar viagem:', error)
    return false
  }
}

export async function obterViagensPorFechar(
  userId: string,
  dias: number = 7
): Promise<Viagem[]> {
  const dataLimite = new Date()
  dataLimite.setDate(dataLimite.getDate() - dias)

  const { data, error } = await supabase
    .from('viagens')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'Em andamento')
    .lte('eta_destino_em', new Date().toISOString())
    .gte('data_inicio', dataLimite.toISOString())
    .order('eta_destino_em', { ascending: true })
    .limit(20)

  if (error) {
    console.warn('Erro ao obter viagens por fechar:', error)
    return []
  }

  return (data || []) as Viagem[]
}
