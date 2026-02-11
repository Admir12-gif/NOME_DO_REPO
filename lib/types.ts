// TMS Database Types

export interface Cliente {
  id: string
  user_id: string
  nome: string
  cidade: string | null
  estado: string | null
  condicao_pagamento: string | null
  forma_pagamento: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface Veiculo {
  id: string
  user_id: string
  placa_cavalo: string
  placa_carreta: string | null
  modelo: string | null
  ano: number | null
  hodometro_atual: number
  meta_consumo: number | null
  intervalo_manutencao: number
  created_at: string
  updated_at: string
}

export interface Motorista {
  id: string
  user_id: string
  nome: string
  tipo: 'CLT' | 'Agregado' | 'Terceiro' | null
  custo_fixo_mensal: number
  custo_variavel_padrao: number
  created_at: string
  updated_at: string
}

export interface PontoIntermediario {
  cidade: string
  estado: string
  observacao?: string
}

export interface Rota {
  id: string
  user_id: string
  nome: string
  origem_cidade: string | null
  origem_estado: string | null
  destino_cidade: string | null
  destino_estado: string | null
  km_planejado: number | null
  pedagio_planejado: number | null
  tempo_ciclo_esperado_horas: number | null
  locais_abastecimento: string | null
  pontos_intermediarios: PontoIntermediario[] | null
  created_at: string
  updated_at: string
}

export interface Viagem {
  id: string
  user_id: string
  data_inicio: string | null
  data_fim: string | null
  cliente_id: string | null
  veiculo_id: string | null
  motorista_id: string | null
  tipo_carga: string | null
  volume_toneladas: number | null
  rota_id: string | null
  rota_avulsa: boolean
  origem_real: string | null
  destino_real: string | null
  km_real: number | null
  valor_frete: number | null
  status: 'Planejada' | 'Em andamento' | 'Concluida' | 'Cancelada'
  chegada_carregar: string | null
  inicio_carregamento: string | null
  fim_carregamento: string | null
  chegada_descarregar: string | null
  inicio_descarga: string | null
  fim_descarga: string | null
  created_at: string
  updated_at: string
  // Joined fields
  cliente?: Cliente
  veiculo?: Veiculo
  motorista?: Motorista
  rota?: Rota
}

export interface CustoViagem {
  id: string
  user_id: string
  viagem_id: string
  data: string
  categoria: 'Diesel' | 'Pedagio' | 'Diarias' | 'Comissao' | 'Arla' | 'Outros'
  valor: number
  observacao: string | null
  created_at: string
}

export interface ContaReceber {
  id: string
  user_id: string
  cliente_id: string | null
  viagem_id: string | null
  data_emissao: string
  data_vencimento: string
  valor: number
  status: 'Em aberto' | 'Recebido' | 'Atrasado'
  data_recebimento: string | null
  forma_pagamento: string | null
  observacao: string | null
  created_at: string
  updated_at: string
  // Joined fields
  cliente?: Cliente
  viagem?: Viagem
}

export interface ContaPagar {
  id: string
  user_id: string
  fornecedor: string | null
  categoria: 'Diesel' | 'Manutencao' | 'Pedagio' | 'Seguro' | 'Parcela' | 'Salario' | 'Impostos' | 'Adiantamento' | 'Multa' | 'Outros' | null
  data_vencimento: string
  valor: number
  status: 'Em aberto' | 'Pago' | 'Atrasado'
  data_pagamento: string | null
  motorista_id: string | null
  observacao: string | null
  created_at: string
  updated_at: string
  // Joined fields
  motorista?: Motorista
}

export interface Abastecimento {
  id: string
  user_id: string
  veiculo_id: string
  data: string
  hodometro: number
  litros: number
  valor_total: number
  posto: string | null
  observacao: string | null
  created_at: string
  // Joined fields
  veiculo?: Veiculo
}

export interface Manutencao {
  id: string
  user_id: string
  veiculo_id: string
  data: string
  hodometro: number
  tipo: 'Preventiva' | 'Corretiva' | null
  sistema: 'Motor' | 'Freios' | 'Pneus' | 'Eletrica' | 'Suspensao' | 'Outros' | null
  descricao: string | null
  custo: number
  oficina: string | null
  veiculo_parado: boolean
  dias_parado: number
  created_at: string
  // Joined fields
  veiculo?: Veiculo
}

// Dashboard KPI Types
export interface DashboardKPIs {
  faturamento_mes: number
  lucro_liquido: number
  margem_operacional: number
  viagens_mes: number
  km_rodados: number
  media_km_litro: number
  contas_receber_total: number
  contas_pagar_total: number
  veiculos_ativos: number
  manutencoes_pendentes: number
}
