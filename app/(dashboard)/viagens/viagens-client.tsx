"use client"

import React from "react"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ViagemDetalheClient } from "./[viagemId]/viagemDetalheClient"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type {
  Viagem,
  Cliente,
  Veiculo,
  Motorista,
  Rota,
  PontoIntermediario,
  ViagemEvento,
  CustoViagem,
  ReceitaViagem,
  ViagemDocumento,
  EtaParametro,
  ViagemPlanejamentoRota,
  ViagemPlanejamentoIntermediario,
} from "@/lib/types"
import { getPontoParadaTipoLabel } from "@/lib/types"
import { 
  Route, 
  Plus, 
  Search,
  Truck,
  User,
  Users,
  MapPin,
  ArrowRight,
  Calendar,
  DollarSign,
  MoreHorizontal,
  Pencil,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  QuickClienteModal,
  QuickVeiculoModal,
  QuickMotoristaModal,
  QuickRotaModal,
} from "@/components/quick-register-modals"

interface ViagensClientProps {
  initialViagens: Viagem[]
  clientes: Cliente[]
  veiculos: Veiculo[]
  motoristas: Motorista[]
  rotas: Rota[]
}

interface ViagemFormData {
  ciclo_id: string
  cliente_id: string
  veiculo_id: string
  motorista_id: string
  rota_id: string
  rota_avulsa: boolean
  origem_real: string
  destino_real: string
  data_inicio: string
  data_fim: string
  tipo_carga: string
  volume_toneladas: string
  km_real: string
  valor_frete: string
  status: string
  planejamento_rota: ViagemPlanejamentoRota | null
}

const STATUS_OPTIONS = [
  { value: "Planejada", label: "Planejada" },
  { value: "Em andamento", label: "Em andamento" },
  { value: "Concluida", label: "Concluida" },
  { value: "Cancelada", label: "Cancelada" },
]

