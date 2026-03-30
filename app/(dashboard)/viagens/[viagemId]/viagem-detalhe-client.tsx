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
  Cliente,
  PostoAbastecimento,
  CustoViagem,
  DocumentoViagemTipo,
  EtaParametro,
  EventoViagemStatus,
  EventoViagemTipo,
  ReceitaViagem,
  Rota,
  ViagemPlanejamentoRota,
  Viagem,
  ViagemDocumento,
  ViagemEvento,
  Veiculo,
  Motorista,
} from "@/lib/types"
import { getPontoParadaTipoLabel, normalizePontoIntermediarioKm, normalizePontoParadaTipo } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
  origem?: string
  destino?: string
  observacao: string
  inicio_em: string
  fim_em: string
  chegada_cliente_em?: string
  partida_cliente_em?: string
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

type NovaViagemFormState = {
  ciclo_id: string
  cliente_id: string
  veiculo_id: string
  motorista_id: string
  rota_id: string
  origem_real: string
  destino_real: string
  data_inicio: string
  data_fim: string
  tipo_carga: string
  volume_toneladas: string
  valor_frete: string
  forma_pagamento: string
  status: Viagem["status"]
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
  { label: "Parada", type: "parada", status: "em_andamento", title: "Parada" },
  { label: "Abastecimento", type: "abastecimento", status: "concluido", title: "Abastecimento" },
  { label: "Manutenção", type: "manutencao" as any, status: "concluido", title: "Manutenção" },
  { label: "Documentação", type: "ocorrencia", status: "pendente", title: "Documentação" },
]

const metodosPagamentoBrasil = [
  "Pix",
  "Boleto bancario",
  "Transferencia bancaria",
  "Cartao de credito",
  "Cartao de debito",
  "Dinheiro",
  "Faturado (a prazo)",
  "Outro",
] as const

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
  manutencao: "Manutenção",
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

