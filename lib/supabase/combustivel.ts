// lib/supabase/combustivel.ts
// Utilities for fuel management and control

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface CartaoCombustivel {
  id: string
  user_id: string
  numero_cartao: string
  veiculo_id: string
  bandeira: string
  data_validade: string
  limite_mensal: number
  saldo_disponivel: number
  ativo: boolean
  observacao?: string
  created_at: string
  updated_at: string
}

export interface CombustivelLimite {
  id: string
  user_id: string
  veiculo_id: string
  limite_diario: number
  limite_semanal: number
  limite_mensal: number
  alerta_percentual: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export async function criarCartaoCombustivel(
  userId: string,
  numeroCartao: string,
  veiculoId: string,
  bandeira: string,
  dataValidade: string,
  limiteMensal: number,
  observacao?: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('cartao_combustivel')
      .insert({
        user_id: userId,
        numero_cartao: numeroCartao,
        veiculo_id: veiculoId,
        bandeira,
        data_validade: dataValidade,
        limite_mensal: limiteMensal,
        saldo_disponivel: limiteMensal,
        ativo: true,
        observacao: observacao || null
      })
      .select('id')
      .single()

    if (error) {
      console.error('Erro ao criar cartão:', error)
      return null
    }

    return data?.id || null
  } catch (error) {
    console.error('Erro ao criar cartão combustível:', error)
    return null
  }
}