const statusColors: Record<string, string> = {
  Planejada: "bg-muted text-muted-foreground",
  "Em andamento": "bg-primary/10 text-primary",
  Concluida: "bg-success/10 text-success",
  Cancelada: "bg-destructive/10 text-destructive",
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

type CicloResumo = {
  cicloId: string
  viagens: Viagem[]
  viagemDestaque: Viagem
  statusCiclo: "Planeado" | "Realizado"
  valorTotal: number
  kmTotal: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("pt-BR")
}

function formatPontosIntermediarios(pontos?: PontoIntermediario[] | null) {
  if (!pontos || pontos.length === 0) return null
  return pontos
    .map((ponto) => `${ponto.cidade}/${ponto.estado} (${getPontoParadaTipoLabel(ponto.tipo_parada)})`)
    .join(" • ")
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

function addHoursToIso(baseIso: string, hours: number) {
  const base = new Date(baseIso)
  if (!Number.isFinite(base.getTime()) || !Number.isFinite(hours)) return null
  return new Date(base.getTime() + hours * 60 * 60 * 1000).toISOString()
}

function buildIntermediarioChave(ponto: PontoIntermediario, index: number) {
  const cidade = (ponto.cidade || "").trim().toLowerCase()
  const estado = (ponto.estado || "").trim().toLowerCase()
  return `${index}:${cidade}:${estado}`
}

function buildDefaultCycleId() {
  const now = new Date()
  const year = now.getFullYear()
  const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(4, 14)
  return `CIC-${year}-${stamp}`
}

function buildCycleIdFromTitle(title: string) {
  const slug = title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)

  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(4, 14)
  return `CIC-${slug || "SEM-TITULO"}-${stamp}`
}

function buildPlanejamentoRota(
  rota: Rota,
  existing?: ViagemPlanejamentoRota | null,
): ViagemPlanejamentoRota {
  const existingIntermediarios = new Map(
    (existing?.intermediarios || []).map((item) => [item.chave, item]),
  )

  const origemPartidaPlanejada = existing?.origem_partida_planejada || null

  let cursorPrevisto = origemPartidaPlanejada

  const intermediarios = (rota.pontos_intermediarios || [])
    .filter((ponto) => ponto.cidade && ponto.estado)
    .map((ponto, index): ViagemPlanejamentoIntermediario => {
      const chave = buildIntermediarioChave(ponto, index)
      const current = existingIntermediarios.get(chave)

      const tempoTrechoHoras =
        ponto.tempo_trecho_horas !== undefined && ponto.tempo_trecho_horas !== null
          ? Number(ponto.tempo_trecho_horas)
          : null

      const chegadaPlanejadaAuto =
        !current?.chegada_planejada && cursorPrevisto && tempoTrechoHoras !== null && tempoTrechoHoras >= 0
          ? addHoursToIso(cursorPrevisto, tempoTrechoHoras)
          : null

      const chegadaPlanejada = current?.chegada_planejada || chegadaPlanejadaAuto || null
      const partidaPlanejada = current?.partida_planejada || chegadaPlanejada || null

      if (partidaPlanejada) {
        cursorPrevisto = partidaPlanejada
      }

      return {
        chave,
        cidade: ponto.cidade,
        estado: ponto.estado,
        tipo_parada: ponto.tipo_parada,
        chegada_planejada: chegadaPlanejada,
        partida_planejada: partidaPlanejada,
      }
    })

  const destinoChegadaPlanejadaAuto =
    !existing?.destino_chegada_planejada &&
    origemPartidaPlanejada &&
    rota.tempo_ciclo_esperado_horas !== null &&
    rota.tempo_ciclo_esperado_horas !== undefined
      ? addHoursToIso(origemPartidaPlanejada, Number(rota.tempo_ciclo_esperado_horas))
      : null

  return {
    origem_partida_planejada: origemPartidaPlanejada,
    destino_chegada_planejada: existing?.destino_chegada_planejada || destinoChegadaPlanejadaAuto || null,
    intermediarios,
  }
}

function toFormPlanejamentoRota(value?: ViagemPlanejamentoRota | null) {
  if (!value) return null
  return {
    origem_partida_planejada: toDatetimeLocal(value.origem_partida_planejada),
    destino_chegada_planejada: toDatetimeLocal(value.destino_chegada_planejada),
    intermediarios: (value.intermediarios || []).map((item) => ({
      ...item,
      chegada_planejada: toDatetimeLocal(item.chegada_planejada),
      partida_planejada: toDatetimeLocal(item.partida_planejada),
    })),
  }
}

function toStoragePlanejamentoRota(value?: ViagemPlanejamentoRota | null) {
  if (!value) return null
  return {
    origem_partida_planejada: toIsoOrNull(value.origem_partida_planejada),
    destino_chegada_planejada: toIsoOrNull(value.destino_chegada_planejada),
    intermediarios: (value.intermediarios || []).map((item) => ({
      ...item,
      chegada_planejada: toIsoOrNull(item.chegada_planejada),
      partida_planejada: toIsoOrNull(item.partida_planejada),
    })),
  }
}

export function ViagensClient({ 
  initialViagens, 
  clientes: initialClientes, 
  veiculos: initialVeiculos, 
  motoristas: initialMotoristas, 
  rotas: initialRotas 
}: ViagensClientProps) {
  const [viagens, setViagens] = useState(initialViagens)
  const [clientes, setClientes] = useState(initialClientes)
  const [veiculos, setVeiculos] = useState(initialVeiculos)
  const [motoristas, setMotoristas] = useState(initialMotoristas)
  const [rotas, setRotas] = useState(initialRotas)

  const supabase = createClient()

  // Helper function to fetch viagem with postos
  const fetchViagemWithPostos = async (viagemId: string) => {
    const { data: viagem } = await supabase
      .from("viagens")
      .select("*, cliente:clientes(*), veiculo:veiculos(*), motorista:motoristas(*), rota:rotas(*)")
      .eq("id", viagemId)
      .single()

    if (viagem && viagem.rota_id) {
      const { data: rotaPostos } = await supabase
        .from("rota_postos")
        .select("posto:postos_abastecimento(*), ordem")
        .eq("rota_id", viagem.rota_id)
        .order("ordem")

      if (rotaPostos && viagem.rota) {
        viagem.rota.postos = rotaPostos.map((rp: any) => rp.posto)
      }
    }

    return viagem
  }


  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isNovoCicloDialogOpen, setIsNovoCicloDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedViagem, setSelectedViagem] = useState<Viagem | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreatingCycle, setIsCreatingCycle] = useState(false)
  const [novoCicloTitulo, setNovoCicloTitulo] = useState("")
  const [editCicloTitulo, setEditCicloTitulo] = useState("")
  const [editingCicloId, setEditingCicloId] = useState("")
  const [editingCicloViagemIds, setEditingCicloViagemIds] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("todas")
  const [cockpitOpen, setCockpitOpen] = useState(false)
  const [cockpitLoading, setCockpitLoading] = useState(false)
  const [cockpitData, setCockpitData] = useState<{
    viagem: Viagem
    eventos: ViagemEvento[]
    custos: CustoViagem[]
    receitas: ReceitaViagem[]
    documentos: ViagemDocumento[]
    parametros: EtaParametro[]
  } | null>(null)

  // Quick register modal states
  const [quickClienteOpen, setQuickClienteOpen] = useState(false)
  const [quickVeiculoOpen, setQuickVeiculoOpen] = useState(false)
  const [quickMotoristaOpen, setQuickMotoristaOpen] = useState(false)
  const [quickRotaOpen, setQuickRotaOpen] = useState(false)
  const [showAdvancedForm, setShowAdvancedForm] = useState(false)

  const [formData, setFormData] = useState<ViagemFormData>({
    ciclo_id: buildDefaultCycleId(),
    cliente_id: "",
    veiculo_id: "",
    motorista_id: "",
    rota_id: "",
    rota_avulsa: false,
    origem_real: "",
    destino_real: "",
    data_inicio: "",
    data_fim: "",
    tipo_carga: "",
    volume_toneladas: "",
    km_real: "",
    valor_frete: "",
    status: "Planejada",
    planejamento_rota: null,
  })

  const resetForm = () => {
    setFormData({
      ciclo_id: buildDefaultCycleId(),
      cliente_id: "",
      veiculo_id: "",
      motorista_id: "",
      rota_id: "",
      rota_avulsa: false,
      origem_real: "",
      destino_real: "",
      data_inicio: "",
      data_fim: "",
      tipo_carga: "",
      volume_toneladas: "",
      km_real: "",
      valor_frete: "",
      status: "Planejada",
      planejamento_rota: null,
    })
    setSelectedViagem(null)
    setShowAdvancedForm(false)
  }

  const handleAdd = () => {
    setNovoCicloTitulo("")
    setIsNovoCicloDialogOpen(true)
  }

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault()
    const titulo = novoCicloTitulo.trim()
    if (!titulo) return

    setIsCreatingCycle(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setIsCreatingCycle(false)
      return
    }

    const cicloId = buildCycleIdFromTitle(titulo)
    const nowIso = new Date().toISOString()

    const insertBase = {
      user_id: user.id,
      ciclo_id: cicloId,
      origem_real: null,
      destino_real: null,
      data_inicio: null,
      data_fim: null,
      tipo_carga: titulo,
      status: "Planejada" as Viagem["status"],
      created_at: nowIso,
      updated_at: nowIso,
    }

    const insertCompat = {
      ...insertBase,
    }
    delete (insertCompat as Record<string, unknown>).ciclo_id

    let { data, error } = await supabase
      .from("viagens")
      .insert(insertBase)
      .select("id")
      .single()

    if (error) {
      const errorMsg = error.message?.toLowerCase() || ""
      if (errorMsg.includes("ciclo_id")) {
        const retry = await supabase
          .from("viagens")
          .insert(insertCompat)
          .select("id")
          .single()
        data = retry.data
        error = retry.error
      }
    }

    if (!error && data) {
      const novaViagem = await fetchViagemWithPostos(data.id)
      if (novaViagem) {
        setViagens((prev) => [novaViagem, ...prev])
        setIsNovoCicloDialogOpen(false)
        setNovoCicloTitulo("")
        await handleOpenCockpitModal(novaViagem.id)
      }
    }

    setIsCreatingCycle(false)
  }

  const handleEdit = (ciclo: CicloResumo) => {
    setEditingCicloId(ciclo.cicloId)
    setEditCicloTitulo(ciclo.cicloId)
    setEditingCicloViagemIds(ciclo.viagens.map((item) => item.id))
    setIsDialogOpen(true)
  }

  const handleSaveCycleTitle = async (e: React.FormEvent) => {
    e.preventDefault()
    const titulo = editCicloTitulo.trim()
    if (!titulo || editingCicloViagemIds.length === 0) return

    setIsLoading(true)
    const novoCicloId = buildCycleIdFromTitle(titulo)
    const nowIso = new Date().toISOString()

    const { error } = await supabase
      .from("viagens")
      .update({ ciclo_id: novoCicloId, updated_at: nowIso })
      .in("id", editingCicloViagemIds)

    if (!error) {
      setViagens((prev) =>
        prev.map((item) =>
          editingCicloViagemIds.includes(item.id)
            ? { ...item, ciclo_id: novoCicloId, updated_at: nowIso }
            : item,
        ),
      )
      setIsDialogOpen(false)
      setEditCicloTitulo("")
      setEditingCicloId("")
      setEditingCicloViagemIds([])
    }

    setIsLoading(false)
  }

  const handleDelete = (viagem: Viagem) => {
    setSelectedViagem(viagem)
    setIsDeleteDialogOpen(true)
  }

  const handleStatusChange = async (viagem: Viagem, newStatus: string) => {
    const updates: Record<string, unknown> = { status: newStatus }

    if (newStatus === "Em andamento" && !viagem.data_inicio) {
      updates.data_inicio = new Date().toISOString()
    }
    if (newStatus === "Concluida" && !viagem.data_fim) {
      updates.data_fim = new Date().toISOString()
    }

    const { error } = await supabase
      .from("viagens")
      .update(updates)
      .eq("id", viagem.id)

    if (!error) {
      const updatedViagem = await fetchViagemWithPostos(viagem.id)
      if (updatedViagem) {
        setViagens(viagens.map(v => v.id === viagem.id ? updatedViagem : v))
      }
    }
  }

  const confirmDelete = async () => {
    if (!selectedViagem) return

    const { error } = await supabase
      .from("viagens")
      .delete()
      .eq("id", selectedViagem.id)

    if (!error) {
      setViagens(viagens.filter(v => v.id !== selectedViagem.id))
    }
    setIsDeleteDialogOpen(false)
    setSelectedViagem(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setIsLoading(false)
      return
    }

    const viagemDataBase = {
      ciclo_id: formData.ciclo_id.trim() || null,
      cliente_id: formData.cliente_id || null,
      veiculo_id: formData.veiculo_id || null,
      motorista_id: formData.motorista_id || null,
      rota_id: formData.rota_id || null,
      rota_avulsa: formData.rota_avulsa,
      origem_real: formData.origem_real || null,
      destino_real: formData.destino_real || null,
      data_inicio: formData.data_inicio ? new Date(formData.data_inicio).toISOString() : null,
      data_fim: formData.data_fim ? new Date(formData.data_fim).toISOString() : null,
      tipo_carga: formData.tipo_carga || null,
      volume_toneladas: formData.volume_toneladas ? parseFloat(formData.volume_toneladas) : null,
      km_real: formData.km_real ? parseFloat(formData.km_real) : null,
      valor_frete: formData.valor_frete ? parseFloat(formData.valor_frete) : null,
      status: formData.status as Viagem["status"],
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }

    const viagemData = {
      ...viagemDataBase,
      planejamento_rota: toStoragePlanejamentoRota(formData.planejamento_rota),
    }

    const viagemDataBaseCompat = {
      ...viagemDataBase,
    }

    delete (viagemDataBaseCompat as Record<string, unknown>).ciclo_id

    const viagemDataCompat = {
      ...viagemData,
    }

    delete (viagemDataCompat as Record<string, unknown>).ciclo_id

    if (selectedViagem) {
      let { error } = await supabase
        .from("viagens")
        .update(viagemData)
        .eq("id", selectedViagem.id)

      if (error) {
        const errorMsg = error.message?.toLowerCase() || ""
        if (errorMsg.includes("planejamento_rota") || errorMsg.includes("ciclo_id")) {
          const retry = await supabase
            .from("viagens")
            .update(errorMsg.includes("planejamento_rota") ? viagemDataBaseCompat : viagemDataCompat)
            .eq("id", selectedViagem.id)
          error = retry.error
        }
      }

      if (!error) {
        const updatedViagem = await fetchViagemWithPostos(selectedViagem.id)
        if (updatedViagem) {
          setViagens(viagens.map(v => v.id === selectedViagem.id ? updatedViagem : v))
        }
      }
    } else {
      let { data, error } = await supabase
        .from("viagens")
        .insert(viagemData)
        .select("id")
        .single()

      if (error) {
        const errorMsg = error.message?.toLowerCase() || ""
        if (errorMsg.includes("planejamento_rota") || errorMsg.includes("ciclo_id")) {
          const retry = await supabase
            .from("viagens")
            .insert(errorMsg.includes("planejamento_rota") ? viagemDataBaseCompat : viagemDataCompat)
            .select("id")
            .single()
          data = retry.data
          error = retry.error
        }
      }

      if (!error && data) {
        const newViagem = await fetchViagemWithPostos(data.id)
        if (newViagem) {
          setViagens([newViagem, ...viagens])
        }
      }
    }

    setIsLoading(false)
    setIsDialogOpen(false)
    resetForm()
  }

  const handleRotaSelect = (rotaId: string) => {
    const rota = rotas.find(r => r.id === rotaId)
    if (rota) {
      setFormData(prev => ({
        ...prev,
        rota_id: rotaId,
        origem_real: `${rota.origem_cidade}/${rota.origem_estado}`,
        destino_real: `${rota.destino_cidade}/${rota.destino_estado}`,
        km_real: rota.km_planejado?.toString() || prev.km_real,
        planejamento_rota: buildPlanejamentoRota(rota, prev.planejamento_rota),
      }))
    }
  }

  const updatePlanejamentoIntermediario = (
    index: number,
    field: "chegada_planejada" | "partida_planejada",
    value: string,
  ) => {
    setFormData((prev) => {
      if (!prev.planejamento_rota) return prev

      const intermediarios = [...prev.planejamento_rota.intermediarios]
      const current = intermediarios[index]
      if (!current) return prev

      intermediarios[index] = {
        ...current,
        [field]: value || null,
      }

      return {
        ...prev,
        planejamento_rota: {
          ...prev.planejamento_rota,
          intermediarios,
        },
      }
    })
  }

  const handleOpenCockpitModal = async (viagemId: string) => {
    setCockpitOpen(true)
    setCockpitLoading(true)

    const [viagem, eventosRes, custosRes, receitasRes, documentosRes, parametrosRes] = await Promise.all([
      fetchViagemWithPostos(viagemId),
      supabase
        .from("viagem_eventos")
        .select("*")
        .eq("viagem_id", viagemId)
        .order("ocorrido_em", { ascending: false }),
      supabase
        .from("custos_viagem")
        .select("*")
        .eq("viagem_id", viagemId)
        .order("data", { ascending: false }),
      supabase
        .from("receitas_viagem")
        .select("*")
        .eq("viagem_id", viagemId)
        .order("data", { ascending: false }),
      supabase
        .from("viagem_documentos")
        .select("*")
        .eq("viagem_id", viagemId)
        .order("created_at", { ascending: false }),
      supabase
        .from("eta_parametros")
        .select("*")
        .eq("ativo", true),
    ])

    if (viagem) {
      setCockpitData({
        viagem,
        eventos: (eventosRes.data || []) as ViagemEvento[],
        custos: (custosRes.data || []) as CustoViagem[],
        receitas: (receitasRes.data || []) as ReceitaViagem[],
        documentos: (documentosRes.data || []) as ViagemDocumento[],
        parametros: (parametrosRes.data || []) as EtaParametro[],
      })
    } else {
      setCockpitData(null)
    }

    setCockpitLoading(false)
  }

  const ciclosResumo = useMemo<CicloResumo[]>(() => {
    const grupos = new Map<string, Viagem[]>()

    for (const viagem of viagens) {
      const cicloNormalizado = viagem.ciclo_id?.trim()
      const cicloFallbackId = viagem.viagem_pai_id || viagem.id
      const cicloKey = cicloNormalizado || `SEM-CICLO-${cicloFallbackId}`
      const lista = grupos.get(cicloKey) || []
      lista.push(viagem)
      grupos.set(cicloKey, lista)
    }

    const getStatusCiclo = (lista: Viagem[]): CicloResumo["statusCiclo"] => {
      const statuses = lista.map((item) => normalizeViagemStatus(item.status))
      const somentePlanejadas = statuses.length > 0 && statuses.every((s) => s === "Planejada")
      return somentePlanejadas ? "Planeado" : "Realizado"
    }

    const sorted = Array.from(grupos.entries()).map(([cicloId, lista]) => {
      const viagensOrdenadas = [...lista].sort((a, b) => {
        const aTs = new Date(a.data_inicio || a.created_at).getTime()
        const bTs = new Date(b.data_inicio || b.created_at).getTime()
        return bTs - aTs
      })
      const viagemDestaque =
        viagensOrdenadas.find((item) => normalizeViagemStatus(item.status) === "Em andamento") ||
        viagensOrdenadas.find((item) => normalizeViagemStatus(item.status) === "Planejada") ||
        viagensOrdenadas[0]

      return {
        cicloId,
        viagens: viagensOrdenadas,
        viagemDestaque,
        statusCiclo: getStatusCiclo(viagensOrdenadas),
        valorTotal: viagensOrdenadas.reduce((sum, item) => sum + Number(item.valor_frete || 0), 0),
        kmTotal: viagensOrdenadas.reduce((sum, item) => sum + Number(item.km_real || 0), 0),
      }
    })

    return sorted.sort((a, b) => {
      const aTs = new Date(a.viagemDestaque.data_inicio || a.viagemDestaque.created_at).getTime()
      const bTs = new Date(b.viagemDestaque.data_inicio || b.viagemDestaque.created_at).getTime()
      return bTs - aTs
    })
  }, [viagens])

  const ciclosFiltrados = ciclosResumo.filter((ciclo) => {
    const termo = search.toLowerCase()
    const matchesSearch =
      ciclo.cicloId.toLowerCase().includes(termo) ||
      ciclo.viagens.some((v) =>
        v.cliente?.nome?.toLowerCase().includes(termo) ||
        v.motorista?.nome?.toLowerCase().includes(termo) ||
        v.veiculo?.placa_cavalo?.toLowerCase().includes(termo) ||
        v.origem_real?.toLowerCase().includes(termo) ||
        v.destino_real?.toLowerCase().includes(termo),
      )

    if (activeTab === "todas") return matchesSearch
    if (activeTab === "planeados") return matchesSearch && ciclo.statusCiclo === "Planeado"
    if (activeTab === "realizados") return matchesSearch && ciclo.statusCiclo === "Realizado"
    return matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Route className="h-7 w-7 text-primary" />
            Ciclos
          </h1>
          <p className="text-muted-foreground">
            Gerencie os ciclos da sua transportadora
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Ciclo
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar ciclos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="todas">Todas ({ciclosResumo.length})</TabsTrigger>
          <TabsTrigger value="planeados">Planeados ({ciclosResumo.filter(c => c.statusCiclo === "Planeado").length})</TabsTrigger>
          <TabsTrigger value="realizados">Realizados ({ciclosResumo.filter(c => c.statusCiclo === "Realizado").length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {ciclosFiltrados.length > 0 ? (
            <div className="grid gap-4">
              {ciclosFiltrados.map((ciclo) => {
                const viagem = ciclo.viagemDestaque
                return (
                <Card
                  key={ciclo.cicloId}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenCockpitModal(viagem.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      handleOpenCockpitModal(viagem.id)
                    }
                  }}
                  className="group cursor-pointer border-border/50 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:border-primary/50 hover:bg-primary/5"
                >
                  <CardContent className="p-4 transition-colors duration-300 group-hover:bg-primary/10">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center transition-all duration-300 group-hover:bg-primary/15 group-hover:scale-105">
                          <Truck className="h-6 w-6 text-primary transition-transform duration-300 group-hover:scale-110" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground">{ciclo.cicloId}</span>
                            <Badge className={statusColors[ciclo.statusCiclo]}>
                              {ciclo.statusCiclo}
                            </Badge>
                            <Badge variant="outline">{ciclo.viagens.length} viagem(ns)</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {viagem.cliente?.nome || "Sem cliente"}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {viagem.motorista?.nome || "Sem motorista"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Truck className="h-3 w-3" />
                              {viagem.veiculo?.placa_cavalo || "Sem veiculo"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(viagem.data_inicio)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold text-foreground flex items-center gap-1 justify-end">
                            <DollarSign className="h-4 w-4 text-success" />
                            {formatCurrency(ciclo.valorTotal)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {ciclo.kmTotal ? `${ciclo.kmTotal.toLocaleString("pt-BR")} km` : "-"}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                            <DropdownMenuItem onClick={() => handleEdit(ciclo)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {normalizeViagemStatus(viagem.status) === "Em andamento" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(viagem, "Concluida")}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Concluir Viagem
                              </DropdownMenuItem>
                            )}
                            {normalizeViagemStatus(viagem.status) !== "Cancelada" && normalizeViagemStatus(viagem.status) !== "Concluida" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(viagem, "Cancelada")}>
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancelar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(viagem)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                )
              })}
            </div>
          ) : (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <Route className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">Nenhum ciclo encontrado</p>
                <Button variant="outline" className="mt-4 bg-transparent" onClick={handleAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeiro ciclo
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={cockpitOpen}
        onOpenChange={(open) => {
          setCockpitOpen(open)
          if (!open) {
            setCockpitData(null)
            setCockpitLoading(false)
          }
        }}
      >
        <DialogContent className="!w-[96vw] !max-w-[96vw] h-[94vh] overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Cockpit da Viagem</DialogTitle>
          </DialogHeader>
          <div className="h-full min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4 bg-muted/20">
              {cockpitLoading && (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Carregando cockpit...
                </div>
              )}
              {!cockpitLoading && cockpitData && (
                <div className="w-full">
                  <ViagemDetalheClient
                    viagem={cockpitData.viagem}
                    initialEventos={cockpitData.eventos}
                    initialCustos={cockpitData.custos}
                    initialReceitas={cockpitData.receitas}
                    initialDocumentos={cockpitData.documentos}
                    etaParametros={cockpitData.parametros}
                    embedded
                  />
                </div>
              )}
              {!cockpitLoading && !cockpitData && (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Não foi possível carregar os dados da viagem.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Novo Ciclo Dialog */}
      <Dialog open={isNovoCicloDialogOpen} onOpenChange={setIsNovoCicloDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Ciclo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCycle} className="space-y-4">
            <div className="grid gap-2">
              <Label>Titulo do ciclo</Label>
              <Input
                value={novoCicloTitulo}
                onChange={(e) => setNovoCicloTitulo(e.target.value)}
                placeholder="Ex: Saude Belém - Xinguara"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                O sistema gera automaticamente o ID tecnico do ciclo no banco.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsNovoCicloDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreatingCycle || !novoCicloTitulo.trim()}>
                {isCreatingCycle ? "Criando..." : "Criar ciclo"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Viagem Form Dialog (edição) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>
              Editar ciclo
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCycleTitle} className="space-y-4">
            <div className="grid gap-2">
              <Label>Titulo do ciclo</Label>
              <Input
                value={editCicloTitulo}
                onChange={(e) => setEditCicloTitulo(e.target.value)}
                placeholder="Ex: Saude Belém - Xinguara"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Ao salvar, o sistema atualiza o identificador tecnico do ciclo para todas as viagens agrupadas.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta viagem?
              Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Register Modals */}
      <QuickClienteModal
        open={quickClienteOpen}
        onOpenChange={setQuickClienteOpen}
        onCreated={(c) => {
          setClientes(prev => [...prev, c])
          setFormData(prev => ({ ...prev, cliente_id: c.id }))
        }}
      />
      <QuickVeiculoModal
        open={quickVeiculoOpen}
        onOpenChange={setQuickVeiculoOpen}
        onCreated={(v) => {
          setVeiculos(prev => [...prev, v])
          setFormData(prev => ({ ...prev, veiculo_id: v.id }))
        }}
      />
      <QuickMotoristaModal
        open={quickMotoristaOpen}
        onOpenChange={setQuickMotoristaOpen}
        onCreated={(m) => {
          setMotoristas(prev => [...prev, m])
          setFormData(prev => ({ ...prev, motorista_id: m.id }))
        }}
      />
      <QuickRotaModal
        open={quickRotaOpen}
        onOpenChange={setQuickRotaOpen}
        onCreated={(r) => {
          setRotas(prev => [...prev, r])
          setFormData(prev => ({
            ...prev,
            rota_id: r.id,
            origem_real: `${r.origem_cidade}/${r.origem_estado}`,
            destino_real: `${r.destino_cidade}/${r.destino_estado}`,
            km_real: r.km_planejado?.toString() || prev.km_real,
            planejamento_rota: buildPlanejamentoRota(r, prev.planejamento_rota),
          }))
        }}
      />

    </div>
  )
}