function parseDecimalInput(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return Number.isFinite(value) ? value : 0

  const normalized = value.trim().replace(",", ".")
  if (!normalized) return 0

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
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

function formatDurationHoursOnly(totalMinutes: number) {
  const minutes = Math.max(0, Number(totalMinutes) || 0)
  if (minutes <= 0) return "-"

  const hours = minutes / 60
  const value = Number.isInteger(hours) ? hours.toString() : hours.toFixed(1).replace(".0", "")
  return `${value} h`
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

function buildPlanejamentoRotaFromForm(
  rota: Rota,
  dataInicio: string,
  dataFim: string,
): ViagemPlanejamentoRota {
  return {
    origem_partida_planejada: toIsoOrNull(dataInicio),
    destino_chegada_planejada: toIsoOrNull(dataFim),
    intermediarios: (rota.pontos_intermediarios || [])
      .filter((ponto) => Boolean(ponto.cidade && ponto.estado))
      .map((ponto, index) => ({
        chave: buildIntermediarioChave(ponto.cidade, ponto.estado, index),
        cidade: ponto.cidade,
        estado: ponto.estado,
        tipo_parada: ponto.tipo_parada,
        chegada_planejada: null,
        partida_planejada: null,
      })),
  }
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
  // Novo estado para modal de ações rápidas
  const [quickActionsModalOpen, setQuickActionsModalOpen] = useState(false)
  const [confirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState(false)
  const [novaViagemModalOpen, setNovaViagemModalOpen] = useState(false)
  const [showNovaViagemAdvanced, setShowNovaViagemAdvanced] = useState(false)
  const [quickActionStep, setQuickActionStep] = useState<'list' | 'form'>('list')
  const [selectedQuickAction, setSelectedQuickAction] = useState<CockpitQuickAction | null>(null)
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
  const [eventosDaViagemSelecionada, setEventosDaViagemSelecionada] = useState<ViagemEvento[]>([])
  const [fechamentoEventoId, setFechamentoEventoId] = useState(() => {
    if (viagem.fechamento_evento_id) return viagem.fechamento_evento_id
    if (typeof window === "undefined") return ""
    return window.localStorage.getItem(getFechamentoEventoStorageKey(viagem.id)) || ""
  })
  const [saldoInicialLitros, setSaldoInicialLitros] = useState("300")
  const [dieselFinalLitros, setDieselFinalLitros] = useState("")
  const [consumoMedioEditavel, setConsumoMedioEditavel] = useState(() => Number(viagem.veiculo?.meta_consumo || 2.4))
  const [timeTicker, setTimeTicker] = useState(() => Date.now())
  const [tipoParadaSelecionado, setTipoParadaSelecionado] = useState<'carga' | 'descarga' | 'descanso' | 'parada_operacional' | 'ocorrencia'>('carga')
  const recalculateEtaInFlightRef = useRef(false)

  const [eventForm, setEventForm] = useState<EventFormState>({
    tipo_evento: "chegada",
    status_evento: "concluido",
    titulo: "",
    local: "",
    origem: "",
    destino: "",
    observacao: "",
    inicio_em: "",
    fim_em: "",
    chegada_cliente_em: "",
    partida_cliente_em: "",
  })
  const [passagemPontoSelecionado, setPassagemPontoSelecionado] = useState("")
  const [novoPontoPassagem, setNovoPontoPassagem] = useState("")
  const [postosAbastecimento, setPostosAbastecimento] = useState<PostoAbastecimento[]>([])
  const [abastecimentoForm, setAbastecimentoForm] = useState({
    veiculo_id: viagem.veiculo_id || "",
    inicio_em: "",
    fim_em: "",
    chegada_cliente_em: "",
    partida_cliente_em: "",
    local: "",
    motorista: "",
    forma_pagamento: "Pix",
    valor_litro_cavalo: "",
    valor_litro_thermo_king: "",
    valor_litro_arla: "",
    hodometro: "",
    horimetro: "",
    hora_thermo_king: "",
    litros_cavalo: "",
    litros_thermo_king: "",
    valor_total: "",
    abasteceu_arla: "nao" as "sim" | "nao",
    litros_arla: "",
    tanque_cheio: "nao" as "sim" | "nao",
  })
  const [manutencaoForm, setManutencaoForm] = useState({
    veiculo_id: viagem.veiculo_id || "",
    inicio_em: "",
    local: "",
    tipo_manutencao: "preventiva" as "preventiva" | "corretiva" | "pneus" | "eletrica" | "motor" | "freios" | "suspensao" | "thermo_king" | "outro",
    valor_total: "",
    forma_pagamento: "Pix",
    nota_fiscal: "",
    hodometro: "",
    observacao: "",
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
  const [documentacaoQuickActionFile, setDocumentacaoQuickActionFile] = useState<File | null>(null)
  const [documentacaoQuickActionPreview, setDocumentacaoQuickActionPreview] = useState<string>("")
  const [clientesCadastro, setClientesCadastro] = useState<Cliente[]>([])
  const [veiculosCadastro, setVeiculosCadastro] = useState<Veiculo[]>([])
  const [motoristasCadastro, setMotoristasCadastro] = useState<Motorista[]>([])
  const [rotasCadastro, setRotasCadastro] = useState<Rota[]>([])

  const [novaViagemForm, setNovaViagemForm] = useState<NovaViagemFormState>({
    ciclo_id: viagem.ciclo_id || "",
    cliente_id: viagem.cliente_id || "",
    veiculo_id: viagem.veiculo_id || "",
    motorista_id: viagem.motorista_id || "",
    rota_id: viagem.rota_id || "",
    origem_real: viagem.origem_real || "",
    destino_real: viagem.destino_real || "",
    data_inicio: toDatetimeLocal(viagem.data_fim || new Date().toISOString()),
    data_fim: "",
    tipo_carga: viagem.tipo_carga || "",
    volume_toneladas: viagem.volume_toneladas?.toString() || "",
    valor_frete: viagem.valor_frete?.toString() || "",
    forma_pagamento: "Pix",
    status: "Planejada",
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
  const abastecimentoResumoFinanceiro = useMemo(() => {
    const litrosCavalo = parseDecimalInput(abastecimentoForm.litros_cavalo)
    const litrosThermoKing = parseDecimalInput(abastecimentoForm.litros_thermo_king)
    const litrosArla = abastecimentoForm.abasteceu_arla === "sim"
      ? parseDecimalInput(abastecimentoForm.litros_arla)
      : 0
    const valorLitroCavalo = parseDecimalInput(abastecimentoForm.valor_litro_cavalo)
    const valorLitroThermoKing = parseDecimalInput(abastecimentoForm.valor_litro_thermo_king)
    const valorLitroArla = parseDecimalInput(abastecimentoForm.valor_litro_arla)

    const subtotalCavalo = litrosCavalo * valorLitroCavalo
    const subtotalThermoKing = litrosThermoKing * valorLitroThermoKing
    const subtotalArla = litrosArla * valorLitroArla
    const total = subtotalCavalo + subtotalThermoKing + subtotalArla

    return {
      litrosCavalo,
      litrosThermoKing,
      litrosArla,
      valorLitroCavalo,
      valorLitroThermoKing,
      valorLitroArla,
      subtotalCavalo,
      subtotalThermoKing,
      subtotalArla,
      total,
    }
  }, [
    abastecimentoForm.abasteceu_arla,
    abastecimentoForm.litros_arla,
    abastecimentoForm.litros_cavalo,
    abastecimentoForm.litros_thermo_king,
    abastecimentoForm.valor_litro_arla,
    abastecimentoForm.valor_litro_cavalo,
    abastecimentoForm.valor_litro_thermo_king,
  ])
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
    const temSubViagens = (subViagensCarregadas || []).length > 0
    const temIrmas = (viagensIrmasDosCiclo || []).length > 0
    if (!temSubViagens && !temIrmas) return

    void refreshEventos()
  }, [subViagemAtivaId, subViagensCarregadas, viagensIrmasDosCiclo])

  useEffect(() => {
    const totalCalculado = abastecimentoResumoFinanceiro.total
    const proximoValor = totalCalculado > 0 ? totalCalculado.toFixed(2) : ""

    setAbastecimentoForm((prev) => (
      prev.valor_total === proximoValor
        ? prev
        : { ...prev, valor_total: proximoValor }
    ))
  }, [abastecimentoResumoFinanceiro.total])

  // Reset formulários ao trocar de sub-viagem
  useEffect(() => {
    if (!subViagemAtivaId) return

    // Reset abastecimento
    setAbastecimentoForm({
      veiculo_id: viagem.veiculo_id || "",
      inicio_em: "",
      fim_em: "",
      chegada_cliente_em: "",
      partida_cliente_em: "",
      local: "",
      motorista: "",
      forma_pagamento: "Pix",
      valor_litro_cavalo: "",
      valor_litro_thermo_king: "",
      valor_litro_arla: "",
      hodometro: "",
      horimetro: "",
      hora_thermo_king: "",
      litros_cavalo: "",
      litros_thermo_king: "",
      valor_total: "",
      abasteceu_arla: "nao",
      litros_arla: "",
      tanque_cheio: "nao",
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
      chegada_cliente_em: "",
      partida_cliente_em: "",
    })
  }, [subViagemAtivaId])

  useEffect(() => {
    const carregarViagensIrmas = async () => {
      if (!viagemState.ciclo_id) return

      const { data, error } = await supabase
        .from("viagens")
        .select("id, status, data_inicio, data_fim, viagem_pai_id")
        .eq("ciclo_id", viagemState.ciclo_id)

      if (!error && data) {
        setViagensIrmasDosCiclo(data as Viagem[])
      }
    }

    carregarViagensIrmas()
  }, [viagemState.ciclo_id, viagemState.status, subViagensCarregadas, supabase])

  useEffect(() => {
    if (!eventModalOpen && !quickActionsModalOpen) {
      setEventoViagemAlvoId(null)
    }
  }, [eventModalOpen, quickActionsModalOpen])

  // Atualizar eventForm quando selectedQuickAction muda
  useEffect(() => {
    if (selectedQuickAction && !activeTimelineEvent) {
      setEventForm(prev => ({
        ...prev,
        titulo: selectedQuickAction.title,
        tipo_evento: selectedQuickAction.type as EventoViagemTipo,
        status_evento: selectedQuickAction.status,
      }))
    }
  }, [activeTimelineEvent, selectedQuickAction])

  useEffect(() => {
    if (selectedQuickAction?.type === 'parada') {
      const tipoLabels: Record<typeof tipoParadaSelecionado, string> = {
        carga: 'Carga',
        descarga: 'Descarga',
        descanso: 'Descanso',
        parada_operacional: 'Parada Operacional',
        ocorrencia: 'Ocorrência'
      }
      setEventForm(prev => ({
        ...prev,
        titulo: tipoLabels[tipoParadaSelecionado],
        tipo_evento: tipoParadaSelecionado === 'ocorrencia' ? 'ocorrencia' : 'parada',
        status_evento: activeTimelineEvent
          ? prev.status_evento
          : (tipoParadaSelecionado === 'ocorrencia' ? 'pendente' : 'em_andamento')
      }))
    }
  }, [activeTimelineEvent, tipoParadaSelecionado, selectedQuickAction])

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

  const custosAbastecimentoPorViagemId = useMemo(() => {
    const mapa = new Map<string, number>()

    // Prioriza valor_total no payload do evento de abastecimento.
    eventosRealizados
      .filter((evento) => evento.tipo_evento === "abastecimento")
      .forEach((evento) => {
        const viagemId = evento.viagem_id
        if (!viagemId) return
        const payload = (evento.payload || {}) as Record<string, unknown>
        const valorTotal = Number(payload.valor_total || 0)
        mapa.set(viagemId, (mapa.get(viagemId) || 0) + Math.max(0, valorTotal))
      })

    // Fallback: se não houver payload, usa custos categoria Diesel por viagem.
    custos
      .filter((item) => normalizeCategoria(item.categoria) === "Diesel")
      .forEach((item) => {
        const viagemId = item.viagem_id
        if (!viagemId) return
        if ((mapa.get(viagemId) || 0) > 0) return
        mapa.set(viagemId, (mapa.get(viagemId) || 0) + Math.max(0, Number(item.valor || 0)))
      })

    return mapa
  }, [custos, eventosRealizados])

  const custosManutencaoPorViagemId = useMemo(() => {
    const mapa = new Map<string, number>()

    eventosRealizados
      .filter((evento) => evento.tipo_evento === "manutencao")
      .forEach((evento) => {
        const viagemId = evento.viagem_id
        if (!viagemId) return
        const payload = (evento.payload || {}) as Record<string, unknown>
        const valorTotal = Number(payload.valor_total || 0)
        mapa.set(viagemId, (mapa.get(viagemId) || 0) + Math.max(0, valorTotal))
      })

    return mapa
  }, [eventosRealizados])

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

    // First, number all viagens in the ciclo by data_inicio order
    const viagensOrdenadas = [...viagensDoCiclo].sort((a, b) => {
      const dateA = (a as { data_inicio?: string | null }).data_inicio
        ? new Date((a as { data_inicio?: string | null }).data_inicio!).getTime()
        : 0
      const dateB = (b as { data_inicio?: string | null }).data_inicio
        ? new Date((b as { data_inicio?: string | null }).data_inicio!).getTime()
        : 0
      return dateA - dateB
    })

    viagensOrdenadas.forEach((viagem, index) => {
      if (viagem?.id) mapa.set(viagem.id, String(index + 1).padStart(2, "0"))
    })

    // Also assign numbers for any viagens only seen in events (not in viagensDoCiclo)
    const eventosOrdenadosAsc = [...eventos].sort(
      (a, b) => new Date(a.ocorrido_em).getTime() - new Date(b.ocorrido_em).getTime(),
    )
    let contador = mapa.size + 1
    eventosOrdenadosAsc.forEach((evento) => {
      const viagemId = evento.viagem_id
      if (!viagemId || mapa.has(viagemId)) return
      mapa.set(viagemId, String(contador).padStart(2, "0"))
      contador += 1
    })

    return mapa
  }, [eventos, viagensDoCiclo])
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
    .sort((a, b) => {
      const seqA = parseInt(sequenciaViagemPorId.get(a.id) || "99", 10)
      const seqB = parseInt(sequenciaViagemPorId.get(b.id) || "99", 10)
      return seqA - seqB
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

  const viagemContexto = subViagemAtiva || viagemState
  const clienteAtual =
    viagemContexto.cliente || clientesCadastro.find((item) => item.id === viagemContexto.cliente_id) || undefined
  const veiculoAtual =
    viagemContexto.veiculo || veiculosCadastro.find((item) => item.id === viagemContexto.veiculo_id) || undefined
  const motoristaAtual =
    viagemContexto.motorista || motoristasCadastro.find((item) => item.id === viagemContexto.motorista_id) || undefined
  const rotaAtual =
    viagemContexto.rota || rotasCadastro.find((item) => item.id === viagemContexto.rota_id) || undefined

  const clienteNome = clienteAtual?.nome || "Sem cliente"
  const cicloLabel = rotaAtual?.nome || `C-${viagemState.id.slice(0, 4).toUpperCase()}`
  const cicloIdReferencia = useMemo(() => {
    if (viagemState.ciclo_id?.trim()) return viagemState.ciclo_id.trim()
    const year = new Date(viagemState.created_at || new Date().toISOString()).getFullYear()
    return `CIC-${year}-${viagemState.id.slice(0, 8).toUpperCase()}`
  }, [viagemState.ciclo_id, viagemState.created_at, viagemState.id])
  const viagemLabel = `V-${viagemState.id.slice(0, 6).toUpperCase()}`
  const origemOperacionalLabel =
    viagemContexto.origem_real ||
    [rotaAtual?.origem_cidade, rotaAtual?.origem_estado].filter(Boolean).join("/") ||
    "Origem"
  const destinoOperacionalLabel =
    viagemContexto.destino_real ||
    [rotaAtual?.destino_cidade, rotaAtual?.destino_estado].filter(Boolean).join("/") ||
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
    const viagemById = new Map<string, Viagem>()

    viagensDoCiclo.forEach((v) => {
      if (v?.id) viagemById.set(v.id, v)
    })

    // Pré-popular com TODAS as viagens do ciclo (mesmo sem eventos)
    viagensDoCiclo.forEach((v) => {
      if (v?.id) grupos.set(v.id, [])
    })

    eventosCicloTabela.forEach((evento) => {
      const viagemId = evento.source?.viagem_id
      if (!viagemId) return
      if (!grupos.has(viagemId)) grupos.set(viagemId, [])
      grupos.get(viagemId)!.push(evento)
    })

    return Array.from(grupos.entries()).map(([viagemId, eventosViagem], index) => {
      // Determinar fechamento pelo status real da viagem
      const temFechamento = statusFechamentoPorViagemId.get(viagemId) ?? false
      const contagem = eventosViagem.length
      const primeiroEvento = eventosViagem[0]
      const ultimoEvento = eventosViagem[eventosViagem.length - 1]
      const sequencia = sequenciaViagemPorId.get(viagemId) || String(index + 1).padStart(2, "0")
      const viagem = viagemById.get(viagemId)
      const eventosReais = eventosViagem.filter((item) => item.kind === "evento" && item.modo === "realizado").length
      const eventosPlanejados = eventosViagem.filter((item) => item.kind === "evento" && item.modo === "planejado").length
      const ultimoEventoIso = ultimoEvento?.source?.ocorrido_em || null
      const tempoSemAtualizacaoMin = ultimoEventoIso
        ? Math.max(0, Math.round((timeTicker - new Date(ultimoEventoIso).getTime()) / 60000))
        : null

      const origem =
        viagem?.origem_real ||
        [viagem?.rota?.origem_cidade, viagem?.rota?.origem_estado].filter(Boolean).join("/") ||
        "-"
      const destino =
        viagem?.destino_real ||
        [viagem?.rota?.destino_cidade, viagem?.rota?.destino_estado].filter(Boolean).join("/") ||
        "-"

      const inicioViagem = viagem?.data_inicio || null
      const fimViagem = viagem?.data_fim || null
      const duracaoMin =
        inicioViagem && fimViagem
          ? Math.max(0, Math.round((new Date(fimViagem).getTime() - new Date(inicioViagem).getTime()) / 60000))
          : null

      let fechamentoMotivo = "Em andamento"
      if (temFechamento) {
        if (viagem?.fechamento_evento_id) {
          fechamentoMotivo = `Fechada pelo evento ${viagem.fechamento_evento_id.slice(0, 8).toUpperCase()}`
        } else {
          fechamentoMotivo = "Fechada sem evento de fechamento vinculado"
        }
      }

      return {
        viagemId,
        sequencia,
        temFechamento,
        contagem,
        primeiroEvento,
        ultimoEvento,
        eventosViagem,
        viagem,
        eventosReais,
        eventosPlanejados,
        tempoSemAtualizacaoMin,
        origem,
        destino,
        inicioViagem,
        fimViagem,
        duracaoMin,
        fechamentoMotivo,
      }
    })
    .sort((a, b) => parseInt(a.sequencia, 10) - parseInt(b.sequencia, 10))
  }, [eventosCicloTabela, sequenciaViagemPorId, statusFechamentoPorViagemId, timeTicker, viagensDoCiclo])

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

  const eventoImpactoMedioPorTipo = useMemo(() => {
    const agrupamento = new Map<string, { total: number; count: number }>()

    eventosRealizados.forEach((evento) => {
      const tipo = evento.tipo_evento || "outro"
      const impacto = Number(evento.impacto_minutos || 0)
      const atual = agrupamento.get(tipo) || { total: 0, count: 0 }
      agrupamento.set(tipo, { total: atual.total + impacto, count: atual.count + 1 })
    })

    return agrupamento
  }, [eventosRealizados])

  const waterfallSeriesCiclo = useMemo(() => {
    let acumulado = 0

    const passos = (Object.keys(eventTypeLabels) as EventoViagemTipo[]).filter((tipo) =>
      eventoImpactoMedioPorTipo.has(tipo),
    )

    const serie = passos.map((tipo) => {
      const dados = eventoImpactoMedioPorTipo.get(tipo)!
      const media = dados.count > 0 ? dados.total / dados.count : 0
      const base = acumulado
      acumulado += media
      return {
        etapa: eventTypeLabels[tipo] || tipo,
        base,
        valor: media,
      }
    })

    if (serie.length > 0) {
      serie.push({ etapa: "Total", base: 0, valor: acumulado })
    }

    return serie
  }, [eventTypeLabels, eventoImpactoMedioPorTipo])

  const litrosThermoTotal = useMemo(() => {
    return eventosRealizados
      .filter((e) => e.tipo_evento === "abastecimento")
      .reduce((sum, e) => {
        const p = (e.payload || {}) as Record<string, unknown>
        return sum + Number(p.litros_thermo_king || 0)
      }, 0)
  }, [eventosRealizados])

  const horasThermoTotal = useMemo(() => {
    return eventosRealizados
      .filter((e) => e.tipo_evento === "abastecimento")
      .reduce((sum, e) => {
        const p = (e.payload || {}) as Record<string, unknown>
        return sum + Number(p.hora_thermo_king || 0)
      }, 0)
  }, [eventosRealizados])

  const lhThermoKing = useMemo(() => {
    if (horasThermoTotal <= 0) return null
    return litrosThermoTotal / horasThermoTotal
  }, [litrosThermoTotal, horasThermoTotal])

  const consumoPorMotorista = kmPorLitroCiclo

  const consumoEntreTanqueCheio = useMemo(() => {
    const fullTanks = eventosRealizados
      .filter((e) => e.tipo_evento === "abastecimento" && ((e.payload as Record<string, unknown>)?.tanque_cheio === "sim"))
      .map((e) => {
        const p = (e.payload || {}) as Record<string, unknown>
        return {
          data: e.ocorrido_em,
          hodometro: Number(p.hodometro || 0),
          litros_cavalo: Number(p.litros_cavalo || 0),
        }
      })
      .filter((item) => item.hodometro > 0 && item.litros_cavalo > 0)
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())

    if (fullTanks.length < 2) return null

    const consumos = fullTanks.slice(1).map((current, index) => {
      const previous = fullTanks[index]
      const kmDiff = current.hodometro - previous.hodometro
      if (kmDiff <= 0 || current.litros_cavalo <= 0) return null
      return kmDiff / current.litros_cavalo
    }).filter((v): v is number => v !== null)

    if (consumos.length === 0) return null

    return consumos.reduce((sum, next) => sum + next, 0) / consumos.length
  }, [eventosRealizados])

  // ─── KPIs derivados (health score + operacionais + financeiros) ────────────
  const autonomiaRestanteKm = useMemo(() => {
    const saldo = saldoAtualEstimadoLitros !== null ? saldoAtualEstimadoLitros : 0
    if (saldo <= 0 || consumoMedioEditavel <= 0) return null
    return Math.max(0, Math.round(saldo * consumoMedioEditavel))
  }, [consumoMedioEditavel, saldoAtualEstimadoLitros])

  const eficienciaMovimentoPercent = useMemo(() => {
    if (!realHours || realHours <= 0) return null
    const paradoHoras = tempoTotalParadoMin / 60
    const emMovimentoHoras = Math.max(0, realHours - paradoHoras)
    return Math.min(100, Math.round((emMovimentoHoras / realHours) * 100))
  }, [realHours, tempoTotalParadoMin])

  const eventosConformidadePercent = useMemo(() => {
    const total = eventosRealizados.length + eventosPlanejados.length
    if (total <= 0) return null
    return Math.min(100, Math.round((eventosRealizados.length / total) * 100))
  }, [eventosRealizados.length, eventosPlanejados.length])

  const healthScore = useMemo(() => {
    let score = 100
    if (atrasoAcumuladoCicloMin > 0) score -= Math.min(30, Math.round(atrasoAcumuladoCicloMin / 10))
    if (saldoAtualEstimadoLitros !== null && saldoAtualEstimadoLitros < 0) score -= 25
    if (eventosRealizados.length === 0) score -= 20
    if (documentos.length === 0) score -= 10
    if (tempoTotalParadoMin >= 120) score -= Math.min(15, Math.round((tempoTotalParadoMin - 120) / 30))
    return Math.max(0, Math.min(100, score))
  }, [atrasoAcumuladoCicloMin, documentos.length, eventosRealizados.length, saldoAtualEstimadoLitros, tempoTotalParadoMin])

  const healthScoreLabel = useMemo(() => {
    if (healthScore >= 80) return { label: "Saudável", color: "text-emerald-700", bg: "bg-emerald-100", ring: "ring-emerald-300" }
    if (healthScore >= 55) return { label: "Atenção", color: "text-amber-700", bg: "bg-amber-100", ring: "ring-amber-300" }
    return { label: "Crítico", color: "text-red-700", bg: "bg-red-100", ring: "ring-red-300" }
  }, [healthScore])

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
      itens.push(`Atraso estimado de ${formatDurationHoursOnly(Number(viagemState.atraso_estimado_minutos || 0))}.`)
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
    return [
      {
        label: "Partida/Chegada",
        action: {
          label: "Partida/Chegada",
          type: "saida",
          status: "concluido",
          title: "Partida/Chegada",
        } as CockpitQuickAction,
      },
      {
        label: "Parada",
        action: findQuickActionByTitle("Parada"),
      },
      { label: "Abastecimento", action: findQuickActionByTitle("Abastecimento") },
      { label: "Manutenção", action: findQuickActionByTitle("Manutenção") },
      { label: "Documentação", action: findQuickActionByTitle("Documentação") },
    ].filter((item): item is { label: string; action: CockpitQuickAction } => Boolean(item.action))
  }, [eventosOrdenados])

  const viagemAtivaNoModalSequencia = useMemo(() => {
    const viagemIdContexto = activeTimelineEvent?.viagem_id || registroViagemSelecionadaId || viagemRegistroAlvoId
    if (!viagemIdContexto) return null

    return opcoesViagemRegistros.find((item) => item.id === viagemIdContexto)?.sequencia || null
  }, [activeTimelineEvent, opcoesViagemRegistros, registroViagemSelecionadaId, viagemRegistroAlvoId])

  const resolveQuickActionFromEvento = (evento: ViagemEvento) => {
    const titulo = (evento.titulo || "").trim().toLowerCase()

    if (titulo.includes("document")) {
      return findQuickActionByTitle("Documentação") || smartQuickActions.find((item) => item.label === "Documentação")?.action || null
    }

    if (evento.tipo_evento === "abastecimento") {
      return findQuickActionByTitle("Abastecimento") || smartQuickActions.find((item) => item.label === "Abastecimento")?.action || null
    }

    if (evento.tipo_evento === "manutencao") {
      return findQuickActionByTitle("Manutenção") || smartQuickActions.find((item) => item.label === "Manutenção")?.action || null
    }

    if (evento.tipo_evento === "parada" || evento.tipo_evento === "ocorrencia") {
      return findQuickActionByTitle("Parada") || smartQuickActions.find((item) => item.label === "Parada")?.action || null
    }

    return smartQuickActions.find((item) => item.label === "Partida/Chegada")?.action || null
  }

  const inferParadaTipoFromEvento = (evento: ViagemEvento): typeof tipoParadaSelecionado => {
    if (evento.tipo_evento === "ocorrencia") return "ocorrencia"

    const titulo = (evento.titulo || "").trim().toLowerCase()
    if (titulo.includes("descarga")) return "descarga"
    if (titulo.includes("carga")) return "carga"
    if (titulo.includes("descanso")) return "descanso"

    return "parada_operacional"
  }

  const abrirEventoNaModalAcoesRapidas = (evento: ViagemEvento) => {
    const payloadData = getAbastecimentoPayloadData((evento.payload || null) as Record<string, unknown> | null)
    const payloadOcorrencia = getOcorrenciaPayloadData((evento.payload || null) as Record<string, unknown> | null)
    const payloadDocumentacao = getDocumentacaoPayloadData((evento.payload || null) as Record<string, unknown> | null)
    const quickAction = resolveQuickActionFromEvento(evento)

    setActiveTimelineEvent(evento)
    setEventoViagemAlvoId(evento.viagem_id)
    setRegistroViagemSelecionadaId(evento.viagem_id)
    setEventoLancamentoModo(isEventoPlanejado(evento) ? "planejado" : "realizado")
    setTipoParadaSelecionado(inferParadaTipoFromEvento(evento))
    setSelectedQuickAction(quickAction)
    setDocumentacaoQuickActionFile(null)
    setDocumentacaoQuickActionPreview("")
    setAbastecimentoForm({
      veiculo_id: String((evento.payload as Record<string, unknown> | null)?.veiculo_id || viagemState.veiculo_id || ""),
      inicio_em: toDatetimeLocal(evento.ocorrido_em),
      fim_em: toDatetimeLocal(evento.previsto_em || evento.ocorrido_em),
      chegada_cliente_em: payloadData.chegada_cliente_em,
      partida_cliente_em: payloadData.partida_cliente_em,
      local: evento.local || "",
      motorista: payloadData.motorista,
      forma_pagamento: payloadData.forma_pagamento || "Pix",
      valor_litro_cavalo: payloadData.valor_litro_cavalo,
      valor_litro_thermo_king: payloadData.valor_litro_thermo_king,
      valor_litro_arla: payloadData.valor_litro_arla,
      hodometro: payloadData.hodometro,
      horimetro: payloadData.horimetro,
      hora_thermo_king: payloadData.hora_thermo_king,
      litros_cavalo: payloadData.litros_cavalo,
      litros_thermo_king: payloadData.litros_thermo_king,
      valor_total: payloadData.valor_total,
      abasteceu_arla: payloadData.abasteceu_arla === "sim" ? "sim" : "nao",
      litros_arla: payloadData.litros_arla,
      tanque_cheio: payloadData.tanque_cheio === "sim" ? "sim" : "nao",
    })
    setOcorrenciaForm(payloadOcorrencia)
    setDocumentacaoEventoForm(payloadDocumentacao)
    setEventForm({
      tipo_evento: evento.tipo_evento,
      status_evento: evento.status_evento,
      titulo: evento.titulo,
      local: evento.local || "",
      observacao: evento.observacao || "",
      inicio_em: toDatetimeLocal(evento.ocorrido_em),
      fim_em: toDatetimeLocal(evento.previsto_em || evento.ocorrido_em),
      origem: String((evento.payload as Record<string, unknown> | null)?.origem || ""),
      destino: String((evento.payload as Record<string, unknown> | null)?.destino || ""),
      chegada_cliente_em: (evento.payload as Record<string, unknown> | null)?.chegada_cliente_em ? toDatetimeLocal((evento.payload as Record<string, unknown>).chegada_cliente_em as string) : "",
      partida_cliente_em: (evento.payload as Record<string, unknown> | null)?.partida_cliente_em ? toDatetimeLocal((evento.payload as Record<string, unknown>).partida_cliente_em as string) : "",
    })
    setQuickActionStep('form')
    setEventModalOpen(false)
    setQuickActionsModalOpen(true)
  }

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
      chegada_cliente_em: "",
      partida_cliente_em: "",
    })
    if (type === "abastecimento") {
      setAbastecimentoForm({
        veiculo_id: viagemState.veiculo_id || "",
        inicio_em: nowLocal,
        fim_em: nowLocal,
        chegada_cliente_em: "",
        partida_cliente_em: "",
        local: "",
        motorista: "",
        forma_pagamento: "Pix",
        valor_litro_cavalo: "",
        valor_litro_thermo_king: "",
        valor_litro_arla: "",
        hodometro: "",
        horimetro: "",
        hora_thermo_king: "",
        litros_cavalo: "",
        litros_thermo_king: "",
        valor_total: "",
        abasteceu_arla: "nao",
        litros_arla: "",
        tanque_cheio: "nao",
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
      : Array.from(new Set([
          viagemState.id,
          ...(subViagensCarregadas || []).map((item) => item.id),
          ...(viagensIrmasDosCiclo || []).map((item) => item.id),
        ]))

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

  const prepararNovaViagemForm = () => {
    const eventoFechamento = eventos.find((evento) => evento.id === fechamentoEventoId)
    const dataInicioLocal = toDatetimeLocal(viagemState.data_fim || new Date().toISOString())

    setNovaViagemForm({
      ciclo_id: cicloIdReferencia,
      cliente_id: viagemState.cliente_id || "",
      veiculo_id: viagemState.veiculo_id || "",
      motorista_id: viagemState.motorista_id || "",
      rota_id: viagemState.rota_id || "",
      origem_real: eventoFechamento?.local || viagemState.destino_real || viagemState.origem_real || "",
      destino_real: viagemState.destino_real || "",
      data_inicio: dataInicioLocal,
      data_fim: "",
      tipo_carga: viagemState.tipo_carga || "",
      volume_toneladas: viagemState.volume_toneladas?.toString() || "",
      valor_frete: viagemState.valor_frete?.toString() || "",
      forma_pagamento: "Pix",
      status: "Planejada",
    })
  }

  const carregarDadosNovaViagemModal = async () => {
    const [clientesResp, veiculosResp, motoristasResp, rotasResp] = await Promise.all([
      supabase.from("clientes").select("*").order("nome"),
      supabase.from("veiculos").select("*").order("placa_cavalo"),
      supabase.from("motoristas").select("*").order("nome"),
      supabase.from("rotas").select("*").order("nome"),
    ])

    if (clientesResp.data) setClientesCadastro(clientesResp.data as Cliente[])
    if (veiculosResp.data) setVeiculosCadastro(veiculosResp.data as Veiculo[])
    if (motoristasResp.data) setMotoristasCadastro(motoristasResp.data as Motorista[])
    if (rotasResp.data) setRotasCadastro(rotasResp.data as Rota[])
  }

  useEffect(() => {
    if (!novaViagemModalOpen) return
    void carregarDadosNovaViagemModal()
  }, [novaViagemModalOpen])

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

    setActiveTimelineEvent(null)
    setEventoLancamentoModo(modo)
    setEventForm({
      tipo_evento: action.type,
      status_evento: modo === "planejado" ? "pendente" : "concluido",
      titulo: action.title,
      local: action.type === "saida" ? origemOperacionalLabel : localPadrao,
      origem: viagemState.origem_real || (viagemState.rota?.origem_cidade && viagemState.rota?.origem_estado ? `${viagemState.rota.origem_cidade}/${viagemState.rota.origem_estado}` : ""),
      destino: viagemState.destino_real || (viagemState.rota?.destino_cidade && viagemState.rota?.destino_estado ? `${viagemState.rota.destino_cidade}/${viagemState.rota.destino_estado}` : ""),
      observacao: modo === "planejado" ? "Planejado por ação rápida." : "Registrado por ação rápida.",
      inicio_em: nowLocal,
      fim_em: nowLocal,
      chegada_cliente_em: "",
      partida_cliente_em: "",
    })
    if (action.type === "abastecimento") {
      setAbastecimentoForm({
        veiculo_id: viagemState.veiculo_id || "",
        inicio_em: nowLocal,
        fim_em: nowLocal,
        chegada_cliente_em: "",
        partida_cliente_em: "",
        local: localPadrao,
        motorista: "",
        forma_pagamento: "Pix",
        valor_litro_cavalo: "",
        valor_litro_thermo_king: "",
        valor_litro_arla: "",
        hodometro: "",
        horimetro: "",
        hora_thermo_king: "",
        litros_cavalo: "",
        litros_thermo_king: "",
        valor_total: "",
        abasteceu_arla: "nao",
        litros_arla: "",
        tanque_cheio: "nao",
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

  const quickActionPartidaChegadaAtiva = ["Saída", "Chegada", "Passagem", "Partida/Chegada"].includes(eventForm.titulo)

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
  const paradaTipoLabel = {
    carga: "Carga",
    descarga: "Descarga",
    descanso: "Descanso",
    parada_operacional: "Parada operacional",
    ocorrencia: "Ocorrência",
  }[tipoParadaSelecionado]
  const paradaDuracaoMinutos = useMemo(() => {
    if (!eventForm.inicio_em || !eventForm.fim_em) return 0

    const inicio = new Date(eventForm.inicio_em).getTime()
    const fim = new Date(eventForm.fim_em).getTime()
    if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) return 0

    return Math.round((fim - inicio) / 60000)
  }, [eventForm.fim_em, eventForm.inicio_em])
  const paradaDuracaoFormatada = paradaDuracaoMinutos > 0 ? formatDurationByUnit(paradaDuracaoMinutos) : "Em aberto"

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

  const getAbastecimentoPayloadData = (payload: Record<string, unknown> | null | undefined): {
    chegada_cliente_em: string
    partida_cliente_em: string
    motorista: string
    forma_pagamento: string
    valor_litro_cavalo: string
    valor_litro_thermo_king: string
    valor_litro_arla: string
    hodometro: string
    horimetro: string
    hora_thermo_king: string
    litros_cavalo: string
    litros_thermo_king: string
    valor_total: string
    abasteceu_arla: "sim" | "nao"
    litros_arla: string
    tanque_cheio: "sim" | "nao"
  } => {
    if (!payload) {
      return {
        chegada_cliente_em: "",
        partida_cliente_em: "",
        motorista: "",
        forma_pagamento: "Pix",
        valor_litro_cavalo: "",
        valor_litro_thermo_king: "",
        valor_litro_arla: "",
        hodometro: "",
        horimetro: "",
        hora_thermo_king: "",
        litros_cavalo: "",
        litros_thermo_king: "",
        valor_total: "",
        abasteceu_arla: "nao",
        litros_arla: "",
        tanque_cheio: "nao",
      }
    }

    return {
      chegada_cliente_em: toDatetimeLocal(String(payload.chegada_cliente_em || "") || null),
      partida_cliente_em: toDatetimeLocal(String(payload.partida_cliente_em || "") || null),
      motorista: String(payload.motorista || ""),
      forma_pagamento: String(payload.forma_pagamento || "Pix"),
      valor_litro_cavalo:
        payload.valor_litro_cavalo !== undefined && payload.valor_litro_cavalo !== null
          ? String(payload.valor_litro_cavalo)
          : "",
      valor_litro_thermo_king:
        payload.valor_litro_thermo_king !== undefined && payload.valor_litro_thermo_king !== null
          ? String(payload.valor_litro_thermo_king)
          : "",
      valor_litro_arla:
        payload.valor_litro_arla !== undefined && payload.valor_litro_arla !== null
          ? String(payload.valor_litro_arla)
          : "",
      hodometro: payload.hodometro !== undefined && payload.hodometro !== null ? String(payload.hodometro) : "",
      horimetro: payload.horimetro !== undefined && payload.horimetro !== null ? String(payload.horimetro) : "",
      hora_thermo_king: payload.hora_thermo_king !== undefined && payload.hora_thermo_king !== null ? String(payload.hora_thermo_king) : "",
      litros_cavalo: payload.litros_cavalo !== undefined && payload.litros_cavalo !== null ? String(payload.litros_cavalo) : "",
      litros_thermo_king: payload.litros_thermo_king !== undefined && payload.litros_thermo_king !== null ? String(payload.litros_thermo_king) : "",
      valor_total: payload.valor_total !== undefined && payload.valor_total !== null ? String(payload.valor_total) : "",
      abasteceu_arla: payload.abasteceu_arla === "sim" ? "sim" : "nao",
      litros_arla: payload.litros_arla !== undefined && payload.litros_arla !== null ? String(payload.litros_arla) : "",
      tanque_cheio: payload.tanque_cheio === "sim" ? "sim" : "nao",
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
      litros:
        Number(params.eventPayload.litros_cavalo || 0) +
        Number(params.eventPayload.litros_thermo_king || 0) +
        Number(params.eventPayload.litros_arla || 0),
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
    const marcoAtual: MarcoOperacionalTipo = selectedMarcoOperacional
    const localPassagem =
      passagemPontoSelecionado === PASSAGEM_OUTRO_PONTO_VALUE
        ? novoPontoPassagem.trim()
        : passagemPontoSelecionado || eventForm.local || ""

    if (marcoAtual === "passagem" && !localPassagem.trim()) {

      alert("Selecione um ponto de passagem ou informe um novo ponto.")
      setLoading(false)
      return
    }

    // Validação de manutenção
    const isManutencaoSelecionada = eventForm.tipo_evento === "manutencao" || eventForm.titulo === "Manutenção"
    if (isManutencaoSelecionada) {
      if (!manutencaoForm.inicio_em || !manutencaoForm.local || !manutencaoForm.tipo_manutencao) {
        alert("Para manutenção, preencha Data/Hora, Local e Tipo de manutenção.")
        setLoading(false)
        return
      }
    }

    if (isAbastecimentoSelecionado) {
      if (!abastecimentoForm.inicio_em || !abastecimentoForm.local || !abastecimentoForm.hodometro || !abastecimentoForm.litros_cavalo || !abastecimentoForm.valor_total) {
        alert("Para abastecimento, preencha Data/Hora, Local, Hodômetro, Litros do cavalo e Valor total.")
        setLoading(false)
        return
      }

      if (!abastecimentoForm.valor_litro_cavalo) {
        alert("Informe o valor por litro do cavalo.")
        setLoading(false)
        return
      }

      if (Number(abastecimentoForm.litros_thermo_king) > 0 && !abastecimentoForm.valor_litro_thermo_king) {
        alert("Informe o valor por litro do Thermo King.")
        setLoading(false)
        return
      }

      if (abastecimentoForm.abasteceu_arla === "sim" && !abastecimentoForm.litros_arla) {
        alert("Informe os litros de ARLA quando selecionado como SIM.")
        setLoading(false)
        return
      }

      if (abastecimentoForm.abasteceu_arla === "sim" && !abastecimentoForm.valor_litro_arla) {
        alert("Informe o valor por litro da ARLA.")
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
        ? (eventForm.origem?.trim() || eventForm.local?.trim() || origemOperacionalLabel || null)
        : quickActionPartidaChegadaAtiva && marcoAtual === "chegada"
          ? (eventForm.destino?.trim() || eventForm.local?.trim() || destinoOperacionalLabel || null)
          : quickActionPartidaChegadaAtiva && marcoAtual === "passagem"
            ? localPassagem
          : isAbastecimentoSelecionado
            ? abastecimentoForm.local || null
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
        origem: eventForm.origem || null,
        destino: eventForm.destino || null,
        chegada_cliente_em: eventForm.chegada_cliente_em ? toIsoOrNull(eventForm.chegada_cliente_em) : null,
        partida_cliente_em: eventForm.partida_cliente_em ? toIsoOrNull(eventForm.partida_cliente_em) : null,
      }


    const payloadAbastecimento = isAbastecimentoSelecionado
      ? {
          veiculo_id: abastecimentoForm.veiculo_id,
          chegada_cliente_em: toIsoOrNull(abastecimentoForm.chegada_cliente_em),
          partida_cliente_em: toIsoOrNull(abastecimentoForm.partida_cliente_em),
          forma_pagamento: abastecimentoForm.forma_pagamento || null,
          valor_litro_cavalo: parseDecimalInput(abastecimentoForm.valor_litro_cavalo),
          valor_litro_thermo_king: parseDecimalInput(abastecimentoForm.valor_litro_thermo_king),
          valor_litro_arla: parseDecimalInput(abastecimentoForm.valor_litro_arla),
          hodometro: Number(abastecimentoForm.hodometro || 0),
          horimetro: parseDecimalInput(abastecimentoForm.horimetro),
          litros_cavalo: Number(abastecimentoForm.litros_cavalo || 0),
          litros_thermo_king: Number(abastecimentoForm.litros_thermo_king || 0),
          hora_thermo_king: Number(abastecimentoForm.hora_thermo_king || 0),
          valor_total: abastecimentoResumoFinanceiro.total,
          abasteceu_arla: abastecimentoForm.abasteceu_arla,
          litros_arla: abastecimentoForm.abasteceu_arla === "sim" ? Number(abastecimentoForm.litros_arla || 0) : null,
          tanque_cheio: abastecimentoForm.tanque_cheio,
          motorista: abastecimentoForm.motorista || null,
        }
      : {}

    const payloadManutencao = isManutencaoSelecionada
      ? {
          veiculo_id: manutencaoForm.veiculo_id,
          inicio_em: manutencaoForm.inicio_em,
          local: manutencaoForm.local,
          tipo_manutencao: manutencaoForm.tipo_manutencao,
          hodometro: manutencaoForm.hodometro || null,
          valor_total: manutencaoForm.valor_total || null,
          nota_fiscal: manutencaoForm.nota_fiscal || null,
          forma_pagamento: manutencaoForm.forma_pagamento || null,
          observacao: manutencaoForm.observacao || null,
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
      Object.keys({ ...payloadMetaBase, ...payloadAbastecimento, ...payloadManutencao, ...payloadOcorrencia, ...payloadDocumentacao }).length > 0
        ? {
            ...payloadMetaBase,
            ...payloadAbastecimento,
            ...payloadManutencao,
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

      console.log("✅ Evento inserido:", { data, error, payload })

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

  const handleDeleteEvent = async (skipConfirmOrEvent?: unknown) => {
    if (!activeTimelineEvent) return

    const skipConfirm = typeof skipConfirmOrEvent === "boolean" ? skipConfirmOrEvent : false

    if (!skipConfirm) {
      const confirmDelete = window.confirm("Deseja apagar este evento do ciclo?")
      if (!confirmDelete) return
    }

    setLoading(true)

    const { error } = await supabase
      .from("viagem_eventos")
      .delete()
      .eq("id", activeTimelineEvent.id)

    if (!error) {
      await refreshEventos()
      setEventModalOpen(false)
      setQuickActionsModalOpen(false)
      setConfirmDeleteModalOpen(false)
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
      setQuickActionsModalOpen(false)
      setConfirmDeleteModalOpen(false)
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

  const handleIniciarNovaViagem = async (overrides?: Partial<{
    ciclo_id: string | null
    cliente_id: string | null
    veiculo_id: string | null
    motorista_id: string | null
    rota_id: string | null
    rota_avulsa: boolean
    origem_real: string | null
    destino_real: string | null
    data_inicio: string
    tipo_carga: string | null
    volume_toneladas: number | null
    valor_frete: number | null
    status: Viagem["status"]
    planejamento_rota: ViagemPlanejamentoRota | null
  }>) => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return null
    }

    const eventoFechamento = eventos.find((evento) => evento.id === fechamentoEventoId)
    const dataInicio = overrides?.data_inicio || viagemState.data_fim || new Date().toISOString()

    const novaViagemBase = {
      ciclo_id: overrides?.ciclo_id ?? cicloIdReferencia,
      viagem_pai_id: viagemState.id,
      cliente_id: (overrides?.cliente_id ?? viagemState.cliente_id) || null,
      veiculo_id: (overrides?.veiculo_id ?? viagemState.veiculo_id) || null,
      motorista_id: (overrides?.motorista_id ?? viagemState.motorista_id) || null,
      rota_id: (overrides?.rota_id ?? viagemState.rota_id) || null,
      rota_avulsa: overrides?.rota_avulsa ?? viagemState.rota_avulsa,
      origem_real: (overrides?.origem_real ?? (eventoFechamento?.local || viagemState.destino_real || viagemState.origem_real)) || null,
      destino_real: (overrides?.destino_real ?? viagemState.destino_real) || null,
      data_inicio: dataInicio,
      data_fim: null,
      tipo_carga: (overrides?.tipo_carga ?? viagemState.tipo_carga) || null,
      volume_toneladas: overrides?.volume_toneladas ?? viagemState.volume_toneladas ?? null,
      km_real: null,
      valor_frete: overrides?.valor_frete ?? viagemState.valor_frete ?? null,
      status: overrides?.status ?? ("Planejada" as Viagem["status"]),
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }

    const novaViagem = {
      ...novaViagemBase,
      planejamento_rota: overrides?.planejamento_rota ?? viagemState.planejamento_rota ?? null,
    }

    let createdViagemId: string | null = null

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
      createdViagemId = data.id
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
          ...(viagemState as Viagem),
          id: data.id,
          ciclo_id: novaViagemBase.ciclo_id,
          cliente_id: novaViagemBase.cliente_id,
          veiculo_id: novaViagemBase.veiculo_id,
          motorista_id: novaViagemBase.motorista_id,
          rota_id: novaViagemBase.rota_id,
          rota_avulsa: novaViagemBase.rota_avulsa,
          origem_real: novaViagemBase.origem_real,
          destino_real: novaViagemBase.destino_real,
          tipo_carga: novaViagemBase.tipo_carga,
          volume_toneladas: novaViagemBase.volume_toneladas,
          valor_frete: novaViagemBase.valor_frete,
          planejamento_rota: novaViagem.planejamento_rota,
          cliente: clientesCadastro.find((item) => item.id === novaViagemBase.cliente_id),
          veiculo: veiculosCadastro.find((item) => item.id === novaViagemBase.veiculo_id),
          motorista: motoristasCadastro.find((item) => item.id === novaViagemBase.motorista_id),
          rota: rotasCadastro.find((item) => item.id === novaViagemBase.rota_id),
          status: "Em andamento",
          data_inicio: dataInicio,
          data_fim: null,
          viagem_pai_id: viagemState.id,
        },
        ...prev,
      ])
      setSubViagemAtivaId(data.id)
      setRegistroViagemSelecionadaId(data.id)
      setEventoViagemAlvoId(data.id)
      if (eventoAberturaCriado) {
        setEventos((prev) => [eventoAberturaCriado as ViagemEvento, ...prev])
      } else {
        await refreshEventos()
      }
    }

    setLoading(false)
    return createdViagemId
  }

  const handleSalvarNovaViagemModal = async () => {
    const rotaSelecionada = rotasCadastro.find((rota) => rota.id === novaViagemForm.rota_id)
    const planejamentoRota = rotaSelecionada
      ? buildPlanejamentoRotaFromForm(rotaSelecionada, novaViagemForm.data_inicio, novaViagemForm.data_fim)
      : null

    const novaViagemId = await handleIniciarNovaViagem({
      ciclo_id: novaViagemForm.ciclo_id.trim() || cicloIdReferencia,
      cliente_id: novaViagemForm.cliente_id || null,
      veiculo_id: novaViagemForm.veiculo_id || null,
      motorista_id: novaViagemForm.motorista_id || null,
      rota_id: novaViagemForm.rota_id || null,
      rota_avulsa: !rotaSelecionada,
      origem_real: novaViagemForm.origem_real.trim() || null,
      destino_real: novaViagemForm.destino_real.trim() || null,
      data_inicio: toIsoOrNull(novaViagemForm.data_inicio) || new Date().toISOString(),
      tipo_carga: novaViagemForm.tipo_carga.trim() || null,
      volume_toneladas: novaViagemForm.volume_toneladas ? Number(novaViagemForm.volume_toneladas) : null,
      valor_frete: novaViagemForm.valor_frete ? Number(novaViagemForm.valor_frete) : null,
      status: novaViagemForm.status,
      planejamento_rota: planejamentoRota,
    })

    if (novaViagemId) {
      setNovaViagemModalOpen(false)
      setShowNovaViagemAdvanced(false)
    }
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
          <TabsTrigger className={embedded ? "px-3 text-sm" : undefined} value="kpis">KPIs</TabsTrigger>
        </TabsList>

        <TabsContent value="operacao" className="space-y-3 min-h-0">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
            <div className="xl:col-span-10 flex flex-col gap-2">
              <Card className="order-2 border-border/60 shadow-sm py-3 gap-2">
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
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          prepararNovaViagemForm()
                          setNovaViagemModalOpen(true)
                        }}
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                        Iniciar nova viagem
                      </Button>
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
                      <p className="text-xs text-muted-foreground">Status na tabela: cinza = realizado, amarelo = planejado. Header da viagem: contexto operacional e consistência dos dados.</p>
                    </div>
                    <table className="w-full min-w-[980px] text-sm">
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
                            <tr
                              key={`header-${grupo.viagemId}`}
                              className={`${grupo.temFechamento ? "bg-red-100/40" : "bg-blue-100/40"} border-b-2 border-border cursor-pointer hover:bg-blue-100/60`}
                              onClick={() => {
                                const primeiroEventoEditavel = grupo.eventosViagem.find((item) => item.kind !== "resumo_fechamento" && item.source)?.source || null

                                if (primeiroEventoEditavel) {
                                  abrirEventoNaModalAcoesRapidas(primeiroEventoEditavel)
                                  return
                                }

                                const newExpanded = new Set(expandedViagensIds)
                                if (newExpanded.has(grupo.viagemId)) {
                                  newExpanded.delete(grupo.viagemId)
                                } else {
                                  newExpanded.add(grupo.viagemId)
                                }
                                setExpandedViagensIds(newExpanded)
                              }}
                            >
                              <td colSpan={7} className="py-2 px-4">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 flex-wrap">
                                      <span className="font-semibold text-sm">Viagem {grupo.sequencia}</span>
                                      <Badge variant="secondary" className="text-[10px] tracking-wide">
                                        ID {grupo.viagemId.slice(0, 8).toUpperCase()}
                                      </Badge>
                                      <Badge variant="outline" className="text-[10px]">
                                        {grupo.viagem?.veiculo?.placa_cavalo || "Sem veículo"}
                                      </Badge>
                                      <Badge variant="outline" className="text-[10px]">
                                        {grupo.viagem?.motorista?.nome || "Sem motorista"}
                                      </Badge>
                                      <Badge variant="outline" className="text-[10px]">
                                        Frete: {typeof grupo.viagem?.valor_frete === "number" && Number.isFinite(grupo.viagem.valor_frete)
                                          ? formatCurrency(grupo.viagem.valor_frete)
                                          : "A definir"}
                                      </Badge>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(event) => {
                                        event.stopPropagation()
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

                                  <div className="flex items-center gap-3 flex-wrap">
                                    <Badge variant={grupo.temFechamento ? "destructive" : "default"} className="text-xs">
                                      {grupo.temFechamento ? "Fechada" : "Aberta"}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {grupo.eventosReais} realizado(s) • {grupo.eventosPlanejados} planejado(s)
                                    </span>
                                    <Badge variant="outline" className="text-[10px]">
                                      Abast: {formatCurrency(custosAbastecimentoPorViagemId.get(grupo.viagemId) || 0)}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px]">
                                      Manut: {formatCurrency(custosManutencaoPorViagemId.get(grupo.viagemId) || 0)}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] font-medium">
                                      Custo: {formatCurrency((custosAbastecimentoPorViagemId.get(grupo.viagemId) || 0) + (custosManutencaoPorViagemId.get(grupo.viagemId) || 0))}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">{grupo.fechamentoMotivo}</span>
                                    {grupo.contagem === 0 ? <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700">Sem eventos</Badge> : null}
                                    {grupo.temFechamento && !grupo.viagem?.fechamento_evento_id ? <Badge variant="outline" className="text-[10px] border-red-500 text-red-700">Sem fechamento_evento</Badge> : null}
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 text-xs text-muted-foreground">
                                    <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1">
                                      <span className="font-medium text-foreground">Rota:</span> {grupo.origem} → {grupo.destino}
                                    </div>
                                    <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1">
                                      <span className="font-medium text-foreground">Último evento:</span> {grupo.ultimoEvento?.tipo || "-"} • {grupo.ultimoEvento?.source?.ocorrido_em ? formatDateTime(grupo.ultimoEvento.source.ocorrido_em) : "-"}
                                    </div>
                                    <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1">
                                      <span className="font-medium text-foreground">Sem atualização:</span> {grupo.tempoSemAtualizacaoMin === null ? "-" : formatDurationByUnit(grupo.tempoSemAtualizacaoMin)}
                                    </div>
                                    <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1">
                                      <span className="font-medium text-foreground">Início/Fim:</span> {formatDateTime(grupo.inicioViagem)} • {formatDateTime(grupo.fimViagem)} {grupo.duracaoMin !== null ? `(${formatDurationByUnit(grupo.duracaoMin)})` : ""}
                                    </div>
                                  </div>
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
                                    abrirEventoNaModalAcoesRapidas(evento.source)
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

              <div className="order-1 grid grid-cols-1 gap-2">
                <div className="space-y-3">
                  <Card className="sticky top-2 z-10 border-border/60 bg-background/95 shadow-sm backdrop-blur py-1 gap-1">
                    <CardContent className="p-2.5 sm:p-2.5 space-y-1.5">
                      {/* Cabeçalho com título + badges de estado */}
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold tracking-tight">CICLO TRANSLOG</h2>
                        {subViagemAtivaId && (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                            Sub-viagem ativa
                          </Badge>
                        )}
                        {subViagensCarregadas.length > 0 && !subViagemAtivaId && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                            {subViagensCarregadas.length} sub-viagem(s)
                          </Badge>
                        )}
                        {cicloFechado && <Badge className="bg-red-100 text-red-800 border-red-200">Ciclo fechado</Badge>}
                      </div>

                      {/* Progresso da rota */}
                      {kmPlanejado > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1 text-xs text-muted-foreground">
                            <span>{origemOperacionalLabel}</span>
                            <span className="font-semibold text-foreground">{progressoRotaPercent.toFixed(0)}%</span>
                            <span>{destinoOperacionalLabel}</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                progressoRotaPercent >= 80 ? "bg-emerald-500" : progressoRotaPercent >= 40 ? "bg-blue-500" : "bg-slate-400"
                              }`}
                              style={{ width: `${progressoRotaPercent}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {kmPercorrido > 0 ? `${kmPercorrido.toLocaleString("pt-BR")} km` : "0 km"} percorridos
                            {kmRestanteAutomatico > 0 ? ` · ${kmRestanteAutomatico.toLocaleString("pt-BR")} km restantes` : ""}
                          </p>
                        </div>
                      )}

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

                      {/* Dados operacionais em grade compacta */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-0 text-xs sm:text-sm">
                        <p className="text-muted-foreground">Ciclo: <span className="font-medium text-foreground">{cicloLabel}</span></p>
                        <p className="text-muted-foreground">Veículo: <span className="font-medium text-foreground">{veiculoAtual?.placa_cavalo || "A DEFINIR"}</span></p>
                        <p className="text-muted-foreground">Motorista: <span className="font-medium text-foreground">{motoristaAtual?.nome || "A DEFINIR"}</span></p>
                        <p className="text-muted-foreground col-span-2 sm:col-span-1">ID ciclo: <span className="font-medium text-foreground text-xs">{cicloIdReferencia}</span></p>
                        <p className="text-muted-foreground">Docs: <span className="font-medium text-foreground">{documentos.length}</span></p>
                      </div>

                      {/* Marco atual + próximo */}
                      <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 space-y-0">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">Marco atual:</span>{" "}
                          {ultimoMarco ? `${eventTypeLabels[ultimoMarco.tipo_evento]} · ${ultimoMarco.local || "A DEFINIR"} · ${formatDateTime(ultimoMarco.ocorrido_em)}` : "Nenhum evento registrado"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">Próximo:</span>{" "}
                          {proximaAcaoTitulo} — {formatDateTime(proximaAcaoPrevisao)}
                          {" · "}Retorno: {viagemContexto.destino_real ? "Definido" : "Em aberto"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">Previsão destino:</span>{" "}
                          {formatDateTime(previsaoChegadaDestino)}
                        </p>
                      </div>

                    </CardContent>
                  </Card>

                  {/* ALERTAS com severidade */}
                  <Card className="border-border/60 shadow-sm py-2 gap-1">
                    <CardHeader className="pb-1 px-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">ALERTAS / PENDÊNCIAS</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1 pt-0 px-3">
                      {pendenciasCockpit.map((item) => {
                        const isCritical = item.toLowerCase().includes("insuficiente") || item.toLowerCase().includes("atraso estimado")
                        const isWarning = item.toLowerCase().includes("elevado") || item.toLowerCase().includes("pendente")
                        return (
                          <div key={item} className={`flex items-start gap-2 rounded-md px-2 py-1 text-sm ${
                            isCritical ? "bg-red-50 text-red-800" : isWarning ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-700"
                          }`}>
                            <TriangleAlert className={`size-4 mt-0.5 shrink-0 ${isCritical ? "text-red-500" : isWarning ? "text-amber-500" : "text-slate-400"}`} />
                            <span className="leading-snug">{item}</span>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                </div>

                {/* KPIs movidos para a coluna da direita */}
                <div className="hidden">
                  {/* Linha 1 · Críticos */}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-0.5">Críticos</p>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Health Score */}
                    <Card className={`border shadow-sm py-2 gap-0 ring-1 ${healthScoreLabel.ring}`}>
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Health score</p>
                        <p className={`text-2xl font-bold ${healthScoreLabel.color}`}>{healthScore}</p>
                        <p className={`text-[11px] font-semibold ${healthScoreLabel.color}`}>{healthScoreLabel.label}</p>
                      </CardContent>
                    </Card>
                    {/* Atraso */}
                    <Card className={`border shadow-sm py-2 gap-0 ${atrasoAcumuladoCicloMin > 0 ? "ring-1 ring-red-300 border-red-200" : "border-border/60"}`}>
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Atraso acumulado</p>
                        <p className={`text-2xl font-bold ${atrasoAcumuladoCicloMin > 0 ? "text-red-700" : "text-emerald-700"}`}>
                          {atrasoAcumuladoCicloMin > 0 ? `+${formatDurationByUnit(atrasoAcumuladoCicloMin)}` : "No prazo"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {atrasoAcumuladoCicloMin > 0 ? "Acima do planejado" : "Dentro do SLA"}
                        </p>
                      </CardContent>
                    </Card>
                    {/* Autonomia */}
                    <Card className={`border shadow-sm py-2 gap-0 col-span-2 ${autonomiaRestanteKm !== null && autonomiaRestanteKm < 200 ? "ring-1 ring-amber-300 border-amber-200" : "border-border/60"}`}>
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Autonomia restante estimada</p>
                        <p className={`text-2xl font-bold ${autonomiaRestanteKm === null ? "text-muted-foreground" : autonomiaRestanteKm < 200 ? "text-amber-700" : "text-foreground"}`}>
                          {autonomiaRestanteKm !== null ? `${autonomiaRestanteKm.toLocaleString("pt-BR")} km` : "-"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {saldoAtualEstimadoLitros !== null ? `Saldo: ${saldoAtualEstimadoLitros.toFixed(0)} L` : "Configure saldo inicial"}
                          {kmRestanteAutomatico > 0 ? ` · ${kmRestanteAutomatico.toLocaleString("pt-BR")} km restantes na rota` : ""}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Linha 2 · Performance */}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-0.5 pt-1">Performance</p>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Progresso da rota */}
                    <Card className="border-border/60 shadow-sm py-2 gap-0 col-span-2">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Progresso da rota</p>
                          <span className="text-[11px] font-semibold text-foreground">{progressoRotaPercent.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              progressoRotaPercent >= 80 ? "bg-emerald-500" : progressoRotaPercent >= 40 ? "bg-blue-500" : "bg-slate-400"
                            }`}
                            style={{ width: `${progressoRotaPercent}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {kmPercorrido > 0 ? `${kmPercorrido.toLocaleString("pt-BR")} km percorridos` : "Sem dados de km"}
                          {kmPlanejado > 0 ? ` / ${kmPlanejado.toLocaleString("pt-BR")} km planejados` : ""}
                        </p>
                      </CardContent>
                    </Card>
                    {/* Eficiência de movimento */}
                    <Card className="border-border/60 shadow-sm py-2 gap-0">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Em movimento</p>
                        <p className="text-2xl font-bold text-foreground">
                          {eficienciaMovimentoPercent !== null ? `${eficienciaMovimentoPercent}%` : "-"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Parado: {formatDurationByUnit(tempoTotalParadoMin)}</p>
                      </CardContent>
                    </Card>
                    {/* Eventos cumpridos */}
                    <Card className="border-border/60 shadow-sm py-2 gap-0">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Eventos</p>
                        <p className="text-2xl font-bold text-foreground">
                          {eventosRealizados.length} <span className="text-base font-normal text-muted-foreground">/ {eventosRealizados.length + eventosPlanejados.length}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {eventosConformidadePercent !== null ? `${eventosConformidadePercent}% realizados` : "Sem eventos"}
                        </p>
                      </CardContent>
                    </Card>
                    {/* Km/l */}
                    <Card className="border-border/60 shadow-sm py-2 gap-0">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Km/L real</p>
                        <p className="text-2xl font-bold text-foreground">
                          {kmPorLitroCiclo !== null ? kmPorLitroCiclo.toFixed(2) : "-"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Meta: {consumoMedioEditavel > 0 ? consumoMedioEditavel.toFixed(2) : "-"}
                        </p>
                      </CardContent>
                    </Card>
                    {/* Carregamento */}
                    <Card className="border-border/60 shadow-sm py-2 gap-0">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Carregamento</p>
                        <p className="text-base font-bold text-foreground leading-tight">
                          {formatDurationByUnit(tempoCarregamentoRealMin)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Plan.: {formatDurationByUnit(tempoCarregamentoPlanejadoMin)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Linha 3 · Financeiro */}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-0.5 pt-1">Financeiro</p>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Receita */}
                    <Card className="border-border/60 shadow-sm py-2 gap-0">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Receita</p>
                        <p className="text-lg font-bold text-emerald-700">{formatCurrency(receitaTotal)}</p>
                        <p className="text-[11px] text-muted-foreground">Frete: {formatCurrency(receitaFrete)}</p>
                      </CardContent>
                    </Card>
                    {/* Custo */}
                    <Card className="border-border/60 shadow-sm py-2 gap-0">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Custo acum.</p>
                        <p className="text-lg font-bold text-red-700">{formatCurrency(custosTotal)}</p>
                        <p className="text-[11px] text-muted-foreground">Diesel: {formatCurrency(abastecimentosResumo.custo)}</p>
                      </CardContent>
                    </Card>
                    {/* Margem */}
                    <Card className={`border shadow-sm py-2 gap-0 ${lucro < 0 ? "ring-1 ring-red-300 border-red-200" : "border-border/60"}`}>
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Margem est.</p>
                        <p className={`text-lg font-bold ${lucro >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                          {lucro >= 0 ? "+" : ""}{margem.toFixed(1)}%
                        </p>
                        <p className="text-[11px] text-muted-foreground">{formatCurrency(lucro)}</p>
                      </CardContent>
                    </Card>
                    {/* Custo/km */}
                    <Card className="border-border/60 shadow-sm py-2 gap-0">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">R$/km</p>
                        <p className="text-lg font-bold text-foreground">
                          {custoPorKm > 0 ? formatCurrency(custoPorKm) : "-"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{kmTotalCiclo > 0 ? `${kmTotalCiclo.toLocaleString("pt-BR")} km` : "Sem km"}</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>


            </div>

            <div className="space-y-2 xl:col-span-2 xl:max-w-[320px] xl:sticky xl:top-2 xl:self-start">
              {/* Indicadores compactos no canto direito */}
              <Card className="border-border/60 shadow-sm py-2 gap-1">
                <CardContent className="p-2 sm:p-2.5 space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Financeiro</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border/60 p-2">
                      <p className="text-[10px] text-muted-foreground">Receita</p>
                      <p className="text-sm sm:text-base font-bold text-emerald-700 leading-tight break-all">{formatCurrency(receitaTotal)}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-2">
                      <p className="text-[10px] text-muted-foreground">Custo</p>
                      <p className="text-sm sm:text-base font-bold text-red-700 leading-tight break-all">{formatCurrency(custosTotal)}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-2">
                      <p className="text-[10px] text-muted-foreground">Margem</p>
                      <p className={`text-sm sm:text-base font-bold leading-tight ${lucro >= 0 ? "text-emerald-700" : "text-red-700"}`}>{lucro >= 0 ? "+" : ""}{margem.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-2">
                      <p className="text-[10px] text-muted-foreground">R$/km</p>
                      <p className="text-sm sm:text-base font-bold leading-tight break-words">{custoPorKm > 0 ? formatCurrency(custoPorKm) : "-"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm py-2 gap-1">
                <CardContent className="p-2 sm:p-2.5 space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Abastecimento</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border/60 p-2">
                      <p className="text-[10px] text-muted-foreground">Consumo km/L</p>
                      <p className="text-sm sm:text-base font-bold leading-tight break-words">{kmPorLitroCiclo !== null ? `${kmPorLitroCiclo.toFixed(2)} km/L` : "-"}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-2">
                      <p className="text-[10px] text-muted-foreground">Litros abastecidos</p>
                      <p className="text-sm sm:text-base font-bold leading-tight break-words">{abastecimentosResumo.litros > 0 ? `${abastecimentosResumo.litros.toFixed(2)} L` : "-"}</p>
                    </div>
                    <div className="sm:col-span-2 rounded-lg border border-border/60 p-2">
                      <p className="text-[10px] text-muted-foreground">Valor total abastecido</p>
                      <p className="text-sm sm:text-base font-bold text-red-700 leading-tight break-all">{abastecimentosResumo.custo > 0 ? formatCurrency(abastecimentosResumo.custo) : "-"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm py-2 gap-1">
                <CardContent className="p-2 sm:p-2.5 space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Performance</p>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="rounded-lg border border-border/60 p-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-muted-foreground">Progresso da rota</p>
                        <span className="text-[11px] font-semibold">{progressoRotaPercent.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${progressoRotaPercent}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>{kmPercorrido > 0 ? `${kmPercorrido.toLocaleString("pt-BR")} km percorridos` : "0 km percorridos"}</span>
                        <span>{kmRestanteAutomatico > 0 ? `${kmRestanteAutomatico.toLocaleString("pt-BR")} km restantes` : "0 km restantes"}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-1"><CardTitle className="text-lg">Ações rápidas</CardTitle></CardHeader>
                <CardContent className="space-y-2 pt-0 pb-3">
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
                  {/* NOVO: Botão único para abrir modal de ações rápidas */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start font-semibold"
                    onClick={() => {
                      setQuickActionsModalOpen(true)
                      setQuickActionStep('list')
                      setSelectedQuickAction(null)
                      setTipoParadaSelecionado('carga')
                      setDocumentacaoQuickActionFile(null)
                      setDocumentacaoQuickActionPreview('')
                    }}
                    disabled={loading || !temViagemAbertaParaRegistro}
                  >
                    Ações rápidas
                  </Button>

                  {/* Modal de ações rápidas em estilo wizard/tab horizontal */}
                  <Dialog open={quickActionsModalOpen} onOpenChange={(open) => {
                    setQuickActionsModalOpen(open)
                    if (!open) {
                      setTipoParadaSelecionado('carga')
                      setDocumentacaoQuickActionFile(null)
                      setDocumentacaoQuickActionPreview('')
                    }
                  }}>
                    <DialogContent className={`!gap-0 overflow-hidden border-border/60 bg-gradient-to-br from-background via-background to-slate-50 !p-0 shadow-2xl ${activeTimelineEvent ? "ring-2 ring-amber-300/80" : ""}`} style={{ maxWidth: '1280px', width: '96%', height: '84vh', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                        <DialogHeader className="shrink-0 border-b border-border/60 bg-gradient-to-r from-slate-50 via-background to-slate-100 px-6 pb-3 pt-5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <DialogTitle className="text-2xl font-bold tracking-tight">Ações rápidas</DialogTitle>
                                {activeTimelineEvent ? (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">Modo edição</Badge>
                                ) : null}
                              </div>
                              {activeTimelineEvent ? (
                                <p className="text-sm text-muted-foreground">
                                  Editando evento da {opcoesViagemRegistros.find((item) => item.id === activeTimelineEvent.viagem_id)?.sequencia
                                    ? `Viagem ${opcoesViagemRegistros.find((item) => item.id === activeTimelineEvent.viagem_id)?.sequencia}`
                                    : "viagem selecionada"}
                                </p>
                              ) : (
                                <p className="text-sm text-muted-foreground">Novo lançamento rápido para a viagem selecionada.</p>
                              )}
                            </div>
                            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-2 text-right">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">Viagem ativa</p>
                              <p className="text-sm font-semibold text-foreground">
                                {viagemAtivaNoModalSequencia
                                  ? `Viagem ${viagemAtivaNoModalSequencia}`
                                  : "Selecione uma viagem"}
                              </p>
                            </div>
                          </div>
                        </DialogHeader>
                        {/* Abas fixas no topo */}
                        <div className="shrink-0 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
                          <div className="flex justify-center gap-2 overflow-x-auto rounded-2xl bg-slate-100/80 p-1.5 text-sm font-semibold shadow-inner">
                          {smartQuickActions.map(({ label, action }) => (
                            <button
                              key={action.title}
                              type="button"
                              className={`rounded-xl px-4 py-2 transition-all whitespace-nowrap text-sm ${selectedQuickAction?.title === action.title ? 'bg-background text-primary font-bold shadow-sm ring-1 ring-primary/15' : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'}`}
                              onClick={() => setSelectedQuickAction(action)}
                              disabled={loading || !temViagemAbertaParaRegistro}
                            >
                              {label}
                            </button>
                          ))}
                          </div>
                        </div>
                        {/* Corpo do formulário com rolagem interna */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                          <div style={{ width: '100%', maxWidth: '1020px', margin: '0 auto' }}>
                            {selectedQuickAction && selectedQuickAction.type === 'abastecimento' && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="md:col-span-2 border-b pb-2 mb-2">
                                  <h3 className="text-xs font-bold text-primary">1. CONTEXTO NO CLIENTE</h3>
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Data/Hora chegada cliente</Label>
                                  <Input type="datetime-local" className="text-sm" value={abastecimentoForm.chegada_cliente_em} onChange={e => setAbastecimentoForm(f => ({ ...f, chegada_cliente_em: e.target.value }))} />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Data/Hora partida cliente</Label>
                                  <Input type="datetime-local" className="text-sm" value={abastecimentoForm.partida_cliente_em} onChange={e => setAbastecimentoForm(f => ({ ...f, partida_cliente_em: e.target.value }))} />
                                </div>

                                <div className="md:col-span-2 border-b pb-2 mb-2 mt-2">
                                  <h3 className="text-xs font-bold text-primary">2. Data e hora do evento</h3>
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Data/Hora Início *</Label>
                                  <Input type="datetime-local" className="text-sm" value={abastecimentoForm.inicio_em} onChange={e => setAbastecimentoForm(f => ({ ...f, inicio_em: e.target.value }))} required />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Data/Hora Fim</Label>
                                  <Input type="datetime-local" className="text-sm" value={abastecimentoForm.fim_em} onChange={e => setAbastecimentoForm(f => ({ ...f, fim_em: e.target.value }))} />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Local (cidade/posto) *</Label>
                                  <Input className="text-sm" value={abastecimentoForm.local} onChange={e => setAbastecimentoForm(f => ({ ...f, local: e.target.value }))} placeholder="Ex: Aurora/PA" required />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Motorista</Label>
                                  <Select value={abastecimentoForm.motorista} onValueChange={v => setAbastecimentoForm(f => ({ ...f, motorista: v }))}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue placeholder="Selecione um motorista" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="">Nenhum</SelectItem>
                                      {motoristasCadastro.map((m) => (
                                        <SelectItem key={m.id} value={m.nome || ""}>{m.nome}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="md:col-span-2 border-b pb-2 mb-2 mt-2">
                                  <h3 className="text-xs font-bold text-primary">3. Dados do abastecimento</h3>
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Hodômetro (km) *</Label>
                                  <Input type="number" className="text-sm" value={abastecimentoForm.hodometro} onChange={e => setAbastecimentoForm(f => ({ ...f, hodometro: e.target.value }))} placeholder="245890" required />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Horímetro</Label>
                                  <Input type="number" step="0.01" className="text-sm" value={abastecimentoForm.horimetro} onChange={e => setAbastecimentoForm(f => ({ ...f, horimetro: e.target.value }))} placeholder="Ex: 3120.5" />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Tanque cheio? *</Label>
                                  <Select value={abastecimentoForm.tanque_cheio} onValueChange={v => setAbastecimentoForm(f => ({ ...f, tanque_cheio: v as 'sim' | 'nao' }))}>
                                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="nao">Não</SelectItem>
                                      <SelectItem value="sim">✅ Sim</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="md:col-span-2 border-b pb-2 mb-2 mt-2">
                                  <h3 className="text-xs font-bold text-primary">4. COMBUSTÍVEIS E PREÇOS</h3>
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Litros abastecidos – Cavalo *</Label>
                                  <Input type="number" step="0.01" className="text-sm" value={abastecimentoForm.litros_cavalo} onChange={e => setAbastecimentoForm(f => ({ ...f, litros_cavalo: e.target.value }))} placeholder="450" required />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Valor por litro - Cavalo *</Label>
                                  <Input type="number" step="0.01" className="text-sm" value={abastecimentoForm.valor_litro_cavalo} onChange={e => setAbastecimentoForm(f => ({ ...f, valor_litro_cavalo: e.target.value }))} placeholder="Ex: 6.49" required />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Litros abastecidos – Thermo King</Label>
                                  <Input type="number" step="0.01" className="text-sm" value={abastecimentoForm.litros_thermo_king} onChange={e => setAbastecimentoForm(f => ({ ...f, litros_thermo_king: e.target.value }))} placeholder="0" />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Valor por litro - Thermo King</Label>
                                  <Input type="number" step="0.01" className="text-sm" value={abastecimentoForm.valor_litro_thermo_king} onChange={e => setAbastecimentoForm(f => ({ ...f, valor_litro_thermo_king: e.target.value }))} placeholder="Ex: 6.49" />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Abasteceu ARLA? (Sim/Não)</Label>
                                  <Select value={abastecimentoForm.abasteceu_arla} onValueChange={v => setAbastecimentoForm(f => ({ ...f, abasteceu_arla: v as 'sim' | 'nao' }))}>
                                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="nao">Não</SelectItem>
                                      <SelectItem value="sim">Sim</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {abastecimentoForm.abasteceu_arla === 'sim' && (
                                  <>
                                    <div>
                                      <Label className="text-xs font-semibold">Litros ARLA</Label>
                                      <Input type="number" step="0.01" className="text-sm" value={abastecimentoForm.litros_arla} onChange={e => setAbastecimentoForm(f => ({ ...f, litros_arla: e.target.value }))} placeholder="0.00" />
                                    </div>
                                    <div>
                                      <Label className="text-xs font-semibold">Valor por litro - ARLA</Label>
                                      <Input type="number" step="0.01" className="text-sm" value={abastecimentoForm.valor_litro_arla} onChange={e => setAbastecimentoForm(f => ({ ...f, valor_litro_arla: e.target.value }))} placeholder="Ex: 4.80" />
                                    </div>
                                  </>
                                )}

                                <div className="md:col-span-2 border-b pb-2 mb-2 mt-2">
                                  <h3 className="text-xs font-bold text-primary">5. PAGAMENTO</h3>
                                </div>
                                <div className="md:col-span-2">
                                  <Label className="text-xs font-semibold">Método de pagamento</Label>
                                  <Select value={abastecimentoForm.forma_pagamento} onValueChange={v => setAbastecimentoForm(f => ({ ...f, forma_pagamento: v }))}>
                                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {metodosPagamentoBrasil.map((metodo) => (
                                        <SelectItem key={`abastecimento-${metodo}`} value={metodo}>{metodo}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="md:col-span-2 border-b pb-2 mb-2 mt-2">
                                  <h3 className="text-xs font-bold text-primary">6. RESUMO FINANCEIRO</h3>
                                </div>
                                <div className="md:col-span-2 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/60 p-4 shadow-sm">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Resumo financeiro</p>
                                      <h4 className="text-lg font-semibold text-foreground">Valor total calculado automaticamente</h4>
                                      <p className="text-sm text-muted-foreground">O total soma Cavalo, Thermo King e ARLA com base nos litros e no preco por litro.</p>
                                    </div>
                                    <div className="rounded-2xl bg-emerald-700 px-4 py-3 text-right text-white shadow-sm">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100">Total</p>
                                      <p className="text-3xl font-bold leading-none">{formatCurrency(abastecimentoResumoFinanceiro.total)}</p>
                                    </div>
                                  </div>
                                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                                    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cavalo</p>
                                      <p className="mt-1 text-lg font-semibold">{formatCurrency(abastecimentoResumoFinanceiro.subtotalCavalo)}</p>
                                      <p className="text-xs text-muted-foreground">{abastecimentoResumoFinanceiro.litrosCavalo.toFixed(2)} L x {formatCurrency(abastecimentoResumoFinanceiro.valorLitroCavalo)}</p>
                                    </div>
                                    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Thermo King</p>
                                      <p className="mt-1 text-lg font-semibold">{formatCurrency(abastecimentoResumoFinanceiro.subtotalThermoKing)}</p>
                                      <p className="text-xs text-muted-foreground">{abastecimentoResumoFinanceiro.litrosThermoKing.toFixed(2)} L x {formatCurrency(abastecimentoResumoFinanceiro.valorLitroThermoKing)}</p>
                                    </div>
                                    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ARLA</p>
                                      <p className="mt-1 text-lg font-semibold">{formatCurrency(abastecimentoResumoFinanceiro.subtotalArla)}</p>
                                      <p className="text-xs text-muted-foreground">{abastecimentoResumoFinanceiro.litrosArla.toFixed(2)} L x {formatCurrency(abastecimentoResumoFinanceiro.valorLitroArla)}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            {selectedQuickAction && selectedQuickAction.type === 'ocorrencia' && selectedQuickAction.title !== 'Documentação' && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs font-semibold">Data/Hora</Label>
                                  <Input type="datetime-local" className="text-sm" value={eventForm.inicio_em} onChange={e => setEventForm(f => ({ ...f, inicio_em: e.target.value }))} required />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Local</Label>
                                  <Input className="text-sm" value={eventForm.local} onChange={e => setEventForm(f => ({ ...f, local: e.target.value }))} required />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Categoria</Label>
                                  <Input className="text-sm" value={ocorrenciaForm.categoria} onChange={e => setOcorrenciaForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ex: Acidente, Pane" required />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Severidade</Label>
                                  <Select value={ocorrenciaForm.severidade} onValueChange={v => setOcorrenciaForm(f => ({ ...f, severidade: v }))}>
                                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="baixa">Baixa</SelectItem>
                                      <SelectItem value="media">Média</SelectItem>
                                      <SelectItem value="alta">Alta</SelectItem>
                                      <SelectItem value="critica">Crítica</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Houve Parada?</Label>
                                  <Select value={ocorrenciaForm.houve_parada} onValueChange={v => setOcorrenciaForm(f => ({ ...f, houve_parada: v }))}>
                                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="nao">Não</SelectItem>
                                      <SelectItem value="sim">Sim</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {ocorrenciaForm.houve_parada === 'sim' && (
                                  <div>
                                    <Label className="text-xs font-semibold">Tempo Parado (min)</Label>
                                    <Input type="number" className="text-sm" value={ocorrenciaForm.tempo_parado_min} onChange={e => setOcorrenciaForm(f => ({ ...f, tempo_parado_min: e.target.value }))} />
                                  </div>
                                )}
                                <div className="md:col-span-2">
                                  <Label className="text-xs font-semibold">Observação</Label>
                                  <Textarea className="text-sm" rows={2} value={eventForm.observacao} onChange={e => setEventForm(f => ({ ...f, observacao: e.target.value }))} />
                                </div>
                                <div className="md:col-span-2">
                                  <Label className="text-xs font-semibold">Ação Imediata</Label>
                                  <Textarea className="text-sm" rows={2} value={ocorrenciaForm.acao_imediata} onChange={e => setOcorrenciaForm(f => ({ ...f, acao_imediata: e.target.value }))} />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Responsável Ação</Label>
                                  <Input className="text-sm" value={ocorrenciaForm.responsavel_acao} onChange={e => setOcorrenciaForm(f => ({ ...f, responsavel_acao: e.target.value }))} />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Contato</Label>
                                  <Input className="text-sm" value={ocorrenciaForm.contato} onChange={e => setOcorrenciaForm(f => ({ ...f, contato: e.target.value }))} placeholder="Telefone/Email" />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Prazo Solução</Label>
                                  <Input type="datetime-local" className="text-sm" value={ocorrenciaForm.prazo_solucao} onChange={e => setOcorrenciaForm(f => ({ ...f, prazo_solucao: e.target.value }))} />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold">Protocolo</Label>
                                  <Input className="text-sm" value={ocorrenciaForm.protocolo} onChange={e => setOcorrenciaForm(f => ({ ...f, protocolo: e.target.value }))} placeholder="Número de protocolo" />
                                </div>
                              </div>
                            )}
                            {quickActionPartidaChegadaAtiva && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                  <Label className="text-xs font-semibold">Origem</Label>
                                  <Input
                                    className="text-sm"
                                    value={eventForm.origem || viagemState.origem_real || (viagemState.rota?.origem_cidade && viagemState.rota?.origem_estado ? `${viagemState.rota.origem_cidade}/${viagemState.rota.origem_estado}` : "") || ""}
                                    onChange={e => setEventForm(f => ({ ...f, origem: e.target.value }))}
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <Label className="text-xs font-semibold">Destino</Label>
                                  <Input
                                    className="text-sm"
                                    value={eventForm.destino || viagemState.destino_real || (viagemState.rota?.destino_cidade && viagemState.rota?.destino_estado ? `${viagemState.rota.destino_cidade}/${viagemState.rota.destino_estado}` : "") || ""}
                                    onChange={e => setEventForm(f => ({ ...f, destino: e.target.value }))}
                                  />
                                </div>
                                <div className="md:col-span-1">
                                  <Label className="text-xs font-semibold">Data/Hora partida</Label>
                                  <Input
                                    type="datetime-local"
                                    className="text-sm"
                                    value={eventForm.inicio_em}
                                    onChange={e => setEventForm(f => ({ ...f, inicio_em: e.target.value }))}
                                    required
                                  />
                                </div>
                                <div className="md:col-span-1">
                                  <Label className="text-xs font-semibold">Data/Hora chegada</Label>
                                  <Input
                                    type="datetime-local"
                                    className="text-sm"
                                    value={eventForm.fim_em}
                                    onChange={e => setEventForm(f => ({ ...f, fim_em: e.target.value }))}
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <Label className="text-xs font-semibold">Observação</Label>
                                  <Textarea
                                    className="text-sm"
                                    rows={3}
                                    value={eventForm.observacao}
                                    onChange={e => setEventForm(f => ({ ...f, observacao: e.target.value }))}
                                  />
                                </div>
                              </div>
                            )}
                            {selectedQuickAction && selectedQuickAction.type === 'parada' && (
                              <div className="space-y-4">
                                <div className="rounded-2xl border border-border/60 bg-white/90 p-4 shadow-sm">
                                  <div className="border-b border-border/60 pb-3 mb-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Parada operacional</p>
                                    <h3 className="text-lg font-semibold text-foreground">Lançamento de parada</h3>
                                    <p className="text-sm text-muted-foreground">Organize o registro com tipo, janela operacional e contexto do local.</p>
                                  </div>

                                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                      <div className="xl:col-span-1">
                                        <Label className="text-xs font-semibold">Tipo de Parada *</Label>
                                        <Select value={tipoParadaSelecionado} onValueChange={v => setTipoParadaSelecionado(v as any)}>
                                          <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="carga">Carga</SelectItem>
                                            <SelectItem value="descarga">Descarga</SelectItem>
                                            <SelectItem value="descanso">Descanso</SelectItem>
                                            <SelectItem value="parada_operacional">Parada Operacional</SelectItem>
                                            <SelectItem value="ocorrencia">Ocorrência</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="md:col-span-1 xl:col-span-1">
                                        <Label className="text-xs font-semibold">Data/Hora início</Label>
                                        <Input type="datetime-local" className="mt-1 text-sm" value={eventForm.inicio_em} onChange={e => setEventForm(f => ({ ...f, inicio_em: e.target.value }))} required />
                                      </div>
                                      <div className="md:col-span-1 xl:col-span-1">
                                        <Label className="text-xs font-semibold">Data/Hora fim</Label>
                                        <Input type="datetime-local" className="mt-1 text-sm" value={eventForm.fim_em} onChange={e => setEventForm(f => ({ ...f, fim_em: e.target.value }))} />
                                      </div>
                                      <div className="md:col-span-2 xl:col-span-3">
                                        <Label className="text-xs font-semibold">Local</Label>
                                        <Input className="mt-1 text-sm" value={eventForm.local} onChange={e => setEventForm(f => ({ ...f, local: e.target.value }))} placeholder="Ex: Cliente, pátio, posto, base operacional" required />
                                      </div>
                                      {(tipoParadaSelecionado === 'carga' || tipoParadaSelecionado === 'descarga') && (
                                        <>
                                          <div className="md:col-span-1 xl:col-span-1">
                                            <Label className="text-xs font-semibold">Chegada no cliente</Label>
                                            <Input type="datetime-local" className="mt-1 text-sm" value={eventForm.chegada_cliente_em || ""} onChange={e => setEventForm(f => ({ ...f, chegada_cliente_em: e.target.value }))} />
                                          </div>
                                          <div className="md:col-span-1 xl:col-span-1">
                                            <Label className="text-xs font-semibold">Partida no cliente</Label>
                                            <Input type="datetime-local" className="mt-1 text-sm" value={eventForm.partida_cliente_em || ""} onChange={e => setEventForm(f => ({ ...f, partida_cliente_em: e.target.value }))} />
                                          </div>
                                        </>
                                      )}
                                      <div className="md:col-span-2 xl:col-span-3">
                                        <Label className="text-xs font-semibold">Observação</Label>
                                        <Textarea className="mt-1 text-sm" rows={4} value={eventForm.observacao} onChange={e => setEventForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Detalhe o motivo, a operação executada ou qualquer contexto relevante." />
                                      </div>
                                    </div>
                                  </div>

                                {tipoParadaSelecionado === 'ocorrencia' && (
                                  <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 shadow-sm">
                                    <div className="border-b border-amber-200/70 pb-3">
                                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Ocorrência vinculada</p>
                                      <h4 className="text-lg font-semibold text-foreground">Detalhamento da ocorrência</h4>
                                    </div>
                                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                      <div>
                                        <Label className="text-xs font-semibold">Categoria</Label>
                                        <Input className="mt-1 text-sm" value={ocorrenciaForm.categoria} onChange={e => setOcorrenciaForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ex: Acidente, Pane" required />
                                      </div>
                                      <div>
                                        <Label className="text-xs font-semibold">Severidade</Label>
                                        <Select value={ocorrenciaForm.severidade} onValueChange={v => setOcorrenciaForm(f => ({ ...f, severidade: v }))}>
                                          <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="baixa">Baixa</SelectItem>
                                            <SelectItem value="media">Média</SelectItem>
                                            <SelectItem value="alta">Alta</SelectItem>
                                            <SelectItem value="critica">Crítica</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label className="text-xs font-semibold">Houve Parada?</Label>
                                        <Select value={ocorrenciaForm.houve_parada} onValueChange={v => setOcorrenciaForm(f => ({ ...f, houve_parada: v }))}>
                                          <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="nao">Não</SelectItem>
                                            <SelectItem value="sim">Sim</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label className="text-xs font-semibold">Tempo Parado (min)</Label>
                                        <Input type="number" className="mt-1 text-sm" value={ocorrenciaForm.tempo_parado_min} onChange={e => setOcorrenciaForm(f => ({ ...f, tempo_parado_min: e.target.value }))} placeholder="Ex: 45" />
                                      </div>
                                      <div className="md:col-span-2 xl:col-span-2">
                                        <Label className="text-xs font-semibold">Ação imediata</Label>
                                        <Textarea className="mt-1 text-sm" rows={3} value={ocorrenciaForm.acao_imediata} onChange={e => setOcorrenciaForm(f => ({ ...f, acao_imediata: e.target.value }))} placeholder="O que foi feito imediatamente para conter ou resolver a situação." />
                                      </div>
                                      <div>
                                        <Label className="text-xs font-semibold">Responsável</Label>
                                        <Input className="mt-1 text-sm" value={ocorrenciaForm.responsavel_acao} onChange={e => setOcorrenciaForm(f => ({ ...f, responsavel_acao: e.target.value }))} placeholder="Nome do responsável" />
                                      </div>
                                      <div>
                                        <Label className="text-xs font-semibold">Contato</Label>
                                        <Input className="mt-1 text-sm" value={ocorrenciaForm.contato} onChange={e => setOcorrenciaForm(f => ({ ...f, contato: e.target.value }))} placeholder="Telefone ou e-mail" />
                                      </div>
                                      <div>
                                        <Label className="text-xs font-semibold">Prazo solução</Label>
                                        <Input type="datetime-local" className="mt-1 text-sm" value={ocorrenciaForm.prazo_solucao} onChange={e => setOcorrenciaForm(f => ({ ...f, prazo_solucao: e.target.value }))} />
                                      </div>
                                      <div>
                                        <Label className="text-xs font-semibold">Protocolo</Label>
                                        <Input className="mt-1 text-sm" value={ocorrenciaForm.protocolo} onChange={e => setOcorrenciaForm(f => ({ ...f, protocolo: e.target.value }))} placeholder="Número de protocolo" />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            {selectedQuickAction && selectedQuickAction.type === 'manutencao' && (
                              <div className="space-y-4">
                                <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] to-background px-3 py-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-semibold text-foreground">Lançamento de manutenção</p>
                                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                      <Badge variant="secondary" className="rounded-full">Obrigatórios: Data/Hora, Local, Tipo</Badge>
                                      <Badge variant="outline" className="rounded-full font-semibold">
                                        {formatCurrency(parseDecimalInput(manutencaoForm.valor_total || "0"))}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-xl border bg-card p-3">
                                  <h3 className="mb-3 border-b pb-2 text-xs font-bold tracking-wide text-primary">1. CONTEXTO OPERACIONAL</h3>
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div>
                                      <Label className="text-xs font-semibold">Data/Hora *</Label>
                                      <Input
                                        type="datetime-local"
                                        className="mt-1 text-sm"
                                        value={manutencaoForm.inicio_em}
                                        onChange={e => setManutencaoForm(f => ({ ...f, inicio_em: e.target.value }))}
                                        required
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs font-semibold">Tipo de Manutenção *</Label>
                                      <Select value={manutencaoForm.tipo_manutencao} onValueChange={v => setManutencaoForm(f => ({ ...f, tipo_manutencao: v as any }))}>
                                        <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="preventiva">Preventiva</SelectItem>
                                          <SelectItem value="corretiva">Corretiva</SelectItem>
                                          <SelectItem value="pneus">Pneus</SelectItem>
                                          <SelectItem value="eletrica">Elétrica</SelectItem>
                                          <SelectItem value="motor">Motor</SelectItem>
                                          <SelectItem value="freios">Freios</SelectItem>
                                          <SelectItem value="suspensao">Suspensão</SelectItem>
                                          <SelectItem value="thermo_king">Thermo King</SelectItem>
                                          <SelectItem value="outro">Outro</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="md:col-span-2">
                                      <Label className="text-xs font-semibold">Local *</Label>
                                      <Input
                                        className="mt-1 text-sm"
                                        value={manutencaoForm.local}
                                        onChange={e => setManutencaoForm(f => ({ ...f, local: e.target.value }))}
                                        placeholder="Ex: Oficina Central - Xinguara"
                                        required
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-xl border bg-card p-3">
                                  <h3 className="mb-3 border-b pb-2 text-xs font-bold tracking-wide text-primary">2. CUSTO E CONTROLE</h3>
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div>
                                      <Label className="text-xs font-semibold">Hodômetro</Label>
                                      <Input
                                        type="number"
                                        inputMode="numeric"
                                        className="mt-1 text-sm"
                                        value={manutencaoForm.hodometro}
                                        onChange={e => setManutencaoForm(f => ({ ...f, hodometro: e.target.value }))}
                                        placeholder="Ex: 150000"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs font-semibold">Valor Total</Label>
                                      <Input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        className="mt-1 text-sm"
                                        value={manutencaoForm.valor_total}
                                        onChange={e => setManutencaoForm(f => ({ ...f, valor_total: e.target.value }))}
                                        placeholder="Ex: 500.00"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs font-semibold">Nota Fiscal</Label>
                                      <Input
                                        className="mt-1 text-sm"
                                        value={manutencaoForm.nota_fiscal}
                                        onChange={e => setManutencaoForm(f => ({ ...f, nota_fiscal: e.target.value }))}
                                        placeholder="Ex: 123456"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs font-semibold">Método de pagamento</Label>
                                      <Select value={manutencaoForm.forma_pagamento} onValueChange={v => setManutencaoForm(f => ({ ...f, forma_pagamento: v }))}>
                                        <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                        <SelectContent>
                                          {metodosPagamentoBrasil.map((metodo) => (
                                            <SelectItem key={`manutencao-${metodo}`} value={metodo}>{metodo}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-xl border bg-card p-3">
                                  <h3 className="mb-3 border-b pb-2 text-xs font-bold tracking-wide text-primary">3. DESCRIÇÃO DO SERVIÇO</h3>
                                  <div>
                                    <Label className="text-xs font-semibold">Observação</Label>
                                    <Textarea
                                      className="mt-1 text-sm"
                                      rows={4}
                                      value={manutencaoForm.observacao}
                                      onChange={e => setManutencaoForm(f => ({ ...f, observacao: e.target.value }))}
                                      placeholder="Descreva o serviço realizado, peças trocadas e qualquer recomendação para o próximo ciclo."
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                            {selectedQuickAction && selectedQuickAction.title === 'Documentação' && (
                              <div className="space-y-4">
                                <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] to-background px-3 py-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-semibold text-foreground">Entrega de documentação</p>
                                    <Badge variant="secondary" className="rounded-full text-[11px]">Campos obrigatórios: Data/Hora e Local</Badge>
                                  </div>
                                </div>

                                <div className="rounded-xl border bg-card p-3">
                                  <h3 className="mb-3 border-b pb-2 text-xs font-bold tracking-wide text-primary">1. DADOS DA ENTREGA</h3>
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div>
                                      <Label className="text-xs font-semibold">Data/Hora da entrega *</Label>
                                      <Input
                                        type="datetime-local"
                                        className="mt-1 text-sm"
                                        value={eventForm.inicio_em}
                                        onChange={e => setEventForm(f => ({ ...f, inicio_em: e.target.value }))}
                                        required
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs font-semibold">Local *</Label>
                                      <Input
                                        className="mt-1 text-sm"
                                        value={eventForm.local}
                                        onChange={e => setEventForm(f => ({ ...f, local: e.target.value }))}
                                        placeholder="Ex: Cliente X - Recebimento"
                                        required
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-xl border bg-card p-3">
                                  <h3 className="mb-3 border-b pb-2 text-xs font-bold tracking-wide text-primary">2. COMPROVANTE VISUAL</h3>
                                  <div>
                                    <Label className="text-xs font-semibold">Carregamento da imagem</Label>
                                    <Input
                                      type="file"
                                      accept="image/*"
                                      className="mt-1 text-sm"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                          setDocumentacaoQuickActionFile(file)
                                          const reader = new FileReader()
                                          reader.onload = (event) => {
                                            setDocumentacaoQuickActionPreview(event.target?.result as string)
                                          }
                                          reader.readAsDataURL(file)
                                        }
                                      }}
                                    />
                                  </div>
                                  {documentacaoQuickActionPreview && documentacaoQuickActionFile?.type.startsWith('image/') && (
                                    <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                                      <p className="mb-2 text-xs font-semibold text-muted-foreground">Pré-visualização</p>
                                      <img src={documentacaoQuickActionPreview} alt="pré-visualização da documentação" className="max-h-48 w-auto rounded" />
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-xl border bg-card p-3">
                                  <h3 className="mb-3 border-b pb-2 text-xs font-bold tracking-wide text-primary">3. OBSERVAÇÕES</h3>
                                  <div>
                                    <Label className="text-xs font-semibold">Observações</Label>
                                    <Textarea
                                      className="mt-1 text-sm"
                                      rows={4}
                                      value={eventForm.observacao}
                                      onChange={e => setEventForm(f => ({ ...f, observacao: e.target.value }))}
                                      placeholder="Descreva contexto da entrega, recebedor ou ressalvas importantes."
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Botões fixos na base */}
                        <div style={{ borderTop: '1px solid var(--border)', background: 'linear-gradient(180deg, rgba(248,250,252,0.96) 0%, var(--background) 100%)', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexShrink: 0 }}>
                          <div className="flex min-w-[220px] items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setQuickActionsModalOpen(false)}
                              className="min-w-[120px] rounded-xl"
                            >
                              Fechar
                            </Button>
                            {activeTimelineEvent ? (
                              <AlertDialog open={confirmDeleteModalOpen} onOpenChange={setConfirmDeleteModalOpen}>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-xl border-destructive/40 text-destructive hover:text-destructive"
                                    disabled={loading}
                                  >
                                    {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                                    Apagar
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Apagar evento do ciclo?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação remove o evento permanentemente e não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={async (event) => {
                                        event.preventDefault()
                                        await handleDeleteEvent(true)
                                      }}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Confirmar exclusão
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : null}
                          </div>
                          <Button 
                            type="button" 
                            onClick={async () => { 
                              if (!selectedQuickAction) {
                                alert("Selecione uma ação para continuar.")
                                return
                              }
                              await handleSaveEvent()
                              setQuickActionsModalOpen(false)
                            }} 
                            disabled={!selectedQuickAction || loading} 
                            style={{ flex: 1, margin: '0 0.5rem', padding: '0.65rem' }} 
                            className="rounded-xl text-sm font-semibold shadow-sm"
                          >
                            {loading ? "Salvando..." : activeTimelineEvent ? "Salvar alterações" : "Salvar"}
                          </Button>
                          <div className="min-w-[120px] text-right text-xs text-muted-foreground">
                            {selectedQuickAction ? `Aba atual: ${selectedQuickAction.title}` : "Nenhuma aba selecionada"}
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4 min-h-0">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Waterfall do ciclo (média de tempo por evento)</CardTitle>
            </CardHeader>
            <CardContent>
              {waterfallSeriesCiclo.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem eventos suficientes para construir o gráfico.</p>
              ) : (
                <ChartContainer
                  className="h-[260px] sm:h-[300px]"
                  config={{
                    base: { label: "Base", color: "transparent" },
                    valor: { label: "Tempo (min)", color: "var(--color-chart-1)" },
                  }}
                >
                  <BarChart data={waterfallSeriesCiclo} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="etapa" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip
                      content={<ChartTooltipContent formatter={(value) => `${Number(value).toFixed(1)} min`} />}
                    />
                    <Bar dataKey="base" stackId="a" fill="transparent" />
                    <Bar dataKey="valor" stackId="a" radius={[6, 6, 0, 0]}>
                      {waterfallSeriesCiclo.map((item, index) => {
                        const fill = item.etapa === "Total" ? "var(--color-chart-2)" : "var(--color-chart-1)"
                        return <Cell key={index} fill={fill} />
                      })}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <div className={embedded ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"}>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">km/L cavalo</p><p className="text-lg font-semibold leading-tight break-words">{kmPorLitroCiclo !== null ? `${kmPorLitroCiclo.toFixed(2)} km/L` : "A DEFINIR"}</p></CardContent></Card>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">L/h Thermo King</p><p className="text-lg font-semibold leading-tight break-words">{lhThermoKing !== null ? `${lhThermoKing.toFixed(2)} L/h` : "A DEFINIR"}</p></CardContent></Card>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Custo por km</p><p className="text-lg font-semibold leading-tight break-words">{formatCurrency(custoPorKm)}</p></CardContent></Card>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Consumo por motorista</p><p className="text-lg font-semibold leading-tight break-words">{consumoPorMotorista !== null ? `${consumoPorMotorista.toFixed(2)} km/L` : "A DEFINIR"}</p><p className="text-xs text-muted-foreground">{viagemState.motorista?.nome || "Motorista não definido"}</p></CardContent></Card>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Consumo por ciclo</p><p className="text-lg font-semibold leading-tight break-words">{litrosConsumidosCiclo !== null ? `${litrosConsumidosCiclo.toFixed(0)} L` : "A DEFINIR"}</p></CardContent></Card>
            <Card className="border-border/50 transition-colors hover:bg-muted/30"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Consumo entre tanque cheio</p><p className="text-lg font-semibold leading-tight break-words">{consumoEntreTanqueCheio !== null ? `${consumoEntreTanqueCheio.toFixed(2)} km/L` : "A DEFINIR"}</p></CardContent></Card>
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

        </TabsContent>
      </Tabs>

      <Dialog open={novaViagemModalOpen} onOpenChange={setNovaViagemModalOpen}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Iniciar nova viagem do ciclo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => setShowNovaViagemAdvanced((prev) => !prev)}>
                {showNovaViagemAdvanced ? "Ocultar campos avançados" : "Mostrar campos avançados"}
              </Button>
            </div>

            <div className="grid gap-2">
              <Label>ID do Ciclo</Label>
              <Input
                value={novaViagemForm.ciclo_id}
                onChange={(event) => setNovaViagemForm((prev) => ({ ...prev, ciclo_id: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Use o mesmo ID para agrupar as viagens no mesmo ciclo.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Cliente</Label>
                <Select
                  value={novaViagemForm.cliente_id}
                  onValueChange={(value) => setNovaViagemForm((prev) => ({ ...prev, cliente_id: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {clientesCadastro.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>{cliente.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Status inicial</Label>
                <Input value="Planejada" disabled />
              </div>

              <div className="grid gap-2">
                <Label>Veículo</Label>
                <Select
                  value={novaViagemForm.veiculo_id}
                  onValueChange={(value) => setNovaViagemForm((prev) => ({ ...prev, veiculo_id: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {veiculosCadastro.map((veiculo) => (
                      <SelectItem key={veiculo.id} value={veiculo.id}>{veiculo.placa_cavalo || "Sem placa"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Motorista</Label>
                <Select
                  value={novaViagemForm.motorista_id}
                  onValueChange={(value) => setNovaViagemForm((prev) => ({ ...prev, motorista_id: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {motoristasCadastro.map((motorista) => (
                      <SelectItem key={motorista.id} value={motorista.id}>{motorista.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Rota Planejada</Label>
              <Select
                value={novaViagemForm.rota_id}
                onValueChange={(value) => {
                  const rota = rotasCadastro.find((item) => item.id === value)
                  setNovaViagemForm((prev) => ({
                    ...prev,
                    rota_id: value,
                    origem_real: rota?.origem_cidade && rota?.origem_estado
                      ? `${rota.origem_cidade}/${rota.origem_estado}`
                      : prev.origem_real,
                    destino_real: rota?.destino_cidade && rota?.destino_estado
                      ? `${rota.destino_cidade}/${rota.destino_estado}`
                      : prev.destino_real,
                  }))
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione uma rota ou preencha manualmente" /></SelectTrigger>
                <SelectContent>
                  {rotasCadastro.map((rota) => (
                    <SelectItem key={rota.id} value={rota.id}>{rota.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Origem</Label>
                <Input
                  value={novaViagemForm.origem_real}
                  onChange={(event) => setNovaViagemForm((prev) => ({ ...prev, origem_real: event.target.value }))}
                  placeholder="Cidade/UF"
                />
              </div>
              <div className="grid gap-2">
                <Label>Destino</Label>
                <Input
                  value={novaViagemForm.destino_real}
                  onChange={(event) => setNovaViagemForm((prev) => ({ ...prev, destino_real: event.target.value }))}
                  placeholder="Cidade/UF"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Partida planejada</Label>
                <Input
                  type="datetime-local"
                  value={novaViagemForm.data_inicio}
                  onChange={(event) => setNovaViagemForm((prev) => ({ ...prev, data_inicio: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Chegada planejada</Label>
                <Input
                  type="datetime-local"
                  value={novaViagemForm.data_fim}
                  onChange={(event) => setNovaViagemForm((prev) => ({ ...prev, data_fim: event.target.value }))}
                />
              </div>
            </div>

            {showNovaViagemAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-md border border-border/60 p-3">
                <div className="grid gap-2">
                  <Label>Tipo de carga</Label>
                  <Input
                    value={novaViagemForm.tipo_carga}
                    onChange={(event) => setNovaViagemForm((prev) => ({ ...prev, tipo_carga: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Volume (t)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novaViagemForm.volume_toneladas}
                    onChange={(event) => setNovaViagemForm((prev) => ({ ...prev, volume_toneladas: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Valor frete (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novaViagemForm.valor_frete}
                    onChange={(event) => setNovaViagemForm((prev) => ({ ...prev, valor_frete: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Metodo de pagamento</Label>
                  <Select
                    value={novaViagemForm.forma_pagamento}
                    onValueChange={(value) => setNovaViagemForm((prev) => ({ ...prev, forma_pagamento: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {metodosPagamentoBrasil.map((metodo) => (
                        <SelectItem key={metodo} value={metodo}>{metodo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setNovaViagemModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSalvarNovaViagemModal} disabled={loading}>
                {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                Salvar e iniciar viagem
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                    const ultimoEventoId = realizados[realizados.length - 1]?.id || ""
                    setOperacaoViagemModalOpen(false)
                    await handleFinalizarViagem(ultimoEventoId, viagemOperacaoId)
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
                  const realizados = eventosDaViagemSelecionada.filter((e) => !isEventoPlanejado(e))
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
                  {eventosDaViagemSelecionada
                    .filter((e) => !isEventoPlanejado(e))
                    .map((e, idx) => {
                      const tipo = e.titulo || eventTypeLabels[e.tipo_evento] || e.tipo_evento
                      const local = e.local || "-"
                      const inicio = formatDateTime(e.ocorrido_em)
                      return (
                        <SelectItem key={e.id} value={e.id}>
                          #{idx + 1} · {tipo}{local && local !== "-" ? ` — ${local}` : ""} · {inicio}
                        </SelectItem>
                      )
                    })
                  }
                  {eventosDaViagemSelecionada.filter((e) => !isEventoPlanejado(e)).length === 0 && (
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
                <Label>Origem</Label>
                <Input
                  value={viagemState.origem_real || (viagemState.rota?.origem_cidade && viagemState.rota?.origem_estado ? `${viagemState.rota.origem_cidade}/${viagemState.rota.origem_estado}` : "") || ""}
                  readOnly
                />
              </div>
              <div className="grid gap-2">
                <Label>Destino</Label>
                <Input
                  value={viagemState.destino_real || (viagemState.rota?.destino_cidade && viagemState.rota?.destino_estado ? `${viagemState.rota.destino_cidade}/${viagemState.rota.destino_estado}` : "") || ""}
                  readOnly
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Partida planejada (data/hora)</Label>
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
                <Label>Chegada planejada (data/hora)</Label>
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
                <Label>Origem</Label>
                <Input
                  value={viagemState.origem_real || (viagemState.rota?.origem_cidade && viagemState.rota?.origem_estado ? `${viagemState.rota.origem_cidade}/${viagemState.rota.origem_estado}` : "") || ""}
                  readOnly
                />
              </div>
              <div className="grid gap-2">
                <Label>Destino</Label>
                <Input
                  value={viagemState.destino_real || (viagemState.rota?.destino_cidade && viagemState.rota?.destino_estado ? `${viagemState.rota.destino_cidade}/${viagemState.rota.destino_estado}` : "") || ""}
                  readOnly
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Partida real (data/hora)</Label>
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
                <Label>Chegada real (data/hora)</Label>
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
              <div className="bg-amber-50 border border-amber-200 rounded p-4">
                <p className="text-sm font-semibold text-amber-900 mb-2">⚠️ Aba de Abastecimento em Refatoração</p>
                <p className="text-sm text-amber-800">Esta seção está sendo refatorada para suportar a nova estrutura de abastecimento com Cavalo, Thermo King e ARLA separados. Use a modal de "Ações Rápidas" para registrar abastecimentos.</p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Origem</Label>
                  <Input
                    value={eventForm.origem || ""}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, origem: event.target.value }))}
                  />
                </div>
                <div>
                  <Label>Destino</Label>
                  <Input
                    value={eventForm.destino || ""}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, destino: event.target.value }))}
                  />
                </div>
                <div>
                  <Label>Data/Hora partida</Label>
                  <Input
                    type="datetime-local"
                    value={eventForm.inicio_em}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, inicio_em: event.target.value }))}
                  />
                </div>
                <div>
                  <Label>Data/Hora chegada</Label>
                  <Input
                    type="datetime-local"
                    value={eventForm.fim_em}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, fim_em: event.target.value }))}
                  />
                </div>
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
                <Button type="button" variant="outline" className="border-destructive/40 text-destructive hover:text-destructive" onClick={() => void handleDeleteEvent()} disabled={loading}>
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
                      {normalizeViagemStatus(subViagem.status) === "Concluida" && <Badge variant="secondary" className="ml-2">Fechada</Badge>}
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
