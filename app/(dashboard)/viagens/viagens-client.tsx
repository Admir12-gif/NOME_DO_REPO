"use client"

import React from "react"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Viagem, Cliente, Veiculo, Motorista, Rota, PontoIntermediario } from "@/lib/types"
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
  Fuel,
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
    .map((ponto) => `${ponto.cidade}/${ponto.estado}`)
    .join(" • ")
}

function parseLocaisAbastecimento(rota?: Rota) {
  if (!rota) return []
  // Use postos from relationship if available, fallback to old locais_abastecimento field
  if (rota.postos && rota.postos.length > 0) {
    return rota.postos.map(p => p.nome + (p.localidade ? ` (${p.localidade})` : ''))
  }
  // Fallback for backward compatibility
  if (rota.locais_abastecimento) {
    return rota.locais_abastecimento
      .split(/\n|,/) 
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
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

  // State to track which postos have been abastecidos for each viagem
  const [abastecimentosRegistrados, setAbastecimentosRegistrados] = useState<Record<string, string[]>>({}) // viagemId -> [posto1, posto2, ...]

  // Load abastecimentos on mount
  useEffect(() => {
    const loadAbastecimentos = async () => {
      const viagemIds = viagens.map(v => v.id)
      if (viagemIds.length === 0) return

      const { data } = await supabase
        .from("abastecimentos")
        .select("viagem_id, posto")
        .in("viagem_id", viagemIds)
        .not("posto", "is", null)

      if (data) {
        const map: Record<string, string[]> = {}
        data.forEach((abast: any) => {
          if (!map[abast.viagem_id]) {
            map[abast.viagem_id] = []
          }
          if (abast.posto && !map[abast.viagem_id].includes(abast.posto)) {
            map[abast.viagem_id].push(abast.posto)
          }
        })
        setAbastecimentosRegistrados(map)
      }
    }
    loadAbastecimentos()
  }, [viagens])

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

  const [abastecimentoStatus, setAbastecimentoStatus] = useState<Record<string, "sim" | "nao">>({})
  const [abastecimentoDialogOpen, setAbastecimentoDialogOpen] = useState(false)
  const [selectedViagemAbastecimento, setSelectedViagemAbastecimento] = useState<Viagem | null>(null)
  const [abastecimentoForm, setAbastecimentoForm] = useState({ hodometro: "", litros: "", valor_total: "", posto: "", observacao: "" })

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem("tms-abastecimento-status")
    if (stored) {
      setAbastecimentoStatus(JSON.parse(stored))
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem("tms-abastecimento-status", JSON.stringify(abastecimentoStatus))
  }, [abastecimentoStatus])

  const handleAbastecimentoClick = (viagem: Viagem, ponto?: string) => {
    setSelectedViagemAbastecimento(viagem)
    setAbastecimentoForm({ hodometro: viagem.km_real?.toString() || "", litros: "", valor_total: "", posto: ponto || "", observacao: "" })
    setAbastecimentoDialogOpen(true)
  }

  const handleAbastecimentoSubmit = async () => {
    if (!selectedViagemAbastecimento || !selectedViagemAbastecimento.veiculo_id) return
    if (!abastecimentoForm.hodometro || !abastecimentoForm.litros || !abastecimentoForm.valor_total || !abastecimentoForm.posto) {
      alert("Preencha todos os campos obrigatórios")
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase.from("abastecimentos").insert([
      {
        user_id: user.id,
        veiculo_id: selectedViagemAbastecimento.veiculo_id,
        viagem_id: selectedViagemAbastecimento.id,
        data: new Date().toISOString().split("T")[0],
        hodometro: parseInt(abastecimentoForm.hodometro),
        litros: parseFloat(abastecimentoForm.litros),
        valor_total: parseFloat(abastecimentoForm.valor_total),
        posto: abastecimentoForm.posto,
        observacao: abastecimentoForm.observacao || null,
      },
    ])

    if (error) {
      console.error("Erro ao registrar abastecimento:", error)
      alert("Erro ao registrar abastecimento: " + error.message)
      return
    }

    // Update the local state to show the posto as abastecido
    setAbastecimentosRegistrados((prev) => ({
      ...prev,
      [selectedViagemAbastecimento.id]: [
        ...(prev[selectedViagemAbastecimento.id] || []),
        abastecimentoForm.posto
      ]
    }))

    setAbastecimentoStatus((prev) => ({
      ...prev,
      [selectedViagemAbastecimento.id]: "sim",
    }))
    setAbastecimentoDialogOpen(false)
    setSelectedViagemAbastecimento(null)
    setAbastecimentoForm({ hodometro: "", litros: "", valor_total: "", posto: "", observacao: "" })
  }

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedViagem, setSelectedViagem] = useState<Viagem | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("todas")

  // Quick register modal states
  const [quickClienteOpen, setQuickClienteOpen] = useState(false)
  const [quickVeiculoOpen, setQuickVeiculoOpen] = useState(false)
  const [quickMotoristaOpen, setQuickMotoristaOpen] = useState(false)
  const [quickRotaOpen, setQuickRotaOpen] = useState(false)

  const [formData, setFormData] = useState({
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
    })
    setSelectedViagem(null)
  }

  const handleAdd = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleEdit = (viagem: Viagem) => {
    setSelectedViagem(viagem)
    setFormData({
      cliente_id: viagem.cliente_id || "",
      veiculo_id: viagem.veiculo_id || "",
      motorista_id: viagem.motorista_id || "",
      rota_id: viagem.rota_id || "",
      rota_avulsa: viagem.rota_avulsa,
      origem_real: viagem.origem_real || "",
      destino_real: viagem.destino_real || "",
      data_inicio: viagem.data_inicio?.split("T")[0] || "",
      data_fim: viagem.data_fim?.split("T")[0] || "",
      tipo_carga: viagem.tipo_carga || "",
      volume_toneladas: viagem.volume_toneladas?.toString() || "",
      km_real: viagem.km_real?.toString() || "",
      valor_frete: viagem.valor_frete?.toString() || "",
      status: viagem.status,
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

    const viagemData = {
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

    if (selectedViagem) {
      const { error } = await supabase
        .from("viagens")
        .update(viagemData)
        .eq("id", selectedViagem.id)

      if (!error) {
        const updatedViagem = await fetchViagemWithPostos(selectedViagem.id)
        if (updatedViagem) {
          setViagens(viagens.map(v => v.id === selectedViagem.id ? updatedViagem : v))
        }
      }
    } else {
      const { data, error } = await supabase
        .from("viagens")
        .insert(viagemData)
        .select("id")
        .single()

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
      }))
    }
  }

  const filteredViagens = viagens.filter(v => {
    const matchesSearch = 
      v.cliente?.nome?.toLowerCase().includes(search.toLowerCase()) ||
      v.motorista?.nome?.toLowerCase().includes(search.toLowerCase()) ||
      v.veiculo?.placa_cavalo?.toLowerCase().includes(search.toLowerCase()) ||
      v.origem_real?.toLowerCase().includes(search.toLowerCase()) ||
      v.destino_real?.toLowerCase().includes(search.toLowerCase())
    
    if (activeTab === "todas") return matchesSearch
    if (activeTab === "planejadas") return matchesSearch && v.status === "Planejada"
    if (activeTab === "em_andamento") return matchesSearch && v.status === "Em andamento"
    if (activeTab === "concluidas") return matchesSearch && v.status === "Concluida"
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

      {/* Quick Register Bar */}
      <Card className="border-dashed border-primary/30 bg-primary/5">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Cadastro rapido:</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent" onClick={() => setQuickClienteOpen(true)}>
                    <Users className="h-4 w-4 text-primary" />
                    <span className="hidden sm:inline">Cliente</span>
                    <Plus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cadastrar novo cliente</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent" onClick={() => setQuickVeiculoOpen(true)}>
                    <Truck className="h-4 w-4 text-primary" />
                    <span className="hidden sm:inline">Veiculo</span>
                    <Plus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cadastrar novo veiculo</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent" onClick={() => setQuickMotoristaOpen(true)}>
                    <User className="h-4 w-4 text-primary" />
                    <span className="hidden sm:inline">Motorista</span>
                    <Plus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cadastrar novo motorista</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent" onClick={() => setQuickRotaOpen(true)}>
                    <Route className="h-4 w-4 text-primary" />
                    <span className="hidden sm:inline">Rota</span>
                    <Plus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cadastrar nova rota</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

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
          <TabsTrigger value="planejadas">Planejadas ({viagens.filter(v => v.status === "Planejada").length})</TabsTrigger>
          <TabsTrigger value="em_andamento">Em Andamento ({viagens.filter(v => v.status === "Em andamento").length})</TabsTrigger>
          <TabsTrigger value="concluidas">Concluidas ({viagens.filter(v => v.status === "Concluida").length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredViagens.length > 0 ? (
            <div className="grid gap-4">
              {filteredViagens.map((viagem) => (
                <Card key={viagem.id} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Truck className="h-6 w-6 text-primary" />
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
                            <Badge className={statusColors[viagem.status]}>
                              {viagem.status}
                            </Badge>
                          </div>
                          {formatPontosIntermediarios(viagem.rota?.pontos_intermediarios) && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span className="font-medium text-foreground/80">Pontos intermediarios:</span>
                              <span>{formatPontosIntermediarios(viagem.rota?.pontos_intermediarios)}</span>
                            </div>
                          )}
                          {parseLocaisAbastecimento(viagem.rota).length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Fuel className="h-3 w-3 text-primary" />
                                <span className="font-medium text-foreground/80">Pontos de abastecimento:</span>
                              </div>
                              <div className="flex flex-col gap-1 ml-5">
                                {parseLocaisAbastecimento(viagem.rota).map((ponto) => {
                                  const foiAbastecido = abastecimentosRegistrados[viagem.id]?.includes(ponto)
                                  return (
                                    <div key={ponto} className="flex items-center gap-2">
                                      <Badge className={foiAbastecido ? "bg-success/20 text-success border-success" : "bg-muted/60 text-foreground/80"}>
                                        {ponto}
                                      </Badge>
                                      {viagem.status === "Em andamento" && (
                                        foiAbastecido ? (
                                          <Badge variant="outline" className="h-6 px-3 text-xs bg-success/10 text-success border-success">
                                            <CheckCircle className="w-3 h-3 mr-1" />
                                            Abastecido
                                          </Badge>
                                        ) : (
                                          <Button
                                            size="sm"
                                            variant="default"
                                            className="h-6 px-3 text-xs font-medium"
                                            onClick={() => handleAbastecimentoClick(viagem, ponto)}
                                          >
                                            <Fuel className="w-3 h-3 mr-1" />
                                            Registrar
                                          </Button>
                                        )
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          {(viagem.status === "Em andamento" || abastecimentoStatus[viagem.id]) && parseLocaisAbastecimento(viagem.rota).length === 0 && (
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                              <span className="text-muted-foreground">Abasteceu na estacao?</span>
                              <Button
                                type="button"
                                size="sm"
                                variant={abastecimentoStatus[viagem.id] === "sim" ? "default" : "outline"}
                                className="h-7 px-2"
                                onClick={() => handleAbastecimentoClick(viagem)}
                              >
                                Sim
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={abastecimentoStatus[viagem.id] === "nao" ? "default" : "outline"}
                                className="h-7 px-2"
                                onClick={() =>
                                  setAbastecimentoStatus((prev) => ({
                                    ...prev,
                                    [viagem.id]: "nao",
                                  }))
                                }
                              >
                                Nao
                              </Button>
                              {abastecimentoStatus[viagem.id] && (
                                <Badge className={abastecimentoStatus[viagem.id] === "sim" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                                  {abastecimentoStatus[viagem.id] === "sim" ? "Abasteceu" : "Nao abasteceu"}
                                </Badge>
                              )}
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
                      <div className="flex items-center gap-4">
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
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(viagem)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {viagem.status === "Planejada" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(viagem, "Em andamento")}>
                                <Play className="h-4 w-4 mr-2" />
                                Iniciar Viagem
                              </DropdownMenuItem>
                            )}
                            {viagem.status === "Em andamento" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(viagem, "Concluida")}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Concluir Viagem
                              </DropdownMenuItem>
                            )}
                            {viagem.status !== "Cancelada" && viagem.status !== "Concluida" && (
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

      {/* Viagem Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedViagem ? "Editar Viagem" : "Nova Viagem"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Cliente + Status */}
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            {/* Veiculo + Motorista */}
            <div className="grid grid-cols-2 gap-4">
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

            {/* Origem / Destino */}
            <div className="grid grid-cols-2 gap-4">
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

            {/* Datas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Data Inicio</Label>
                <Input
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={formData.data_fim}
                  onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                />
              </div>
            </div>

            {/* Carga / Volume / KM */}
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Tipo de Carga</Label>
                <Input
                  value={formData.tipo_carga}
                  onChange={(e) => setFormData({ ...formData, tipo_carga: e.target.value })}
                  placeholder="Ex: Graos, Combustivel"
                />
              </div>
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

            {/* Frete */}
            <div className="grid gap-2">
              <Label>Valor do Frete (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.valor_frete}
                onChange={(e) => setFormData({ ...formData, valor_frete: e.target.value })}
                placeholder="0.00"
              />
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
          }))
        }}
      />

      {/* Abastecimento Modal */}
      <Dialog open={abastecimentoDialogOpen} onOpenChange={setAbastecimentoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Abastecimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="abast-hodometro">Hodômetro (km) *</Label>
              <Input
                id="abast-hodometro"
                type="number"
                placeholder="Ex: 45000"
                value={abastecimentoForm.hodometro}
                onChange={(e) => setAbastecimentoForm({ ...abastecimentoForm, hodometro: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="abast-litros">Litros *</Label>
              <Input
                id="abast-litros"
                type="number"
                step="0.01"
                placeholder="Ex: 50.5"
                value={abastecimentoForm.litros}
                onChange={(e) => setAbastecimentoForm({ ...abastecimentoForm, litros: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="abast-valor">Valor Total (R$) *</Label>
              <Input
                id="abast-valor"
                type="number"
                step="0.01"
                placeholder="Ex: 250.50"
                value={abastecimentoForm.valor_total}
                onChange={(e) => setAbastecimentoForm({ ...abastecimentoForm, valor_total: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="abast-posto">Posto *</Label>
              <Select value={abastecimentoForm.posto} onValueChange={(value) => setAbastecimentoForm({ ...abastecimentoForm, posto: value })}>
                <SelectTrigger id="abast-posto">
                  <SelectValue placeholder="Selecione um ponto..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedViagemAbastecimento && parseLocaisAbastecimento(selectedViagemAbastecimento.rota).map((ponto) => (
                    <SelectItem key={ponto} value={ponto}>
                      {ponto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="abast-obs">Observação</Label>
              <Textarea
                id="abast-obs"
                placeholder="Observações adicionais"
                value={abastecimentoForm.observacao}
                onChange={(e) => setAbastecimentoForm({ ...abastecimentoForm, observacao: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAbastecimentoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAbastecimentoSubmit}>
                Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
