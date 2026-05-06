// lib/supabase/analytics.ts
// Analytics queries for rentabilidade and KPI drilling

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface RentabilidadeCliente {
  cliente_id: string
  cliente_nome: string
  quantidade_viagens: number
  valor_frete_total: number
  custos_total: number
  lucro_liquido: number
  margem_percentual: number
  km_total: number
}

export interface RentabilidadeRota {
  rota_id: string
  rota_nome: string
  quantidade_viagens: number
  valor_frete_total: number
  custos_total: number
  lucro_liquido: number
  margem_percentual: number
  distancia_km: number
}

export interface RentabilidadeVeiculo {
  veiculo_id: string
  veiculo_placa: string
  quantidade_viagens: number
  valor_frete_total: number
  custos_total: number
  lucro_liquido: number
  margem_percentual: number
  km_rodados: number
  consumo_medio: number
}

export interface KpisAvancados {
  faturamento_mes: number
  custos_mes: number
  lucro_mes: number
  margem_mes: number
  viagens_mes: number
  km_mes: number
  consumo_medio_mes: number
  ticket_medio: number
  cliente_top: RentabilidadeCliente | null
  rota_top: RentabilidadeRota | null
  veiculo_mais_ativo: RentabilidadeVeiculo | null
}

export async function obterRentabilidadePorCliente(
  userId: string,
  dataInicio: string,
  dataFim: string
): Promise<RentabilidadeCliente[]> {
  try {
    const { data, error } = await supabase
      .from('viagens')
      .select(`
        id,
        cliente_id,
        cliente:cliente_id(id, nome),
        valor_frete,
        custos_viagem(categoria, valor)
      `)
      .eq('user_id', userId)
      .eq('status', 'Concluida')
      .gte('data_fim', dataInicio)
      .lte('data_fim', dataFim)

    if (error) {
      console.warn('Erro ao obter rentabilidade por cliente:', error)
      return []
    }

    const resultMap = new Map<string, RentabilidadeCliente>()

    data?.forEach((viagem: any) => {
      const clienteId = viagem.cliente_id || 'sem_cliente'
      const clienteNome = viagem.cliente?.nome || 'Sem cliente'

      if (!resultMap.has(clienteId)) {
        resultMap.set(clienteId, {
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          quantidade_viagens: 0,
          valor_frete_total: 0,
          custos_total: 0,
          lucro_liquido: 0,
          margem_percentual: 0,
          km_total: 0
        })
      }

      const cliente = resultMap.get(clienteId)!
      cliente.quantidade_viagens += 1
      cliente.valor_frete_total += viagem.valor_frete || 0

      const custos = (viagem.custos_viagem || []).reduce(
        (sum: number, c: any) => sum + (c.valor || 0),
        0
      )
      cliente.custos_total += custos
    })

    // Calcular lucro e margem
    resultMap.forEach(cliente => {
      cliente.lucro_liquido = cliente.valor_frete_total - cliente.custos_total
      cliente.margem_percentual =
        cliente.valor_frete_total > 0
          ? (cliente.lucro_liquido / cliente.valor_frete_total) * 100
          : 0
    })

    return Array.from(resultMap.values()).sort(
      (a, b) => b.lucro_liquido - a.lucro_liquido
    )
  } catch (error) {
    console.error('Erro ao obter rentabilidade por cliente:', error)
    return []
  }
}

export async function obterRentabilidadePorRota(
  userId: string,
  dataInicio: string,
  dataFim: string
): Promise<RentabilidadeRota[]> {
  try {
    const { data, error } = await supabase
      .from('viagens')
      .select(`
        id,
        rota_id,
        rota:rota_id(id, descricao, distancia_km),
        valor_frete,
        custos_viagem(categoria, valor)
      `)
      .eq('user_id', userId)
      .eq('status', 'Concluida')
      .gte('data_fim', dataInicio)
      .lte('data_fim', dataFim)

    if (error) {
      console.warn('Erro ao obter rentabilidade por rota:', error)
      return []
    }

    const resultMap = new Map<string, RentabilidadeRota>()

    data?.forEach((viagem: any) => {
      const rotaId = viagem.rota_id || 'sem_rota'
      const rotaNome = viagem.rota?.descricao || 'Sem rota'
      const distanciaKm = viagem.rota?.distancia_km || 0

      if (!resultMap.has(rotaId)) {
        resultMap.set(rotaId, {
          rota_id: rotaId,
          rota_nome: rotaNome,
          quantidade_viagens: 0,
          valor_frete_total: 0,
          custos_total: 0,
          lucro_liquido: 0,
          margem_percentual: 0,
          distancia_km: distanciaKm
        })
      }

      const rota = resultMap.get(rotaId)!
      rota.quantidade_viagens += 1
      rota.valor_frete_total += viagem.valor_frete || 0

      const custos = (viagem.custos_viagem || []).reduce(
        (sum: number, c: any) => sum + (c.valor || 0),
        0
      )
      rota.custos_total += custos
    })

    resultMap.forEach(rota => {
      rota.lucro_liquido = rota.valor_frete_total - rota.custos_total
      rota.margem_percentual =
        rota.valor_frete_total > 0 ? (rota.lucro_liquido / rota.valor_frete_total) * 100 : 0
    })

    return Array.from(resultMap.values()).sort((a, b) => b.lucro_liquido - a.lucro_liquido)
  } catch (error) {
    console.error('Erro ao obter rentabilidade por rota:', error)
    return []
  }
}

