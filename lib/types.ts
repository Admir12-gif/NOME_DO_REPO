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

export interface PostoAbastecimento {
  id: string
  user_id: string
  nome: string
  localidade: string | null
  referencia: string | null
  created_at: string
  updated_at: string
}

export type PontoParadaTipo = "parada" | "descanso" | "abastecimento" | "descarga" | "ocorrencia"

export const PONTO_PARADA_TIPO_OPTIONS: ReadonlyArray<{ value: PontoParadaTipo; label: string }> = [
  { value: "parada", label: "Parada padrão" },
  { value: "descanso", label: "Descanso" },
  { value: "abastecimento", label: "Abastecimento" },
  { value: "descarga", label: "Descarga" },
  { value: "ocorrencia", label: "Ocorrência" },
]

export function normalizePontoParadaTipo(tipo?: string | null): PontoParadaTipo {
  if (!tipo) return "parada"

  const normalized = tipo
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()

  if (normalized === "descanso") return "descanso"
  if (normalized === "abastecimento") return "abastecimento"
  if (normalized === "descarga") return "descarga"
  if (normalized === "ocorrencia") return "ocorrencia"
  if (normalized === "parada" || normalized === "parada padrao" || normalized === "parada_padrao") {
    return "parada"
  }

  return "parada"
}

export function getPontoParadaTipoLabel(tipo?: string | null) {
  const normalizedTipo = normalizePontoParadaTipo(tipo)
  return PONTO_PARADA_TIPO_OPTIONS.find((option) => option.value === normalizedTipo)?.label || "Parada padrão"
}

export interface PontoIntermediario {
  cidade: string
  estado: string
  km?: number | null
  tempo_trecho_horas?: number | null
  tipo_parada?: PontoParadaTipo
  observacao?: string
}

export function normalizePontoIntermediarioKm(km?: number | string | null) {
  if (km === null || km === undefined || km === "") return null
  const parsed = typeof km === "number" ? km : Number.parseFloat(String(km).replace(",", "."))
  if (!Number.isFinite(parsed)) return null
  return parsed >= 0 ? parsed : null
}

export interface ViagemPlanejamentoIntermediario {
  chave: string
  cidade: string
  estado: string
  tipo_parada?: PontoParadaTipo
  chegada_planejada: string | null
  partida_planejada: string | null
  chegada_real?: string | null
  partida_real?: string | null
}

export interface ViagemPlanejamentoRota {
  origem_partida_planejada: string | null
  destino_chegada_planejada: string | null
  origem_partida_real?: string | null
  destino_chegada_real?: string | null
  intermediarios: ViagemPlanejamentoIntermediario[]
}

export type ViagemStatus = 'Planejada' | 'Em andamento' | 'Concluida' | 'Concluída' | 'Cancelada'

export type EventoViagemTipo =
  | 'chegada'
  | 'saida'
  | 'abastecimento'
  | 'ocorrencia'
  | 'pedagio'
  | 'parada'
  | 'espera'
  | 'nova_viagem'

export type EventoViagemStatus = 'concluido' | 'em_andamento' | 'pendente' | 'atrasado'

export type DocumentoViagemTipo =
  | 'NF'
  | 'CTE'
  | 'MDFE'
  | 'CANHOTO'
  | 'COMPROVANTE_ABASTECIMENTO'
  | 'PEDAGIO'
  | 'OCORRENCIA'
  | 'FOTO'
  | 'OUTRO'

export type EtaEscopo = 'global' | 'rota' | 'motorista' | 'veiculo'

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
  // Joined fields
  postos?: PostoAbastecimento[]
}

export interface Viagem {
  id: string
  user_id: string
  ciclo_id?: string | null
  viagem_pai_id?: string | null
  fechamento_evento_id?: string | null
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
  planejamento_rota?: ViagemPlanejamentoRota | null
  status: ViagemStatus
  chegada_carregar: string | null
  inicio_carregamento: string | null
  fim_carregamento: string | null
  chegada_descarregar: string | null
  inicio_descarga: string | null
  fim_descarga: string | null
  eta_destino_em: string | null
  eta_proximo_ponto_em: string | null
  eta_calculado_em: string | null
  atraso_estimado_minutos: number | null
  velocidade_media_kmh: number | null
  km_restante: number | null
  carregado: boolean
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

export interface ReceitaViagem {
  id: string
  user_id: string
  viagem_id: string
  data: string
  tipo: 'Frete principal' | 'Receita extra' | 'Ajuste' | 'Desconto'
  descricao: string | null
  valor: number
  created_at: string
  updated_at: string
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
  posto_id?: string | null
  viagem_id?: string | null
  data: string
  hodometro: number
  litros: number
  valor_total: number
  posto: string | null
  observacao: string | null
  created_at: string
  // Joined fields
  veiculo?: Veiculo
  posto_cadastrado?: PostoAbastecimento | null
}

export interface ViagemEvento {
  id: string
  user_id: string
  viagem_id: string
  tipo_evento: EventoViagemTipo
  status_evento: EventoViagemStatus
  titulo: string
  observacao: string | null
  local: string | null
  previsto_em: string | null
  ocorrido_em: string
  impacto_minutos: number
  comprovante_url: string | null
  payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface ViagemDocumento {
  id: string
  user_id: string
  viagem_id: string
  tipo_documento: DocumentoViagemTipo
  nome_arquivo: string
  arquivo_url: string
  observacao: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface EtaParametro {
  id: string
  user_id: string
  escopo: EtaEscopo
  entidade_id: string | null
  velocidade_media_carregado: number
  velocidade_media_vazio: number
  parada_abastecimento_min: number
  parada_pedagio_min: number
  parada_descarga_min: number
  parada_coleta_min: number
  parada_espera_min: number
  ativo: boolean
  created_at: string
  updated_at: string
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
