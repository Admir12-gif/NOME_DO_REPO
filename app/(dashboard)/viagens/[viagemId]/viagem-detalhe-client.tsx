"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  PostoAbastecimento,
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
import { Progress } from "@/components/ui/progress"
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
  inicio_em: string
  fim_em: string
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

type CockpitQuickAction = {
  label: string
  type: EventoViagemTipo
  status: EventoViagemStatus
  title: string
}

type MarcoOperacionalTipo = "saida" | "chegada" | "passagem"
const PASSAGEM_OUTRO_PONTO_VALUE = "__outro_ponto__"

const cockpitQuickActions: CockpitQuickAction[] = [
  { label: "Chegada", type: "chegada", status: "concluido", title: "Chegada" },
  { label: "Saída", type: "saida", status: "concluido", title: "Saída" },
  { label: "Iniciar Carreg.", type: "parada", status: "em_andamento", title: "Início de carregamento" },
  { label: "Finalizar Carreg.", type: "parada", status: "concluido", title: "Fim de carregamento" },
  { label: "Iniciar Descanso", type: "parada", status: "em_andamento", title: "Início de descanso" },
  { label: "Finalizar Descanso", type: "parada", status: "concluido", title: "Fim de descanso" },
  { label: "Abastecimento", type: "abastecimento", status: "concluido", title: "Abastecimento" },
  { label: "Manutenção", type: "parada", status: "pendente", title: "Manutenção" },
  { label: "Documentação", type: "ocorrencia", status: "pendente", title: "Documentação" },
  { label: "Ocorrência", type: "ocorrencia", status: "pendente", title: "Ocorrência" },
]