export async function obterRentabilidadePorVeiculo(
  userId: string,
  dataInicio: string,
  dataFim: string
): Promise<RentabilidadeVeiculo[]> {
  try {
    const { data: viagens, error: errViagens } = await supabase
      .from('viagens')
      .select(`
        id,
        veiculo_id,
        veiculo:veiculo_id(id, placa_cavalo),
        valor_frete,
        custos_viagem(categoria, valor)
      `)
      .eq('user_id', userId)
      .eq('status', 'Concluida')
      .gte('data_fim', dataInicio)
      .lte('data_fim', dataFim)

    const { data: abastecimentos } = await supabase
      .from('abastecimentos')
      .select('veiculo_id, litros, hodometro')
      .eq('user_id', userId)
      .gte('data', dataInicio)
      .lte('data', dataFim)

    if (errViagens) {
      console.warn('Erro ao obter rentabilidade por veículo:', errViagens)
      return []
    }

    const resultMap = new Map<string, RentabilidadeVeiculo>()

    viagens?.forEach((viagem: any) => {
      const veiculoId = viagem.veiculo_id || 'sem_veiculo'
      const veiculoPlaca = viagem.veiculo?.placa_cavalo || 'N/A'

      if (!resultMap.has(veiculoId)) {
        resultMap.set(veiculoId, {
          veiculo_id: veiculoId,
          veiculo_placa: veiculoPlaca,
          quantidade_viagens: 0,
          valor_frete_total: 0,
          custos_total: 0,
          lucro_liquido: 0,
          margem_percentual: 0,
          km_rodados: 0,
          consumo_medio: 0
        })
      }

      const veiculo = resultMap.get(veiculoId)!
      veiculo.quantidade_viagens += 1
      veiculo.valor_frete_total += viagem.valor_frete || 0

      const custos = (viagem.custos_viagem || []).reduce(
        (sum: number, c: any) => sum + (c.valor || 0),
        0
      )
      veiculo.custos_total += custos
    })

    resultMap.forEach(veiculo => {
      veiculo.lucro_liquido = veiculo.valor_frete_total - veiculo.custos_total
      veiculo.margem_percentual =
        veiculo.valor_frete_total > 0
          ? (veiculo.lucro_liquido / veiculo.valor_frete_total) * 100
          : 0

      // Calcular consumo médio de combustível
      const abastecimentosVeiculo = abastecimentos?.filter(
        a => a.veiculo_id === veiculo.veiculo_id
      ) || []
      if (abastecimentosVeiculo.length > 0) {
        const kmTotal = abastecimentosVeiculo.reduce(
          (max, curr) => Math.max(max, curr.hodometro || 0),
          0
        )
        const litrosTotal = abastecimentosVeiculo.reduce((sum, a) => sum + (a.litros || 0), 0)
        veiculo.km_rodados = kmTotal
        veiculo.consumo_medio = kmTotal > 0 ? litrosTotal / kmTotal : 0
      }
    })

    return Array.from(resultMap.values()).sort((a, b) => b.lucro_liquido - a.lucro_liquido)
  } catch (error) {
    console.error('Erro ao obter rentabilidade por veículo:', error)
    return []
  }
}

export async function obterKpisAvancados(
  userId: string,
  dataInicio: string,
  dataFim: string
): Promise<KpisAvancados> {
  try {
    const [clientesData, rotasData, veiculosData] = await Promise.all([
      obterRentabilidadePorCliente(userId, dataInicio, dataFim),
      obterRentabilidadePorRota(userId, dataInicio, dataFim),
      obterRentabilidadePorVeiculo(userId, dataInicio, dataFim)
    ])

    return {
      faturamento_mes: clientesData.reduce((sum, c) => sum + c.valor_frete_total, 0),
      custos_mes: clientesData.reduce((sum, c) => sum + c.custos_total, 0),
      lucro_mes: clientesData.reduce((sum, c) => sum + c.lucro_liquido, 0),
      margem_mes:
        clientesData.length > 0
          ? clientesData.reduce((sum, c) => sum + c.margem_percentual, 0) /
            clientesData.length
          : 0,
      viagens_mes: clientesData.reduce((sum, c) => sum + c.quantidade_viagens, 0),
      km_mes: 0,
      consumo_medio_mes: 0,
      ticket_medio:
        clientesData.length > 0
          ? clientesData.reduce((sum, c) => sum + c.valor_frete_total, 0) /
            clientesData.reduce((sum, c) => sum + c.quantidade_viagens, 0)
          : 0,
      cliente_top: clientesData[0] || null,
      rota_top: rotasData[0] || null,
      veiculo_mais_ativo: veiculosData[0] || null
    }
  } catch (error) {
    console.error('Erro ao obter KPIs avançados:', error)
    return {
      faturamento_mes: 0,
      custos_mes: 0,
      lucro_mes: 0,
      margem_mes: 0,
      viagens_mes: 0,
      km_mes: 0,
      consumo_medio_mes: 0,
      ticket_medio: 0,
      cliente_top: null,
      rota_top: null,
      veiculo_mais_ativo: null
    }
  }
}
