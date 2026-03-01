"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Camera,
  Circle,
  Clock3,
  FileText,
  Fuel,
  Loader2,
  Plus,
  Route,
  TriangleAlert,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { calculateEta, deriveEtaStopsFromIntermediarios } from "@/lib/eta"
import type {
  CustoViagem,
  DocumentoViagemTipo,
  EtaParametro,
  EventoViagemStatus,
  EventoViagemTipo,
  ReceitaViagem,
  Viagem,
  ViagemDocumento,
  ViagemEvento,
} from "@/lib/types"
import { getPontoParadaTipoLabel, normalizePontoIntermediarioKm, normalizePontoParadaTipo } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

interface ViagemDetalheClientProps {
  viagem: Viagem
  initialEventos: ViagemEvento[]
  initialCustos: CustoViagem[]
  initialReceitas: ReceitaViagem[]
  initialDocumentos: ViagemDocumento[]
  etaParametros: EtaParametro[]
  embedded?: boolean
}

type EventFormState = {
  tipo_evento: EventoViagemTipo
  status_evento: EventoViagemStatus
  titulo: string
  local: string
  observacao: string
  impacto_minutos: string
  previsto_em: string
  comprovante_url: string
}

type CostFormState = {
  data: string
  categoria: CustoViagem["categoria"]
  valor: string
  observacao: string
}

type ReceitaFormState = {
  data: string
  tipo: ReceitaViagem["tipo"]
  valor: string
  descricao: string
}

type DocumentoFormState = {
  tipo_documento: DocumentoViagemTipo
  nome_arquivo: string
  observacao: string
}

const eventQuickActions: { label: string; type: EventoViagemTipo }[] = [
  { label: "+ Chegada/Saída", type: "chegada" },
  { label: "+ Abastecimento", type: "abastecimento" },
  { label: "+ Ocorrência", type: "ocorrencia" },
  { label: "+ Pedágio", type: "pedagio" },
  { label: "+ Parada/Espera", type: "parada" },
]

const eventQuickActionsCompactLabel: Record<EventoViagemTipo, string> = {
  chegada: "Chegada",
  saida: "Saída",
  abastecimento: "Abastecer",
  ocorrencia: "Ocorrência",
  pedagio: "Pedágio",
  parada: "Parada",
  espera: "Espera",
}

const eventTypeLabels: Record<EventoViagemTipo, string> = {
  chegada: "Chegada",
  saida: "Saída",
  abastecimento: "Abastecimento",
  ocorrencia: "Ocorrência",
  pedagio: "Pedágio",
  parada: "Parada",
  espera: "Espera",
}

const eventStatusLabel: Record<EventoViagemStatus, string> = {
  concluido: "✅ Concluído",
  em_andamento: "🟡 Em andamento",
  pendente: "⚪ Pendente",
  atrasado: "🔴 Atrasado",
}

