"use client"

import React, { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ViagemDetalheClient } from "./[viagemId]/viagemDetalheClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { QuickClienteModal, QuickVeiculoModal, QuickMotoristaModal, QuickRotaModal } from "@/components/quick-register-modals"
import type { Viagem, Cliente, Veiculo, Motorista, Rota, ViagemEvento, CustoViagem, ReceitaViagem, ViagemDocumento, EtaParametro } from "@/lib/types"
import { Plus, Search, Truck, User, MapPin, Calendar, MoreHorizontal, Pencil, Trash2, CheckCircle, XCircle, Route, Loader2, ChevronRight } from "lucide-react"

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
  origem_real: string
  destino_real: string
  data_inicio: string
  data_fim: string
  valor_frete: string
  tipo_carga: string
  status: string
}

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  Planejada:      { label: "Planejada",      bg: "bg-slate-100",   text: "text-slate-700",   dot: "bg-slate-400"  },
  "Em andamento": { label: "Em andamento",   bg: "bg-blue-100",    text: "text-blue-700",    dot: "bg-blue-500"   },
  Concluida:      { label: "Concluída",      bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500"},
  Cancelada:      { label: "Cancelada",      bg: "bg-rose-100",    text: "text-rose-700",    dot: "bg-rose-500"   },
}