export async function obterCartoesCombustivel(
  userId: string,
  veiculoId?: string
): Promise<CartaoCombustivel[]> {
  try {
    let query = supabase
      .from('cartao_combustivel')
      .select('*')
      .eq('user_id', userId)

    if (veiculoId) {
      query = query.eq('veiculo_id', veiculoId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.warn('Erro ao obter cartões:', error)
      return []
    }

    return (data || []) as CartaoCombustivel[]
  } catch (error) {
    console.error('Erro ao obter cartões combustível:', error)
    return []
  }
}

export async function atualizarSaldoCartao(
  userId: string,
  cartaoId: string,
  novoSaldo: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('cartao_combustivel')
      .update({
        saldo_disponivel: novoSaldo,
        updated_at: new Date().toISOString()
      })
      .eq('id', cartaoId)
      .eq('user_id', userId)

    if (error) {
      console.error('Erro ao atualizar saldo:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Erro ao atualizar saldo cartão:', error)
    return false
  }
}

export async function desativarCartao(
  userId: string,
  cartaoId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('cartao_combustivel')
      .update({
        ativo: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', cartaoId)
      .eq('user_id', userId)

    if (error) {
      console.error('Erro ao desativar cartão:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Erro ao desativar cartão:', error)
    return false
  }
}

export async function criarLimiteCombustivel(
  userId: string,
  veiculoId: string,
  limiteDiario: number,
  limiteSemanal: number,
  limiteMensal: number,
  alertaPercentual: number = 20
): Promise<string | null> {
  try {
    // Verificar se já existe limite para este veículo
    const { data: existente } = await supabase
      .from('combustivel_limites')
      .select('id')
      .eq('user_id', userId)
      .eq('veiculo_id', veiculoId)
      .single()

    if (existente) {
      // Atualizar
      const { error } = await supabase
        .from('combustivel_limites')
        .update({
          limite_diario: limiteDiario,
          limite_semanal: limiteSemanal,
          limite_mensal: limiteMensal,
          alerta_percentual: alertaPercentual,
          updated_at: new Date().toISOString()
        })
        .eq('id', existente.id)

      if (error) throw error
      return existente.id
    } else {
      // Criar novo
      const { data, error } = await supabase
        .from('combustivel_limites')
        .insert({
          user_id: userId,
          veiculo_id: veiculoId,
          limite_diario: limiteDiario,
          limite_semanal: limiteSemanal,
          limite_mensal: limiteMensal,
          alerta_percentual: alertaPercentual,
          ativo: true
        })
        .select('id')
        .single()

      if (error) throw error
      return data?.id || null
    }
  } catch (error) {
    console.error('Erro ao criar limite combustível:', error)
    return null
  }
}

export async function obterLimitesCombustivel(
  userId: string,
  veiculoId?: string
): Promise<CombustivelLimite[]> {
  try {
    let query = supabase
      .from('combustivel_limites')
      .select('*')
      .eq('user_id', userId)
      .eq('ativo', true)

    if (veiculoId) {
      query = query.eq('veiculo_id', veiculoId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.warn('Erro ao obter limites:', error)
      return []
    }

    return (data || []) as CombustivelLimite[]
  } catch (error) {
    console.error('Erro ao obter limites combustível:', error)
    return []
  }
}

export async function verificarGastoCombustivel(
  userId: string,
  veiculoId: string,
  periodo: 'diario' | 'semanal' | 'mensal' = 'mensal'
): Promise<{
  gasto_atual: number
  limite: number
  percentual_utilizado: number
  alerta: boolean
}> {
  try {
    const [limites, abastecimentos] = await Promise.all([
      obterLimitesCombustivel(userId, veiculoId),
      supabase
        .from('abastecimentos')
        .select('valor_total, data')
        .eq('user_id', userId)
        .eq('veiculo_id', veiculoId)
    ])

    if (!limites.length || !abastecimentos.data) {
      return {
        gasto_atual: 0,
        limite: 0,
        percentual_utilizado: 0,
        alerta: false
      }
    }

    const limite = limites[0]
    let limitePeriodo = 0

    switch (periodo) {
      case 'diario':
        limitePeriodo = limite.limite_diario
        break
      case 'semanal':
        limitePeriodo = limite.limite_semanal
        break
      case 'mensal':
        limitePeriodo = limite.limite_mensal
        break
    }

    // Calcular gastos no período
    const agora = new Date()
    let dataInicio: Date

    switch (periodo) {
      case 'diario':
        dataInicio = new Date(agora)
        dataInicio.setHours(0, 0, 0, 0)
        break
      case 'semanal':
        dataInicio = new Date(agora)
        dataInicio.setDate(agora.getDate() - agora.getDay())
        dataInicio.setHours(0, 0, 0, 0)
        break
      case 'mensal':
        dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
        break
    }

    const gastoAtual = (abastecimentos.data as any[])
      .filter(a => new Date(a.data) >= dataInicio)
      .reduce((sum, a) => sum + (a.valor_total || 0), 0)

    const percentualUtilizado = limitePeriodo > 0 ? (gastoAtual / limitePeriodo) * 100 : 0
    const alerta = percentualUtilizado > (100 - limite.alerta_percentual)

    return {
      gasto_atual: gastoAtual,
      limite: limitePeriodo,
      percentual_utilizado: percentualUtilizado,
      alerta
    }
  } catch (error) {
    console.error('Erro ao verificar gasto combustível:', error)
    return {
      gasto_atual: 0,
      limite: 0,
      percentual_utilizado: 0,
      alerta: false
    }
  }
}

export async function obterRelatorioGastoCombustivel(
  userId: string,
  dataInicio: string,
  dataFim: string
): Promise<Array<{
  veiculo_id: string
  veiculo_nome: string
  quantidade_abastecimentos: number
  litros_total: number
  gasto_total: number
  gasto_medio: number
  consumo_medio: number
}>> {
  try {
    const { data, error } = await supabase
      .from('abastecimentos')
      .select(`
        veiculo_id,
        veiculo:veiculo_id(id, placa_cavalo),
        litros,
        valor_total
      `)
      .eq('user_id', userId)
      .gte('data', dataInicio)
      .lte('data', dataFim)

    if (error) {
      console.warn('Erro ao obter relatório:', error)
      return []
    }

    const resultMap = new Map<
      string,
      {
        veiculo_id: string
        veiculo_nome: string
        quantidade_abastecimentos: number
        litros_total: number
        gasto_total: number
        gasto_medio: number
        consumo_medio: number
      }
    >()

    data?.forEach((item: any) => {
      const veiculoId = item.veiculo_id || 'sem_veiculo'
      const veiculoNome = item.veiculo?.placa_cavalo || 'N/A'

      if (!resultMap.has(veiculoId)) {
        resultMap.set(veiculoId, {
          veiculo_id: veiculoId,
          veiculo_nome: veiculoNome,
          quantidade_abastecimentos: 0,
          litros_total: 0,
          gasto_total: 0,
          gasto_medio: 0,
          consumo_medio: 0
        })
      }

      const stats = resultMap.get(veiculoId)!
      stats.quantidade_abastecimentos += 1
      stats.litros_total += item.litros || 0
      stats.gasto_total += item.valor_total || 0
    })

    resultMap.forEach(stats => {
      stats.gasto_medio =
        stats.quantidade_abastecimentos > 0
          ? stats.gasto_total / stats.quantidade_abastecimentos
          : 0
    })

    return Array.from(resultMap.values())
  } catch (error) {
    console.error('Erro ao gerar relatório combustível:', error)
    return []
  }
}