const documentoGrupos: { label: string; tipos: DocumentoViagemTipo[] }[] = [
  { label: "NF / CT-e / MDF-e", tipos: ["NF", "CTE", "MDFE"] },
  { label: "Canhotos", tipos: ["CANHOTO"] },
  { label: "Comprovantes de abastecimento", tipos: ["COMPROVANTE_ABASTECIMENTO", "PEDAGIO"] },
  { label: "Fotos / ocorrências", tipos: ["FOTO", "OCORRENCIA"] },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDateTime(value: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatFileSize(bytes?: number) {
  if (!bytes || Number.isNaN(bytes)) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function toIsoOrNull(value?: string | null) {
  if (!value) return null
  return new Date(value).toISOString()
}

function normalizeCategoria(categoria?: string | null): CustoViagem["categoria"] {
  if (!categoria) return "Outros"

  const normalized = categoria
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()

  if (normalized === "diesel") return "Diesel"
  if (normalized === "pedagio") return "Pedagio"
  if (normalized === "diarias") return "Diarias"
  if (normalized === "comissao" || normalized === "comissao motorista") return "Comissao"
  if (normalized === "arla") return "Arla"
  return "Outros"
}

function normalizeViagemStatus(status?: string | null) {
  if (!status) return "Planejada"
  if (status === "Concluída") return "Concluida"
  return status
}

function buildIntermediarioChave(cidade?: string | null, estado?: string | null, index = 0) {
  const cidadeNormalizada = (cidade || "").trim().toLowerCase()
  const estadoNormalizado = (estado || "").trim().toLowerCase()
  return `${index}:${cidadeNormalizada}:${estadoNormalizado}`
}

export function ViagemDetalheClient({
  viagem,
  initialEventos,
  initialCustos,
  initialReceitas,
  initialDocumentos,
  etaParametros,
  embedded = false,
}: ViagemDetalheClientProps) {
  const supabase = createClient()

  const [eventos, setEventos] = useState(initialEventos)
  const [custos, setCustos] = useState(initialCustos)
  const [receitas, setReceitas] = useState(initialReceitas)
  const [documentos, setDocumentos] = useState(initialDocumentos)
  const [viagemState, setViagemState] = useState(viagem)
  const [loading, setLoading] = useState(false)

  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [activeTimelineEvent, setActiveTimelineEvent] = useState<ViagemEvento | null>(null)
  const [timelineRealModalOpen, setTimelineRealModalOpen] = useState(false)
  const [costModalOpen, setCostModalOpen] = useState(false)
  const [receitaModalOpen, setReceitaModalOpen] = useState(false)
  const [docModalOpen, setDocModalOpen] = useState(false)

  const [eventForm, setEventForm] = useState<EventFormState>({
    tipo_evento: "chegada",
    status_evento: "concluido",
    titulo: "",
    local: "",
    observacao: "",
    impacto_minutos: "0",
    previsto_em: "",
    comprovante_url: "",
  })

  const [costForm, setCostForm] = useState<CostFormState>({
    data: new Date().toISOString().split("T")[0],
    categoria: "Diesel",
    valor: "",
    observacao: "",
  })

  const [receitaForm, setReceitaForm] = useState<ReceitaFormState>({
    data: new Date().toISOString().split("T")[0],
    tipo: "Receita extra",
    valor: "",
    descricao: "",
  })

  const [docForm, setDocForm] = useState<DocumentoFormState>({
    tipo_documento: "NF",
    nome_arquivo: "",
    observacao: "",
  })
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null)
  const [timelineReal, setTimelineReal] = useState(() => ({
    origem_partida_real: toDatetimeLocal(viagem.planejamento_rota?.origem_partida_real || null),
    destino_chegada_real: toDatetimeLocal(viagem.planejamento_rota?.destino_chegada_real || null),
    intermediarios: (viagem.planejamento_rota?.intermediarios || []).map((item) => ({
      chave: item.chave,
      cidade: item.cidade,
      estado: item.estado,
      chegada_real: toDatetimeLocal(item.chegada_real || null),
      partida_real: toDatetimeLocal(item.partida_real || null),
    })),
  }))

  useEffect(() => {
    setTimelineReal({
      origem_partida_real: toDatetimeLocal(viagemState.planejamento_rota?.origem_partida_real || null),
      destino_chegada_real: toDatetimeLocal(viagemState.planejamento_rota?.destino_chegada_real || null),
      intermediarios: (viagemState.planejamento_rota?.intermediarios || []).map((item) => ({
        chave: item.chave,
        cidade: item.cidade,
        estado: item.estado,
        chegada_real: toDatetimeLocal(item.chegada_real || null),
        partida_real: toDatetimeLocal(item.partida_real || null),
      })),
    })
  }, [viagemState.planejamento_rota])

  const eventosOrdenados = useMemo(
    () => [...eventos].sort((a, b) => new Date(b.ocorrido_em).getTime() - new Date(a.ocorrido_em).getTime()),
    [eventos],
  )

  const custosTotal = useMemo(() => custos.reduce((sum, item) => sum + Number(item.valor || 0), 0), [custos])
  const receitasExtras = useMemo(() => receitas.reduce((sum, item) => sum + Number(item.valor || 0), 0), [receitas])
  const receitaFrete = Number(viagemState.valor_frete || 0)
  const receitaTotal = receitaFrete + receitasExtras
  const lucro = receitaTotal - custosTotal
  const margem = receitaTotal > 0 ? (lucro / receitaTotal) * 100 : 0
  const custoPorKm = Number(viagemState.km_real || 0) > 0 ? custosTotal / Number(viagemState.km_real) : 0

  const tempoTransitoHoras = useMemo(() => {
    const chegada = eventos.filter((e) => e.tipo_evento === "chegada").length
    const saida = eventos.filter((e) => e.tipo_evento === "saida").length
    return Math.max(0, (chegada + saida) * 1.5)
  }, [eventos])

  const tempoParadoHoras = useMemo(() => {
    const tempo = eventos.reduce((sum, evento) => {
      if (["parada", "espera", "ocorrencia"].includes(evento.tipo_evento)) {
        return sum + Number(evento.impacto_minutos || 0)
      }
      return sum
    }, 0)
    return tempo / 60
  }, [eventos])

  const abastecimentosResumo = useMemo(() => {
    const abastecimentos = eventos.filter((e) => e.tipo_evento === "abastecimento")
    return {
      qtd: abastecimentos.length,
      litros: abastecimentos.reduce((sum, e) => sum + Number((e.payload as any)?.litros || 0), 0),
      custo: custos
        .filter((c) => normalizeCategoria(c.categoria) === "Diesel")
        .reduce((sum, c) => sum + Number(c.valor || 0), 0),
    }
  }, [custos, eventos])

  const custosPorCategoria = useMemo(() => {
    const total = custos.reduce((sum, item) => sum + Number(item.valor || 0), 0)
    const grouped = custos.reduce((acc, item) => {
      const categoria = normalizeCategoria(item.categoria)
      acc[categoria] = (acc[categoria] || 0) + Number(item.valor || 0)
      return acc
    }, {} as Record<string, number>)

    return Object.entries(grouped)
      .map(([categoria, valor]) => ({
        categoria,
        valor,
        percentual: total > 0 ? (valor / total) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor)
  }, [custos])

  const plannedHours = useMemo(() => {
    if (!viagemState.data_inicio || !viagemState.data_fim) return null
    return (new Date(viagemState.data_fim).getTime() - new Date(viagemState.data_inicio).getTime()) / 3600000
  }, [viagemState.data_inicio, viagemState.data_fim])

  const realHours = useMemo(() => {
    if (!viagemState.data_inicio) return null
    const finalDate = viagemState.status === "Concluida" || viagemState.status === "Concluída"
      ? (viagemState.data_fim || new Date().toISOString())
      : new Date().toISOString()

    return (new Date(finalDate).getTime() - new Date(viagemState.data_inicio).getTime()) / 3600000
  }, [viagemState.data_fim, viagemState.data_inicio, viagemState.status])

  const statusNormalizado = normalizeViagemStatus(viagemState.status)

  const faseOperacional = useMemo(() => {
    if (statusNormalizado === "Planejada") return "Pré-operação"
    if (statusNormalizado === "Em andamento") return "Em trânsito"
    if (statusNormalizado === "Concluida") return "Encerramento"
    return "Cancelada"
  }, [statusNormalizado])

  const ultimoMarco = eventosOrdenados[0] || null

  const proximoMarcoPrevisto = useMemo(() => {
    const agora = Date.now()
    return eventos
      .filter((evento) => !!evento.previsto_em)
      .map((evento) => ({ ...evento, previstoTs: new Date(evento.previsto_em as string).getTime() }))
      .filter((evento) => evento.previstoTs >= agora)
      .sort((a, b) => a.previstoTs - b.previstoTs)[0] || null
  }, [eventos])

  const kmPlanejado = Number(viagemState.rota?.km_planejado || 0)
  const kmReal = Number(viagemState.km_real || 0)
  const desvioKm = kmPlanejado > 0 && kmReal > 0 ? kmReal - kmPlanejado : null

  const aderenciaTempo = useMemo(() => {
    if (!plannedHours || !realHours || plannedHours <= 0) return null
    return (realHours / plannedHours) * 100
  }, [plannedHours, realHours])

  const acoesRecomendadas = useMemo(() => {
    const acoes: string[] = []
    const pontosPlanejados = viagemState.rota?.pontos_intermediarios || []
    const possuiAbastecimentoPlanejado = pontosPlanejados.some(
      (ponto) => normalizePontoParadaTipo(ponto.tipo_parada) === "abastecimento",
    )
    const possuiDescargaPlanejada = pontosPlanejados.some(
      (ponto) => normalizePontoParadaTipo(ponto.tipo_parada) === "descarga",
    )
    const eventosAbastecimento = eventos.filter((evento) => evento.tipo_evento === "abastecimento").length
    const eventosOcorrencia = eventos.filter((evento) => evento.tipo_evento === "ocorrencia").length

    if (statusNormalizado === "Planejada") {
      acoes.push("Confirmar motorista, veículo e documentação antes da saída.")
      acoes.push("Registrar evento de saída para iniciar o rastreio operacional.")
    }

    if (statusNormalizado === "Em andamento") {
      if (!viagemState.eta_destino_em) {
        acoes.push("Recalcular ETA para atualizar previsão de chegada ao destino.")
      }
      if (possuiAbastecimentoPlanejado && eventosAbastecimento === 0) {
        acoes.push("Rota prevê abastecimento: registrar evento ao realizar a parada planejada.")
      }
      if (possuiDescargaPlanejada && !eventos.some((evento) => evento.tipo_evento === "chegada")) {
        acoes.push("Rota prevê descarga intermediária: atualizar marcos de chegada/saída nos pontos de entrega.")
      }
      if ((viagemState.atraso_estimado_minutos || 0) > 0) {
        acoes.push("Comunicar atraso estimado ao cliente e revisar pontos de parada.")
      }
      if (eventos.length === 0) {
        acoes.push("Registrar marcos da viagem para melhorar controle de operação.")
      }
      if (eventosOcorrencia > 0) {
        acoes.push("Existem ocorrências em aberto: validar impactos no ETA e plano de contingência.")
      }
    }

    if (statusNormalizado === "Concluida") {
      acoes.push("Validar custos e receitas para fechamento financeiro da viagem.")
      if (documentos.length === 0) {
        acoes.push("Anexar documentos finais (canhotos/comprovantes) para auditoria.")
      }
    }

    if (acoes.length === 0) {
      acoes.push("Operação dentro do esperado. Manter atualização dos eventos.")
    }

    return acoes.slice(0, 3)
  }, [
    statusNormalizado,
    viagemState.eta_destino_em,
    viagemState.atraso_estimado_minutos,
    viagemState.rota?.pontos_intermediarios,
    eventos,
    documentos.length,
  ])

  const percursoPlanejado = useMemo(() => {
    const planejamento = viagemState.planejamento_rota
    const planejamentoIntermediarios = (planejamento?.intermediarios || []) as Array<{
      chave?: string
      cidade?: string
      estado?: string
      chegada_planejada?: string | null
      partida_planejada?: string | null
      chegadaPlanejada?: string | null
      partidaPlanejada?: string | null
    }>
    const planejamentoPorChave = new Map(
      planejamentoIntermediarios
        .filter((item) => !!item.chave)
        .map((item) => [item.chave as string, item]),
    )
    const timelineRealPorChave = new Map(
      (timelineReal.intermediarios || [])
        .filter((item) => !!item.chave)
        .map((item) => [item.chave, item]),
    )

    const origem =
      viagemState.origem_real ||
      (viagemState.rota?.origem_cidade && viagemState.rota?.origem_estado
        ? `${viagemState.rota.origem_cidade}/${viagemState.rota.origem_estado}`
        : null)

    const destino =
      viagemState.destino_real ||
      (viagemState.rota?.destino_cidade && viagemState.rota?.destino_estado
        ? `${viagemState.rota.destino_cidade}/${viagemState.rota.destino_estado}`
        : null)

    const intermediarios = (viagemState.rota?.pontos_intermediarios || [])
      .map((ponto, index) => {
        const cidadeEstado = ponto?.cidade && ponto?.estado ? `${ponto.cidade}/${ponto.estado}` : null
        if (!cidadeEstado) return null
        const tipoParada = normalizePontoParadaTipo(ponto.tipo_parada)
        const chave = buildIntermediarioChave(ponto.cidade, ponto.estado, index)
        const planejamentoIntermediario =
          planejamentoIntermediarios[index] ||
          planejamentoPorChave.get(chave) ||
          planejamentoIntermediarios.find(
            (item) =>
              (item.cidade || "").trim().toLowerCase() === (ponto.cidade || "").trim().toLowerCase() &&
              (item.estado || "").trim().toLowerCase() === (ponto.estado || "").trim().toLowerCase(),
          )
        const realizadoIntermediario =
          timelineReal.intermediarios[index] ||
          timelineRealPorChave.get(chave) ||
          timelineReal.intermediarios.find(
            (item) =>
              (item.cidade || "").trim().toLowerCase() === (ponto.cidade || "").trim().toLowerCase() &&
              (item.estado || "").trim().toLowerCase() === (ponto.estado || "").trim().toLowerCase(),
          )

        return {
          id: `intermediario-${index}-${cidadeEstado}`,
          label: cidadeEstado,
          tipo: "intermediario" as const,
          tipoParada,
          kmPonto: normalizePontoIntermediarioKm(ponto.km),
          ordemIntermediario: index + 1,
          chegadaPlanejada:
            planejamentoIntermediario?.chegada_planejada ||
            planejamentoIntermediario?.chegadaPlanejada ||
            null,
          partidaPlanejada:
            planejamentoIntermediario?.partida_planejada ||
            planejamentoIntermediario?.partidaPlanejada ||
            null,
          chegadaReal: realizadoIntermediario?.chegada_real || null,
          partidaReal: realizadoIntermediario?.partida_real || null,
        }
      })
      .filter(Boolean) as Array<{
        id: string
        label: string
        tipo: "intermediario"
        tipoParada: ReturnType<typeof normalizePontoParadaTipo>
        kmPonto: number | null
        ordemIntermediario: number
        chegadaPlanejada: string | null
        partidaPlanejada: string | null
        chegadaReal: string | null
        partidaReal: string | null
      }>

    const pontos: Array<{
      id: string
      label: string
      tipo: "origem" | "intermediario" | "destino"
      tipoParada?: ReturnType<typeof normalizePontoParadaTipo>
      kmPonto?: number | null
      ordemIntermediario?: number
      chegadaPlanejada?: string | null
      partidaPlanejada?: string | null
      chegadaReal?: string | null
      partidaReal?: string | null
    }> = []

    if (origem) {
      pontos.push({
        id: `origem-${origem}`,
        label: origem,
        tipo: "origem",
        kmPonto: 0,
        partidaPlanejada: planejamento?.origem_partida_planejada || viagemState.data_inicio || null,
        partidaReal: timelineReal.origem_partida_real || null,
      })
    }

    pontos.push(...intermediarios)

    if (destino) {
      pontos.push({
        id: `destino-${destino}`,
        label: destino,
        tipo: "destino",
        kmPonto: kmPlanejado > 0 ? kmPlanejado : null,
        chegadaPlanejada: planejamento?.destino_chegada_planejada || viagemState.data_fim || null,
        chegadaReal: timelineReal.destino_chegada_real || null,
      })
    }

    return pontos
  }, [
    viagemState.data_fim,
    viagemState.data_inicio,
    viagemState.destino_real,
    viagemState.origem_real,
    viagemState.planejamento_rota,
    viagemState.rota,
    timelineReal,
  ])

  const kmRestanteAutomatico = useMemo(() => {
    if (percursoPlanejado.length < 2 || kmPlanejado <= 0) {
      return Number(viagemState.km_restante || 0)
    }

    const totalTrechos = Math.max(1, percursoPlanejado.length - 1)
    const kmPorIndice = (index: number) => (index / totalTrechos) * kmPlanejado

    const resolvedKmPorPonto = percursoPlanejado.map((ponto, index) => {
      const kmInformado = normalizePontoIntermediarioKm(ponto.kmPonto)
      if (kmInformado === null) return kmPorIndice(index)
      if (kmInformado > kmPlanejado) return kmPlanejado
      return kmInformado
    })

    let ultimoKmConcluido = 0
    percursoPlanejado.forEach((ponto, index) => {
      const concluido = ponto.tipo === "origem"
        ? Boolean(ponto.partidaReal)
        : ponto.tipo === "destino"
          ? Boolean(ponto.chegadaReal)
          : Boolean(ponto.chegadaReal)

      if (concluido) {
        ultimoKmConcluido = Math.max(ultimoKmConcluido, resolvedKmPorPonto[index] || 0)
      }
    })

    return Math.max(0, Math.round(kmPlanejado - ultimoKmConcluido))
  }, [kmPlanejado, percursoPlanejado, viagemState.km_restante])

  const paradasPrevistasPorRota = useMemo(
    () => deriveEtaStopsFromIntermediarios(viagemState.rota?.pontos_intermediarios),
    [viagemState.rota?.pontos_intermediarios],
  )

  const recalculateEta = async (override?: { km?: number; velocidade?: number }) => {
    const km = override?.km ?? kmRestanteAutomatico
    const velocidade = override?.velocidade

    const result = calculateEta({
      viagem: {
        data_inicio: viagemState.data_inicio,
        carregado: viagemState.carregado,
        rota_id: viagemState.rota_id,
        motorista_id: viagemState.motorista_id,
        veiculo_id: viagemState.veiculo_id,
        eta_destino_em: viagemState.eta_destino_em,
        velocidade_media_kmh: velocidade ?? viagemState.velocidade_media_kmh,
      },
      eventos,
      parametros: etaParametros,
      kmRestante: km,
      etaPlanejado: viagemState.data_fim,
      paradasPrevistas: paradasPrevistasPorRota,
    })

    const previsoesPendentes = eventos
      .filter(
        (evento) =>
          (evento.status_evento === "pendente" || evento.status_evento === "atrasado") &&
          !!evento.previsto_em,
      )
      .map((evento) => new Date(evento.previsto_em as string))
      .sort((a, b) => a.getTime() - b.getTime())

    const nowTs = Date.now()
    const proximoPonto =
      previsoesPendentes.find((data) => data.getTime() >= nowTs) ||
      previsoesPendentes[0] ||
      result.eta

    const payload = {
      eta_destino_em: result.eta.toISOString(),
      eta_proximo_ponto_em: proximoPonto.toISOString(),
      eta_calculado_em: new Date().toISOString(),
      atraso_estimado_minutos: result.atrasoMinutos,
      velocidade_media_kmh: result.velocidadeMediaKmh,
      km_restante: km,
    }

    const { error } = await supabase
      .from("viagens")
      .update(payload)
      .eq("id", viagemState.id)

    if (!error) {
      setViagemState((prev) => ({ ...prev, ...payload }))
    }
  }

  const updateTimelineRealIntermediario = (
    index: number,
    field: "chegada_real" | "partida_real",
    value: string,
  ) => {
    setTimelineReal((prev) => {
      const intermediarios = [...prev.intermediarios]
      const current = intermediarios[index]
      if (!current) return prev

      intermediarios[index] = {
        ...current,
        [field]: value,
      }

      return {
        ...prev,
        intermediarios,
      }
    })
  }

  const salvarTimelineReal = async () => {
    const planejamentoAtual = viagemState.planejamento_rota || {
      origem_partida_planejada: null,
      destino_chegada_planejada: null,
      intermediarios: [],
    }

    const realizadosPorChave = new Map(
      timelineReal.intermediarios
        .filter((item) => !!item.chave)
        .map((item) => [item.chave, item]),
    )

    const intermediariosAtualizados = (planejamentoAtual.intermediarios || []).map((item, index) => {
      const realizado = timelineReal.intermediarios[index] || realizadosPorChave.get(item.chave)
      return {
        ...item,
        chegada_real: toIsoOrNull(realizado?.chegada_real),
        partida_real: toIsoOrNull(realizado?.partida_real),
      }
    })

    const planejamentoAtualizado = {
      ...planejamentoAtual,
      origem_partida_real: toIsoOrNull(timelineReal.origem_partida_real),
      destino_chegada_real: toIsoOrNull(timelineReal.destino_chegada_real),
      intermediarios: intermediariosAtualizados,
    }

    const kmAtualizado = kmRestanteAutomatico

    const { error } = await supabase
      .from("viagens")
      .update({
        planejamento_rota: planejamentoAtualizado,
        km_restante: kmAtualizado,
      })
      .eq("id", viagemState.id)

    if (!error) {
      setViagemState((prev) => ({
        ...prev,
        planejamento_rota: planejamentoAtualizado,
        km_restante: kmAtualizado,
      }))

      await recalculateEta({ km: kmAtualizado })
    }
  }

  const openNewEventModal = (type: EventoViagemTipo) => {
    setActiveTimelineEvent(null)
    setEventForm({
      tipo_evento: type,
      status_evento: "concluido",
      titulo: eventTypeLabels[type],
      local: "",
      observacao: "",
      impacto_minutos: "0",
      previsto_em: "",
      comprovante_url: "",
    })
    setEventModalOpen(true)
  }

  const handleSaveEvent = async () => {
    if (!eventForm.titulo) return
    setLoading(true)

    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user
    if (!user) {
      setLoading(false)
      return
    }

    const payload = {
      tipo_evento: eventForm.tipo_evento,
      status_evento: eventForm.status_evento,
      titulo: eventForm.titulo,
      local: eventForm.local || null,
      observacao: eventForm.observacao || null,
      previsto_em: eventForm.previsto_em ? new Date(eventForm.previsto_em).toISOString() : null,
      impacto_minutos: Number(eventForm.impacto_minutos || 0),
      comprovante_url: eventForm.comprovante_url || null,
      payload: null,
    }

    if (activeTimelineEvent) {
      const { data, error } = await supabase
        .from("viagem_eventos")
        .update(payload)
        .eq("id", activeTimelineEvent.id)
        .select("*")
        .single()

      if (!error && data) {
        setEventos((prev) => prev.map((item) => (item.id === data.id ? data : item)))
        setEventModalOpen(false)
        setActiveTimelineEvent(null)
        await recalculateEta()
      }
    } else {
      const { data, error } = await supabase
        .from("viagem_eventos")
        .insert({
          user_id: user.id,
          viagem_id: viagemState.id,
          ...payload,
          ocorrido_em: new Date().toISOString(),
        })
        .select("*")
        .single()

      if (!error && data) {
        const nextEvents = [data, ...eventos]
        setEventos(nextEvents)
        setEventModalOpen(false)
        setActiveTimelineEvent(null)
        await recalculateEta()
      }
    }

    setLoading(false)
  }

  const handleSaveCost = async () => {
    if (!costForm.valor) return
    setLoading(true)

    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user
    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("custos_viagem")
      .insert({
        user_id: user.id,
        viagem_id: viagemState.id,
        data: costForm.data,
        categoria: normalizeCategoria(costForm.categoria),
        valor: Number(costForm.valor),
        observacao: costForm.observacao || null,
      })
      .select("*")
      .single()

    if (!error && data) {
      setCustos((prev) => [data, ...prev])
      setCostModalOpen(false)
    }

    setLoading(false)
  }

  const handleSaveReceita = async () => {
    if (!receitaForm.valor) return
    setLoading(true)

    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user
    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("receitas_viagem")
      .insert({
        user_id: user.id,
        viagem_id: viagemState.id,
        data: receitaForm.data,
        tipo: receitaForm.tipo,
        valor: Number(receitaForm.valor),
        descricao: receitaForm.descricao || null,
      })
      .select("*")
      .single()

    if (!error && data) {
      setReceitas((prev) => [data, ...prev])
      setReceitaModalOpen(false)
    }

    setLoading(false)
  }

  const handleSaveDocumento = async () => {
    if (!selectedDocFile) {
      alert("Selecione um arquivo para upload")
      return
    }
    setLoading(true)

    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user
    if (!user) {
      setLoading(false)
      return
    }

    const fileName = selectedDocFile.name.replace(/\s+/g, "-")
    const path = `${user.id}/${viagemState.id}/${Date.now()}-${fileName}`

    const { error: uploadError } = await supabase
      .storage
      .from("viagem-documentos")
      .upload(path, selectedDocFile, {
        upsert: false,
      })

    if (uploadError) {
      alert(`Erro no upload: ${uploadError.message}`)
      setLoading(false)
      return
    }

    const { data: publicData } = supabase
      .storage
      .from("viagem-documentos")
      .getPublicUrl(path)

    const arquivoUrl = publicData.publicUrl

    const { data, error } = await supabase
      .from("viagem_documentos")
      .insert({
        user_id: user.id,
        viagem_id: viagemState.id,
        tipo_documento: docForm.tipo_documento,
        nome_arquivo: docForm.nome_arquivo || selectedDocFile?.name,
        arquivo_url: arquivoUrl,
        observacao: docForm.observacao || null,
        metadata: {
          size_bytes: selectedDocFile.size,
          mime_type: selectedDocFile.type,
        },
      })
      .select("*")
      .single()

    if (!error && data) {
      setDocumentos((prev) => [data, ...prev])
      setDocModalOpen(false)
      setSelectedDocFile(null)
      setDocForm({
        tipo_documento: "NF",
        nome_arquivo: "",
        observacao: "",
      })
    }

    setLoading(false)
  }

  return (
    <div className={embedded ? "space-y-5 w-full max-w-full overflow-x-hidden pb-1" : "space-y-6"}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          {!embedded && (
            <Link href="/viagens" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
              <ArrowLeft className="size-4" />
              Voltar para viagens
            </Link>
          )}
          <h1 className={embedded ? "text-xl font-bold text-foreground" : "text-2xl font-bold text-foreground mt-1"}>Cockpit da Viagem</h1>
          <p className="text-muted-foreground">
            {viagemState.rota?.nome || `${viagemState.origem_real || "Origem"} → ${viagemState.destino_real || "Destino"}`}
          </p>
        </div>

        <div className={embedded ? "grid grid-cols-1 sm:grid-cols-2 gap-2 w-full" : "grid grid-cols-1 sm:grid-cols-2 gap-2 w-full md:w-auto md:min-w-[340px]"}>
          <Card className="border-border/50">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">ETA destino</p>
              <p className="font-semibold">{formatDateTime(viagemState.eta_destino_em)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Atraso estimado</p>
              <p className={viagemState.atraso_estimado_minutos && viagemState.atraso_estimado_minutos > 0 ? "font-semibold text-destructive" : "font-semibold"}>
                {viagemState.atraso_estimado_minutos ? `${viagemState.atraso_estimado_minutos > 0 ? "+" : ""}${viagemState.atraso_estimado_minutos} min` : "No prazo"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="operacao" className="space-y-4 min-h-0">
        <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap gap-1 p-1">
          <TabsTrigger className={embedded ? "px-3 text-sm" : undefined} value="operacao">Operação</TabsTrigger>
          <TabsTrigger className={embedded ? "px-3 text-sm" : undefined} value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger className={embedded ? "px-3 text-sm" : undefined} value="docs">Docs</TabsTrigger>
          <TabsTrigger className={embedded ? "px-3 text-sm" : undefined} value="kpis">KPIs</TabsTrigger>
        </TabsList>

        <TabsContent value="operacao" className="space-y-4 min-h-0">
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Status: {statusNormalizado}</Badge>
                <Badge variant="outline">Fase: {faseOperacional}</Badge>
                {aderenciaTempo !== null && (
                  <Badge variant="outline">
                    Aderência tempo: {aderenciaTempo.toFixed(0)}%
                  </Badge>
                )}
              </div>

              <div className={embedded ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"}>
                <div className="rounded-md border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Último marco</p>
                  <p className="text-sm font-medium mt-1">{ultimoMarco ? ultimoMarco.titulo : "Sem eventos"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{ultimoMarco ? formatDateTime(ultimoMarco.ocorrido_em) : "-"}</p>
                </div>
                <div className="rounded-md border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Próximo marco previsto</p>
                  <p className="text-sm font-medium mt-1">{proximoMarcoPrevisto ? eventTypeLabels[proximoMarcoPrevisto.tipo_evento] : "Sem previsão"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{proximoMarcoPrevisto ? formatDateTime(proximoMarcoPrevisto.previsto_em) : "-"}</p>
                </div>
                <div className="rounded-md border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Desvio de KM</p>
                  <p className={desvioKm !== null && desvioKm > 0 ? "text-sm font-medium mt-1 text-destructive" : "text-sm font-medium mt-1"}>
                    {desvioKm !== null ? `${desvioKm > 0 ? "+" : ""}${desvioKm.toFixed(0)} km` : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Planejado: {kmPlanejado > 0 ? `${kmPlanejado.toFixed(0)} km` : "-"}</p>
                </div>
                <div className="rounded-md border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Prioridade operacional</p>
                  <p className="text-sm font-medium mt-1">
                    {(viagemState.atraso_estimado_minutos || 0) > 0 ? "Alta" : statusNormalizado === "Em andamento" ? "Média" : "Normal"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{(viagemState.atraso_estimado_minutos || 0) > 0 ? "Com atraso estimado" : "Sem risco imediato"}</p>
                </div>
              </div>

              <div className="rounded-md border border-border/70 p-3">
                <p className="text-xs text-muted-foreground">Ações recomendadas</p>
                <ul className="mt-2 space-y-1">
                  {acoesRecomendadas.map((acao) => (
                    <li key={acao} className="text-sm text-foreground">• {acao}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-md border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">KM planejado</p>
                  <p className="text-sm font-medium mt-1">{kmPlanejado > 0 ? `${kmPlanejado.toFixed(0)} km` : "-"}</p>
                </div>
                <div className="rounded-md border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">KM restante automático</p>
                  <p className="text-sm font-medium mt-1">{kmRestanteAutomatico.toFixed(0)} km</p>
                </div>
                <div className="rounded-md border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Progresso estimado da rota</p>
                  <p className="text-sm font-medium mt-1">
                    {kmPlanejado > 0
                      ? `${(((kmPlanejado - kmRestanteAutomatico) / kmPlanejado) * 100).toFixed(0)}%`
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size={embedded ? "sm" : "default"}
                  onClick={() => setTimelineRealModalOpen(true)}
                >
                  Preencher realizados
                </Button>
                <Button
                  size={embedded ? "sm" : "default"}
                  variant="outline"
                  onClick={() => recalculateEta({ km: kmRestanteAutomatico })}
                >
                  Recalcular ETA automático
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle>Timeline da Rota</CardTitle>
              <p className="text-sm text-muted-foreground">
                Visão planejada e realizada de origem, pontos intermediários e destino.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {percursoPlanejado.length === 0 && (
                <p className="text-sm text-muted-foreground">Trajeto da rota não definido.</p>
              )}
              {percursoPlanejado.map((ponto, index) => (
                <div key={ponto.id} className="rounded-md border border-border/60 p-3">
                  <div className="flex items-start gap-2">
                    <span className="pt-1">
                      <Circle className={
                        ponto.tipo === "origem"
                          ? "size-4 text-primary fill-primary"
                          : ponto.tipo === "destino"
                            ? "size-4 text-green-600 fill-green-600"
                            : ponto.tipoParada === "abastecimento"
                              ? "size-4 text-amber-500 fill-amber-500"
                              : ponto.tipoParada === "descarga"
                                ? "size-4 text-violet-500 fill-violet-500"
                                : ponto.tipoParada === "ocorrencia"
                                  ? "size-4 text-destructive fill-destructive"
                                  : ponto.tipoParada === "descanso"
                                    ? "size-4 text-cyan-600 fill-cyan-600"
                                    : "size-4 text-muted-foreground"
                      } />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold leading-tight">{ponto.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ponto.tipo === "origem"
                          ? "Origem"
                          : ponto.tipo === "destino"
                            ? "Destino"
                            : `${getPontoParadaTipoLabel(ponto.tipoParada)} · Ponto intermediário ${ponto.ordemIntermediario || index}`}
                      </p>
                      {(ponto.chegadaPlanejada || ponto.partidaPlanejada) && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {ponto.chegadaPlanejada ? `Chegada planejada: ${formatDateTime(ponto.chegadaPlanejada)}` : ""}
                          {ponto.chegadaPlanejada && ponto.partidaPlanejada ? " • " : ""}
                          {ponto.partidaPlanejada ? `Partida planejada: ${formatDateTime(ponto.partidaPlanejada)}` : ""}
                        </p>
                      )}
                      {(ponto.chegadaReal || ponto.partidaReal) && (
                        <p className="text-sm text-foreground mt-1">
                          {ponto.chegadaReal ? `Chegada real: ${formatDateTime(ponto.chegadaReal)}` : ""}
                          {ponto.chegadaReal && ponto.partidaReal ? " • " : ""}
                          {ponto.partidaReal ? `Partida real: ${formatDateTime(ponto.partidaReal)}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financeiro" className="space-y-4 min-h-0">
          <div className={embedded ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" : "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"}>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Frete</p><p className="text-lg xl:text-xl font-semibold leading-tight break-words">{formatCurrency(receitaFrete)}</p></CardContent></Card>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Custos acumulados</p><p className="text-lg xl:text-xl font-semibold leading-tight break-words">{formatCurrency(custosTotal)}</p></CardContent></Card>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Margem lucro</p><p className="text-lg xl:text-xl font-semibold leading-tight break-words">{formatCurrency(lucro)} ({margem.toFixed(1)}%)</p></CardContent></Card>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Custo/km</p><p className="text-lg xl:text-xl font-semibold leading-tight break-words">{formatCurrency(custoPorKm)}</p></CardContent></Card>
          </div>

          <Card className="border-border/50">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Tabela de custos</CardTitle>
              <Button size="sm" variant={embedded ? "secondary" : "default"} onClick={() => setCostModalOpen(true)}><Plus className="size-4 mr-1" />Lançar custo</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2">Data</th>
                      <th className="py-2">Categoria</th>
                      <th className="py-2">Valor</th>
                      <th className="py-2">Forma pagamento</th>
                      <th className="py-2">Comprovante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {custos.map((custo) => (
                      <tr key={custo.id} className="border-b border-border/50">
                        <td className="py-2">{new Date(custo.data).toLocaleDateString("pt-BR")}</td>
                        <td className="py-2">{custo.categoria}</td>
                        <td className="py-2">{formatCurrency(Number(custo.valor || 0))}</td>
                        <td className="py-2">-</td>
                        <td className="py-2">{custo.observacao ? "Sim" : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Tabela de receitas</CardTitle>
              <Button size="sm" variant={embedded ? "secondary" : "default"} onClick={() => setReceitaModalOpen(true)}><Plus className="size-4 mr-1" />Lançar receita extra</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="rounded-md border p-3 flex items-center justify-between"><span>Frete principal</span><span className="font-medium">{formatCurrency(receitaFrete)}</span></div>
                {receitas.map((receita) => (
                  <div key={receita.id} className="rounded-md border p-3 flex items-center justify-between">
                    <span className="min-w-0 pr-3 break-words">{receita.tipo}{receita.descricao ? ` • ${receita.descricao}` : ""}</span>
                    <span className="font-medium">{formatCurrency(Number(receita.valor || 0))}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4 min-h-0">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={embedded ? "secondary" : "default"} onClick={() => setDocModalOpen(true)}><Plus className="size-4 mr-1" />Upload documento</Button>
            <Button size="sm" variant="outline" disabled><Camera className="size-4 mr-1" />Foto rápida (mobile)</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documentoGrupos.map((grupo) => {
              const docsDoGrupo = documentos.filter((doc) => grupo.tipos.includes(doc.tipo_documento))
              return (
                <Card className="border-border/50" key={grupo.label}>
                  <CardHeader>
                    <CardTitle className="text-base">{grupo.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {docsDoGrupo.length === 0 && <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>}
                    {docsDoGrupo.map((doc) => (
                      <a key={doc.id} href={doc.arquivo_url} target="_blank" className="flex items-center justify-between rounded-md border p-2 transition-colors hover:bg-muted/40">
                        <div className="min-w-0">
                          <p className="text-sm truncate">{doc.nome_arquivo}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(Number((doc.metadata as Record<string, unknown> | null)?.size_bytes || 0))} • {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <FileText className="size-4 text-muted-foreground" />
                      </a>
                    ))}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4 min-h-0">
          <div className={embedded ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"}>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tempo em trânsito</p><p className="text-lg font-semibold leading-tight break-words">{tempoTransitoHoras.toFixed(1)}h</p></CardContent></Card>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tempo parado</p><p className="text-lg font-semibold leading-tight break-words">{tempoParadoHoras.toFixed(1)}h</p></CardContent></Card>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Abastecimentos</p><p className="text-lg font-semibold leading-tight break-words">{abastecimentosResumo.qtd} ({abastecimentosResumo.litros.toFixed(0)}L)</p><p className="text-xs text-muted-foreground">{formatCurrency(abastecimentosResumo.custo)}</p></CardContent></Card>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Planejado vs Real (tempo)</p><p className="text-lg font-semibold leading-tight break-words">{plannedHours ? `${plannedHours.toFixed(1)}h` : "-"} / {realHours ? `${realHours.toFixed(1)}h` : "-"}</p></CardContent></Card>
          </div>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Custo total por categoria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {custosPorCategoria.map((item) => (
                <div key={item.categoria} className="space-y-1">
                  <div className="flex justify-between text-sm"><span>{item.categoria}</span><span>{formatCurrency(item.valor)} ({item.percentual.toFixed(1)}%)</span></div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${item.percentual}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Comparativo Planejado vs Real</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border p-3 flex items-start gap-2">
                <Route className="size-4 mt-0.5" />
                <div>
                  <p className="font-medium">KM Planejado vs Real</p>
                  <p className="text-muted-foreground">{Number(viagemState.rota?.km_planejado || 0).toFixed(0)} km / {Number(viagemState.km_real || 0).toFixed(0)} km</p>
                </div>
              </div>
              <div className="rounded-md border p-3 flex items-start gap-2">
                <Clock3 className="size-4 mt-0.5" />
                <div>
                  <p className="font-medium">Tempo Planejado vs Real</p>
                  <p className="text-muted-foreground">{plannedHours ? `${plannedHours.toFixed(1)}h` : "-"} / {realHours ? `${realHours.toFixed(1)}h` : "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={timelineRealModalOpen} onOpenChange={setTimelineRealModalOpen}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preencher realizado da timeline planejada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Origem · Partida real</Label>
                <Input
                  type="datetime-local"
                  value={timelineReal.origem_partida_real || ""}
                  onChange={(event) =>
                    setTimelineReal((prev) => ({
                      ...prev,
                      origem_partida_real: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Destino · Chegada real</Label>
                <Input
                  type="datetime-local"
                  value={timelineReal.destino_chegada_real || ""}
                  onChange={(event) =>
                    setTimelineReal((prev) => ({
                      ...prev,
                      destino_chegada_real: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {timelineReal.intermediarios.length > 0 && (
              <div className="space-y-3">
                {timelineReal.intermediarios.map((ponto, index) => (
                  <div key={ponto.chave || `${ponto.cidade}-${index}`} className="rounded-md border border-border/60 p-3">
                    <p className="text-xs font-medium text-foreground mb-2">
                      {index + 1}. {ponto.cidade}/{ponto.estado}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label>Chegada real</Label>
                        <Input
                          type="datetime-local"
                          value={ponto.chegada_real || ""}
                          onChange={(event) => updateTimelineRealIntermediario(index, "chegada_real", event.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Partida real</Label>
                        <Input
                          type="datetime-local"
                          value={ponto.partida_real || ""}
                          onChange={(event) => updateTimelineRealIntermediario(index, "partida_real", event.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setTimelineRealModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  await salvarTimelineReal()
                  setTimelineRealModalOpen(false)
                }}
                disabled={loading}
              >
                {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                Salvar realizados e recalcular ETA
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={eventModalOpen} onOpenChange={setEventModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeTimelineEvent ? "Atualizar ponto da timeline" : "Registrar evento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={eventForm.tipo_evento} onValueChange={(value: EventoViagemTipo) => setEventForm((prev) => ({ ...prev, tipo_evento: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(eventTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={eventForm.status_evento} onValueChange={(value: EventoViagemStatus) => setEventForm((prev) => ({ ...prev, status_evento: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(eventStatusLabel).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Título</Label>
              <Input value={eventForm.titulo} onChange={(event) => setEventForm((prev) => ({ ...prev, titulo: event.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Registrar chegada/saída - local</Label>
                <Input value={eventForm.local} onChange={(event) => setEventForm((prev) => ({ ...prev, local: event.target.value }))} />
              </div>
              <div>
                <Label>Impacto em minutos</Label>
                <Input type="number" value={eventForm.impacto_minutos} onChange={(event) => setEventForm((prev) => ({ ...prev, impacto_minutos: event.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Previsto em</Label>
              <Input type="datetime-local" value={eventForm.previsto_em} onChange={(event) => setEventForm((prev) => ({ ...prev, previsto_em: event.target.value }))} />
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea value={eventForm.observacao} onChange={(event) => setEventForm((prev) => ({ ...prev, observacao: event.target.value }))} />
            </div>
            <div>
              <Label>Anexar comprovante (URL)</Label>
              <Input value={eventForm.comprovante_url} onChange={(event) => setEventForm((prev) => ({ ...prev, comprovante_url: event.target.value }))} />
            </div>
            <Button className="w-full" onClick={handleSaveEvent} disabled={loading}>
              {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Salvar evento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={costModalOpen} onOpenChange={setCostModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lançar custo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={costForm.data} onChange={(event) => setCostForm((prev) => ({ ...prev, data: event.target.value }))} /></div>
              <div>
                <Label>Categoria</Label>
                <Select value={costForm.categoria} onValueChange={(value: CustoViagem["categoria"]) => setCostForm((prev) => ({ ...prev, categoria: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Diesel">Diesel</SelectItem>
                    <SelectItem value="Pedagio">Pedágio</SelectItem>
                    <SelectItem value="Diarias">Diárias</SelectItem>
                    <SelectItem value="Comissao">Comissão</SelectItem>
                    <SelectItem value="Arla">Arla</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Valor</Label><Input type="number" value={costForm.valor} onChange={(event) => setCostForm((prev) => ({ ...prev, valor: event.target.value }))} /></div>
            <div><Label>Comprovante/observação</Label><Textarea value={costForm.observacao} onChange={(event) => setCostForm((prev) => ({ ...prev, observacao: event.target.value }))} /></div>
            <Button className="w-full" onClick={handleSaveCost} disabled={loading}><Fuel className="size-4 mr-1" />Salvar custo</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={receitaModalOpen} onOpenChange={setReceitaModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lançar receita extra</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={receitaForm.data} onChange={(event) => setReceitaForm((prev) => ({ ...prev, data: event.target.value }))} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={receitaForm.tipo} onValueChange={(value: ReceitaViagem["tipo"]) => setReceitaForm((prev) => ({ ...prev, tipo: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Receita extra">Receita extra</SelectItem>
                    <SelectItem value="Ajuste">Ajuste</SelectItem>
                    <SelectItem value="Desconto">Ajuste/desconto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Valor</Label><Input type="number" value={receitaForm.valor} onChange={(event) => setReceitaForm((prev) => ({ ...prev, valor: event.target.value }))} /></div>
            <div><Label>Descrição</Label><Textarea value={receitaForm.descricao} onChange={(event) => setReceitaForm((prev) => ({ ...prev, descricao: event.target.value }))} /></div>
            <Button className="w-full" onClick={handleSaveReceita} disabled={loading}><Plus className="size-4 mr-1" />Salvar receita</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={docModalOpen} onOpenChange={setDocModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload de documento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={docForm.tipo_documento} onValueChange={(value: DocumentoViagemTipo) => setDocForm((prev) => ({ ...prev, tipo_documento: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NF">NF</SelectItem>
                  <SelectItem value="CTE">CT-e</SelectItem>
                  <SelectItem value="MDFE">MDF-e</SelectItem>
                  <SelectItem value="CANHOTO">Canhoto</SelectItem>
                  <SelectItem value="COMPROVANTE_ABASTECIMENTO">Comprovante abastecimento</SelectItem>
                  <SelectItem value="PEDAGIO">Pedágio</SelectItem>
                  <SelectItem value="OCORRENCIA">Ocorrência</SelectItem>
                  <SelectItem value="FOTO">Foto</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nome do arquivo</Label><Input value={docForm.nome_arquivo} onChange={(event) => setDocForm((prev) => ({ ...prev, nome_arquivo: event.target.value }))} /></div>
            <div>
              <Label>Arquivo (upload)</Label>
              <Input
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  setSelectedDocFile(file)
                  if (file && !docForm.nome_arquivo) {
                    setDocForm((prev) => ({ ...prev, nome_arquivo: file.name }))
                  }
                }}
              />
            </div>
            <div><Label>Observação</Label><Textarea value={docForm.observacao} onChange={(event) => setDocForm((prev) => ({ ...prev, observacao: event.target.value }))} /></div>
            <Button className="w-full" onClick={handleSaveDocumento} disabled={loading}>Salvar documento</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