function findQuickActionByTitle(title: string) {
  return cockpitQuickActions.find((action) => action.title === title)
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

const marcoOperacionalConfig: Record<MarcoOperacionalTipo, { tipo: EventoViagemTipo; titulo: string; label: string }> = {
  saida: { tipo: "saida", titulo: "Saída", label: "Saída" },
  chegada: { tipo: "chegada", titulo: "Chegada", label: "Chegada" },
  passagem: { tipo: "parada", titulo: "Passagem", label: "Passagem" },
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

function formatDurationByUnit(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(Number(totalMinutes) || 0))
  if (minutes <= 0) return "-"

  if (minutes >= 1440) {
    const days = minutes / 1440
    const value = Number.isInteger(days) ? days.toString() : days.toFixed(1).replace(".0", "")
    return `${value} dia${Number(value) > 1 ? "s" : ""}`
  }

  if (minutes >= 60) {
    const hours = minutes / 60
    const value = Number.isInteger(hours) ? hours.toString() : hours.toFixed(1).replace(".0", "")
    return `${value} h`
  }

  return `${minutes} min`
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

function getLocalEventosStorageKey(viagemId: string) {
  return `tms:viagem_eventos:${viagemId}`
}

function readLocalEventos(viagemId: string) {
  if (typeof window === "undefined") return [] as ViagemEvento[]

  try {
    const raw = window.localStorage.getItem(getLocalEventosStorageKey(viagemId))
    if (!raw) return [] as ViagemEvento[]
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ViagemEvento[]) : ([] as ViagemEvento[])
  } catch {
    return [] as ViagemEvento[]
  }
}

function writeLocalEventos(viagemId: string, eventos: ViagemEvento[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(getLocalEventosStorageKey(viagemId), JSON.stringify(eventos))
}

function isMissingViagemEventosTableError(errorMessage: string, errorCode?: string) {
  return (
    errorCode === "PGRST205" ||
    errorMessage.toLowerCase().includes("viagem_eventos") ||
    errorMessage.toLowerCase().includes("schema cache")
  )
}

function createLocalEventId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `local-${crypto.randomUUID()}`
  }

  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
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
  const [usingLocalEventosFallback, setUsingLocalEventosFallback] = useState(false)

  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [activeTimelineEvent, setActiveTimelineEvent] = useState<ViagemEvento | null>(null)
  const [timelineRealModalOpen, setTimelineRealModalOpen] = useState(false)
  const [expandedTimelinePointId, setExpandedTimelinePointId] = useState<string | null>(null)
  const [costModalOpen, setCostModalOpen] = useState(false)
  const [receitaModalOpen, setReceitaModalOpen] = useState(false)
  const [docModalOpen, setDocModalOpen] = useState(false)
  const [saldoInicialLitros, setSaldoInicialLitros] = useState("300")
  const [consumoMedioEditavel, setConsumoMedioEditavel] = useState(() => Number(viagem.veiculo?.meta_consumo || 2.4))
  const [timeTicker, setTimeTicker] = useState(() => Date.now())
  const recalculateEtaInFlightRef = useRef(false)

  const [eventForm, setEventForm] = useState<EventFormState>({
    tipo_evento: "chegada",
    status_evento: "concluido",
    titulo: "",
    local: "",
    observacao: "",
    inicio_em: "",
    fim_em: "",
  })
  const [passagemPontoSelecionado, setPassagemPontoSelecionado] = useState("")
  const [novoPontoPassagem, setNovoPontoPassagem] = useState("")
  const [postosAbastecimento, setPostosAbastecimento] = useState<PostoAbastecimento[]>([])
  const [abastecimentoForm, setAbastecimentoForm] = useState({
    veiculo_id: viagem.veiculo_id || "",
    posto_id: "",
    hodometro: "",
    litros: "",
    valor_total: "",
    posto: "",
    arla: "nao",
    arla_valor: "",
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

  useEffect(() => {
    if (initialEventos.length > 0) return

    const localEventos = readLocalEventos(viagem.id)
    if (localEventos.length > 0) {
      setEventos(localEventos)
      setUsingLocalEventosFallback(true)
    }
  }, [initialEventos.length, viagem.id])

  useEffect(() => {
    const loadPostos = async () => {
      const { data } = await supabase
        .from("postos_abastecimento")
        .select("id, user_id, nome, localidade, referencia, created_at, updated_at")
        .order("nome")

      if (data) {
        setPostosAbastecimento(data as PostoAbastecimento[])
      }
    }

    void loadPostos()
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimeTicker(Date.now())
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [])

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
      ? (viagemState.data_fim || new Date(timeTicker).toISOString())
      : new Date(timeTicker).toISOString()

    return (new Date(finalDate).getTime() - new Date(viagemState.data_inicio).getTime()) / 3600000
  }, [timeTicker, viagemState.data_fim, viagemState.data_inicio, viagemState.status])

  const statusNormalizado = normalizeViagemStatus(viagemState.status)

  const faseOperacional = useMemo(() => {
    if (statusNormalizado === "Planejada") return "Pré-operação"
    if (statusNormalizado === "Em andamento") return "Em trânsito"
    if (statusNormalizado === "Concluida") return "Encerramento"
    return "Cancelada"
  }, [statusNormalizado])

  const ultimoMarco = eventosOrdenados[0] || null

  const proximoMarcoPrevisto = useMemo(() => {
    const agora = timeTicker
    return eventos
      .filter((evento) => !!evento.previsto_em)
      .map((evento) => ({ ...evento, previstoTs: new Date(evento.previsto_em as string).getTime() }))
      .filter((evento) => evento.previstoTs >= agora)
      .sort((a, b) => a.previstoTs - b.previstoTs)[0] || null
  }, [eventos, timeTicker])

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

  const progressoRotaPercent = useMemo(() => {
    if (kmPlanejado <= 0) return 0
    const perc = ((kmPlanejado - kmRestanteAutomatico) / kmPlanejado) * 100
    return Math.max(0, Math.min(100, perc))
  }, [kmPlanejado, kmRestanteAutomatico])

  const kmPercorrido = Math.max(0, kmPlanejado > 0 ? kmPlanejado - kmRestanteAutomatico : kmReal)

  const tempoRestanteHoras = useMemo(() => {
    if (!viagemState.eta_destino_em) return null
    const diffMs = new Date(viagemState.eta_destino_em).getTime() - timeTicker
    return diffMs > 0 ? diffMs / 3600000 : 0
  }, [timeTicker, viagemState.eta_destino_em])

  const consumoMedioOperacao = useMemo(() => {
    if (abastecimentosResumo.litros <= 0) return 0
    const baseKm = kmReal > 0 ? kmReal : kmPercorrido
    if (baseKm <= 0) return 0
    return baseKm / abastecimentosResumo.litros
  }, [abastecimentosResumo.litros, kmPercorrido, kmReal])

  const consumoPrevistoTotalLitros = useMemo(() => {
    if (kmPlanejado <= 0 || consumoMedioOperacao <= 0) return null
    return kmPlanejado / consumoMedioOperacao
  }, [consumoMedioOperacao, kmPlanejado])

  const necessarioAbastecerLitros = useMemo(() => {
    if (consumoPrevistoTotalLitros === null) return null
    return Math.max(0, consumoPrevistoTotalLitros - abastecimentosResumo.litros)
  }, [abastecimentosResumo.litros, consumoPrevistoTotalLitros])

  const primeiroPendenteIndex = useMemo(
    () =>
      percursoPlanejado.findIndex((ponto) => {
        if (ponto.tipo === "origem") return !ponto.partidaReal
        if (ponto.tipo === "destino") return !ponto.chegadaReal
        return !ponto.chegadaReal
      }),
    [percursoPlanejado],
  )

  const proximoPontoTimeline =
    primeiroPendenteIndex >= 0 ? percursoPlanejado[primeiroPendenteIndex] : null

  const clienteNome = viagemState.cliente?.nome || "Sem cliente"
  const cicloLabel = viagemState.rota?.nome || `C-${viagemState.id.slice(0, 4).toUpperCase()}`
  const viagemLabel = `V-${viagemState.id.slice(0, 6).toUpperCase()}`
  const origemOperacionalLabel =
    viagemState.origem_real ||
    [viagemState.rota?.origem_cidade, viagemState.rota?.origem_estado].filter(Boolean).join("/") ||
    "Origem"
  const destinoOperacionalLabel =
    viagemState.destino_real ||
    [viagemState.rota?.destino_cidade, viagemState.rota?.destino_estado].filter(Boolean).join("/") ||
    "Destino"

  const pontosIntermediariosRotaOptions = useMemo(() => {
    const fromRota = (viagemState.rota?.pontos_intermediarios || [])
      .map((ponto) => {
        const cidade = (ponto?.cidade || "").trim()
        const estado = (ponto?.estado || "").trim()
        if (!cidade || !estado) return null
        return `${cidade}/${estado}`
      })
      .filter(Boolean) as string[]

    const fromPlanejamento = (viagemState.planejamento_rota?.intermediarios || [])
      .map((ponto) => {
        const cidade = (ponto?.cidade || "").trim()
        const estado = (ponto?.estado || "").trim()
        if (!cidade || !estado) return null
        return `${cidade}/${estado}`
      })
      .filter(Boolean) as string[]

    return Array.from(new Set([...fromRota, ...fromPlanejamento]))
  }, [viagemState.planejamento_rota?.intermediarios, viagemState.rota?.pontos_intermediarios])

  const pontosPassagemExtrasViagem = useMemo(() => {
    const extras = eventos
      .filter((evento) => evento.titulo === "Passagem")
      .filter((evento) => {
        const payload = (evento.payload || {}) as Record<string, unknown>
        return payload.passagem_ponto_origem === "viagem"
      })
      .map((evento) => (evento.local || "").trim())
      .filter(Boolean)

    return Array.from(new Set(extras))
  }, [eventos])

  const pontosPassagemOptions = useMemo(
    () => Array.from(new Set([...pontosIntermediariosRotaOptions, ...pontosPassagemExtrasViagem])),
    [pontosIntermediariosRotaOptions, pontosPassagemExtrasViagem],
  )

  const proximaAcaoTitulo = proximoMarcoPrevisto
    ? `${eventTypeLabels[proximoMarcoPrevisto.tipo_evento]} — ${proximoMarcoPrevisto.local || "Ponto operacional"}`
    : proximoPontoTimeline
      ? `Chegada — ${proximoPontoTimeline.label}`
      : "Sem próxima ação planejada"

  const proximaAcaoPrevisao =
    proximoMarcoPrevisto?.previsto_em ||
    proximoPontoTimeline?.chegadaPlanejada ||
    proximoPontoTimeline?.partidaPlanejada ||
    viagemState.eta_destino_em ||
    null

  const chegadaPlanejadaDestino =
    viagemState.planejamento_rota?.destino_chegada_planejada ||
    viagemState.data_fim ||
    null

  const previsaoChegadaDestino = viagemState.eta_destino_em || chegadaPlanejadaDestino

  const eventosCockpit = useMemo(() => {
    const toTipo = (evento: ViagemEvento) => {
      if (evento.titulo?.trim()) return evento.titulo
      return eventTypeLabels[evento.tipo_evento] || evento.tipo_evento
    }

    const toStatus = (evento: ViagemEvento) => {
      if (evento.status_evento === "concluido") return "Concluído"
      if (evento.status_evento === "em_andamento") return "Em andamento"
      if (evento.status_evento === "atrasado") return "Atrasado"
      return "Pendente"
    }

    return eventosOrdenados.map((evento, index) => ({
      id: evento.id,
      ordem: index + 1,
      tipo: toTipo(evento),
      local: evento.local || "-",
      inicio: formatDateTime(evento.ocorrido_em),
      fim: formatDateTime(evento.previsto_em),
      duracao: formatDurationByUnit(Number(evento.impacto_minutos || 0)),
      status: toStatus(evento),
      source: evento,
    }))
  }, [eventosOrdenados])

  const tempoCarregamentoPlanejadoMin = useMemo(
    () =>
      eventos.reduce((sum, evento) => {
        const titulo = (evento.titulo || "").toLowerCase()
        if (!titulo.includes("carreg")) return sum
        return sum + Math.max(0, Number(evento.impacto_minutos || 0))
      }, 0),
    [eventos],
  )

  const tempoCarregamentoRealMin = useMemo(() => {
    return eventos.reduce((sum, evento) => {
      const titulo = (evento.titulo || "").toLowerCase()
      if (!titulo.includes("carreg")) return sum
      if (evento.status_evento === "em_andamento") {
        const minutosAteAgora = Math.max(0, Math.round((timeTicker - new Date(evento.ocorrido_em).getTime()) / 60000))
        return sum + minutosAteAgora
      }
      return sum + Math.max(0, Number(evento.impacto_minutos || 0))
    }, 0)
  }, [eventos, timeTicker])

  const tempoTotalParadoMin = useMemo(() => {
    return eventos.reduce((sum, evento) => {
      const titulo = (evento.titulo || "").toLowerCase()
      const contaComoParado =
        ["parada", "espera", "ocorrencia"].includes(evento.tipo_evento) ||
        titulo.includes("fila") ||
        titulo.includes("descans")

      if (!contaComoParado) return sum

      if (evento.status_evento === "em_andamento") {
        const minutosAteAgora = Math.max(0, Math.round((timeTicker - new Date(evento.ocorrido_em).getTime()) / 60000))
        return sum + minutosAteAgora
      }

      return sum + Math.max(0, Number(evento.impacto_minutos || 0))
    }, 0)
  }, [eventos, timeTicker])

  const consumoEstimadoLitros = useMemo(() => {
    if (kmPlanejado <= 0 || consumoMedioEditavel <= 0) return null
    return kmPlanejado / consumoMedioEditavel
  }, [consumoMedioEditavel, kmPlanejado])

  const saldoAtualEstimadoLitros = useMemo(() => {
    const saldoInicial = Number(saldoInicialLitros)
    if (!Number.isFinite(saldoInicial)) return null
    if (consumoEstimadoLitros === null) return null
    return saldoInicial + abastecimentosResumo.litros - consumoEstimadoLitros
  }, [abastecimentosResumo.litros, consumoEstimadoLitros, saldoInicialLitros])

  const pendenciasCockpit = useMemo(() => {
    const itens: string[] = []

    const possuiSaidaOrigem = eventos.some((evento) => evento.tipo_evento === "saida")
    const possuiChegadaDestino = eventos.some((evento) => evento.tipo_evento === "chegada")

    if (statusNormalizado !== "Planejada" && !possuiSaidaOrigem) {
      itens.push("Saída da origem ainda não registrada.")
    }

    if (statusNormalizado === "Em andamento" && !possuiChegadaDestino) {
      itens.push("Chegada ao destino pendente de registro.")
    }

    if ((viagemState.atraso_estimado_minutos || 0) > 0) {
      itens.push(`Atraso estimado de ${formatDurationByUnit(Number(viagemState.atraso_estimado_minutos || 0))}.`)
    }

    if (tempoTotalParadoMin >= 120) {
      itens.push(`Tempo parado elevado no ciclo: ${formatDurationByUnit(tempoTotalParadoMin)}.`)
    }

    if (saldoAtualEstimadoLitros !== null && saldoAtualEstimadoLitros < 0) {
      itens.push("Saldo de diesel estimado insuficiente para concluir o ciclo.")
    }

    if (itens.length === 0) {
      itens.push("Operação sem pendências críticas no momento.")
    }

    return itens.slice(0, 4)
  }, [
    eventos,
    saldoAtualEstimadoLitros,
    statusNormalizado,
    tempoTotalParadoMin,
    viagemState.atraso_estimado_minutos,
  ])

  const smartQuickActions = useMemo(() => {
    const carregamentoEmAndamento = eventosOrdenados.some(
      (evento) => evento.status_evento === "em_andamento" && evento.titulo === "Início de carregamento",
    )
    const descansoEmAndamento = eventosOrdenados.some(
      (evento) => evento.status_evento === "em_andamento" && evento.titulo === "Início de descanso",
    )

    return [
      {
        label: "Partida/Chegada",
        action: {
          label: "Partida/Chegada",
          type: "saida",
          status: "concluido",
          title: "Partida e chegada",
        } as CockpitQuickAction,
      },
      {
        label: carregamentoEmAndamento ? "Finalizar Carreg." : "Iniciar Carreg.",
        action: findQuickActionByTitle(carregamentoEmAndamento ? "Fim de carregamento" : "Início de carregamento"),
      },
      {
        label: descansoEmAndamento ? "Finalizar Descanso" : "Iniciar Descanso",
        action: findQuickActionByTitle(descansoEmAndamento ? "Fim de descanso" : "Início de descanso"),
      },
      { label: "Abastecimento", action: findQuickActionByTitle("Abastecimento") },
      { label: "Manutenção", action: findQuickActionByTitle("Manutenção") },
      { label: "Documentação", action: findQuickActionByTitle("Documentação") },
      { label: "Ocorrência", action: findQuickActionByTitle("Ocorrência") },
    ].filter((item): item is { label: string; action: CockpitQuickAction } => Boolean(item.action))
  }, [eventosOrdenados])

  const paradasPrevistasPorRota = useMemo(
    () => deriveEtaStopsFromIntermediarios(viagemState.rota?.pontos_intermediarios),
    [viagemState.rota?.pontos_intermediarios],
  )

  const recalculateEta = async (override?: { km?: number; velocidade?: number }) => {
    if (recalculateEtaInFlightRef.current) return
    recalculateEtaInFlightRef.current = true

    try {
    const km = override?.km ?? kmRestanteAutomatico
    const velocidade = override?.velocidade
    const etaPlanejadaDestino =
      viagemState.planejamento_rota?.destino_chegada_planejada ||
      viagemState.data_fim ||
      null

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
      tempoPerdidoMin: tempoTotalParadoMin,
      etaPlanejado: etaPlanejadaDestino,
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

    const etaAtualTs = viagemState.eta_destino_em ? new Date(viagemState.eta_destino_em).getTime() : null
    const etaNovoTs = new Date(payload.eta_destino_em).getTime()
    const shouldPersist =
      etaAtualTs === null ||
      Math.abs(etaNovoTs - etaAtualTs) >= 60_000 ||
      Math.abs(Number(viagemState.atraso_estimado_minutos || 0) - Number(payload.atraso_estimado_minutos || 0)) >= 1 ||
      Math.abs(Number(viagemState.velocidade_media_kmh || 0) - Number(payload.velocidade_media_kmh || 0)) >= 0.1 ||
      Number(viagemState.km_restante || 0) !== Number(payload.km_restante || 0)

    if (!shouldPersist) {
      return
    }

    const { error } = await supabase
      .from("viagens")
      .update(payload)
      .eq("id", viagemState.id)

    if (!error) {
      setViagemState((prev) => ({ ...prev, ...payload }))
    }
    } finally {
      recalculateEtaInFlightRef.current = false
    }
  }

  useEffect(() => {
    if (statusNormalizado !== "Em andamento") return

    const runAutoEta = () => {
      void recalculateEta()
    }

    runAutoEta()
    const intervalId = window.setInterval(runAutoEta, 60_000)

    return () => window.clearInterval(intervalId)
  }, [
    statusNormalizado,
    kmRestanteAutomatico,
    tempoTotalParadoMin,
    viagemState.carregado,
    viagemState.data_inicio,
    viagemState.data_fim,
    viagemState.rota_id,
    viagemState.motorista_id,
    viagemState.veiculo_id,
    viagemState.velocidade_media_kmh,
    viagemState.planejamento_rota?.destino_chegada_planejada,
    paradasPrevistasPorRota,
    etaParametros,
  ])

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
    setLoading(true)

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

    setLoading(false)
  }

  const openNewEventModal = (type: EventoViagemTipo) => {
    setActiveTimelineEvent(null)
    const nowLocal = toDatetimeLocal(new Date().toISOString())
    setEventForm({
      tipo_evento: type,
      status_evento: "concluido",
      titulo: eventTypeLabels[type],
      local: "",
      observacao: "",
      inicio_em: nowLocal,
      fim_em: nowLocal,
    })
    setEventModalOpen(true)
  }

  const refreshEventos = async () => {
    const { data, error } = await supabase
      .from("viagem_eventos")
      .select("*")
      .eq("viagem_id", viagemState.id)
      .order("ocorrido_em", { ascending: false })

    if (!error && data) {
      setEventos(data as ViagemEvento[])
      setUsingLocalEventosFallback(false)
      return
    }

    if (error && isMissingViagemEventosTableError(error.message, error.code)) {
      const localEventos = readLocalEventos(viagemState.id)
      setEventos(localEventos)
      setUsingLocalEventosFallback(true)
    }
  }

  const getEventoSaveErrorMessage = (errorMessage: string, errorCode?: string) => {
    const missingTable = isMissingViagemEventosTableError(errorMessage, errorCode)

    if (missingTable) {
      return "Tabela 'viagem_eventos' não encontrada no Supabase. Execute o script scripts/004_cockpit_viagem_eta_docs.sql no SQL Editor do projeto."
    }

    return errorMessage
  }

  const handleQuickActionRegister = (action: CockpitQuickAction) => {
    const nowLocal = toDatetimeLocal(new Date().toISOString())
    const localPadrao =
      ultimoMarco?.local ||
      viagemState.destino_real ||
      viagemState.origem_real ||
      "A DEFINIR"
    const isPartidaChegadaAction = action.title === "Partida e chegada"

    setActiveTimelineEvent(null)
    setEventForm({
      tipo_evento: isPartidaChegadaAction ? "saida" : action.type,
      status_evento: "concluido",
      titulo: isPartidaChegadaAction ? "Saída" : action.title,
      local: isPartidaChegadaAction ? origemOperacionalLabel : localPadrao,
      observacao: "Registrado por ação rápida.",
      inicio_em: nowLocal,
      fim_em: nowLocal,
    })
    if (action.type === "abastecimento") {
      setAbastecimentoForm({
        veiculo_id: viagemState.veiculo_id || "",
        posto_id: "",
        hodometro: "",
        litros: "",
        valor_total: "",
        posto: localPadrao,
        arla: "nao",
        arla_valor: "",
      })
    }
    setPassagemPontoSelecionado("")
    setNovoPontoPassagem("")
    setEventModalOpen(true)
  }

  const quickActionPartidaChegadaAtiva = ["Saída", "Chegada", "Passagem"].includes(eventForm.titulo)

  const selectedMarcoOperacional = useMemo<MarcoOperacionalTipo>(() => {
    if (eventForm.titulo === "Chegada") return "chegada"
    if (eventForm.titulo === "Passagem") return "passagem"
    return "saida"
  }, [eventForm.titulo])

  const isPassagemSelecionada = quickActionPartidaChegadaAtiva && selectedMarcoOperacional === "passagem"
  const isAbastecimentoSelecionado = eventForm.tipo_evento === "abastecimento" || eventForm.titulo === "Abastecimento"

  const handleChangeMarcoOperacional = (value: MarcoOperacionalTipo) => {
    const config = marcoOperacionalConfig[value]
    const localMarco = value === "saida" ? origemOperacionalLabel : value === "chegada" ? destinoOperacionalLabel : ""
    const passagemDefault = pontosPassagemOptions[0] || PASSAGEM_OUTRO_PONTO_VALUE

    if (value === "passagem") {
      setPassagemPontoSelecionado(passagemDefault)
      setNovoPontoPassagem("")
    } else {
      setPassagemPontoSelecionado("")
      setNovoPontoPassagem("")
    }

    setEventForm((prev) => ({
      ...prev,
      tipo_evento: config.tipo,
      titulo: config.titulo,
      local:
        value === "passagem"
          ? (passagemDefault === PASSAGEM_OUTRO_PONTO_VALUE ? "" : passagemDefault)
          : (localMarco || prev.local),
      fim_em: "",
    }))
  }

  const getAbastecimentoPayloadData = (payload: Record<string, unknown> | null | undefined) => {
    if (!payload) {
      return {
        posto_id: "",
        hodometro: "",
        litros: "",
        valor_total: "",
        posto: "",
        arla: "nao",
        arla_valor: "",
      }
    }

    return {
      posto_id: String(payload.posto_id || ""),
      hodometro: payload.hodometro !== undefined && payload.hodometro !== null ? String(payload.hodometro) : "",
      litros: payload.litros !== undefined && payload.litros !== null ? String(payload.litros) : "",
      valor_total: payload.valor_total !== undefined && payload.valor_total !== null ? String(payload.valor_total) : "",
      posto: String(payload.posto || ""),
      arla: payload.arla === "sim" ? "sim" : "nao",
      arla_valor: payload.arla_valor !== undefined && payload.arla_valor !== null ? String(payload.arla_valor) : "",
    }
  }

  const upsertAbastecimentoRegistro = async (params: {
    userId: string
    eventPayload: Record<string, unknown>
    existingAbastecimentoId?: string | null
    inicioIso: string
  }) => {
    const postoNome =
      String(params.eventPayload.posto || "") ||
      postosAbastecimento.find((item) => item.id === String(params.eventPayload.posto_id || ""))?.nome ||
      null

    const abastecimentoData = {
      user_id: params.userId,
      veiculo_id: String(params.eventPayload.veiculo_id || viagemState.veiculo_id || ""),
      viagem_id: viagemState.id,
      posto_id: String(params.eventPayload.posto_id || "") || null,
      data: params.inicioIso,
      hodometro: Number(params.eventPayload.hodometro || 0),
      litros: Number(params.eventPayload.litros || 0),
      valor_total: Number(params.eventPayload.valor_total || 0),
      posto: postoNome,
      observacao: eventForm.observacao || null,
    }

    if (!abastecimentoData.veiculo_id) return null

    if (params.existingAbastecimentoId) {
      const { data, error } = await supabase
        .from("abastecimentos")
        .update(abastecimentoData)
        .eq("id", params.existingAbastecimentoId)
        .select("id")
        .single()

      if (!error && data) return data.id as string
    }

    const { data, error } = await supabase
      .from("abastecimentos")
      .insert(abastecimentoData)
      .select("id")
      .single()

    if (!error && data) return data.id as string
    return null
  }

  const handleSelectPassagemPonto = (value: string) => {
    setPassagemPontoSelecionado(value)
    if (value === PASSAGEM_OUTRO_PONTO_VALUE) {
      setEventForm((prev) => ({ ...prev, local: "" }))
      return
    }

    setNovoPontoPassagem("")
    setEventForm((prev) => ({ ...prev, local: value }))
  }

  useEffect(() => {
    if (!eventModalOpen || !isPassagemSelecionada) return

    const localAtual = (eventForm.local || "").trim()
    if (!localAtual) {
      const fallback = pontosPassagemOptions[0] || PASSAGEM_OUTRO_PONTO_VALUE
      setPassagemPontoSelecionado(fallback)
      return
    }

    if (pontosPassagemOptions.includes(localAtual)) {
      setPassagemPontoSelecionado(localAtual)
      setNovoPontoPassagem("")
      return
    }

    setPassagemPontoSelecionado(PASSAGEM_OUTRO_PONTO_VALUE)
    setNovoPontoPassagem(localAtual)
  }, [eventModalOpen, isPassagemSelecionada, eventForm.local, pontosPassagemOptions])

  const syncPlanejamentoRealByMarco = async (marco: MarcoOperacionalTipo, ocorridoIso: string) => {
    if (marco !== "saida" && marco !== "chegada") return

    const planejamentoAtual = viagemState.planejamento_rota || {
      origem_partida_planejada: null,
      destino_chegada_planejada: null,
      intermediarios: [],
    }

    const planejamentoAtualizado = {
      ...planejamentoAtual,
      origem_partida_real: marco === "saida" ? ocorridoIso : planejamentoAtual.origem_partida_real || null,
      destino_chegada_real: marco === "chegada" ? ocorridoIso : planejamentoAtual.destino_chegada_real || null,
    }

    const { error } = await supabase
      .from("viagens")
      .update({ planejamento_rota: planejamentoAtualizado })
      .eq("id", viagemState.id)

    if (!error) {
      setViagemState((prev) => ({
        ...prev,
        planejamento_rota: planejamentoAtualizado,
      }))

      setTimelineReal((prev) => ({
        ...prev,
        origem_partida_real:
          marco === "saida"
            ? toDatetimeLocal(ocorridoIso)
            : prev.origem_partida_real,
        destino_chegada_real:
          marco === "chegada"
            ? toDatetimeLocal(ocorridoIso)
            : prev.destino_chegada_real,
      }))
    }
  }

  const handleSaveEvent = async () => {
    if (!eventForm.titulo) return
    setLoading(true)

    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id || viagemState.user_id
    if (!userId) {
      alert("Não foi possível identificar o usuário para salvar o evento.")
      setLoading(false)
      return
    }

    const inicioIso = eventForm.inicio_em ? new Date(eventForm.inicio_em).toISOString() : new Date().toISOString()
    const eventoPontual = quickActionPartidaChegadaAtiva
    const marcoAtual: MarcoOperacionalTipo =
      eventForm.titulo === "Chegada"
        ? "chegada"
        : eventForm.titulo === "Passagem"
          ? "passagem"
          : "saida"
    const localPassagem =
      passagemPontoSelecionado === PASSAGEM_OUTRO_PONTO_VALUE
        ? novoPontoPassagem.trim()
        : passagemPontoSelecionado || eventForm.local || ""

    if (marcoAtual === "passagem" && !localPassagem.trim()) {
      alert("Selecione um ponto de passagem ou informe um novo ponto.")
      setLoading(false)
      return
    }

    if (isAbastecimentoSelecionado) {
      if (!abastecimentoForm.veiculo_id || !abastecimentoForm.hodometro || !abastecimentoForm.litros || !abastecimentoForm.valor_total) {
        alert("Para abastecimento, preencha veículo, hodômetro, litros e valor total.")
        setLoading(false)
        return
      }

      if (abastecimentoForm.arla === "sim" && !abastecimentoForm.arla_valor) {
        alert("Informe o valor de ARLA quando selecionado como SIM.")
        setLoading(false)
        return
      }
    }

    const localEvento =
      quickActionPartidaChegadaAtiva && marcoAtual === "saida"
        ? origemOperacionalLabel
        : quickActionPartidaChegadaAtiva && marcoAtual === "chegada"
          ? destinoOperacionalLabel
          : quickActionPartidaChegadaAtiva && marcoAtual === "passagem"
            ? localPassagem
          : isAbastecimentoSelecionado
            ? abastecimentoForm.posto || postosAbastecimento.find((item) => item.id === abastecimentoForm.posto_id)?.nome || eventForm.local || null
          : eventForm.local || null
    const payloadMetaBase =
      marcoAtual === "passagem"
        ? {
            passagem_ponto_origem:
              passagemPontoSelecionado === PASSAGEM_OUTRO_PONTO_VALUE ? "viagem" : "rota",
          }
        : {}

    const payloadAbastecimento = isAbastecimentoSelecionado
      ? {
          veiculo_id: abastecimentoForm.veiculo_id,
          posto_id: abastecimentoForm.posto_id || null,
          hodometro: Number(abastecimentoForm.hodometro || 0),
          litros: Number(abastecimentoForm.litros || 0),
          valor_total: Number(abastecimentoForm.valor_total || 0),
          arla: abastecimentoForm.arla,
          arla_valor: abastecimentoForm.arla === "sim" ? Number(abastecimentoForm.arla_valor || 0) : null,
          posto:
            abastecimentoForm.posto ||
            postosAbastecimento.find((item) => item.id === abastecimentoForm.posto_id)?.nome ||
            null,
        }
      : {}

    const payloadMeta =
      Object.keys({ ...payloadMetaBase, ...payloadAbastecimento }).length > 0
        ? {
            ...payloadMetaBase,
            ...payloadAbastecimento,
          }
        : null

    const fimIso = eventoPontual
      ? null
      : eventForm.fim_em
        ? new Date(eventForm.fim_em).toISOString()
        : null
    const impactoMinutos = fimIso
      ? Math.max(0, Math.round((new Date(fimIso).getTime() - new Date(inicioIso).getTime()) / 60000))
      : 0

    const payload = {
      tipo_evento: eventForm.tipo_evento,
      status_evento: eventForm.status_evento,
      titulo: eventForm.titulo,
      local: localEvento,
      observacao: eventForm.observacao || null,
      previsto_em: fimIso,
      impacto_minutos: impactoMinutos,
      comprovante_url: null,
      payload: payloadMeta,
    }

    if (activeTimelineEvent) {
      const { data, error } = await supabase
        .from("viagem_eventos")
        .update({ ...payload, ocorrido_em: inicioIso })
        .eq("id", activeTimelineEvent.id)
        .select("*")
        .single()

      if (!error && data) {
        if (isAbastecimentoSelecionado) {
          const existingAbastecimentoId = String(
            ((activeTimelineEvent.payload || {}) as Record<string, unknown>).abastecimento_id || "",
          ) || null
          const abastecimentoId = await upsertAbastecimentoRegistro({
            userId,
            eventPayload: (payloadMeta || {}) as Record<string, unknown>,
            existingAbastecimentoId,
            inicioIso,
          })

          if (abastecimentoId) {
            await supabase
              .from("viagem_eventos")
              .update({
                payload: {
                  ...((payloadMeta || {}) as Record<string, unknown>),
                  abastecimento_id: abastecimentoId,
                },
              })
              .eq("id", activeTimelineEvent.id)
          }
        }
        await refreshEventos()
        await syncPlanejamentoRealByMarco(marcoAtual, inicioIso)
        setEventModalOpen(false)
        setActiveTimelineEvent(null)
        await recalculateEta()
      } else if (error && isMissingViagemEventosTableError(error.message, error.code)) {
        const localEventos = readLocalEventos(viagemState.id)
        const nowIso = new Date().toISOString()
        const updatedLocal = localEventos.map((item) =>
          item.id === activeTimelineEvent.id
            ? {
                ...item,
                ...payload,
                ocorrido_em: inicioIso,
                updated_at: nowIso,
              }
            : item,
        )

        writeLocalEventos(viagemState.id, updatedLocal)
        setEventos(updatedLocal)
        setUsingLocalEventosFallback(true)

        if (isAbastecimentoSelecionado) {
          const existingAbastecimentoId = String(
            ((activeTimelineEvent.payload || {}) as Record<string, unknown>).abastecimento_id || "",
          ) || null
          await upsertAbastecimentoRegistro({
            userId,
            eventPayload: (payloadMeta || {}) as Record<string, unknown>,
            existingAbastecimentoId,
            inicioIso,
          })
        }

        await syncPlanejamentoRealByMarco(marcoAtual, inicioIso)
        setEventModalOpen(false)
        setActiveTimelineEvent(null)
        await recalculateEta()
      } else if (error) {
        alert(`Erro ao atualizar evento: ${getEventoSaveErrorMessage(error.message, error.code)}`)
      }
    } else {
      const { data, error } = await supabase
        .from("viagem_eventos")
        .insert({
          user_id: userId,
          viagem_id: viagemState.id,
          ...payload,
          ocorrido_em: inicioIso,
        })
        .select("*")
        .single()

      if (!error && data) {
        if (isAbastecimentoSelecionado) {
          const abastecimentoId = await upsertAbastecimentoRegistro({
            userId,
            eventPayload: (payloadMeta || {}) as Record<string, unknown>,
            inicioIso,
          })

          if (abastecimentoId) {
            await supabase
              .from("viagem_eventos")
              .update({
                payload: {
                  ...((payloadMeta || {}) as Record<string, unknown>),
                  abastecimento_id: abastecimentoId,
                },
              })
              .eq("id", data.id)
          }
        }

        await refreshEventos()
        await syncPlanejamentoRealByMarco(marcoAtual, inicioIso)
        setEventModalOpen(false)
        setActiveTimelineEvent(null)
        await recalculateEta()
      } else if (error && isMissingViagemEventosTableError(error.message, error.code)) {
        const nowIso = new Date().toISOString()
        const localEvento: ViagemEvento = {
          id: createLocalEventId(),
          user_id: userId,
          viagem_id: viagemState.id,
          ...payload,
          ocorrido_em: inicioIso,
          created_at: nowIso,
          updated_at: nowIso,
        }

        const localEventos = [localEvento, ...readLocalEventos(viagemState.id)]
        writeLocalEventos(viagemState.id, localEventos)
        setEventos(localEventos)
        setUsingLocalEventosFallback(true)

        if (isAbastecimentoSelecionado) {
          await upsertAbastecimentoRegistro({
            userId,
            eventPayload: (payloadMeta || {}) as Record<string, unknown>,
            inicioIso,
          })
        }

        await syncPlanejamentoRealByMarco(marcoAtual, inicioIso)
        setEventModalOpen(false)
        setActiveTimelineEvent(null)
        await recalculateEta()
      } else if (error) {
        alert(`Erro ao salvar evento: ${getEventoSaveErrorMessage(error.message, error.code)}`)
      }
    }

    setLoading(false)
  }

  const handleDeleteEvent = async () => {
    if (!activeTimelineEvent) return

    const confirmDelete = window.confirm("Deseja apagar este evento do ciclo?")
    if (!confirmDelete) return

    setLoading(true)

    const { error } = await supabase
      .from("viagem_eventos")
      .delete()
      .eq("id", activeTimelineEvent.id)

    if (!error) {
      await refreshEventos()
      setEventModalOpen(false)
      setActiveTimelineEvent(null)
      await recalculateEta()
      setLoading(false)
      return
    }

    if (isMissingViagemEventosTableError(error.message, error.code)) {
      const updatedLocal = readLocalEventos(viagemState.id).filter((item) => item.id !== activeTimelineEvent.id)
      writeLocalEventos(viagemState.id, updatedLocal)
      setEventos(updatedLocal)
      setUsingLocalEventosFallback(true)
      setEventModalOpen(false)
      setActiveTimelineEvent(null)
      await recalculateEta()
      setLoading(false)
      return
    }

    alert(`Erro ao apagar evento: ${getEventoSaveErrorMessage(error.message, error.code)}`)
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

  const handleFinalizarCiclo = async () => {
    setLoading(true)

    const { error } = await supabase
      .from("viagens")
      .update({ status: "Concluida" })
      .eq("id", viagemState.id)

    if (!error) {
      setViagemState((prev) => ({ ...prev, status: "Concluida" }))
    }

    setLoading(false)
  }

  return (
    <div className={embedded ? "space-y-3 w-full max-w-full overflow-x-hidden pb-1" : "space-y-4"}>
      {!embedded && (
        <Link href="/viagens" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
          <ArrowLeft className="size-4" />
          Voltar para viagens
        </Link>
      )}

      <Tabs defaultValue="operacao" className="space-y-3 min-h-0">
        <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap gap-1 rounded-xl border border-border/60 bg-muted/40 p-1.5">
          <TabsTrigger className={embedded ? "px-3 text-sm" : undefined} value="operacao">Operação</TabsTrigger>
          <TabsTrigger className={embedded ? "px-3 text-sm" : undefined} value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger className={embedded ? "px-3 text-sm" : undefined} value="docs">Docs</TabsTrigger>
          <TabsTrigger className={embedded ? "px-3 text-sm" : undefined} value="kpis">KPIs</TabsTrigger>
        </TabsList>

        <TabsContent value="operacao" className="space-y-3 min-h-0">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
            <div className="space-y-3 xl:col-span-9">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)] gap-3">
                <div className="space-y-3">
                  <Card className="border-border/60 shadow-sm py-3 gap-2">
                    <CardContent className="p-4 sm:p-4 space-y-1.5">
                      <h2 className="text-xl font-bold tracking-tight">COCKPIT DO CICLO — TRANSLOG</h2>
                      <p className="text-sm text-muted-foreground leading-tight">
                        Ciclo: <span className="font-medium text-foreground">{cicloLabel}</span>
                        {" | "}Veículo: <span className="font-medium text-foreground">{viagemState.veiculo?.placa_cavalo || "A DEFINIR"}</span>
                        {" | "}Motorista: <span className="font-medium text-foreground">{viagemState.motorista?.nome || "A DEFINIR"}</span>
                        {" | "}Status: <span className="font-semibold uppercase text-foreground">{faseOperacional}</span>
                      </p>
                      <p className="text-sm text-muted-foreground leading-tight">
                        Marco atual: <span className="font-medium text-foreground">{ultimoMarco ? `${eventTypeLabels[ultimoMarco.tipo_evento]} (${ultimoMarco.local || "A DEFINIR"})` : "A DEFINIR"}</span>
                      </p>
                      <p className="text-sm text-muted-foreground leading-tight">
                        Previsão próximo marco: <span className="font-medium text-foreground">{proximaAcaoTitulo} — {formatDateTime(proximaAcaoPrevisao)}</span>
                        {" | "}Retorno: <span className="font-medium text-foreground">{viagemState.destino_real ? "DEFINIDO" : "EM ABERTO"}</span>
                      </p>
                      <p className="text-sm text-muted-foreground leading-tight">
                        Previsão de chegada ao destino: <span className="font-medium text-foreground">{formatDateTime(previsaoChegadaDestino)}</span>
                        {tempoTotalParadoMin > 0 ? (
                          <>
                            {" | "}Ajuste por tempo perdido: <span className="font-medium text-foreground">+{formatDurationByUnit(tempoTotalParadoMin)}</span>
                          </>
                        ) : null}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60 shadow-sm py-3 gap-2">
                    <CardHeader className="pb-1 px-4">
                      <CardTitle className="text-lg">ALERTAS / PENDÊNCIAS</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-0.5 pt-0 px-4">
                      {pendenciasCockpit.map((item) => (
                        <p key={item} className="text-sm text-muted-foreground">
                          <TriangleAlert className="size-4 inline-block mr-2 align-text-bottom" />
                          {item}
                        </p>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-2 lg:self-start">
                  <Card className="border-border/60 shadow-sm py-2 gap-1"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Carregamento real vs planejado</p><p className="text-base font-semibold">{formatDurationByUnit(tempoCarregamentoRealMin)} / {formatDurationByUnit(tempoCarregamentoPlanejadoMin)}</p></CardContent></Card>
                  <Card className="border-border/60 shadow-sm py-2 gap-1"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Tempo total parado</p><p className="text-base font-semibold">{formatDurationByUnit(tempoTotalParadoMin)}</p></CardContent></Card>
                  <Card className="border-border/60 shadow-sm py-2 gap-1"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Diesel no ciclo (L)</p><p className="text-base font-semibold">{abastecimentosResumo.litros.toFixed(0)} L</p></CardContent></Card>
                </div>
              </div>


              <Card className="border-border/60 shadow-sm py-3 gap-2">
                <CardHeader className="pb-1 px-4">
                  <CardTitle className="text-lg">EVENTOS DO CICLO</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-4">
                  {usingLocalEventosFallback && (
                    <p className="text-xs text-amber-600 mb-2">
                      Modo local ativo: eventos salvos no navegador até publicar a migration no Supabase.
                    </p>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-2">#</th>
                          <th className="py-2 pr-2">Tipo</th>
                          <th className="py-2 pr-2">Local</th>
                          <th className="py-2 pr-2">Início</th>
                          <th className="py-2 pr-2">Fim</th>
                          <th className="py-2 pr-2">Duração</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eventosCockpit.length === 0 && (
                          <tr>
                            <td className="py-3 text-muted-foreground" colSpan={7}>
                              Nenhum evento registrado neste ciclo.
                            </td>
                          </tr>
                        )}
                        {eventosCockpit.map((evento) => (
                          <tr
                            key={evento.id}
                            className="border-b border-border/50 cursor-pointer hover:bg-muted/30"
                            onClick={() => {
                              setActiveTimelineEvent(evento.source)
                              const payloadData = getAbastecimentoPayloadData((evento.source.payload || null) as Record<string, unknown> | null)
                              setAbastecimentoForm({
                                veiculo_id: String((evento.source.payload as Record<string, unknown> | null)?.veiculo_id || viagemState.veiculo_id || ""),
                                posto_id: payloadData.posto_id,
                                hodometro: payloadData.hodometro,
                                litros: payloadData.litros,
                                valor_total: payloadData.valor_total,
                                posto: payloadData.posto || evento.source.local || "",
                                arla: payloadData.arla === "sim" ? "sim" : "nao",
                                arla_valor: payloadData.arla_valor,
                              })
                              setEventForm({
                                tipo_evento: evento.source.tipo_evento,
                                status_evento: evento.source.status_evento,
                                titulo: evento.source.titulo,
                                local: evento.source.local || "",
                                observacao: evento.source.observacao || "",
                                inicio_em: toDatetimeLocal(evento.source.ocorrido_em),
                                fim_em: toDatetimeLocal(evento.source.previsto_em || evento.source.ocorrido_em),
                              })
                              setEventModalOpen(true)
                            }}
                          >
                            <td className="py-2 pr-2">{evento.ordem}</td>
                            <td className="py-2 pr-2">{evento.tipo}</td>
                            <td className="py-2 pr-2">{evento.local}</td>
                            <td className="py-2 pr-2">{evento.inicio}</td>
                            <td className="py-2 pr-2">{evento.fim}</td>
                            <td className="py-2 pr-2">{evento.duracao}</td>
                            <td className="py-2">{evento.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Clique em uma linha para registrar apenas início, fim e observação.</p>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm w-full">
                <CardHeader className="pb-2"><CardTitle className="text-xl">VIAGENS DO CICLO (organização)</CardTitle></CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <p className="text-sm">1) {viagemLabel} — {viagemState.origem_real || "A DEFINIR"} → {viagemState.destino_real || "A DEFINIR"} <span className="text-muted-foreground">({statusNormalizado === "Em andamento" ? "em execução" : statusNormalizado.toLowerCase()})</span></p>
                  <p className="text-sm">2) V-RETORNO — {viagemState.destino_real ? "planejado" : "RETORNO: EM ABERTO (criar quando fechar)"}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => openNewEventModal("saida")}>+ Criar viagem de retorno</Button>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm w-full">
                <CardHeader className="pb-2"><CardTitle className="text-xl">FECHAMENTO</CardTitle></CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <Button type="button" onClick={handleFinalizarCiclo} disabled={loading}>
                    {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                    Finalizar ciclo
                  </Button>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{eventosOrdenados[0]?.status_evento === "concluido" ? "☑" : "☐"} Último evento encerrado</p>
                    <p>{abastecimentosResumo.qtd > 0 ? "☑" : "☐"} Abastecimentos lançados (se houve)</p>
                    <p>{saldoAtualEstimadoLitros !== null ? "☑" : "☐"} Saldo final do tanque (L) informado</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3 xl:col-span-3">
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-xl">PAINEL OPERACIONAL</CardTitle></CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <p className="text-sm text-muted-foreground">AÇÕES RÁPIDAS ({smartQuickActions.length} botões) · ao clicar, informe início e fim</p>
                  {smartQuickActions.map(({ label, action }) => (
                    <Button
                      key={label}
                      type="button"
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleQuickActionRegister(action)}
                      disabled={loading}
                    >
                      {label}
                    </Button>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-xl">DIESEL (LITROS)</CardTitle></CardHeader>
                <CardContent className="space-y-3 pt-0 text-sm">
                  <div className="grid grid-cols-1 gap-2">
                    <div className="grid gap-1">
                      <Label htmlFor="saldoInicialLitros">Saldo inicial (L)</Label>
                      <Input
                        id="saldoInicialLitros"
                        type="number"
                        value={saldoInicialLitros}
                        onChange={(event) => setSaldoInicialLitros(event.target.value)}
                      />
                    </div>
                    <p>Abastecido no ciclo: <span className="font-medium">{abastecimentosResumo.litros.toFixed(0)} L</span></p>
                    <p>Consumo estimado: <span className="font-medium">{consumoEstimadoLitros !== null ? `${consumoEstimadoLitros.toFixed(0)} L` : "A DEFINIR"}</span></p>
                    <p>Saldo atual estimado: <span className="font-medium">{saldoAtualEstimadoLitros !== null ? `${saldoAtualEstimadoLitros.toFixed(0)} L` : "A DEFINIR"}</span></p>
                    <div className="grid gap-1">
                      <Label htmlFor="consumoMedioEditavel">Consumo médio (km/L)</Label>
                      <Input
                        id="consumoMedioEditavel"
                        type="number"
                        step="0.1"
                        value={consumoMedioEditavel}
                        onChange={(event) => setConsumoMedioEditavel(Number(event.target.value) || 0)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
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
            {quickActionPartidaChegadaAtiva && (
              <div>
                <Label>Tipo de marco</Label>
                <Select value={selectedMarcoOperacional} onValueChange={(value: MarcoOperacionalTipo) => handleChangeMarcoOperacional(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saida">{marcoOperacionalConfig.saida.label}</SelectItem>
                    <SelectItem value="chegada">{marcoOperacionalConfig.chegada.label}</SelectItem>
                    <SelectItem value="passagem">{marcoOperacionalConfig.passagem.label}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Evento</Label>
              <Input value={eventForm.titulo} onChange={(event) => setEventForm((prev) => ({ ...prev, titulo: event.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Local</Label>
                {isPassagemSelecionada ? (
                  <div className="space-y-2">
                    <Select value={passagemPontoSelecionado || (pontosPassagemOptions[0] || PASSAGEM_OUTRO_PONTO_VALUE)} onValueChange={handleSelectPassagemPonto}>
                      <SelectTrigger><SelectValue placeholder="Selecione um ponto" /></SelectTrigger>
                      <SelectContent>
                        {pontosPassagemOptions.map((ponto) => (
                          <SelectItem key={ponto} value={ponto}>{ponto}</SelectItem>
                        ))}
                        <SelectItem value={PASSAGEM_OUTRO_PONTO_VALUE}>Outro ponto (somente nesta viagem)</SelectItem>
                      </SelectContent>
                    </Select>
                    {passagemPontoSelecionado === PASSAGEM_OUTRO_PONTO_VALUE && (
                      <Input
                        placeholder="Ex.: Posto BR - km 230"
                        value={novoPontoPassagem}
                        onChange={(event) => {
                          const value = event.target.value
                          setNovoPontoPassagem(value)
                          setEventForm((prev) => ({ ...prev, local: value }))
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <Input value={eventForm.local} onChange={(event) => setEventForm((prev) => ({ ...prev, local: event.target.value }))} />
                )}
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

            {isAbastecimentoSelecionado && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-md border border-border/60 p-3">
                <div>
                  <Label>Veículo *</Label>
                  <Input
                    value={`${viagemState.veiculo?.placa_cavalo || "-"}${viagemState.veiculo?.modelo ? ` - ${viagemState.veiculo.modelo}` : ""}`}
                    disabled
                  />
                </div>
                <div>
                  <Label>Hodômetro (km) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={abastecimentoForm.hodometro}
                    onChange={(event) => setAbastecimentoForm((prev) => ({ ...prev, hodometro: event.target.value }))}
                  />
                </div>
                <div>
                  <Label>Litros *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={abastecimentoForm.litros}
                    onChange={(event) => setAbastecimentoForm((prev) => ({ ...prev, litros: event.target.value }))}
                  />
                </div>
                <div>
                  <Label>Valor Total (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={abastecimentoForm.valor_total}
                    onChange={(event) => setAbastecimentoForm((prev) => ({ ...prev, valor_total: event.target.value }))}
                  />
                </div>
                <div>
                  <Label>Posto cadastrado</Label>
                  <Select
                    value={abastecimentoForm.posto_id || undefined}
                    onValueChange={(value) => {
                      const postoSelecionado = postosAbastecimento.find((posto) => posto.id === value)
                      setAbastecimentoForm((prev) => ({
                        ...prev,
                        posto_id: value,
                        posto: postoSelecionado?.nome || prev.posto,
                      }))
                      if (postoSelecionado?.nome) {
                        setEventForm((prev) => ({ ...prev, local: postoSelecionado.nome }))
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder={postosAbastecimento.length > 0 ? "Selecione um posto" : "Nenhum posto cadastrado"} /></SelectTrigger>
                    <SelectContent>
                      {postosAbastecimento.map((posto) => (
                        <SelectItem key={posto.id} value={posto.id}>
                          {posto.nome}{posto.localidade ? ` • ${posto.localidade}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Posto (livre)</Label>
                  <Input
                    value={abastecimentoForm.posto}
                    placeholder="Use se o posto não estiver cadastrado"
                    onChange={(event) => {
                      const value = event.target.value
                      setAbastecimentoForm((prev) => ({ ...prev, posto: value }))
                      if (value) {
                        setEventForm((prev) => ({ ...prev, local: value }))
                      }
                    }}
                  />
                </div>
                <div>
                  <Label>ARLA</Label>
                  <Select
                    value={abastecimentoForm.arla}
                    onValueChange={(value: "sim" | "nao") =>
                      setAbastecimentoForm((prev) => ({
                        ...prev,
                        arla: value,
                        arla_valor: value === "sim" ? prev.arla_valor : "",
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao">Não</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {abastecimentoForm.arla === "sim" && (
                  <div>
                    <Label>Valor ARLA (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={abastecimentoForm.arla_valor}
                      onChange={(event) =>
                        setAbastecimentoForm((prev) => ({ ...prev, arla_valor: event.target.value }))
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {quickActionPartidaChegadaAtiva ? (
              <div>
                <Label>
                  {selectedMarcoOperacional === "saida"
                    ? "Data/hora da saída"
                    : selectedMarcoOperacional === "chegada"
                      ? "Data/hora da chegada"
                      : "Data/hora da passagem"}
                </Label>
                <Input
                  type="datetime-local"
                  value={eventForm.inicio_em}
                  onChange={(event) => setEventForm((prev) => ({ ...prev, inicio_em: event.target.value }))}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Início (data/hora)</Label>
                  <Input type="datetime-local" value={eventForm.inicio_em} onChange={(event) => setEventForm((prev) => ({ ...prev, inicio_em: event.target.value }))} />
                </div>
                <div>
                  <Label>Fim (data/hora)</Label>
                  <Input type="datetime-local" value={eventForm.fim_em} onChange={(event) => setEventForm((prev) => ({ ...prev, fim_em: event.target.value }))} />
                </div>
              </div>
            )}
            <div>
              <Label>Observação curta</Label>
              <Textarea value={eventForm.observacao} onChange={(event) => setEventForm((prev) => ({ ...prev, observacao: event.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeTimelineEvent ? (
                <Button type="button" variant="outline" className="border-destructive/40 text-destructive hover:text-destructive" onClick={handleDeleteEvent} disabled={loading}>
                  {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                  Apagar evento
                </Button>
              ) : (
                <div />
              )}
              <Button className="w-full" onClick={handleSaveEvent} disabled={loading}>
                {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                Salvar evento
              </Button>
            </div>
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
