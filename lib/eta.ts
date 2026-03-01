import { normalizePontoParadaTipo, type EtaParametro, type PontoIntermediario, type Viagem, type ViagemEvento } from "@/lib/types"

export interface EtaStopCounts {
  abastecimento?: number
  pedagio?: number
  descarga?: number
  coleta?: number
  espera?: number
}

export interface EtaCalculationInput {
  viagem: Pick<Viagem, "data_inicio" | "carregado" | "rota_id" | "motorista_id" | "veiculo_id" | "eta_destino_em" | "velocidade_media_kmh">
  eventos: Pick<ViagemEvento, "tipo_evento" | "ocorrido_em">[]
  parametros: EtaParametro[]
  kmRestante: number
  paradasPrevistas?: EtaStopCounts
  etaPlanejado?: string | null
  now?: Date
}

export interface EtaCalculationResult {
  eta: Date
  atrasoMinutos: number
  velocidadeMediaKmh: number
  tempoDeslocamentoMin: number
  tempoParadasMin: number
  horaBase: Date
}

export function deriveEtaStopsFromIntermediarios(
  pontosIntermediarios?: Pick<PontoIntermediario, "tipo_parada">[] | null,
): EtaStopCounts {
  return (pontosIntermediarios || []).reduce<EtaStopCounts>((acc, ponto) => {
    const tipo = normalizePontoParadaTipo(ponto.tipo_parada)

    if (tipo === "abastecimento") {
      acc.abastecimento = (acc.abastecimento || 0) + 1
      return acc
    }

    if (tipo === "descarga") {
      acc.descarga = (acc.descarga || 0) + 1
      return acc
    }

    acc.espera = (acc.espera || 0) + 1
    return acc
  }, {})
}

const DEFAULT_GLOBAL: Omit<EtaParametro, "id" | "user_id" | "created_at" | "updated_at"> = {
  escopo: "global",
  entidade_id: null,
  velocidade_media_carregado: 55,
  velocidade_media_vazio: 65,
  parada_abastecimento_min: 25,
  parada_pedagio_min: 10,
  parada_descarga_min: 120,
  parada_coleta_min: 120,
  parada_espera_min: 60,
  ativo: true,
}

export function resolveEtaParametro(parametros: EtaParametro[], viagem: Pick<Viagem, "rota_id" | "motorista_id" | "veiculo_id">) {
  const ativos = parametros.filter((p) => p.ativo)

  const veiculo = ativos.find(
    (p) => p.escopo === "veiculo" && p.entidade_id === viagem.veiculo_id,
  )
  if (veiculo) return veiculo

  const motorista = ativos.find(
    (p) => p.escopo === "motorista" && p.entidade_id === viagem.motorista_id,
  )
  if (motorista) return motorista

  const rota = ativos.find(
    (p) => p.escopo === "rota" && p.entidade_id === viagem.rota_id,
  )
  if (rota) return rota

  const global = ativos.find(
    (p) => p.escopo === "global" && !p.entidade_id,
  )

  return global || DEFAULT_GLOBAL
}

export function resolveHoraBase(
  viagem: Pick<Viagem, "data_inicio">,
  eventos: Pick<ViagemEvento, "tipo_evento" | "ocorrido_em">[],
  now = new Date(),
): Date {
  const ultimaSaida = eventos
    .filter((evento) => evento.tipo_evento === "saida")
    .sort((a, b) => new Date(b.ocorrido_em).getTime() - new Date(a.ocorrido_em).getTime())[0]

  if (ultimaSaida?.ocorrido_em) {
    return new Date(ultimaSaida.ocorrido_em)
  }

  if (viagem.data_inicio) {
    return new Date(viagem.data_inicio)
  }

  return now
}

export function calculateEta(input: EtaCalculationInput): EtaCalculationResult {
  const horaBase = resolveHoraBase(input.viagem, input.eventos, input.now)
  const parametro = resolveEtaParametro(input.parametros, input.viagem)

  const velocidadeMediaKmh =
    input.viagem.velocidade_media_kmh ||
    (input.viagem.carregado
      ? Number(parametro.velocidade_media_carregado)
      : Number(parametro.velocidade_media_vazio))

  const tempoDeslocamentoMin = velocidadeMediaKmh > 0
    ? Math.round((Math.max(0, input.kmRestante) / velocidadeMediaKmh) * 60)
    : 0

  const paradas = input.paradasPrevistas || {}
  const tempoParadasMin =
    (paradas.abastecimento || 0) * Number(parametro.parada_abastecimento_min) +
    (paradas.pedagio || 0) * Number(parametro.parada_pedagio_min) +
    (paradas.descarga || 0) * Number(parametro.parada_descarga_min) +
    (paradas.coleta || 0) * Number(parametro.parada_coleta_min) +
    (paradas.espera || 0) * Number(parametro.parada_espera_min)

  const eta = new Date(horaBase)
  eta.setMinutes(eta.getMinutes() + tempoDeslocamentoMin + tempoParadasMin)

  const etaPlanejado = input.etaPlanejado ? new Date(input.etaPlanejado) : null
  const atrasoMinutos = etaPlanejado
    ? Math.round((eta.getTime() - etaPlanejado.getTime()) / 60000)
    : 0

  return {
    eta,
    atrasoMinutos,
    velocidadeMediaKmh,
    tempoDeslocamentoMin,
    tempoParadasMin,
    horaBase,
  }
}
