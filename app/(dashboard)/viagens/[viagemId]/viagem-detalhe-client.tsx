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
  initialSubViagens?: Viagem[]
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

type EventoCicloTableRow = {
  id: string
  kind: "evento" | "resumo_fechamento"
  ordem: string
  modo: "realizado" | "planejado"
  tipo: string
  local: string
  inicio: string
  fim: string
  duracao: string
  status: string
  source: ViagemEvento | null
}

type MarcoOperacionalTipo = "saida" | "chegada" | "passagem"
const PASSAGEM_OUTRO_PONTO_VALUE = "__outro_ponto__"

function getFechamentoEventoStorageKey(viagemId: string) {
  return `tms:viagem:${viagemId}:fechamento_evento_id`
}

const cockpitQuickActions: CockpitQuickAction[] = [
  { label: "Chegada", type: "chegada", status: "concluido", title: "Chegada" },
  { label: "Saída", type: "saida", status: "concluido", title: "Saída" },
  { label: "Iniciar carregamento", type: "parada", status: "em_andamento", title: "Início de carregamento" },
  { label: "Finalizar carregamento", type: "parada", status: "concluido", title: "Fim de carregamento" },
  { label: "Iniciar descanso", type: "parada", status: "em_andamento", title: "Início de descanso" },
  { label: "Finalizar descanso", type: "parada", status: "concluido", title: "Fim de descanso" },
  { label: "Abastecimento", type: "abastecimento", status: "concluido", title: "Abastecimento" },
  { label: "Manutenção (ocorrência)", type: "parada", status: "pendente", title: "Manutenção" },
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
  nova_viagem: "Nova viagem",
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

  const normalized = status
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()

  if (["concluida", "fechada", "fechado", "finalizada", "encerrada"].includes(normalized)) return "Concluida"
  if (["em andamento", "andamento", "aberta", "aberto", "em_execucao", "executando"].includes(normalized)) return "Em andamento"
  if (["planejada", "planejado"].includes(normalized)) return "Planejada"
  if (["cancelada", "cancelado"].includes(normalized)) return "Cancelada"

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

function isEventoPlanejado(evento: ViagemEvento) {
  const payload = (evento.payload || {}) as Record<string, unknown>
  return payload.lancamento_modo === "planejado" || payload.planejado === true
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
  initialSubViagens = [],
  embedded = false,
}: ViagemDetalheClientProps) {
  const supabase = createClient()

  const [eventos, setEventos] = useState(initialEventos)
  const [custos, setCustos] = useState(initialCustos)
  const [receitas, setReceitas] = useState(initialReceitas)
  const [documentos, setDocumentos] = useState(initialDocumentos)
  const [viagemState, setViagemState] = useState(viagem)
  const [subViagensCarregadas, setSubViagensCarregadas] = useState(initialSubViagens)
  const [subViagemAtivaId, setSubViagemAtivaId] = useState<string | null>(null)
  const [viagensIrmasDosCiclo, setViagensIrmasDosCiclo] = useState<Viagem[]>([])
  const [loading, setLoading] = useState(false)
  const [usingLocalEventosFallback, setUsingLocalEventosFallback] = useState(false)

  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [activeTimelineEvent, setActiveTimelineEvent] = useState<ViagemEvento | null>(null)
  const [timelineRealModalOpen, setTimelineRealModalOpen] = useState(false)
  const [timelinePlanejadoModalOpen, setTimelinePlanejadoModalOpen] = useState(false)
  const [eventoLancamentoModo, setEventoLancamentoModo] = useState<"realizado" | "planejado">("realizado")
  const [expandedTimelinePointId, setExpandedTimelinePointId] = useState<string | null>(null)
  const [costModalOpen, setCostModalOpen] = useState(false)
  const [receitaModalOpen, setReceitaModalOpen] = useState(false)
  const [docModalOpen, setDocModalOpen] = useState(false)
  const [eventosCicloExpandido, setEventosCicloExpandido] = useState(false)
  const [expandedViagensIds, setExpandedViagensIds] = useState<Set<string>>(new Set())
  const [finalizarViagemModalOpen, setFinalizarViagemModalOpen] = useState(false)
  const [finalizacaoTipoModalOpen, setFinalizacaoTipoModalOpen] = useState(false)
  const [finalizacaoTipo, setFinalizacaoTipo] = useState<"viagem" | "ciclo">("viagem")
  const [finalizarViagemEventoId, setFinalizarViagemEventoId] = useState("")
  const [operacaoViagemModalOpen, setOperacaoViagemModalOpen] = useState(false)
  const [operacaoViagemTipo, setOperacaoViagemTipo] = useState<"fechar" | "reabrir">("fechar")
  const [viagemOperacaoId, setViagemOperacaoId] = useState("")
  const [eventoViagemAlvoId, setEventoViagemAlvoId] = useState<string | null>(null)
  const [registroViagemSelecionadaId, setRegistroViagemSelecionadaId] = useState("")
  const [fecharSubViagemModalOpen, setFecharSubViagemModalOpen] = useState(false)
  const [subViagemParaFecharId, setSubViagemParaFecharId] = useState<string | null>(null)
  const [fechamentoEventoId, setFechamentoEventoId] = useState(() => {
    if (viagem.fechamento_evento_id) return viagem.fechamento_evento_id
    if (typeof window === "undefined") return ""
    return window.localStorage.getItem(getFechamentoEventoStorageKey(viagem.id)) || ""
  })
  const [saldoInicialLitros, setSaldoInicialLitros] = useState("300")
  const [dieselFinalLitros, setDieselFinalLitros] = useState("")
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
    posto_modo: "cadastrado" as "cadastrado" | "livre",
    posto_id: "",
    hodometro: "",
    litros: "",
    valor_total: "",
    posto: "",
    arla: "nao",
    arla_litros: "",
    arla_valor: "",
    ap_refrigerado: "nao",
    ap_refrigerado_horimetro: "",
    ap_refrigerado_litros: "",
    ap_refrigerado_valor: "",
  })
  const [ocorrenciaForm, setOcorrenciaForm] = useState({
    categoria: "operacional",
    severidade: "media",
    houve_parada: "nao",
    tempo_parado_min: "",
    acao_imediata: "",
    responsavel_acao: "",
    contato: "",
    prazo_solucao: "",
    protocolo: "",
  })
  const [documentacaoEventoForm, setDocumentacaoEventoForm] = useState({
    tipo_documento: "NF",
    numero_documento: "",
    emissor: "",
    validade_documento: "",
    status_documento: "pendente",
    protocolo_documento: "",
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
  const [timelinePlanejado, setTimelinePlanejado] = useState(() => ({
    origem_partida_planejada: toDatetimeLocal(viagem.planejamento_rota?.origem_partida_planejada || viagem.data_inicio || null),
    destino_chegada_planejada: toDatetimeLocal(viagem.planejamento_rota?.destino_chegada_planejada || viagem.data_fim || null),
    intermediarios: (viagem.planejamento_rota?.intermediarios || []).map((item) => ({
      chave: item.chave,
      cidade: item.cidade,
      estado: item.estado,
      chegada_planejada: toDatetimeLocal(item.chegada_planejada || null),
      partida_planejada: toDatetimeLocal(item.partida_planejada || null),
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
    setTimelinePlanejado({
      origem_partida_planejada: toDatetimeLocal(viagemState.planejamento_rota?.origem_partida_planejada || viagemState.data_inicio || null),
      destino_chegada_planejada: toDatetimeLocal(viagemState.planejamento_rota?.destino_chegada_planejada || viagemState.data_fim || null),
      intermediarios: (viagemState.planejamento_rota?.intermediarios || []).map((item) => ({
        chave: item.chave,
        cidade: item.cidade,
        estado: item.estado,
        chegada_planejada: toDatetimeLocal(item.chegada_planejada || null),
        partida_planejada: toDatetimeLocal(item.partida_planejada || null),
      })),
    })
  }, [viagemState.data_fim, viagemState.data_inicio, viagemState.planejamento_rota])

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

  useEffect(() => {
    if (typeof window === "undefined") return

    const storageKey = getFechamentoEventoStorageKey(viagemState.id)
    if (fechamentoEventoId) {
      window.localStorage.setItem(storageKey, fechamentoEventoId)
      return
    }

    window.localStorage.removeItem(storageKey)
  }, [fechamentoEventoId, viagemState.id])

  useEffect(() => {
    if (!subViagemAtivaId) return

    const carregarEventosSubViagem = async () => {
      const { data, error } = await supabase
        .from("viagem_eventos")
        .select("*")
        .eq("viagem_id", subViagemAtivaId)
        .order("ocorrido_em", { ascending: false })

      if (!error && data) {
        setEventos(data)
      }
    }

    carregarEventosSubViagem()
  }, [subViagemAtivaId, supabase])

  useEffect(() => {
    if (subViagemAtivaId) return
    if ((subViagensCarregadas || []).length === 0) return

    void refreshEventos()
  }, [subViagemAtivaId, subViagensCarregadas])

  // Reset formulários ao trocar de sub-viagem
  useEffect(() => {
    if (!subViagemAtivaId) return

    // Reset abastecimento
    setAbastecimentoForm({
      veiculo_id: viagem.veiculo_id || "",
      posto_modo: "cadastrado",
      posto_id: "",
      hodometro: "",
      litros: "",
      valor_total: "",
      posto: "",
      arla: "nao",
      arla_litros: "",
      arla_valor: "",
      ap_refrigerado: "nao",
      ap_refrigerado_horimetro: "",
      ap_refrigerado_litros: "",
      ap_refrigerado_valor: "",
    })

    // Reset ocorrência
    setOcorrenciaForm({
      categoria: "operacional",
      severidade: "media",
      houve_parada: "nao",
      tempo_parado_min: "",
      acao_imediata: "",
      responsavel_acao: "",
      contato: "",
      prazo_solucao: "",
      protocolo: "",
    })

    // Reset documentação evento
    setDocumentacaoEventoForm({
      tipo_documento: "NF",
      numero_documento: "",
      emissor: "",
      validade_documento: "",
      status_documento: "pendente",
      protocolo_documento: "",
    })

    // Reset custos
    setCostForm({
      data: new Date().toISOString().split("T")[0],
      categoria: "Diesel",
      valor: "",
      observacao: "",
    })

    // Reset receitas
    setReceitaForm({
      data: new Date().toISOString().split("T")[0],
      tipo: "Receita extra",
      valor: "",
      descricao: "",
    })

    // Reset documentos
    setDocForm({
      tipo_documento: "NF",
      nome_arquivo: "",
      observacao: "",
    })
    setSelectedDocFile(null)

    // Reset evento geral
    setEventForm({
      tipo_evento: "chegada",
      status_evento: "concluido",
      titulo: "",
      local: "",
      observacao: "",
      inicio_em: "",
      fim_em: "",
    })
  }, [subViagemAtivaId])

  useEffect(() => {
    const carregarViagensIrmas = async () => {
      if (!viagemState.ciclo_id) return

      const { data, error } = await supabase
        .from("viagens")
        .select("id, status, data_fim")
        .eq("ciclo_id", viagemState.ciclo_id)

      if (!error && data) {
        setViagensIrmasDosCiclo(data as Viagem[])
      }
    }

    carregarViagensIrmas()
  }, [viagemState.ciclo_id, viagemState.status, subViagensCarregadas, supabase])

  useEffect(() => {
    if (!eventModalOpen) {
      setEventoViagemAlvoId(null)
    }
  }, [eventModalOpen])

  const eventosPlanejados = useMemo(() => eventos.filter((evento) => isEventoPlanejado(evento)), [eventos])
  const eventosRealizados = useMemo(() => eventos.filter((evento) => !isEventoPlanejado(evento)), [eventos])

  const eventosOrdenados = useMemo(
    () => [...eventosRealizados].sort((a, b) => new Date(b.ocorrido_em).getTime() - new Date(a.ocorrido_em).getTime()),
    [eventosRealizados],
  )

  const custosTotal = useMemo(() => custos.reduce((sum, item) => sum + Number(item.valor || 0), 0), [custos])
  const receitasExtras = useMemo(() => receitas.reduce((sum, item) => sum + Number(item.valor || 0), 0), [receitas])
  const receitaFrete = Number(viagemState.valor_frete || 0)
  const receitaTotal = receitaFrete + receitasExtras
  const lucro = receitaTotal - custosTotal
  const margem = receitaTotal > 0 ? (lucro / receitaTotal) * 100 : 0
  const custoPorKm = Number(viagemState.km_real || 0) > 0 ? custosTotal / Number(viagemState.km_real) : 0

  const tempoTransitoHoras = useMemo(() => {
    const chegada = eventosRealizados.filter((e) => e.tipo_evento === "chegada").length
    const saida = eventosRealizados.filter((e) => e.tipo_evento === "saida").length
    return Math.max(0, (chegada + saida) * 1.5)
  }, [eventosRealizados])

  const tempoParadoHoras = useMemo(() => {
    const tempo = eventosRealizados.reduce((sum, evento) => {
      if (["parada", "espera", "ocorrencia"].includes(evento.tipo_evento)) {
        return sum + Number(evento.impacto_minutos || 0)
      }
      return sum
    }, 0)
    return tempo / 60
  }, [eventosRealizados])

  const abastecimentosResumo = useMemo(() => {
    const abastecimentos = eventosRealizados.filter((e) => e.tipo_evento === "abastecimento")
    return {
      qtd: abastecimentos.length,
      litros: abastecimentos.reduce((sum, e) => sum + Number((e.payload as any)?.litros || 0), 0),
      custo: custos
        .filter((c) => normalizeCategoria(c.categoria) === "Diesel")
        .reduce((sum, c) => sum + Number(c.valor || 0), 0),
    }
  }, [custos, eventosRealizados])

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

  const subViagemAtiva = useMemo(
    () => (subViagemAtivaId ? subViagensCarregadas.find((item) => item.id === subViagemAtivaId) || null : null),
    [subViagemAtivaId, subViagensCarregadas],
  )
  const viagensDoCiclo = useMemo(() => {
    const base = [
      viagemState,
      ...(subViagensCarregadas || []),
      ...(viagensIrmasDosCiclo || []),
    ]
    const unique = new Map<string, Viagem>()

    base.forEach((item) => {
      if (!item?.id) return
      const existente = unique.get(item.id)
      unique.set(item.id, { ...(existente || {}), ...(item as Viagem) })
    })

    return Array.from(unique.values())
  }, [viagemState, subViagensCarregadas, viagensIrmasDosCiclo])
  const viagensAbertas = useMemo(
    () => viagensDoCiclo.filter((item) => normalizeViagemStatus(item.status as Viagem["status"]) !== "Concluida"),
    [viagensDoCiclo],
  )
  const viagensFechadas = useMemo(
    () => viagensDoCiclo.filter((item) => normalizeViagemStatus(item.status as Viagem["status"]) === "Concluida"),
    [viagensDoCiclo],
  )
  const idsViagemNosEventos = useMemo(() => {
    const ids = new Set<string>()
    eventos.forEach((evento) => {
      if (evento.viagem_id) ids.add(evento.viagem_id)
    })
    return Array.from(ids)
  }, [eventos])
  const sequenciaViagemPorId = useMemo(() => {
    const mapa = new Map<string, string>()
    const eventosOrdenadosAsc = [...eventos].sort(
      (a, b) => new Date(a.ocorrido_em).getTime() - new Date(b.ocorrido_em).getTime(),
    )

    let contador = 1
    eventosOrdenadosAsc.forEach((evento) => {
      const viagemId = evento.viagem_id
      if (!viagemId || mapa.has(viagemId)) return
      mapa.set(viagemId, String(contador).padStart(2, "0"))
      contador += 1
    })

    return mapa
  }, [eventos])
  const opcoesViagemRegistros = useMemo(() => {
    const mapaViagens = new Map<string, Viagem>()
    viagensDoCiclo.forEach((item) => mapaViagens.set(item.id, item))

    const idsUnificados = new Set<string>([
      ...viagensDoCiclo.map((item) => item.id),
      ...idsViagemNosEventos,
    ])

    return Array.from(idsUnificados).map((id) => {
      const viagem = mapaViagens.get(id)
      const status = normalizeViagemStatus(viagem?.status || null)
      const placa = viagem?.veiculo?.placa_cavalo || "sem-veiculo"
      const sequencia = sequenciaViagemPorId.get(id) || "--"
      return {
        id,
        status,
        placa,
        sequencia,
        isPrincipal: id === viagemState.id,
      }
    })
  }, [idsViagemNosEventos, sequenciaViagemPorId, viagemState.id, viagensDoCiclo])
  const opcoesViagemAbertasRegistros = useMemo(
    () => opcoesViagemRegistros.filter((item) => item.status !== "Concluida"),
    [opcoesViagemRegistros],
  )
  const opcoesFecharViagem = useMemo(
    () => opcoesViagemRegistros.filter((item) => item.status !== "Concluida"),
    [opcoesViagemRegistros],
  )
  const opcoesReabrirViagem = useMemo(
    () => opcoesViagemRegistros.filter((item) => item.status === "Concluida"),
    [opcoesViagemRegistros],
  )
  const viagemAbertaPreferencialId = useMemo(() => {
    const subAberta = (subViagensCarregadas || []).find(
      (item) => normalizeViagemStatus(item.status as Viagem["status"]) !== "Concluida",
    )
    if (subAberta?.id) return subAberta.id

    if (normalizeViagemStatus(viagemState.status as Viagem["status"]) !== "Concluida") {
      return viagemState.id
    }

    return viagensAbertas[0]?.id || viagemState.id
  }, [subViagensCarregadas, viagemState.id, viagemState.status, viagensAbertas])
  const viagemRegistroAlvoId = useMemo(
    () => registroViagemSelecionadaId || viagemAbertaPreferencialId,
    [registroViagemSelecionadaId, viagemAbertaPreferencialId],
  )
  const temViagemAbertaParaRegistro = opcoesViagemAbertasRegistros.length > 0
  const statusFechamentoPorViagemId = useMemo(() => {
    const mapa = new Map<string, boolean>()
    viagensDoCiclo.forEach((item) => {
      mapa.set(item.id, normalizeViagemStatus(item.status as Viagem["status"]) === "Concluida")
    })
    return mapa
  }, [viagensDoCiclo])

  useEffect(() => {
    const existeNaLista = opcoesViagemAbertasRegistros.some((item) => item.id === registroViagemSelecionadaId)
    if (existeNaLista) return

    setRegistroViagemSelecionadaId(opcoesViagemAbertasRegistros[0]?.id || "")
  }, [opcoesViagemAbertasRegistros, registroViagemSelecionadaId])
  const viagemAlvoId = subViagemAtiva?.id || viagemState.id
  const statusNormalizado = normalizeViagemStatus((subViagemAtiva?.status || viagemState.status) as Viagem["status"])
  const viagemFechada = statusNormalizado === "Concluida"
  
  const cicloFechado = useMemo(() => {
    if (viagensDoCiclo.length <= 1) return false
    return viagensDoCiclo.every((v) => normalizeViagemStatus(v.status) === "Concluida")
  }, [viagensDoCiclo])

  const faseOperacional = useMemo(() => {
    if (statusNormalizado === "Planejada") return "Pré-operação"
    if (statusNormalizado === "Em andamento") return "Em execução"
    if (statusNormalizado === "Concluida") return "Fechado"
    return "Cancelada"
  }, [statusNormalizado])

  const ultimoMarco = eventosOrdenados[0] || null

  const proximoMarcoPrevisto = useMemo(() => {
    const agora = timeTicker
    return eventosRealizados
      .filter((evento) => !!evento.previsto_em)
      .map((evento) => ({ ...evento, previstoTs: new Date(evento.previsto_em as string).getTime() }))
      .filter((evento) => evento.previstoTs >= agora)
      .sort((a, b) => a.previstoTs - b.previstoTs)[0] || null
  }, [eventosRealizados, timeTicker])

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
      acoes.push("Lançar evento de saída para iniciar o rastreio operacional.")
    }

    if (statusNormalizado === "Em andamento") {
      if (!viagemState.eta_destino_em) {
        acoes.push("Recalcular ETA para atualizar previsão destino.")
      }
      if (possuiAbastecimentoPlanejado && eventosAbastecimento === 0) {
        acoes.push("Rota prevê abastecimento: lançar evento ao realizar a parada planejada.")
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

  const atrasoPorPontos = useMemo(() => {
    return percursoPlanejado
      .map((ponto) => {
        const previstoEm = ponto.tipo === "origem" ? ponto.partidaPlanejada || null : ponto.chegadaPlanejada || null
        const realizadoEm = ponto.tipo === "origem" ? ponto.partidaReal || null : ponto.chegadaReal || null

        if (!previstoEm) {
          return {
            id: ponto.id,
            label: ponto.label,
            previstoEm: null as string | null,
            realizadoEm,
            atrasoMin: null as number | null,
          }
        }

        if (!realizadoEm) {
          return {
            id: ponto.id,
            label: ponto.label,
            previstoEm,
            realizadoEm: null,
            atrasoMin: null,
          }
        }

        const atrasoMin = Math.round((new Date(realizadoEm).getTime() - new Date(previstoEm).getTime()) / 60000)

        return {
          id: ponto.id,
          label: ponto.label,
          previstoEm,
          realizadoEm,
          atrasoMin,
        }
      })
      .filter((item) => item.previstoEm !== null)
  }, [percursoPlanejado])

  const atrasoAcumuladoPontosMin = useMemo(() => {
    return atrasoPorPontos.reduce((sum, item) => {
      if (item.atrasoMin === null) return sum
      return sum + Math.max(0, item.atrasoMin)
    }, 0)
  }, [atrasoPorPontos])

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
  const cicloIdReferencia = useMemo(() => {
    if (viagemState.ciclo_id?.trim()) return viagemState.ciclo_id.trim()
    const year = new Date(viagemState.created_at || new Date().toISOString()).getFullYear()
    return `CIC-${year}-${viagemState.id.slice(0, 8).toUpperCase()}`
  }, [viagemState.ciclo_id, viagemState.created_at, viagemState.id])
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
    const extras = eventosRealizados
      .filter((evento) => evento.titulo === "Passagem")
      .filter((evento) => {
        const payload = (evento.payload || {}) as Record<string, unknown>
        return payload.passagem_ponto_origem === "viagem"
      })
      .map((evento) => (evento.local || "").trim())
      .filter(Boolean)

    return Array.from(new Set(extras))
  }, [eventosRealizados])

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

  const eventosCockpit = useMemo<EventoCicloTableRow[]>(() => {
    const toTipo = (evento: ViagemEvento) => {
      if (evento.titulo?.trim()) return evento.titulo
      return eventTypeLabels[evento.tipo_evento] || evento.tipo_evento
    }

    const eventosTabelaOrdenados = [...eventos].sort(
      (a, b) => new Date(a.ocorrido_em).getTime() - new Date(b.ocorrido_em).getTime(),
    )

    return eventosTabelaOrdenados.map((evento, index) => ({
      id: evento.id,
      kind: "evento" as const,
      ordem: String(index + 1),
      modo: isEventoPlanejado(evento) ? "planejado" : "realizado",
      tipo: toTipo(evento),
      local: evento.local || "-",
      inicio: formatDateTime(evento.ocorrido_em),
      fim: formatDateTime(evento.previsto_em),
      duracao: formatDurationByUnit(Number(evento.impacto_minutos || 0)),
      status: isEventoPlanejado(evento) ? "Planejado" : "Realizado",
      source: evento,
    }))
  }, [eventos])

  const eventosCicloTabela = eventosCockpit
  const EVENTOS_COMPACTOS_QTD = 5
  const fechamentoEventoIndex = useMemo(
    () => (fechamentoEventoId ? eventosCicloTabela.findIndex((evento) => evento.id === fechamentoEventoId) : -1),
    [eventosCicloTabela, fechamentoEventoId],
  )
  const fechamentoViagemLabel = useMemo(() => {
    if (!fechamentoEventoId) return `FV-${viagemState.id.slice(0, 6).toUpperCase()}`
    return `FV-${viagemState.id.slice(0, 4).toUpperCase()}-${fechamentoEventoId.slice(0, 4).toUpperCase()}`
  }, [fechamentoEventoId, viagemState.id])
  const resumoFechamentoRow = useMemo<EventoCicloTableRow | null>(() => {
    if (fechamentoEventoIndex < 0) return null

    const eventosAteFechamento = eventosCicloTabela.slice(0, fechamentoEventoIndex + 1)
    if (eventosAteFechamento.length === 0) return null

    const primeiroEvento = eventosAteFechamento[0]
    const eventoFechamento = eventosAteFechamento[eventosAteFechamento.length - 1]

    return {
      id: `resumo-fechamento-${viagemState.id}`,
      kind: "resumo_fechamento",
      ordem: `1-${eventoFechamento.ordem}`,
      modo: "realizado",
      tipo: `Fechamento da viagem ${fechamentoViagemLabel}`,
      local: eventoFechamento.local,
      inicio: primeiroEvento.inicio,
      fim: eventoFechamento.fim !== "-" ? eventoFechamento.fim : eventoFechamento.inicio,
      duracao: `${eventosAteFechamento.length} etapa(s) compactadas`,
      status: "Clique para expandir",
      source: null,
    }
  }, [eventosCicloTabela, fechamentoEventoIndex, fechamentoViagemLabel, viagemState.id])
  const eventosCicloVisiveis = useMemo(
    () => {
      if (!viagemFechada || eventosCicloExpandido) return eventosCicloTabela

      if (resumoFechamentoRow && fechamentoEventoIndex >= 0) {
        return [resumoFechamentoRow, ...eventosCicloTabela.slice(fechamentoEventoIndex + 1)]
      }

      return eventosCicloTabela.slice(-EVENTOS_COMPACTOS_QTD)
    },
    [EVENTOS_COMPACTOS_QTD, eventosCicloExpandido, eventosCicloTabela, fechamentoEventoIndex, resumoFechamentoRow, viagemFechada],
  )
  const eventosCompactadosOcultos = useMemo(() => {
    if (!viagemFechada || eventosCicloExpandido) return 0
    if (resumoFechamentoRow && fechamentoEventoIndex >= 0) return fechamentoEventoIndex
    return Math.max(0, eventosCicloTabela.length - eventosCicloVisiveis.length)
  }, [eventosCicloExpandido, eventosCicloTabela.length, eventosCicloVisiveis.length, fechamentoEventoIndex, resumoFechamentoRow, viagemFechada])

  // Agrupar eventos por viagem_id
  const eventosAgrupados = useMemo(() => {
    const grupos = new Map<string, typeof eventosCicloTabela>()
    
    eventosCicloTabela.forEach((evento) => {
      const viagemId = evento.source?.viagem_id
      if (!viagemId) return
      
      if (!grupos.has(viagemId)) {
        grupos.set(viagemId, [])
      }
      grupos.get(viagemId)!.push(evento)
    })
    
    return Array.from(grupos.entries()).map(([viagemId, eventosViagem], index) => {
      // Determinar fechamento pelo status real da viagem
      const temFechamento = statusFechamentoPorViagemId.get(viagemId) ?? false
      const contagem = eventosViagem.length
      const primeiroEvento = eventosViagem[0]
      const ultimoEvento = eventosViagem[eventosViagem.length - 1]
      const sequencia = String(index + 1).padStart(2, "0")
      
      return {
        viagemId,
        sequencia,
        temFechamento,
        contagem,
        primeiroEvento,
        ultimoEvento,
        eventosViagem,
      }
    })
  }, [eventosCicloTabela, statusFechamentoPorViagemId])

  const eventosVisiveisAgrupados = useMemo(() => {
    const resultado: typeof eventosAgrupados = []
    
    eventosAgrupados.forEach((grupo) => {
      const isExpandedGroup = expandedViagensIds.has(grupo.viagemId)

      // Por padrão, toda viagem fica compactada por ID.
      if (!isExpandedGroup) {
        resultado.push({
          ...grupo,
          eventosViagem: [], // Vazio para não renderizar eventos individuais
        })
      } else {
        // Expandida manualmente: mostrar todos os eventos da viagem.
        resultado.push(grupo)
      }
    })
    
    return resultado
  }, [eventosAgrupados, expandedViagensIds])

  const tempoCarregamentoPlanejadoMin = useMemo(
    () =>
      eventosRealizados.reduce((sum, evento) => {
        const titulo = (evento.titulo || "").toLowerCase()
        if (!titulo.includes("carreg")) return sum
        return sum + Math.max(0, Number(evento.impacto_minutos || 0))
      }, 0),
    [eventosRealizados],
  )

  const tempoCarregamentoRealMin = useMemo(() => {
    return eventosRealizados.reduce((sum, evento) => {
      const titulo = (evento.titulo || "").toLowerCase()
      if (!titulo.includes("carreg")) return sum
      if (evento.status_evento === "em_andamento") {
        const minutosAteAgora = Math.max(0, Math.round((timeTicker - new Date(evento.ocorrido_em).getTime()) / 60000))
        return sum + minutosAteAgora
      }
      return sum + Math.max(0, Number(evento.impacto_minutos || 0))
    }, 0)
  }, [eventosRealizados, timeTicker])

  const tempoTotalParadoMin = useMemo(() => {
    return eventosRealizados.reduce((sum, evento) => {
      const titulo = (evento.titulo || "").toLowerCase()
      const contaComoParado =
        ["parada", "espera", "ocorrencia", "abastecimento"].includes(evento.tipo_evento) ||
        titulo.includes("abastec") ||
        titulo.includes("fila") ||
        titulo.includes("descans")

      if (!contaComoParado) return sum

      if (evento.status_evento === "em_andamento") {
        const minutosAteAgora = Math.max(0, Math.round((timeTicker - new Date(evento.ocorrido_em).getTime()) / 60000))
        return sum + minutosAteAgora
      }

      return sum + Math.max(0, Number(evento.impacto_minutos || 0))
    }, 0)
  }, [eventosRealizados, timeTicker])

  const atrasoAcumuladoCicloMin = atrasoAcumuladoPontosMin

  const tempoFilaMin = useMemo(() => {
    return eventosRealizados.reduce((sum, evento) => {
      const titulo = (evento.titulo || "").toLowerCase()
      if (!titulo.includes("fila")) return sum

      if (evento.status_evento === "em_andamento") {
        const minutosAteAgora = Math.max(0, Math.round((timeTicker - new Date(evento.ocorrido_em).getTime()) / 60000))
        return sum + minutosAteAgora
      }

      return sum + Math.max(0, Number(evento.impacto_minutos || 0))
    }, 0)
  }, [eventosRealizados, timeTicker])

  const tempoDescansoMin = useMemo(() => {
    return eventosRealizados.reduce((sum, evento) => {
      const titulo = (evento.titulo || "").toLowerCase()
      if (!titulo.includes("descans")) return sum

      if (evento.status_evento === "em_andamento") {
        const minutosAteAgora = Math.max(0, Math.round((timeTicker - new Date(evento.ocorrido_em).getTime()) / 60000))
        return sum + minutosAteAgora
      }

      return sum + Math.max(0, Number(evento.impacto_minutos || 0))
    }, 0)
  }, [eventosRealizados, timeTicker])

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

  const litrosConsumidosCiclo = useMemo(() => {
    const saldoInicial = Number(saldoInicialLitros)
    const saldoFinal = Number(dieselFinalLitros)
    if (!Number.isFinite(saldoInicial) || !Number.isFinite(saldoFinal)) return null
    return Math.max(0, saldoInicial + abastecimentosResumo.litros - saldoFinal)
  }, [abastecimentosResumo.litros, dieselFinalLitros, saldoInicialLitros])

  const kmTotalCiclo = kmReal > 0 ? kmReal : kmPercorrido

  const kmPorLitroCiclo = useMemo(() => {
    if (litrosConsumidosCiclo === null || litrosConsumidosCiclo <= 0 || kmTotalCiclo <= 0) return null
    return kmTotalCiclo / litrosConsumidosCiclo
  }, [kmTotalCiclo, litrosConsumidosCiclo])

  const pendenciasCockpit = useMemo(() => {
    const itens: string[] = []

    const possuiSaidaOrigem = eventosRealizados.some((evento) => evento.tipo_evento === "saida")
    const possuiChegadaDestino = eventosRealizados.some((evento) => evento.tipo_evento === "chegada")

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
    eventosRealizados,
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
        label: carregamentoEmAndamento ? "Finalizar carregamento" : "Iniciar carregamento",
        action: findQuickActionByTitle(carregamentoEmAndamento ? "Fim de carregamento" : "Início de carregamento"),
      },
      {
        label: descansoEmAndamento ? "Finalizar descanso" : "Iniciar descanso",
        action: findQuickActionByTitle(descansoEmAndamento ? "Fim de descanso" : "Início de descanso"),
      },
      { label: "Abastecimento", action: findQuickActionByTitle("Abastecimento") },
      { label: "Manutenção (ocorrência)", action: findQuickActionByTitle("Manutenção") },
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

  const updateTimelinePlanejadoIntermediario = (
    index: number,
    field: "chegada_planejada" | "partida_planejada",
    value: string,
  ) => {
    setTimelinePlanejado((prev) => {
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

  const salvarTimelinePlanejada = async () => {
    setLoading(true)

    const planejamentoAtual = viagemState.planejamento_rota || {
      origem_partida_planejada: null,
      destino_chegada_planejada: null,
      intermediarios: [],
    }

    const planejadosPorChave = new Map(
      timelinePlanejado.intermediarios
        .filter((item) => !!item.chave)
        .map((item) => [item.chave, item]),
    )

    const intermediariosAtualizados = (planejamentoAtual.intermediarios || []).map((item, index) => {
      const planejado = timelinePlanejado.intermediarios[index] || planejadosPorChave.get(item.chave)
      return {
        ...item,
        chegada_planejada: toIsoOrNull(planejado?.chegada_planejada),
        partida_planejada: toIsoOrNull(planejado?.partida_planejada),
      }
    })

    const planejamentoAtualizado = {
      ...planejamentoAtual,
      origem_partida_planejada: toIsoOrNull(timelinePlanejado.origem_partida_planejada),
      destino_chegada_planejada: toIsoOrNull(timelinePlanejado.destino_chegada_planejada),
      intermediarios: intermediariosAtualizados,
    }

    const { error } = await supabase
      .from("viagens")
      .update({
        planejamento_rota: planejamentoAtualizado,
      })
      .eq("id", viagemState.id)

    if (!error) {
      setViagemState((prev) => ({
        ...prev,
        planejamento_rota: planejamentoAtualizado,
      }))

      await recalculateEta()
    }

    setLoading(false)
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
    const alvoId = viagemRegistroAlvoId
    if (!alvoId) return
    setEventoViagemAlvoId(alvoId)
    setActiveTimelineEvent(null)
    setEventoLancamentoModo("realizado")
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
    if (type === "abastecimento") {
      setAbastecimentoForm({
        veiculo_id: viagemState.veiculo_id || "",
        posto_modo: "cadastrado",
        posto_id: "",
        hodometro: "",
        litros: "",
        valor_total: "",
        posto: "",
        arla: "nao",
        arla_litros: "",
        arla_valor: "",
        ap_refrigerado: "nao",
        ap_refrigerado_horimetro: "",
        ap_refrigerado_litros: "",
        ap_refrigerado_valor: "",
      })
    }
    if (type === "ocorrencia") {
      setOcorrenciaForm({
        categoria: "operacional",
        severidade: "media",
        houve_parada: "nao",
        tempo_parado_min: "",
        acao_imediata: "",
        responsavel_acao: "",
        contato: "",
        prazo_solucao: "",
        protocolo: "",
      })
      setDocumentacaoEventoForm({
        tipo_documento: "NF",
        numero_documento: "",
        emissor: "",
        validade_documento: "",
        status_documento: "pendente",
        protocolo_documento: "",
      })
    }
    setEventModalOpen(true)
  }

  const refreshEventos = async () => {
    const idsViagens = subViagemAtivaId
      ? [subViagemAtivaId]
      : Array.from(new Set([viagemState.id, ...(subViagensCarregadas || []).map((item) => item.id)]))

    const { data, error } = await supabase
      .from("viagem_eventos")
      .select("*")
      .in("viagem_id", idsViagens)
      .order("ocorrido_em", { ascending: false })

    if (!error && data) {
      setEventos(data as ViagemEvento[])
      setUsingLocalEventosFallback(false)
      return
    }

    if (error && isMissingViagemEventosTableError(error.message, error.code)) {
      const localEventos = idsViagens.flatMap((id) => readLocalEventos(id))
      setEventos(localEventos)
      setUsingLocalEventosFallback(true)
    }
  }

  const carregarEventosDaViagem = async (viagemId: string) => {
    const { data, error } = await supabase
      .from("viagem_eventos")
      .select("*")
      .eq("viagem_id", viagemId)
      .order("ocorrido_em", { ascending: false })

    if (!error && data) {
      setEventos(data as ViagemEvento[])
      setUsingLocalEventosFallback(false)
      return data as ViagemEvento[]
    }

    if (error && isMissingViagemEventosTableError(error.message, error.code)) {
      const localEventos = readLocalEventos(viagemId)
      setEventos(localEventos)
      setUsingLocalEventosFallback(true)
      return localEventos
    }

    return [] as ViagemEvento[]
  }

  const getEventoSaveErrorMessage = (errorMessage: string, errorCode?: string) => {
    const missingTable = isMissingViagemEventosTableError(errorMessage, errorCode)

    if (missingTable) {
      return "Tabela 'viagem_eventos' não encontrada no Supabase. Execute o script scripts/004_cockpit_viagem_eta_docs.sql no SQL Editor do projeto."
    }

    return errorMessage
  }

  const handleQuickActionRegister = (action: CockpitQuickAction, modo: "realizado" | "planejado") => {
    const alvoId = viagemRegistroAlvoId
    if (!alvoId) return
    setEventoViagemAlvoId(alvoId)
    const nowLocal = toDatetimeLocal(new Date().toISOString())
    const localPadrao =
      ultimoMarco?.local ||
      viagemState.destino_real ||
      viagemState.origem_real ||
      "A DEFINIR"
    const isPartidaChegadaAction = action.title === "Partida e chegada"

    setActiveTimelineEvent(null)
    setEventoLancamentoModo(modo)
    setEventForm({
      tipo_evento: isPartidaChegadaAction ? "saida" : action.type,
      status_evento: modo === "planejado" ? "pendente" : "concluido",
      titulo: isPartidaChegadaAction ? "Saída" : action.title,
      local: isPartidaChegadaAction ? origemOperacionalLabel : localPadrao,
      observacao: modo === "planejado" ? "Planejado por ação rápida." : "Registrado por ação rápida.",
      inicio_em: nowLocal,
      fim_em: nowLocal,
    })
    if (action.type === "abastecimento") {
      setAbastecimentoForm({
        veiculo_id: viagemState.veiculo_id || "",
        posto_modo: "cadastrado",
        posto_id: "",
        hodometro: "",
        litros: "",
        valor_total: "",
        posto: localPadrao,
        arla: "nao",
        arla_litros: "",
        arla_valor: "",
        ap_refrigerado: "nao",
        ap_refrigerado_horimetro: "",
        ap_refrigerado_litros: "",
        ap_refrigerado_valor: "",
      })
    }
    if (action.type === "ocorrencia") {
      setOcorrenciaForm({
        categoria: "operacional",
        severidade: "media",
        houve_parada: "nao",
        tempo_parado_min: "",
        acao_imediata: "",
        responsavel_acao: "",
        contato: "",
        prazo_solucao: "",
        protocolo: "",
      })
      setDocumentacaoEventoForm({
        tipo_documento: "NF",
        numero_documento: "",
        emissor: "",
        validade_documento: "",
        status_documento: "pendente",
        protocolo_documento: "",
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
  const isDocumentacaoSelecionada =
    eventForm.tipo_evento === "ocorrencia" &&
    (eventForm.titulo || "").toLowerCase().includes("document")
  const isOcorrenciaSelecionada = eventForm.tipo_evento === "ocorrencia" && !isDocumentacaoSelecionada

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
        posto_modo: "cadastrado" as "cadastrado" | "livre",
        posto_id: "",
        hodometro: "",
        litros: "",
        valor_total: "",
        posto: "",
        arla: "nao",
        arla_litros: "",
        arla_valor: "",
        ap_refrigerado: "nao",
        ap_refrigerado_horimetro: "",
        ap_refrigerado_litros: "",
        ap_refrigerado_valor: "",
      }
    }

    return {
      posto_modo: payload.posto_modo === "livre" ? "livre" : (String(payload.posto_id || "") ? "cadastrado" : "livre"),
      posto_id: String(payload.posto_id || ""),
      hodometro: payload.hodometro !== undefined && payload.hodometro !== null ? String(payload.hodometro) : "",
      litros: payload.litros !== undefined && payload.litros !== null ? String(payload.litros) : "",
      valor_total: payload.valor_total !== undefined && payload.valor_total !== null ? String(payload.valor_total) : "",
      posto: String(payload.posto || ""),
      arla: payload.arla === "sim" ? "sim" : "nao",
      arla_litros: payload.arla_litros !== undefined && payload.arla_litros !== null ? String(payload.arla_litros) : "",
      arla_valor: payload.arla_valor !== undefined && payload.arla_valor !== null ? String(payload.arla_valor) : "",
      ap_refrigerado: payload.ap_refrigerado === "sim" ? "sim" : "nao",
      ap_refrigerado_horimetro:
        payload.ap_refrigerado_horimetro !== undefined && payload.ap_refrigerado_horimetro !== null
          ? String(payload.ap_refrigerado_horimetro)
          : "",
      ap_refrigerado_litros:
        payload.ap_refrigerado_litros !== undefined && payload.ap_refrigerado_litros !== null
          ? String(payload.ap_refrigerado_litros)
          : "",
      ap_refrigerado_valor:
        payload.ap_refrigerado_valor !== undefined && payload.ap_refrigerado_valor !== null
          ? String(payload.ap_refrigerado_valor)
          : "",
    }
  }

  const getOcorrenciaPayloadData = (payload: Record<string, unknown> | null | undefined) => {
    if (!payload) {
      return {
        categoria: "operacional",
        severidade: "media",
        houve_parada: "nao",
        tempo_parado_min: "",
        acao_imediata: "",
        responsavel_acao: "",
        contato: "",
        prazo_solucao: "",
        protocolo: "",
      }
    }

    return {
      categoria: String(payload.categoria || "operacional"),
      severidade: String(payload.severidade || "media"),
      houve_parada: payload.houve_parada === "sim" ? "sim" : "nao",
      tempo_parado_min:
        payload.tempo_parado_min !== undefined && payload.tempo_parado_min !== null
          ? String(payload.tempo_parado_min)
          : "",
      acao_imediata: String(payload.acao_imediata || ""),
      responsavel_acao: String(payload.responsavel_acao || ""),
      contato: String(payload.contato || ""),
      prazo_solucao: toDatetimeLocal(String(payload.prazo_solucao || "") || null),
      protocolo: String(payload.protocolo || ""),
    }
  }

  const getDocumentacaoPayloadData = (payload: Record<string, unknown> | null | undefined) => {
    if (!payload) {
      return {
        tipo_documento: "NF",
        numero_documento: "",
        emissor: "",
        validade_documento: "",
        status_documento: "pendente",
        protocolo_documento: "",
      }
    }

    return {
      tipo_documento: String(payload.tipo_documento || "NF"),
      numero_documento: String(payload.numero_documento || ""),
      emissor: String(payload.emissor || ""),
      validade_documento: toDatetimeLocal(String(payload.validade_documento || "") || null),
      status_documento: String(payload.status_documento || "pendente"),
      protocolo_documento: String(payload.protocolo_documento || ""),
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
    const viagemEventosId = eventoViagemAlvoId || subViagemAtivaId || viagemState.id

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
      if (!eventForm.inicio_em || !eventForm.local || !abastecimentoForm.hodometro || !abastecimentoForm.litros || !abastecimentoForm.valor_total) {
        alert("Para abastecimento, preencha data/hora, local (cidade/UF), hodômetro, litros e valor total.")
        setLoading(false)
        return
      }

      if (abastecimentoForm.arla === "sim" && !abastecimentoForm.arla_valor) {
        alert("Informe o valor de ARLA quando selecionado como SIM.")
        setLoading(false)
        return
      }

      if (abastecimentoForm.arla === "sim" && !abastecimentoForm.arla_litros) {
        alert("Informe os litros de ARLA quando selecionado como SIM.")
        setLoading(false)
        return
      }

      if (abastecimentoForm.ap_refrigerado === "sim" && !abastecimentoForm.ap_refrigerado_valor) {
        alert("Informe o valor de Termoking quando selecionado como SIM.")
        setLoading(false)
        return
      }

      if (abastecimentoForm.ap_refrigerado === "sim" && !abastecimentoForm.ap_refrigerado_horimetro) {
        alert("Informe o horímetro de Termoking quando selecionado como SIM.")
        setLoading(false)
        return
      }

      if (abastecimentoForm.ap_refrigerado === "sim" && !abastecimentoForm.ap_refrigerado_litros) {
        alert("Informe os litros de Termoking quando selecionado como SIM.")
        setLoading(false)
        return
      }
    }

    if (isOcorrenciaSelecionada && ocorrenciaForm.houve_parada === "sim" && !ocorrenciaForm.tempo_parado_min) {
      alert("Informe o tempo parado (min) para a ocorrência.")
      setLoading(false)
      return
    }

    if (isDocumentacaoSelecionada && !documentacaoEventoForm.tipo_documento) {
      alert("Informe o tipo de documento.")
      setLoading(false)
      return
    }

    const localEvento =
      quickActionPartidaChegadaAtiva && marcoAtual === "saida"
        ? (eventForm.local?.trim() || origemOperacionalLabel || null)
        : quickActionPartidaChegadaAtiva && marcoAtual === "chegada"
          ? (eventForm.local?.trim() || destinoOperacionalLabel || null)
          : quickActionPartidaChegadaAtiva && marcoAtual === "passagem"
            ? localPassagem
          : isAbastecimentoSelecionado
            ? eventForm.local || abastecimentoForm.posto || postosAbastecimento.find((item) => item.id === abastecimentoForm.posto_id)?.nome || null
          : eventForm.local || null
    const payloadMetaBase =
      {
        ...(marcoAtual === "passagem"
          ? {
              passagem_ponto_origem:
                passagemPontoSelecionado === PASSAGEM_OUTRO_PONTO_VALUE ? "viagem" : "rota",
            }
          : {}),
        lancamento_modo: eventoLancamentoModo,
      }

    const payloadAbastecimento = isAbastecimentoSelecionado
      ? {
          posto_modo: abastecimentoForm.posto_modo,
          veiculo_id: abastecimentoForm.veiculo_id,
          posto_id: abastecimentoForm.posto_id || null,
          hodometro: Number(abastecimentoForm.hodometro || 0),
          litros: Number(abastecimentoForm.litros || 0),
          valor_total: Number(abastecimentoForm.valor_total || 0),
          arla: abastecimentoForm.arla,
          arla_litros: abastecimentoForm.arla === "sim" ? Number(abastecimentoForm.arla_litros || 0) : null,
          arla_valor: abastecimentoForm.arla === "sim" ? Number(abastecimentoForm.arla_valor || 0) : null,
          ap_refrigerado: abastecimentoForm.ap_refrigerado,
          ap_refrigerado_horimetro:
            abastecimentoForm.ap_refrigerado === "sim"
              ? Number(abastecimentoForm.ap_refrigerado_horimetro || 0)
              : null,
          ap_refrigerado_litros:
            abastecimentoForm.ap_refrigerado === "sim"
              ? Number(abastecimentoForm.ap_refrigerado_litros || 0)
              : null,
          ap_refrigerado_valor:
            abastecimentoForm.ap_refrigerado === "sim"
              ? Number(abastecimentoForm.ap_refrigerado_valor || 0)
              : null,
          posto:
            abastecimentoForm.posto ||
            postosAbastecimento.find((item) => item.id === abastecimentoForm.posto_id)?.nome ||
            null,
        }
      : {}

    const payloadOcorrencia = isOcorrenciaSelecionada
      ? {
          categoria: ocorrenciaForm.categoria,
          severidade: ocorrenciaForm.severidade,
          houve_parada: ocorrenciaForm.houve_parada,
          tempo_parado_min:
            ocorrenciaForm.houve_parada === "sim"
              ? Number(ocorrenciaForm.tempo_parado_min || 0)
              : null,
          acao_imediata: ocorrenciaForm.acao_imediata || null,
          responsavel_acao: ocorrenciaForm.responsavel_acao || null,
          contato: ocorrenciaForm.contato || null,
          prazo_solucao: toIsoOrNull(ocorrenciaForm.prazo_solucao),
          protocolo: ocorrenciaForm.protocolo || null,
        }
      : {}

    const payloadDocumentacao = isDocumentacaoSelecionada
      ? {
          tipo_documento: documentacaoEventoForm.tipo_documento,
          numero_documento: documentacaoEventoForm.numero_documento || null,
          emissor: documentacaoEventoForm.emissor || null,
          validade_documento: toIsoOrNull(documentacaoEventoForm.validade_documento),
          status_documento: documentacaoEventoForm.status_documento || "pendente",
          protocolo_documento: documentacaoEventoForm.protocolo_documento || null,
        }
      : {}

    const payloadMeta =
      Object.keys({ ...payloadMetaBase, ...payloadAbastecimento, ...payloadOcorrencia, ...payloadDocumentacao }).length > 0
        ? {
            ...payloadMetaBase,
            ...payloadAbastecimento,
            ...payloadOcorrencia,
            ...payloadDocumentacao,
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
        if (eventoLancamentoModo === "realizado") {
          await syncPlanejamentoRealByMarco(marcoAtual, inicioIso)
        }
        setEventModalOpen(false)
        setActiveTimelineEvent(null)
        await recalculateEta()
      } else if (error && isMissingViagemEventosTableError(error.message, error.code)) {
        const localEventos = readLocalEventos(subViagemAtivaId || viagemState.id)
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

  writeLocalEventos(subViagemAtivaId || viagemState.id, updatedLocal)
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

        if (eventoLancamentoModo === "realizado") {
          await syncPlanejamentoRealByMarco(marcoAtual, inicioIso)
        }
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
          viagem_id: viagemEventosId,
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
        if (eventoLancamentoModo === "realizado") {
          await syncPlanejamentoRealByMarco(marcoAtual, inicioIso)
        }
        setEventModalOpen(false)
        setActiveTimelineEvent(null)
        await recalculateEta()
      } else if (error && isMissingViagemEventosTableError(error.message, error.code)) {
        const nowIso = new Date().toISOString()
        const localEvento: ViagemEvento = {
          id: createLocalEventId(),
          user_id: userId,
          viagem_id: viagemEventosId,
          ...payload,
          ocorrido_em: inicioIso,
          created_at: nowIso,
          updated_at: nowIso,
        }

        const localEventos = [localEvento, ...readLocalEventos(viagemEventosId)]
        writeLocalEventos(viagemEventosId, localEventos)
        setEventos(localEventos)
        setUsingLocalEventosFallback(true)

        if (isAbastecimentoSelecionado) {
          await upsertAbastecimentoRegistro({
            userId,
            eventPayload: (payloadMeta || {}) as Record<string, unknown>,
            inicioIso,
          })
        }

        if (eventoLancamentoModo === "realizado") {
          await syncPlanejamentoRealByMarco(marcoAtual, inicioIso)
        }
        setEventModalOpen(false)
        setActiveTimelineEvent(null)
        setEventoViagemAlvoId(null)
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
      const updatedLocal = readLocalEventos(subViagemAtivaId || viagemState.id).filter((item) => item.id !== activeTimelineEvent.id)
      writeLocalEventos(subViagemAtivaId || viagemState.id, updatedLocal)
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

  const handleFinalizarViagem = async (eventoFinalId: string, viagemIdAlvo: string = viagemAlvoId) => {
    setLoading(true)

    const eventoFinal = eventos.find((e) => e.id === eventoFinalId)
    const dataFim = eventoFinal?.ocorrido_em || new Date().toISOString()

    let { error } = await supabase
      .from("viagens")
      .update({ status: "Concluida", data_fim: dataFim, fechamento_evento_id: eventoFinalId })
      .eq("id", viagemIdAlvo)

    if (error) {
      const errorMsg = error.message?.toLowerCase() || ""
      if (errorMsg.includes("fechamento_evento_id")) {
        const retry = await supabase
          .from("viagens")
          .update({ status: "Concluida", data_fim: dataFim })
          .eq("id", viagemIdAlvo)
        error = retry.error
      }
    }

    if (!error) {
      if (viagemIdAlvo === viagemState.id) {
        setViagemState((prev) => ({ ...prev, status: "Concluida", data_fim: dataFim, fechamento_evento_id: eventoFinalId }))
        setFechamentoEventoId(eventoFinalId)
      } else {
        setSubViagensCarregadas((prev) =>
          prev.map((item) =>
            item.id === viagemIdAlvo
              ? { ...item, status: "Concluida", data_fim: dataFim, fechamento_evento_id: eventoFinalId }
              : item,
          ),
        )
      }
      setEventosCicloExpandido(false)
    }

    setLoading(false)
  }

  const handleFinalizarCiclo = async (eventoFinalId: string) => {
    setLoading(true)

    const eventoFinal = eventos.find((e) => e.id === eventoFinalId)
    const dataFim = eventoFinal?.ocorrido_em || new Date().toISOString()

    // Update all viagens with the same ciclo_id to Concluida
    let { error } = await supabase
      .from("viagens")
      .update({ status: "Concluida", data_fim: dataFim })
      .eq("ciclo_id", cicloIdReferencia)

    if (error) {
      const errorMsg = error.message?.toLowerCase() || ""
      if (!errorMsg.includes("ciclo_id")) {
        // If error is not about ciclo_id, try without the filter
        const retry = await supabase
          .from("viagens")
          .update({ status: "Concluida", data_fim: dataFim })
          .eq("id", viagemState.id)
        error = retry.error
      }
    }

    if (!error) {
      setViagemState((prev) => ({ ...prev, status: "Concluida", data_fim: dataFim, fechamento_evento_id: eventoFinalId }))
      setFechamentoEventoId(eventoFinalId)
      setEventosCicloExpandido(false)
    }

    setLoading(false)
  }

  const handleReobrirViagem = async (viagemIdAlvo: string = viagemAlvoId) => {
    setLoading(true)

    let { error } = await supabase
      .from("viagens")
      .update({ status: "Em andamento", data_fim: null, fechamento_evento_id: null })
      .eq("id", viagemIdAlvo)

    if (error) {
      const errorMsg = error.message?.toLowerCase() || ""
      if (errorMsg.includes("fechamento_evento_id")) {
        const retry = await supabase
          .from("viagens")
          .update({ status: "Em andamento", data_fim: null })
          .eq("id", viagemIdAlvo)
        error = retry.error
      }
    }

    if (!error) {
      if (viagemIdAlvo === viagemState.id) {
        setViagemState((prev) => ({ ...prev, status: "Em andamento", data_fim: null, fechamento_evento_id: null }))
        setFechamentoEventoId("")
      } else {
        setSubViagensCarregadas((prev) =>
          prev.map((item) =>
            item.id === viagemIdAlvo
              ? { ...item, status: "Em andamento", data_fim: null, fechamento_evento_id: null }
              : item,
          ),
        )
      }
      setEventosCicloExpandido(false)
    }

    setLoading(false)
  }

  const handleIniciarNovaViagem = async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const eventoFechamento = eventos.find((evento) => evento.id === fechamentoEventoId)
    const dataInicio = viagemState.data_fim || new Date().toISOString()

    const novaViagemBase = {
      ciclo_id: cicloIdReferencia,
      viagem_pai_id: viagemState.id,
      cliente_id: viagemState.cliente_id || null,
      veiculo_id: viagemState.veiculo_id || null,
      motorista_id: viagemState.motorista_id || null,
      rota_id: viagemState.rota_id || null,
      rota_avulsa: viagemState.rota_avulsa,
      origem_real: eventoFechamento?.local || viagemState.destino_real || viagemState.origem_real || null,
      destino_real: viagemState.destino_real || null,
      data_inicio: dataInicio,
      data_fim: null,
      tipo_carga: viagemState.tipo_carga || null,
      volume_toneladas: viagemState.volume_toneladas ?? null,
      km_real: null,
      valor_frete: viagemState.valor_frete ?? null,
      status: "Planejada" as Viagem["status"],
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }

    const novaViagem = {
      ...novaViagemBase,
      planejamento_rota: viagemState.planejamento_rota || null,
    }

    let { data, error } = await supabase
      .from("viagens")
      .insert(novaViagem)
      .select("id")
      .single()

    if (error) {
      const errorMsg = error.message?.toLowerCase() || ""
      if (errorMsg.includes("planejamento_rota") || errorMsg.includes("ciclo_id") || errorMsg.includes("viagem_pai_id")) {
        const insertData = { ...novaViagem } as Record<string, unknown>

        if (errorMsg.includes("planejamento_rota")) {
          delete insertData.planejamento_rota
        }
        if (errorMsg.includes("viagem_pai_id")) {
          delete insertData.viagem_pai_id
        }
        if (errorMsg.includes("ciclo_id")) {
          delete insertData.ciclo_id
        }
        
        const retry = await supabase
          .from("viagens")
          .insert(insertData)
          .select("id")
          .single()
        data = retry.data
        error = retry.error
      }
    }

    if (!error && data?.id) {
      // Cycle timeline marker on parent trip
      const novaViagemEventoCiclo = {
        viagem_id: viagemState.id, // Parent viagem
        tipo_evento: "nova_viagem" as EventoViagemTipo,
        status_evento: "pendente" as EventoViagemStatus,
        titulo: `Nova viagem iniciada: ${data.id.slice(0, 6).toUpperCase()}`,
        local: eventoFechamento?.local || viagemState.destino_real || "Ponto indefinido",
        observacao: `Sub-viagem iniciada a partir do fechamento`,
        ocorrido_em: dataInicio,
        previsto_em: dataInicio,
        impacto_minutos: 0,
        payload: { sub_viagem_id: data.id, lancamento_modo: "planejado" },
      }

      // Start marker inside the new trip so next events stay linked to it
      const novaViagemEventoAbertura = {
        viagem_id: data.id,
        tipo_evento: "nova_viagem" as EventoViagemTipo,
        status_evento: "concluido" as EventoViagemStatus,
        titulo: `Início da viagem ${data.id.slice(0, 6).toUpperCase()}`,
        local: eventoFechamento?.local || viagemState.destino_real || "Ponto inicial",
        observacao: "Viagem aberta dentro do ciclo",
        ocorrido_em: dataInicio,
        previsto_em: dataInicio,
        impacto_minutos: 0,
        payload: { sub_viagem_id: data.id, lancamento_modo: "realizado" },
      }

      await supabase.from("viagem_eventos").insert(novaViagemEventoCiclo)
      const { data: eventoAberturaCriado } = await supabase
        .from("viagem_eventos")
        .insert(novaViagemEventoAbertura)
        .select("*")
        .single()

      setSubViagensCarregadas((prev) => [
        {
          ...(viagem as Viagem),
          id: data.id,
          status: "Em andamento",
          data_inicio: dataInicio,
          data_fim: null,
          viagem_pai_id: viagemState.id,
        },
        ...prev,
      ])
      setRegistroViagemSelecionadaId(data.id)
      setEventoViagemAlvoId(data.id)
      if (eventoAberturaCriado) {
        setEventos((prev) => [eventoAberturaCriado as ViagemEvento, ...prev])
      } else {
        await refreshEventos()
      }
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
                  <Card className="sticky top-2 z-10 border-border/60 bg-background/95 shadow-sm backdrop-blur py-3 gap-2">
                    <CardContent className="p-4 sm:p-4 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold tracking-tight">CICLO TRANSLOG</h2>
                        {subViagemAtivaId && (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                            Visualizando sub-viagem
                          </Badge>
                        )}
                        {subViagensCarregadas.length > 0 && !subViagemAtivaId && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                            {subViagensCarregadas.length} sub-viagem(s)
                          </Badge>
                        )}
                      </div>
                      {subViagemAtivaId && (
                        <p className="text-xs text-muted-foreground">
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => setSubViagemAtivaId(null)}
                          >
                            ← Voltar para viagem principal
                          </Button>
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground leading-tight">
                        Ciclo: <span className="font-medium text-foreground">{cicloLabel}</span>
                        {" | "}ID do ciclo: <span className="font-medium text-foreground">{cicloIdReferencia}</span>
                        {" | "}Veículo: <span className="font-medium text-foreground">{viagemState.veiculo?.placa_cavalo || "A DEFINIR"}</span>
                        {" | "}Motorista: <span className="font-medium text-foreground">{viagemState.motorista?.nome || "A DEFINIR"}</span>
                        {" | "}Status da viagem: <span className="font-semibold text-foreground">{faseOperacional}</span>
                        {cicloFechado ? <Badge className="ml-2 bg-red-100 text-red-800 border-red-200">Fechamento de ciclo</Badge> : null}
                      </p>
                      <p className="text-sm text-muted-foreground leading-tight">
                        Marco atual: <span className="font-medium text-foreground">{ultimoMarco ? `${eventTypeLabels[ultimoMarco.tipo_evento]} (${ultimoMarco.local || "A DEFINIR"})` : "A DEFINIR"}</span>
                      </p>
                      <p className="text-sm text-muted-foreground leading-tight">
                        Próximo marco (previsão): <span className="font-medium text-foreground">{proximaAcaoTitulo} — {formatDateTime(proximaAcaoPrevisao)}</span>
                        {" | "}Retorno: <span className="font-medium text-foreground">{viagemState.destino_real ? "Definido" : "Em aberto"}</span>
                      </p>
                      <p className="text-sm text-muted-foreground leading-tight">
                        Previsão destino: <span className="font-medium text-foreground">{formatDateTime(previsaoChegadaDestino)}</span>
                        {atrasoAcumuladoCicloMin > 0 ? (
                          <>
                            {" | "}Atraso acumulado: <span className="font-medium text-foreground">+{formatDurationByUnit(atrasoAcumuladoCicloMin)}</span>
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
                  <Card className="border-border/60 shadow-sm py-2 gap-1"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Tempo parado (total)</p><p className="text-base font-semibold">{formatDurationByUnit(tempoTotalParadoMin)}</p></CardContent></Card>
                  <Card className="border-border/60 shadow-sm py-2 gap-1"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Atraso acumulado do ciclo</p><p className="text-base font-semibold">+{formatDurationByUnit(atrasoAcumuladoCicloMin)}</p></CardContent></Card>
                  <Card className="border-border/60 shadow-sm py-2 gap-1"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Diesel no ciclo (L)</p><p className="text-base font-semibold">{abastecimentosResumo.litros.toFixed(0)} L</p></CardContent></Card>
                </div>
              </div>


              <Card className="border-border/60 shadow-sm py-3 gap-2">
                <CardHeader className="pb-1 px-4 gap-3">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">EVENTOS DO CICLO</CardTitle>
                      <span className="text-xs font-mono text-muted-foreground border border-border/60 rounded px-2 py-0.5 bg-muted/40">
                        {viagemLabel}
                      </span>
                      {viagemFechada && (
                        <Badge className={`text-xs ${cicloFechado ? "bg-red-100 text-red-800 border-red-200" : "bg-emerald-100 text-emerald-800 border-emerald-200"}`}>
                          {cicloFechado ? "Fechamento de ciclo" : "Fechamento de viagem"} · {(subViagemAtiva?.data_fim || viagemState.data_fim) ? new Date((subViagemAtiva?.data_fim || viagemState.data_fim) as string).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sticky top-2 z-20 bg-background/95 backdrop-blur rounded-md py-1">
                      {viagemFechada ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleIniciarNovaViagem}
                          disabled={loading}
                        >
                          {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                          Iniciar nova viagem
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        onClick={() => {
                          setOperacaoViagemTipo("fechar")
                          setViagemOperacaoId(subViagemAtivaId || opcoesFecharViagem[0]?.id || viagemState.id)
                          setOperacaoViagemModalOpen(true)
                        }}
                        disabled={loading || opcoesFecharViagem.length === 0}
                      >
                        {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                        Fechar viagem
                      </Button>
                      {opcoesReabrirViagem.length > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setOperacaoViagemTipo("reabrir")
                            setViagemOperacaoId(opcoesReabrirViagem[0]?.id || "")
                            setOperacaoViagemModalOpen(true)
                          }}
                          disabled={loading}
                        >
                          {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                          Reabrir viagem
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4">
                  {usingLocalEventosFallback && (
                    <p className="text-xs text-amber-600 mb-2">
                      Modo local ativo: eventos salvos no navegador até publicar a migration no Supabase.
                    </p>
                  )}
                  <div className="overflow-x-auto">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <p className="text-xs text-muted-foreground">Status na tabela: cinza = realizado, amarelo = planejado.</p>
                    </div>
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
                        {eventosCicloTabela.length === 0 && (
                          <tr>
                            <td className="py-3 text-muted-foreground" colSpan={7}>
                              Nenhum evento registrado neste ciclo.
                            </td>
                          </tr>
                        )}
                        {eventosVisiveisAgrupados.map((grupo) => (
                          <>
                            {/* Header de Viagem */}
                            <tr key={`header-${grupo.viagemId}`} className={`${grupo.temFechamento ? "bg-red-100/40" : "bg-blue-100/40"} border-b-2 border-border`}>
                              <td colSpan={7} className="py-2 px-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <span className="font-semibold text-sm">Viagem {grupo.sequencia}</span>
                                    <Badge variant={grupo.temFechamento ? "destructive" : "default"} className="text-xs">
                                      {grupo.temFechamento ? "Fechada" : "Aberta"}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {grupo.contagem} evento(s)
                                    </span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const newExpanded = new Set(expandedViagensIds)
                                      if (newExpanded.has(grupo.viagemId)) {
                                        newExpanded.delete(grupo.viagemId)
                                      } else {
                                        newExpanded.add(grupo.viagemId)
                                      }
                                      setExpandedViagensIds(newExpanded)
                                    }}
                                    className="text-xs"
                                  >
                                    {expandedViagensIds.has(grupo.viagemId) ? "Contrair" : "Expandir"}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                            
                            {/* Eventos da Viagem */}
                            {grupo.eventosViagem.length > 0 ? (
                              grupo.eventosViagem.map((evento) => (
                                <tr
                                  key={evento.id}
                                  className={`border-b border-border/50 ${
                                    evento.kind === "resumo_fechamento"
                                      ? "bg-emerald-50 hover:bg-emerald-100/80"
                                      : evento.modo === "realizado"
                                        ? "bg-slate-100/80 hover:bg-slate-200/85"
                                        : "bg-amber-50/55 hover:bg-amber-100/65"
                                  } ${evento.source?.status_evento === "em_andamento" || evento.id === ultimoMarco?.id ? "ring-1 ring-blue-300 bg-blue-50/45" : ""} cursor-pointer`}
                                  onClick={() => {
                                    if (evento.kind === "resumo_fechamento") {
                                      setEventosCicloExpandido(true)
                                      return
                                    }

                                    if (!evento.source) return

                                    setActiveTimelineEvent(evento.source)
                                    setEventoViagemAlvoId(evento.source.viagem_id)
                                    setEventoLancamentoModo(isEventoPlanejado(evento.source) ? "planejado" : "realizado")
                                    const payloadData = getAbastecimentoPayloadData((evento.source.payload || null) as Record<string, unknown> | null)
                                    const payloadOcorrencia = getOcorrenciaPayloadData((evento.source.payload || null) as Record<string, unknown> | null)
                                    const payloadDocumentacao = getDocumentacaoPayloadData((evento.source.payload || null) as Record<string, unknown> | null)
                                    setAbastecimentoForm({
                                      veiculo_id: String((evento.source.payload as Record<string, unknown> | null)?.veiculo_id || viagemState.veiculo_id || ""),
                                      posto_modo: payloadData.posto_modo,
                                      posto_id: payloadData.posto_id,
                                      hodometro: payloadData.hodometro,
                                      litros: payloadData.litros,
                                      valor_total: payloadData.valor_total,
                                      posto: payloadData.posto || evento.source.local || "",
                                      arla: payloadData.arla === "sim" ? "sim" : "nao",
                                      arla_litros: payloadData.arla_litros,
                                      arla_valor: payloadData.arla_valor,
                                      ap_refrigerado: payloadData.ap_refrigerado === "sim" ? "sim" : "nao",
                                      ap_refrigerado_horimetro: payloadData.ap_refrigerado_horimetro,
                                      ap_refrigerado_litros: payloadData.ap_refrigerado_litros,
                                      ap_refrigerado_valor: payloadData.ap_refrigerado_valor,
                                    })
                                    setOcorrenciaForm(payloadOcorrencia)
                                    setDocumentacaoEventoForm(payloadDocumentacao)
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
                              ))
                            ) : null}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3 xl:col-span-3">
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-xl">Ações rápidas</CardTitle></CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <div className="grid gap-1">
                    <Label>Viagem dos registros</Label>
                    <Select
                      value={opcoesViagemAbertasRegistros.length > 0 ? registroViagemSelecionadaId : undefined}
                      onValueChange={(value) => {
                        setRegistroViagemSelecionadaId(value)
                        setEventoViagemAlvoId(value)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a viagem (ID)" />
                      </SelectTrigger>
                      <SelectContent>
                        {opcoesViagemAbertasRegistros.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            Viagem {item.sequencia}
                          </SelectItem>
                        ))}
                        {opcoesViagemAbertasRegistros.length === 0 ? (
                          <SelectItem value="__sem_viagem_aberta__" disabled>
                            Nenhuma viagem aberta
                          </SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                  </div>
                  {smartQuickActions.map(({ label, action }) => (
                    <Button
                      key={label}
                      type="button"
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleQuickActionRegister(action, "realizado")}
                      disabled={loading || !temViagemAbertaParaRegistro}
                    >
                      {label}
                    </Button>
                  ))}
                  {subViagensCarregadas && subViagensCarregadas.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setFecharSubViagemModalOpen(true)}
                      disabled={loading}
                    >
                      Fechar sub-viagem
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-xl">DIESEL (LITROS)</CardTitle></CardHeader>
                <CardContent className="space-y-3 pt-0 text-sm">
                  <div className="flex items-center justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => openNewEventModal("abastecimento")} disabled={!temViagemAbertaParaRegistro}>
                      Lançar abastecimento
                    </Button>
                  </div>
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
                    <div className="grid gap-1">
                      <Label htmlFor="dieselFinalLitros">Diesel final (L)</Label>
                      <Input
                        id="dieselFinalLitros"
                        type="number"
                        value={dieselFinalLitros}
                        onChange={(event) => setDieselFinalLitros(event.target.value)}
                      />
                    </div>
                    <p>Abastecido no ciclo: <span className="font-medium">{abastecimentosResumo.litros.toFixed(0)} L</span></p>
                    <p>Litros consumidos no ciclo: <span className="font-medium">{litrosConsumidosCiclo !== null ? `${litrosConsumidosCiclo.toFixed(0)} L` : "A DEFINIR"}</span></p>
                    <p>KM/L do ciclo ({viagemState.motorista?.nome || "motorista"}): <span className="font-medium">{kmPorLitroCiclo !== null ? `${kmPorLitroCiclo.toFixed(2)} km/L` : "A DEFINIR"}</span></p>
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
          <div className={embedded ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"}>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Atraso acumulado do ciclo</p><p className="text-lg font-semibold leading-tight break-words">+{formatDurationByUnit(atrasoAcumuladoCicloMin)}</p></CardContent></Card>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tempo parado total</p><p className="text-lg font-semibold leading-tight break-words">{formatDurationByUnit(tempoTotalParadoMin)}</p></CardContent></Card>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tempo de fila</p><p className="text-lg font-semibold leading-tight break-words">{formatDurationByUnit(tempoFilaMin)}</p></CardContent></Card>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tempo de carregamento</p><p className="text-lg font-semibold leading-tight break-words">{formatDurationByUnit(tempoCarregamentoRealMin)}</p></CardContent></Card>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tempo de descanso</p><p className="text-lg font-semibold leading-tight break-words">{formatDurationByUnit(tempoDescansoMin)}</p></CardContent></Card>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Consumo KM/L por motorista</p><p className="text-lg font-semibold leading-tight break-words">{kmPorLitroCiclo !== null ? `${kmPorLitroCiclo.toFixed(2)} km/L` : "A DEFINIR"}</p><p className="text-xs text-muted-foreground">{viagemState.motorista?.nome || "Motorista não definido"}</p></CardContent></Card>
          </div>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Atraso por ponto de passagem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {atrasoPorPontos.length === 0 && (
                <p className="text-muted-foreground">Sem baseline planejado. Defina previsão por trecho para medir atraso.</p>
              )}
              {atrasoPorPontos.map((item) => (
                <div key={item.id} className="rounded-md border border-border/60 p-3">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-muted-foreground">Previsão: {formatDateTime(item.previstoEm)}</p>
                  <p className="text-muted-foreground">Real: {formatDateTime(item.realizadoEm)}</p>
                  <p className={item.atrasoMin !== null && item.atrasoMin > 0 ? "text-amber-600" : "text-muted-foreground"}>
                    {item.atrasoMin === null
                      ? "Aguardando chegada real"
                      : item.atrasoMin > 0
                        ? `Atraso: +${formatDurationByUnit(item.atrasoMin)}`
                        : item.atrasoMin < 0
                          ? `Adiantado: ${formatDurationByUnit(Math.abs(item.atrasoMin))}`
                          : "No horário"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

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

      <Dialog open={operacaoViagemModalOpen} onOpenChange={setOperacaoViagemModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{operacaoViagemTipo === "fechar" ? "Selecionar viagem para finalizar" : "Selecionar viagem para reabrir"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Viagem alvo</Label>
              <Select value={viagemOperacaoId} onValueChange={setViagemOperacaoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a viagem" />
                </SelectTrigger>
                <SelectContent>
                  {(operacaoViagemTipo === "fechar" ? opcoesFecharViagem : opcoesReabrirViagem).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      Viagem {item.sequencia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOperacaoViagemModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!viagemOperacaoId || loading}
                onClick={async () => {
                  if (!viagemOperacaoId) return

                  if (operacaoViagemTipo === "fechar") {
                    const eventosSelecionados = await carregarEventosDaViagem(viagemOperacaoId)
                    const realizados = eventosSelecionados.filter((e) => !isEventoPlanejado(e))
                    setFinalizacaoTipo("viagem")
                    setFinalizarViagemEventoId(realizados[0]?.id || "")
                    setOperacaoViagemModalOpen(false)
                    setFinalizacaoTipoModalOpen(true)
                    return
                  }

                  await handleReobrirViagem(viagemOperacaoId)
                  setOperacaoViagemModalOpen(false)
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de escolha: Finalizar viagem ou ciclo */}
      <Dialog open={finalizacaoTipoModalOpen} onOpenChange={setFinalizacaoTipoModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>O que deseja finalizar?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Escolha se deseja fechar apenas esta viagem ou o ciclo completo (todas as viagens deste ciclo).
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setFinalizacaoTipo("viagem")
                  const realizados = eventosCicloTabela.filter((e) => e.modo === "realizado")
                  setFinalizarViagemEventoId(realizados[realizados.length - 1]?.id ?? "")
                  setFinalizacaoTipoModalOpen(false)
                  setFinalizarViagemModalOpen(true)
                }}
              >
                <span>Finalizar apenas<br />esta <strong>Viagem</strong></span>
              </Button>
              <Button
                type="button"
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                onClick={() => {
                  setFinalizacaoTipo("ciclo")
                  const realizados = eventosCicloTabela.filter((e) => e.modo === "realizado")
                  setFinalizarViagemEventoId(realizados[realizados.length - 1]?.id ?? "")
                  setFinalizacaoTipoModalOpen(false)
                  setFinalizarViagemModalOpen(true)
                }}
              >
                <span>Finalizar<br />o <strong>Ciclo</strong> todo</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={finalizarViagemModalOpen} onOpenChange={setFinalizarViagemModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {finalizacaoTipo === "viagem" ? "Finalizar viagem" : "Finalizar ciclo completo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {finalizacaoTipo === "viagem"
                ? "Selecione o evento que marca o final desta viagem. A data/hora desse evento será registrada como a conclusão."
                : "Selecione o evento que marca o final do ciclo. Todas as viagens deste ciclo serão marcadas como concluídas."}
            </p>
            <div className="grid gap-2">
              <Label>
                {finalizacaoTipo === "viagem" ? "Evento final da viagem" : "Evento final do ciclo"}
              </Label>
              <Select
                value={finalizarViagemEventoId}
                onValueChange={setFinalizarViagemEventoId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um evento" />
                </SelectTrigger>
                <SelectContent>
                  {eventosCicloTabela
                    .filter((e) => e.modo === "realizado")
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        #{e.ordem} · {e.tipo}{e.local && e.local !== "-" ? ` — ${e.local}` : ""} · {e.inicio}
                      </SelectItem>
                    ))
                  }
                  {eventosCicloTabela.filter((e) => e.modo === "realizado").length === 0 && (
                    <SelectItem value="__sem_eventos__" disabled>
                      Nenhum evento realizado registrado
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setFinalizarViagemModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={loading || !finalizarViagemEventoId || finalizarViagemEventoId === "__sem_eventos__"}
                onClick={async () => {
                  if (finalizacaoTipo === "viagem") {
                    await handleFinalizarViagem(finalizarViagemEventoId)
                  } else {
                    await handleFinalizarCiclo(finalizarViagemEventoId)
                  }
                  setFinalizarViagemModalOpen(false)
                }}
              >
                {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                {finalizacaoTipo === "viagem" ? "Confirmar fechamento da viagem" : "Confirmar fechamento do ciclo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={timelinePlanejadoModalOpen} onOpenChange={setTimelinePlanejadoModalOpen}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Planejar timeline do ciclo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Origem · Partida planejada</Label>
                <Input
                  type="datetime-local"
                  value={timelinePlanejado.origem_partida_planejada || ""}
                  onChange={(event) =>
                    setTimelinePlanejado((prev) => ({
                      ...prev,
                      origem_partida_planejada: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Destino · Chegada planejada</Label>
                <Input
                  type="datetime-local"
                  value={timelinePlanejado.destino_chegada_planejada || ""}
                  onChange={(event) =>
                    setTimelinePlanejado((prev) => ({
                      ...prev,
                      destino_chegada_planejada: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {timelinePlanejado.intermediarios.length > 0 && (
              <div className="space-y-3">
                {timelinePlanejado.intermediarios.map((ponto, index) => (
                  <div key={ponto.chave || `${ponto.cidade}-${index}`} className="rounded-md border border-border/60 p-3">
                    <p className="text-xs font-medium text-foreground mb-2">
                      {index + 1}. {ponto.cidade}/{ponto.estado}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label>Chegada planejada</Label>
                        <Input
                          type="datetime-local"
                          value={ponto.chegada_planejada || ""}
                          onChange={(event) => updateTimelinePlanejadoIntermediario(index, "chegada_planejada", event.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Partida planejada</Label>
                        <Input
                          type="datetime-local"
                          value={ponto.partida_planejada || ""}
                          onChange={(event) => updateTimelinePlanejadoIntermediario(index, "partida_planejada", event.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setTimelinePlanejadoModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  await salvarTimelinePlanejada()
                  setTimelinePlanejadoModalOpen(false)
                }}
                disabled={loading}
              >
                {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                Salvar planejado e recalcular ETA
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
            <DialogTitle>{activeTimelineEvent ? "Atualizar ponto da timeline" : (eventForm.titulo ? `Lançar evento: ${eventForm.titulo}` : "Lançar evento")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Modo de lançamento</Label>
              <Select
                value={eventoLancamentoModo}
                onValueChange={(value: "realizado" | "planejado") => setEventoLancamentoModo(value)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="realizado">Realizado</SelectItem>
                  <SelectItem value="planejado">Planejado</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                  <Label>Data/hora *</Label>
                  <Input
                    type="datetime-local"
                    value={eventForm.inicio_em}
                    onChange={(event) => {
                      const value = event.target.value
                      setEventForm((prev) => ({ ...prev, inicio_em: value, fim_em: value || prev.fim_em }))
                    }}
                  />
                </div>
                <div>
                  <Label>Local (cidade/UF) *</Label>
                  <Input
                    value={eventForm.local}
                    placeholder="Ex.: Rondonópolis/MT"
                    onChange={(event) => setEventForm((prev) => ({ ...prev, local: event.target.value }))}
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
                  <Label>Posto (origem)</Label>
                  <Select
                    value={abastecimentoForm.posto_modo}
                    onValueChange={(value: "cadastrado" | "livre") =>
                      setAbastecimentoForm((prev) => ({
                        ...prev,
                        posto_modo: value,
                        posto_id: value === "cadastrado" ? prev.posto_id : "",
                        posto: value === "livre" ? prev.posto : "",
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cadastrado">Posto cadastrado</SelectItem>
                      <SelectItem value="livre">Posto livre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {abastecimentoForm.posto_modo === "cadastrado" ? (
                  <div>
                    <Label>Posto cadastrado</Label>
                    <Select
                      value={abastecimentoForm.posto_id || undefined}
                      onValueChange={(value) => {
                        const postoSelecionado = postosAbastecimento.find((posto) => posto.id === value)
                        setAbastecimentoForm((prev) => ({
                          ...prev,
                          posto_id: value,
                          posto: postoSelecionado?.nome || "",
                        }))
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
                ) : (
                  <div>
                    <Label>Nome do posto (opcional)</Label>
                    <Input
                      value={abastecimentoForm.posto}
                      placeholder="Ex.: Posto BR 163"
                      onChange={(event) => {
                        const value = event.target.value
                        setAbastecimentoForm((prev) => ({ ...prev, posto: value }))
                      }}
                    />
                  </div>
                )}
                <div className="md:col-span-2 rounded-md border border-border/60 p-3">
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">Avançado (opcional)</summary>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label>ARLA</Label>
                        <Select
                          value={abastecimentoForm.arla}
                          onValueChange={(value: "sim" | "nao") =>
                            setAbastecimentoForm((prev) => ({
                              ...prev,
                              arla: value,
                              arla_litros: value === "sim" ? prev.arla_litros : "",
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
                        <>
                          <div>
                            <Label>ARLA litros</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={abastecimentoForm.arla_litros}
                              onChange={(event) =>
                                setAbastecimentoForm((prev) => ({ ...prev, arla_litros: event.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <Label>ARLA valor total (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={abastecimentoForm.arla_valor}
                              onChange={(event) =>
                                setAbastecimentoForm((prev) => ({ ...prev, arla_valor: event.target.value }))
                              }
                            />
                          </div>
                        </>
                      )}
                      <div>
                        <Label>ThermoKing</Label>
                        <Select
                          value={abastecimentoForm.ap_refrigerado}
                          onValueChange={(value: "sim" | "nao") =>
                            setAbastecimentoForm((prev) => ({
                              ...prev,
                              ap_refrigerado: value,
                              ap_refrigerado_horimetro: value === "sim" ? prev.ap_refrigerado_horimetro : "",
                              ap_refrigerado_litros: value === "sim" ? prev.ap_refrigerado_litros : "",
                              ap_refrigerado_valor: value === "sim" ? prev.ap_refrigerado_valor : "",
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
                      {abastecimentoForm.ap_refrigerado === "sim" && (
                        <>
                          <div>
                            <Label>ThermoKing litros</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={abastecimentoForm.ap_refrigerado_litros}
                              onChange={(event) =>
                                setAbastecimentoForm((prev) => ({ ...prev, ap_refrigerado_litros: event.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <Label>ThermoKing horímetro</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={abastecimentoForm.ap_refrigerado_horimetro}
                              onChange={(event) =>
                                setAbastecimentoForm((prev) => ({ ...prev, ap_refrigerado_horimetro: event.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <Label>ThermoKing valor total (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={abastecimentoForm.ap_refrigerado_valor}
                              onChange={(event) =>
                                setAbastecimentoForm((prev) => ({ ...prev, ap_refrigerado_valor: event.target.value }))
                              }
                            />
                          </div>
                        </>
                      )}
                      <div className="md:col-span-2">
                        <Label>Anexo/Nota</Label>
                        <Textarea
                          value={eventForm.observacao}
                          placeholder="Observações do abastecimento ou referência de anexo/nota"
                          onChange={(event) => setEventForm((prev) => ({ ...prev, observacao: event.target.value }))}
                        />
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            )}

            {isOcorrenciaSelecionada && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-md border border-border/60 p-3">
                <div>
                  <Label>Categoria da ocorrência</Label>
                  <Select
                    value={ocorrenciaForm.categoria}
                    onValueChange={(value) => setOcorrenciaForm((prev) => ({ ...prev, categoria: value }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operacional">Operacional</SelectItem>
                      <SelectItem value="seguranca">Segurança</SelectItem>
                      <SelectItem value="mecanica">Mecânica</SelectItem>
                      <SelectItem value="trafego">Tráfego</SelectItem>
                      <SelectItem value="fiscal">Fiscal</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Severidade</Label>
                  <Select
                    value={ocorrenciaForm.severidade}
                    onValueChange={(value) => setOcorrenciaForm((prev) => ({ ...prev, severidade: value }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Houve parada?</Label>
                  <Select
                    value={ocorrenciaForm.houve_parada}
                    onValueChange={(value: "sim" | "nao") =>
                      setOcorrenciaForm((prev) => ({
                        ...prev,
                        houve_parada: value,
                        tempo_parado_min: value === "sim" ? prev.tempo_parado_min : "",
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
                {ocorrenciaForm.houve_parada === "sim" && (
                  <div>
                    <Label>Tempo parado (min)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={ocorrenciaForm.tempo_parado_min}
                      onChange={(event) =>
                        setOcorrenciaForm((prev) => ({ ...prev, tempo_parado_min: event.target.value }))
                      }
                    />
                  </div>
                )}
                <div className="md:col-span-2">
                  <Label>Ação imediata</Label>
                  <Textarea
                    value={ocorrenciaForm.acao_imediata}
                    onChange={(event) =>
                      setOcorrenciaForm((prev) => ({ ...prev, acao_imediata: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Responsável pela ação</Label>
                  <Input
                    value={ocorrenciaForm.responsavel_acao}
                    onChange={(event) =>
                      setOcorrenciaForm((prev) => ({ ...prev, responsavel_acao: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Contato</Label>
                  <Input
                    value={ocorrenciaForm.contato}
                    onChange={(event) =>
                      setOcorrenciaForm((prev) => ({ ...prev, contato: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Prazo de solução</Label>
                  <Input
                    type="datetime-local"
                    value={ocorrenciaForm.prazo_solucao}
                    onChange={(event) =>
                      setOcorrenciaForm((prev) => ({ ...prev, prazo_solucao: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Protocolo / referência</Label>
                  <Input
                    value={ocorrenciaForm.protocolo}
                    onChange={(event) =>
                      setOcorrenciaForm((prev) => ({ ...prev, protocolo: event.target.value }))
                    }
                  />
                </div>
              </div>
            )}

            {isDocumentacaoSelecionada && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-md border border-border/60 p-3">
                <div>
                  <Label>Tipo de documento</Label>
                  <Select
                    value={documentacaoEventoForm.tipo_documento}
                    onValueChange={(value) => setDocumentacaoEventoForm((prev) => ({ ...prev, tipo_documento: value }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NF">NF</SelectItem>
                      <SelectItem value="CTE">CT-e</SelectItem>
                      <SelectItem value="MDFE">MDF-e</SelectItem>
                      <SelectItem value="CANHOTO">Canhoto</SelectItem>
                      <SelectItem value="COMPROVANTE_ABASTECIMENTO">Comprovante abastecimento</SelectItem>
                      <SelectItem value="FOTO">Foto</SelectItem>
                      <SelectItem value="OUTRO">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status do documento</Label>
                  <Select
                    value={documentacaoEventoForm.status_documento}
                    onValueChange={(value) => setDocumentacaoEventoForm((prev) => ({ ...prev, status_documento: value }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="conferido">Conferido</SelectItem>
                      <SelectItem value="divergente">Divergente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Número do documento</Label>
                  <Input
                    value={documentacaoEventoForm.numero_documento}
                    onChange={(event) =>
                      setDocumentacaoEventoForm((prev) => ({ ...prev, numero_documento: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Emissor</Label>
                  <Input
                    value={documentacaoEventoForm.emissor}
                    onChange={(event) =>
                      setDocumentacaoEventoForm((prev) => ({ ...prev, emissor: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Validade</Label>
                  <Input
                    type="datetime-local"
                    value={documentacaoEventoForm.validade_documento}
                    onChange={(event) =>
                      setDocumentacaoEventoForm((prev) => ({ ...prev, validade_documento: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Protocolo / referência</Label>
                  <Input
                    value={documentacaoEventoForm.protocolo_documento}
                    onChange={(event) =>
                      setDocumentacaoEventoForm((prev) => ({ ...prev, protocolo_documento: event.target.value }))
                    }
                  />
                </div>
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
            ) : !isAbastecimentoSelecionado ? (
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
            ) : (
              <></>
            )}
            {!isAbastecimentoSelecionado && (
              <div>
                <Label>Observação curta</Label>
                <Textarea value={eventForm.observacao} onChange={(event) => setEventForm((prev) => ({ ...prev, observacao: event.target.value }))} />
              </div>
            )}
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

      {/* Modal para selecionar sub-viagem a fechar */}
      <Dialog open={fecharSubViagemModalOpen} onOpenChange={setFecharSubViagemModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fechar sub-viagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione a sub-viagem que deseja fechar:
            </p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {subViagensCarregadas && subViagensCarregadas.length > 0 ? (
                subViagensCarregadas.map((subViagem) => (
                  <Button
                    key={subViagem.id}
                    type="button"
                    variant={subViagemParaFecharId === subViagem.id ? "default" : "outline"}
                    className="w-full justify-start text-left"
                    onClick={() => setSubViagemParaFecharId(subViagem.id)}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex-1">
                        <p className="font-medium text-sm">Sub-viagem {subViagem.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          Status: <span>{subViagem.status}</span>
                        </p>
                      </div>
                      {subViagem.status === "Fechada" && <Badge variant="secondary" className="ml-2">Fechada</Badge>}
                    </div>
                  </Button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma sub-viagem disponível</p>
              )}
            </div>
            {subViagemParaFecharId && (
              <Button
                type="button"
                className="w-full bg-red-600 hover:bg-red-700"
                onClick={() => {
                  setFinalizacaoTipo("viagem")
                  const realizados = eventosCicloTabela.filter((e) => e.modo === "realizado")
                  setFinalizarViagemEventoId(realizados[realizados.length - 1]?.id ?? "")
                  setFecharSubViagemModalOpen(false)
                  setViagemOperacaoId(subViagemParaFecharId || "")
                  setFinalizacaoTipoModalOpen(true)
                }}
              >
                Prosseguir com fechamento
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