function normalizeStatus(s?: string | null) {
  if (!s) return "Planejada"
  const n = s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
  if (["concluida", "fechada", "finalizada"].includes(n)) return "Concluida"
  if (["em andamento", "andamento", "aberta"].includes(n)) return "Em andamento"
  if (["cancelada"].includes(n)) return "Cancelada"
  return "Planejada"
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

function formatDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

function toDatetimeLocal(v?: string | null) {
  if (!v) return ""
  const d = new Date(v)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function ViagensClient({ initialViagens, clientes: initialClientes, veiculos: initialVeiculos, motoristas: initialMotoristas, rotas: initialRotas }: ViagensClientProps) {
  const supabase = createClient()

  const [viagens, setViagens] = useState(initialViagens)
  const [clientes, setClientes] = useState(initialClientes)
  const [veiculos, setVeiculos] = useState(initialVeiculos)
  const [motoristas, setMotoristas] = useState(initialMotoristas)
  const [rotas, setRotas] = useState(initialRotas)

  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("todas")
  const [isLoading, setIsLoading] = useState(false)

  // Form modal
  const [formOpen, setFormOpen] = useState(false)
  const [editingViagem, setEditingViagem] = useState<Viagem | null>(null)
  const [formData, setFormData] = useState<ViagemFormData>({
    cliente_id: "", veiculo_id: "", motorista_id: "", rota_id: "",
    origem_real: "", destino_real: "", data_inicio: "", data_fim: "",
    valor_frete: "", tipo_carga: "", status: "Planejada",
  })

  // Delete
  const [deleteViagem, setDeleteViagem] = useState<Viagem | null>(null)

  // Cockpit
  const [cockpitOpen, setCockpitOpen] = useState(false)
  const [cockpitLoading, setCockpitLoading] = useState(false)
  const [cockpitData, setCockpitData] = useState<{ viagem: Viagem; eventos: ViagemEvento[]; custos: CustoViagem[]; receitas: ReceitaViagem[]; documentos: ViagemDocumento[]; parametros: EtaParametro[] } | null>(null)

  // Quick modals
  const [quickClienteOpen, setQuickClienteOpen] = useState(false)
  const [quickVeiculoOpen, setQuickVeiculoOpen] = useState(false)
  const [quickMotoristaOpen, setQuickMotoristaOpen] = useState(false)
  const [quickRotaOpen, setQuickRotaOpen] = useState(false)

  const fetchViagem = async (id: string) => {
    const { data } = await supabase
      .from("viagens")
      .select("*, cliente:clientes(*), veiculo:veiculos(*), motorista:motoristas(*), rota:rotas(*)")
      .eq("id", id).single()
    return data as Viagem | null
  }

  const openForm = (viagem?: Viagem) => {
    if (viagem) {
      setEditingViagem(viagem)
      setFormData({
        cliente_id: viagem.cliente_id || "",
        veiculo_id: viagem.veiculo_id || "",
        motorista_id: viagem.motorista_id || "",
        rota_id: viagem.rota_id || "",
        origem_real: viagem.origem_real || "",
        destino_real: viagem.destino_real || "",
        data_inicio: toDatetimeLocal(viagem.data_inicio),
        data_fim: toDatetimeLocal(viagem.data_fim),
        valor_frete: viagem.valor_frete?.toString() || "",
        tipo_carga: viagem.tipo_carga || "",
        status: viagem.status || "Planejada",
      })
    } else {
      setEditingViagem(null)
      setFormData({ cliente_id: "", veiculo_id: "", motorista_id: "", rota_id: "", origem_real: "", destino_real: "", data_inicio: "", data_fim: "", valor_frete: "", tipo_carga: "", status: "Planejada" })
    }
    setFormOpen(true)
  }

  const handleRotaSelect = (rotaId: string) => {
    const rota = rotas.find(r => r.id === rotaId)
    if (rota) {
      setFormData(prev => ({
        ...prev,
        rota_id: rotaId,
        origem_real: `${rota.origem_cidade}/${rota.origem_estado}`,
        destino_real: `${rota.destino_cidade}/${rota.destino_estado}`,
      }))
    } else {
      setFormData(prev => ({ ...prev, rota_id: rotaId }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsLoading(false); return }

    const payload = {
      cliente_id: formData.cliente_id || null,
      veiculo_id: formData.veiculo_id || null,
      motorista_id: formData.motorista_id || null,
      rota_id: formData.rota_id || null,
      origem_real: formData.origem_real || null,
      destino_real: formData.destino_real || null,
      data_inicio: formData.data_inicio ? new Date(formData.data_inicio).toISOString() : null,
      data_fim: formData.data_fim ? new Date(formData.data_fim).toISOString() : null,
      valor_frete: formData.valor_frete ? parseFloat(formData.valor_frete) : null,
      tipo_carga: formData.tipo_carga || null,
      status: formData.status as Viagem["status"],
      updated_at: new Date().toISOString(),
    }

    if (editingViagem) {
      const { error } = await supabase.from("viagens").update(payload).eq("id", editingViagem.id)
      if (!error) {
        const updated = await fetchViagem(editingViagem.id)
        if (updated) setViagens(prev => prev.map(v => v.id === editingViagem.id ? updated : v))
      }
    } else {
      const { data, error } = await supabase.from("viagens")
        .insert({ ...payload, user_id: user.id, created_at: new Date().toISOString() })
        .select("id").single()
      if (!error && data) {
        const nova = await fetchViagem(data.id)
        if (nova) {
          setViagens(prev => [nova, ...prev])
          setFormOpen(false)
          setIsLoading(false)
          await handleOpenCockpit(data.id)
          return
        }
      }
    }

    setIsLoading(false)
    setFormOpen(false)
  }

  const handleStatusChange = async (viagem: Viagem, status: string) => {
    const updates: Record<string, unknown> = { status }
    if (status === "Em andamento" && !viagem.data_inicio) updates.data_inicio = new Date().toISOString()
    if (status === "Concluida" && !viagem.data_fim) updates.data_fim = new Date().toISOString()
    const { error } = await supabase.from("viagens").update(updates).eq("id", viagem.id)
    if (!error) {
      const updated = await fetchViagem(viagem.id)
      if (updated) setViagens(prev => prev.map(v => v.id === viagem.id ? updated : v))
    }
  }

  const handleDelete = async () => {
    if (!deleteViagem) return
    const { error } = await supabase.from("viagens").delete().eq("id", deleteViagem.id)
    if (!error) setViagens(prev => prev.filter(v => v.id !== deleteViagem.id))
    setDeleteViagem(null)
  }

  const handleOpenCockpit = async (id: string) => {
    setCockpitOpen(true)
    setCockpitLoading(true)
    const [viagem, eventosRes, custosRes, receitasRes, documentosRes, parametrosRes] = await Promise.all([
      fetchViagem(id),
      supabase.from("viagem_eventos").select("*").eq("viagem_id", id).order("ocorrido_em", { ascending: false }),
      supabase.from("custos_viagem").select("*").eq("viagem_id", id).order("data", { ascending: false }),
      supabase.from("receitas_viagem").select("*").eq("viagem_id", id).order("data", { ascending: false }),
      supabase.from("viagem_documentos").select("*").eq("viagem_id", id).order("created_at", { ascending: false }),
      supabase.from("eta_parametros").select("*").eq("ativo", true),
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
    }
    setCockpitLoading(false)
  }

  const tabs = [
    { key: "todas", label: "Todas" },
    { key: "andamento", label: "Em andamento" },
    { key: "planejadas", label: "Planejadas" },
    { key: "concluidas", label: "Concluídas" },
  ]

  const viagensFiltradas = useMemo(() => {
    const termo = search.toLowerCase()
    return viagens
      .filter(v => {
        const matchSearch =
          !termo ||
          v.cliente?.nome?.toLowerCase().includes(termo) ||
          v.motorista?.nome?.toLowerCase().includes(termo) ||
          v.veiculo?.placa_cavalo?.toLowerCase().includes(termo) ||
          v.origem_real?.toLowerCase().includes(termo) ||
          v.destino_real?.toLowerCase().includes(termo) ||
          v.tipo_carga?.toLowerCase().includes(termo)
        if (!matchSearch) return false
        const status = normalizeStatus(v.status)
        if (activeTab === "andamento") return status === "Em andamento"
        if (activeTab === "planejadas") return status === "Planejada"
        if (activeTab === "concluidas") return status === "Concluida"
        return true
      })
      .sort((a, b) => new Date(b.data_inicio || b.created_at).getTime() - new Date(a.data_inicio || a.created_at).getTime())
  }, [viagens, search, activeTab])

  const contagens = useMemo(() => ({
    todas: viagens.length,
    andamento: viagens.filter(v => normalizeStatus(v.status) === "Em andamento").length,
    planejadas: viagens.filter(v => normalizeStatus(v.status) === "Planejada").length,
    concluidas: viagens.filter(v => normalizeStatus(v.status) === "Concluida").length,
  }), [viagens])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Viagens</h1>
          <p className="page-subtitle">Gerencie e acompanhe todas as viagens</p>
        </div>
        <Button onClick={() => openForm()} size="sm" className="gap-1.5 gradient-primary font-semibold">
          <Plus className="h-4 w-4" />
          Nova Viagem
        </Button>
      </div>

      {/* Card principal */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        {/* Barra de busca + tabs */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, motorista, placa, rota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                {tab.label}
                <span className={`ml-1.5 tabular-nums ${activeTab === tab.key ? "opacity-70" : "opacity-60"}`}>
                  {contagens[tab.key as keyof typeof contagens]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        {viagensFiltradas.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Route className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Nenhuma viagem encontrada</p>
            <p className="text-xs text-muted-foreground mb-4">
              {search ? "Tente outros termos de busca" : "Crie a primeira viagem"}
            </p>
            {!search && (
              <Button size="sm" onClick={() => openForm()} className="gap-1.5">
                <Plus className="h-4 w-4" />Nova Viagem
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {viagensFiltradas.map((viagem) => {
              const status = normalizeStatus(viagem.status)
              const cfg = statusConfig[status] || statusConfig["Planejada"]
              const rota = [viagem.origem_real, viagem.destino_real].filter(Boolean).join(" → ")
              return (
                <div
                  key={viagem.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenCockpit(viagem.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOpenCockpit(viagem.id) } }}
                  className="group flex items-center gap-4 px-4 py-3.5 hover:bg-primary/[0.03] transition-colors cursor-pointer"
                >
                  {/* Status icon */}
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <Truck className={`h-4 w-4 ${cfg.text}`} />
                  </div>

                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
                        <span className={`size-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                      {viagem.cliente?.nome && (
                        <span className="text-sm font-semibold text-foreground truncate">{viagem.cliente.nome}</span>
                      )}
                      {!viagem.cliente?.nome && rota && (
                        <span className="text-sm font-semibold text-foreground truncate">{rota}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {viagem.cliente?.nome && rota && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[200px]">{rota}</span>
                        </span>
                      )}
                      {viagem.motorista?.nome && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 shrink-0" />{viagem.motorista.nome.split(" ")[0]}
                        </span>
                      )}
                      {viagem.veiculo?.placa_cavalo && (
                        <span className="flex items-center gap-1">
                          <Truck className="h-3 w-3 shrink-0" />{viagem.veiculo.placa_cavalo}
                        </span>
                      )}
                      {viagem.data_inicio && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 shrink-0" />{formatDate(viagem.data_inicio)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Frete */}
                  {viagem.valor_frete ? (
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(Number(viagem.valor_frete))}</p>
                      <p className="text-[10px] text-muted-foreground">frete</p>
                    </div>
                  ) : null}

                  {/* Seta + menu */}
                  <div className="flex items-center gap-1 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => openForm(viagem)}>
                          <Pencil className="h-4 w-4 mr-2" />Editar viagem
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {status === "Planejada" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(viagem, "Em andamento")}>
                            <Truck className="h-4 w-4 mr-2 text-blue-600" />Iniciar viagem
                          </DropdownMenuItem>
                        )}
                        {status === "Em andamento" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(viagem, "Concluida")}>
                            <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />Concluir viagem
                          </DropdownMenuItem>
                        )}
                        {status !== "Cancelada" && status !== "Concluida" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(viagem, "Cancelada")}>
                            <XCircle className="h-4 w-4 mr-2 text-rose-600" />Cancelar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteViagem(viagem)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cockpit Modal */}
      <Dialog open={cockpitOpen} onOpenChange={(open) => { setCockpitOpen(open); if (!open) { setCockpitData(null); setCockpitLoading(false) } }}>
        <DialogContent className="!w-[97vw] !max-w-[97vw] h-[95vh] overflow-hidden p-0 rounded-xl">
          <DialogHeader className="sr-only"><DialogTitle>Cockpit da Viagem</DialogTitle></DialogHeader>
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-background">
              {cockpitLoading && (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  <p className="text-sm">Carregando viagem...</p>
                </div>
              )}
              {!cockpitLoading && cockpitData && (
                <ViagemDetalheClient
                  viagem={cockpitData.viagem}
                  initialEventos={cockpitData.eventos}
                  initialCustos={cockpitData.custos}
                  initialReceitas={cockpitData.receitas}
                  initialDocumentos={cockpitData.documentos}
                  etaParametros={cockpitData.parametros}
                  embedded
                />
              )}
              {!cockpitLoading && !cockpitData && (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Não foi possível carregar a viagem.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nova / Editar Viagem */}
      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingViagem(null) }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader style={{ background: "linear-gradient(135deg, oklch(0.13 0.045 265) 0%, oklch(0.18 0.04 260) 100%)", padding: "1.25rem 1.5rem 1rem" }}>
            <DialogTitle className="text-xl font-bold text-white">{editingViagem ? "Editar Viagem" : "Nova Viagem"}</DialogTitle>
            <p className="text-xs text-white/50 mt-0.5">{editingViagem ? "Atualize os dados da viagem" : "Preencha os dados para iniciar a viagem"}</p>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            {/* Operação */}
            <div className="rounded-xl border border-blue-200/70 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50/60 border-b border-blue-200/60">
                <div className="size-1.5 rounded-full bg-blue-500" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-blue-700">Operação</p>
              </div>
              <div className="p-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Cliente</Label>
                  <Select value={formData.cliente_id} onValueChange={v => setFormData(p => ({ ...p, cliente_id: v }))}>
                    <SelectTrigger className="mt-1.5 text-sm h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Veículo</Label>
                  <Select value={formData.veiculo_id} onValueChange={v => setFormData(p => ({ ...p, veiculo_id: v }))}>
                    <SelectTrigger className="mt-1.5 text-sm h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa_cavalo || "Sem placa"}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Motorista</Label>
                  <Select value={formData.motorista_id} onValueChange={v => setFormData(p => ({ ...p, motorista_id: v }))}>
                    <SelectTrigger className="mt-1.5 text-sm h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{motoristas.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Rota */}
            <div className="rounded-xl border border-emerald-200/70 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50/60 border-b border-emerald-200/60">
                <div className="size-1.5 rounded-full bg-emerald-500" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">Rota</p>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Rota cadastrada</Label>
                  <Select value={formData.rota_id} onValueChange={handleRotaSelect}>
                    <SelectTrigger className="mt-1.5 text-sm h-9"><SelectValue placeholder="Selecione ou preencha manualmente" /></SelectTrigger>
                    <SelectContent>{rotas.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Origem</Label>
                    <Input className="mt-1.5 text-sm h-9" value={formData.origem_real} onChange={e => setFormData(p => ({ ...p, origem_real: e.target.value }))} placeholder="Cidade/UF" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Destino</Label>
                    <Input className="mt-1.5 text-sm h-9" value={formData.destino_real} onChange={e => setFormData(p => ({ ...p, destino_real: e.target.value }))} placeholder="Cidade/UF" />
                  </div>
                </div>
              </div>
            </div>

            {/* Agenda + Frete */}
            <div className="rounded-xl border border-violet-200/70 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50/60 border-b border-violet-200/60">
                <div className="size-1.5 rounded-full bg-violet-500" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-violet-700">Agenda & Frete</p>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Partida</Label>
                  <Input type="datetime-local" className="mt-1.5 text-sm h-9" value={formData.data_inicio} onChange={e => setFormData(p => ({ ...p, data_inicio: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Chegada</Label>
                  <Input type="datetime-local" className="mt-1.5 text-sm h-9" value={formData.data_fim} onChange={e => setFormData(p => ({ ...p, data_fim: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Valor frete</Label>
                  <Input type="number" step="0.01" className="mt-1.5 text-sm h-9" value={formData.valor_frete} onChange={e => setFormData(p => ({ ...p, valor_frete: e.target.value }))} placeholder="R$" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Status</Label>
                  <Select value={formData.status} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="mt-1.5 text-sm h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Planejada">Planejada</SelectItem>
                      <SelectItem value="Em andamento">Em andamento</SelectItem>
                      <SelectItem value="Concluida">Concluída</SelectItem>
                      <SelectItem value="Cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" className="h-9" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" className="h-9 gradient-primary font-semibold" disabled={isLoading}>
                {isLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                {editingViagem ? "Salvar" : "Criar viagem"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!deleteViagem} onOpenChange={(open) => { if (!open) setDeleteViagem(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir viagem?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Modals */}
      <QuickClienteModal open={quickClienteOpen} onOpenChange={setQuickClienteOpen} onCreated={(c) => { setClientes(p => [...p, c]); setFormData(p => ({ ...p, cliente_id: c.id })) }} />
      <QuickVeiculoModal open={quickVeiculoOpen} onOpenChange={setQuickVeiculoOpen} onCreated={(v) => { setVeiculos(p => [...p, v]); setFormData(p => ({ ...p, veiculo_id: v.id })) }} />
      <QuickMotoristaModal open={quickMotoristaOpen} onOpenChange={setQuickMotoristaOpen} onCreated={(m) => { setMotoristas(p => [...p, m]); setFormData(p => ({ ...p, motorista_id: m.id })) }} />
      <QuickRotaModal open={quickRotaOpen} onOpenChange={setQuickRotaOpen} onCreated={(r) => { setRotas(p => [...p, r]); handleRotaSelect(r.id) }} />
    </div>
  )
}
