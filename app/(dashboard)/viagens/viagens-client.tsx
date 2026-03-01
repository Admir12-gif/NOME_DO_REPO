"use client"

import React from "react"

import { useEffect, useState } from "react"
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
  if (status === "Concluída") return "Concluida"
  return status
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

function buildIntermediarioChave(ponto: PontoIntermediario, index: number) {
  const cidade = (ponto.cidade || "").trim().toLowerCase()
  const estado = (ponto.estado || "").trim().toLowerCase()
  return `${index}:${cidade}:${estado}`
}

function buildPlanejamentoRota(
  rota: Rota,
  existing?: ViagemPlanejamentoRota | null,
): ViagemPlanejamentoRota {
  const existingIntermediarios = new Map(
    (existing?.intermediarios || []).map((item) => [item.chave, item]),
  )

  const intermediarios = (rota.pontos_intermediarios || [])
    .filter((ponto) => ponto.cidade && ponto.estado)
    .map((ponto, index): ViagemPlanejamentoIntermediario => {
      const chave = buildIntermediarioChave(ponto, index)
      const current = existingIntermediarios.get(chave)

      return {
        chave,
        cidade: ponto.cidade,
        estado: ponto.estado,
        tipo_parada: ponto.tipo_parada,
        chegada_planejada: current?.chegada_planejada || null,
        partida_planejada: current?.partida_planejada || null,
      }
    })

  return {
    origem_partida_planejada: existing?.origem_partida_planejada || null,
    destino_chegada_planejada: existing?.destino_chegada_planejada || null,
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedViagem, setSelectedViagem] = useState<Viagem | null>(null)
  const [isLoading, setIsLoading] = useState(false)
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

  const [formData, setFormData] = useState<ViagemFormData>({
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
  }

  const handleAdd = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleEdit = (viagem: Viagem) => {
    const rotaSelecionada = rotas.find((rota) => rota.id === viagem.rota_id)
    const planejamentoFromViagem = toFormPlanejamentoRota(viagem.planejamento_rota)

    setSelectedViagem(viagem)
    setFormData({
      cliente_id: viagem.cliente_id || "",
      veiculo_id: viagem.veiculo_id || "",
      motorista_id: viagem.motorista_id || "",
      rota_id: viagem.rota_id || "",
      rota_avulsa: viagem.rota_avulsa,
      origem_real: viagem.origem_real || "",
      destino_real: viagem.destino_real || "",
      data_inicio: toDatetimeLocal(viagem.data_inicio),
      data_fim: toDatetimeLocal(viagem.data_fim),
      tipo_carga: viagem.tipo_carga || "",
      volume_toneladas: viagem.volume_toneladas?.toString() || "",
      km_real: viagem.km_real?.toString() || "",
      valor_frete: viagem.valor_frete?.toString() || "",
      status: viagem.status,
      planejamento_rota: rotaSelecionada
        ? buildPlanejamentoRota(rotaSelecionada, planejamentoFromViagem)
        : planejamentoFromViagem,
    })
    setIsDialogOpen(true)
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

    if (selectedViagem) {
      let { error } = await supabase
        .from("viagens")
        .update(viagemData)
        .eq("id", selectedViagem.id)

      if (error?.message?.toLowerCase().includes("planejamento_rota")) {
        const retry = await supabase
          .from("viagens")
          .update(viagemDataBase)
          .eq("id", selectedViagem.id)
        error = retry.error
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

      if (error?.message?.toLowerCase().includes("planejamento_rota")) {
        const retry = await supabase
          .from("viagens")
          .insert(viagemDataBase)
          .select("id")
          .single()
        data = retry.data
        error = retry.error
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

  const filteredViagens = viagens.filter(v => {
    const status = normalizeViagemStatus(v.status)
    const matchesSearch = 
      v.cliente?.nome?.toLowerCase().includes(search.toLowerCase()) ||
      v.motorista?.nome?.toLowerCase().includes(search.toLowerCase()) ||
      v.veiculo?.placa_cavalo?.toLowerCase().includes(search.toLowerCase()) ||
      v.origem_real?.toLowerCase().includes(search.toLowerCase()) ||
      v.destino_real?.toLowerCase().includes(search.toLowerCase())
    
    if (activeTab === "todas") return matchesSearch
    if (activeTab === "planejadas") return matchesSearch && status === "Planejada"
    if (activeTab === "em_andamento") return matchesSearch && status === "Em andamento"
    if (activeTab === "concluidas") return matchesSearch && status === "Concluida"
    return matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Route className="h-7 w-7 text-primary" />
            Viagens
          </h1>
          <p className="text-muted-foreground">
            Gerencie as viagens da sua transportadora
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Viagem
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar viagens..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="todas">Todas ({viagens.length})</TabsTrigger>
          <TabsTrigger value="planejadas">Planejadas ({viagens.filter(v => normalizeViagemStatus(v.status) === "Planejada").length})</TabsTrigger>
          <TabsTrigger value="em_andamento">Em Andamento ({viagens.filter(v => normalizeViagemStatus(v.status) === "Em andamento").length})</TabsTrigger>
          <TabsTrigger value="concluidas">Concluidas ({viagens.filter(v => normalizeViagemStatus(v.status) === "Concluida").length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredViagens.length > 0 ? (
            <div className="grid gap-4">
              {filteredViagens.map((viagem) => (
                <Card
                  key={viagem.id}
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
                            <span className="font-medium text-foreground flex items-center gap-1">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              {viagem.origem_real || "Origem"}
                            </span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-foreground">
                              {viagem.destino_real || "Destino"}
                            </span>
                            <Badge className={statusColors[normalizeViagemStatus(viagem.status)]}>
                              {normalizeViagemStatus(viagem.status)}
                            </Badge>
                          </div>
                          {formatPontosIntermediarios(viagem.rota?.pontos_intermediarios) && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span className="font-medium text-foreground/80">Pontos intermediarios:</span>
                              <span>{formatPontosIntermediarios(viagem.rota?.pontos_intermediarios)}</span>
                            </div>
                          )}
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
                            {formatCurrency(viagem.valor_frete || 0)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {viagem.km_real ? `${viagem.km_real.toLocaleString("pt-BR")} km` : "-"}
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
                            <DropdownMenuItem onClick={() => handleEdit(viagem)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {normalizeViagemStatus(viagem.status) === "Planejada" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(viagem, "Em andamento")}>
                                <Play className="h-4 w-4 mr-2" />
                                Iniciar Viagem
                              </DropdownMenuItem>
                            )}
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
              ))}
            </div>
          ) : (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <Route className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">Nenhuma viagem encontrada</p>
                <Button variant="outline" className="mt-4 bg-transparent" onClick={handleAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeira viagem
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
        <DialogContent className="!w-[70vw] !max-w-[70vw] h-[94vh] overflow-hidden p-0">
          <div className="h-full min-h-0 flex flex-col">
            <DialogHeader className="px-4 py-4 sm:px-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <DialogTitle>Cockpit da Viagem</DialogTitle>
              {!cockpitLoading && cockpitData?.viagem && (
                <p className="text-sm text-muted-foreground">
                  {cockpitData.viagem.rota?.nome || `${cockpitData.viagem.origem_real || "Origem"} → ${cockpitData.viagem.destino_real || "Destino"}`}
                </p>
              )}
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 bg-muted/20">
              {cockpitLoading && (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Carregando cockpit...
                </div>
              )}
              {!cockpitLoading && cockpitData && (
                <div className="mx-auto w-full max-w-[1400px]">
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

      {/* Viagem Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedViagem ? "Editar Viagem" : "Nova Viagem"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Preencha o básico primeiro (cliente, veículo, motorista e rota). O restante é opcional e pode ser complementado depois.
            </div>

            {/* Cliente + Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Cliente</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-primary gap-1 px-1" onClick={() => setQuickClienteOpen(true)}>
                    <Plus className="h-3 w-3" /> Novo
                  </Button>
                </div>
                <Select
                  value={formData.cliente_id}
                  onValueChange={(value) => setFormData({ ...formData, cliente_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedViagem ? (
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label>Status inicial</Label>
                  <Input value="Planejada" disabled />
                </div>
              )}
            </div>

            {/* Veiculo + Motorista */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Veiculo</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-primary gap-1 px-1" onClick={() => setQuickVeiculoOpen(true)}>
                    <Plus className="h-3 w-3" /> Novo
                  </Button>
                </div>
                <Select
                  value={formData.veiculo_id}
                  onValueChange={(value) => setFormData({ ...formData, veiculo_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {veiculos.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.placa_cavalo} {v.modelo && `- ${v.modelo}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Motorista</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-primary gap-1 px-1" onClick={() => setQuickMotoristaOpen(true)}>
                    <Plus className="h-3 w-3" /> Novo
                  </Button>
                </div>
                <Select
                  value={formData.motorista_id}
                  onValueChange={(value) => setFormData({ ...formData, motorista_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {motoristas.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Rota */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Rota Planejada</Label>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-primary gap-1 px-1" onClick={() => setQuickRotaOpen(true)}>
                  <Plus className="h-3 w-3" /> Nova Rota
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Selecionar a rota preenche origem, destino, km e habilita o planejamento por ponto.</p>
              <Select
                value={formData.rota_id}
                onValueChange={handleRotaSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma rota ou preencha manualmente" />
                </SelectTrigger>
                <SelectContent>
                  {rotas.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome} ({r.origem_cidade}/{r.origem_estado} - {r.destino_cidade}/{r.destino_estado})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.rota_id && formData.planejamento_rota && (
              <div className="space-y-4 rounded-lg border border-border/70 bg-muted/20 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Planejamento da rota</p>
                  <p className="text-xs text-muted-foreground">
                    Defina chegada e partida planejadas em cada ponto intermediário da rota.
                  </p>
                </div>

                {formData.planejamento_rota.intermediarios.length === 0 && (
                  <p className="text-xs text-muted-foreground">A rota selecionada não possui pontos intermediários.</p>
                )}

                {formData.planejamento_rota.intermediarios.length > 0 && (
                  <div className="space-y-3">
                    {formData.planejamento_rota.intermediarios.map((ponto, index) => (
                      <div key={ponto.chave} className="rounded-md border border-border/60 bg-background p-3 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {index + 1}. {ponto.cidade}/{ponto.estado}
                          </p>
                          <span className="text-xs text-muted-foreground">{getPontoParadaTipoLabel(ponto.tipo_parada)}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="grid gap-2">
                            <Label>Chegada planejada</Label>
                            <Input
                              type="datetime-local"
                              value={ponto.chegada_planejada || ""}
                              onChange={(e) => updatePlanejamentoIntermediario(index, "chegada_planejada", e.target.value)}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Partida planejada</Label>
                            <Input
                              type="datetime-local"
                              value={ponto.partida_planejada || ""}
                              onChange={(e) => updatePlanejamentoIntermediario(index, "partida_planejada", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Origem / Destino */}
            {!formData.rota_id && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Origem</Label>
                  <Input
                    value={formData.origem_real}
                    onChange={(e) => setFormData({ ...formData, origem_real: e.target.value })}
                    placeholder="Cidade/UF"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Destino</Label>
                  <Input
                    value={formData.destino_real}
                    onChange={(e) => setFormData({ ...formData, destino_real: e.target.value })}
                    placeholder="Cidade/UF"
                  />
                </div>
              </div>
            )}

            {/* Datas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Partida planejada</Label>
                <Input
                  type="datetime-local"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Chegada planejada</Label>
                <Input
                  type="datetime-local"
                  value={formData.data_fim}
                  onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-border/70 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Dados complementares</p>
                <p className="text-xs text-muted-foreground">Opcional no cadastro inicial. Preencha agora se já tiver os dados.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Tipo de Carga</Label>
                  <Input
                    value={formData.tipo_carga}
                    onChange={(e) => setFormData({ ...formData, tipo_carga: e.target.value })}
                    placeholder="Ex: grãos, combustível, refrigerado"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Valor do Frete (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor_frete}
                    onChange={(e) => setFormData({ ...formData, valor_frete: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Volume (ton)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.volume_toneladas}
                    onChange={(e) => setFormData({ ...formData, volume_toneladas: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>KM</Label>
                  <Input
                    type="number"
                    value={formData.km_real}
                    onChange={(e) => setFormData({ ...formData, km_real: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
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
