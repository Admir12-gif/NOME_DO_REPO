"use client"

import React, { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import type { Cliente, Veiculo, Motorista, Rota, PontoIntermediario } from "@/lib/types"
import { Users, Truck, User, Route, Plus, X, GripVertical } from "lucide-react"

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO"
]

// ---- Quick Cliente Modal ----
export function QuickClienteModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (cliente: Cliente) => void
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [form, setForm] = useState({ nome: "", cidade: "", estado: "", condicao_pagamento: "", forma_pagamento: "", observacoes: "" })

  const resetForm = () => setForm({ nome: "", cidade: "", estado: "", condicao_pagamento: "", forma_pagamento: "", observacoes: "" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsLoading(false); return }

    const { data, error } = await supabase
      .from("clientes")
      .insert({
        nome: form.nome,
        cidade: form.cidade || null,
        estado: form.estado || null,
        condicao_pagamento: form.condicao_pagamento || null,
        forma_pagamento: form.forma_pagamento || null,
        observacoes: form.observacoes || null,
        user_id: user.id,
      })
      .select()
      .single()

    if (!error && data) {
      onCreated(data)
      resetForm()
      onOpenChange(false)
    }
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Cadastro Rapido - Cliente
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do cliente" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{ESTADOS.map((uf) => (<SelectItem key={uf} value={uf}>{uf}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Cond. Pagamento</Label>
              <Input value={form.condicao_pagamento} onChange={(e) => setForm({ ...form, condicao_pagamento: e.target.value })} placeholder="Ex: 30 dias" />
            </div>
            <div className="grid gap-2">
              <Label>Forma Pagamento</Label>
              <Input value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })} placeholder="Ex: Boleto" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---- Quick Veiculo Modal ----
export function QuickVeiculoModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (veiculo: Veiculo) => void
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [form, setForm] = useState({ placa_cavalo: "", placa_carreta: "", modelo: "", ano: "", hodometro_atual: "", meta_consumo: "" })

  const resetForm = () => setForm({ placa_cavalo: "", placa_carreta: "", modelo: "", ano: "", hodometro_atual: "", meta_consumo: "" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsLoading(false); return }

    const { data, error } = await supabase
      .from("veiculos")
      .insert({
        placa_cavalo: form.placa_cavalo,
        placa_carreta: form.placa_carreta || null,
        modelo: form.modelo || null,
        ano: form.ano ? parseInt(form.ano) : null,
        hodometro_atual: form.hodometro_atual ? parseFloat(form.hodometro_atual) : 0,
        meta_consumo: form.meta_consumo ? parseFloat(form.meta_consumo) : null,
        user_id: user.id,
      })
      .select()
      .single()

    if (!error && data) {
      onCreated(data)
      resetForm()
      onOpenChange(false)
    }
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Cadastro Rapido - Veiculo
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Placa Cavalo *</Label>
              <Input value={form.placa_cavalo} onChange={(e) => setForm({ ...form, placa_cavalo: e.target.value.toUpperCase() })} placeholder="ABC1D23" required />
            </div>
            <div className="grid gap-2">
              <Label>Placa Carreta</Label>
              <Input value={form.placa_carreta} onChange={(e) => setForm({ ...form, placa_carreta: e.target.value.toUpperCase() })} placeholder="XYZ4E56" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Modelo</Label>
              <Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} placeholder="Ex: Scania R450" />
            </div>
            <div className="grid gap-2">
              <Label>Ano</Label>
              <Input type="number" value={form.ano} onChange={(e) => setForm({ ...form, ano: e.target.value })} placeholder="2024" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Hodometro (km)</Label>
              <Input type="number" value={form.hodometro_atual} onChange={(e) => setForm({ ...form, hodometro_atual: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Meta Consumo (km/l)</Label>
              <Input type="number" step="0.01" value={form.meta_consumo} onChange={(e) => setForm({ ...form, meta_consumo: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---- Quick Motorista Modal ----
export function QuickMotoristaModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (motorista: Motorista) => void
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [form, setForm] = useState({ nome: "", tipo: "", custo_fixo_mensal: "", custo_variavel_padrao: "" })

  const resetForm = () => setForm({ nome: "", tipo: "", custo_fixo_mensal: "", custo_variavel_padrao: "" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsLoading(false); return }

    const { data, error } = await supabase
      .from("motoristas")
      .insert({
        nome: form.nome,
        tipo: form.tipo || null,
        custo_fixo_mensal: form.custo_fixo_mensal ? parseFloat(form.custo_fixo_mensal) : 0,
        custo_variavel_padrao: form.custo_variavel_padrao ? parseFloat(form.custo_variavel_padrao) : 0,
        user_id: user.id,
      })
      .select()
      .single()

    if (!error && data) {
      onCreated(data)
      resetForm()
      onOpenChange(false)
    }
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Cadastro Rapido - Motorista
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" required />
          </div>
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CLT">CLT</SelectItem>
                <SelectItem value="Agregado">Agregado</SelectItem>
                <SelectItem value="Terceiro">Terceiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Custo Fixo Mensal (R$)</Label>
              <Input type="number" step="0.01" value={form.custo_fixo_mensal} onChange={(e) => setForm({ ...form, custo_fixo_mensal: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Custo Variavel (R$)</Label>
              <Input type="number" step="0.01" value={form.custo_variavel_padrao} onChange={(e) => setForm({ ...form, custo_variavel_padrao: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---- Quick Rota Modal (with intermediate points) ----
export function QuickRotaModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (rota: Rota) => void
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [form, setForm] = useState({
    nome: "",
    origem_cidade: "",
    origem_estado: "",
    destino_cidade: "",
    destino_estado: "",
    km_planejado: "",
    pedagio_planejado: "",
    tempo_ciclo_esperado_horas: "",
    locais_abastecimento: "",
  })
  const [pontosIntermediarios, setPontosIntermediarios] = useState<PontoIntermediario[]>([])

  const resetForm = () => {
    setForm({ nome: "", origem_cidade: "", origem_estado: "", destino_cidade: "", destino_estado: "", km_planejado: "", pedagio_planejado: "", tempo_ciclo_esperado_horas: "", locais_abastecimento: "" })
    setPontosIntermediarios([])
  }

  const addPonto = () => {
    setPontosIntermediarios([...pontosIntermediarios, { cidade: "", estado: "", observacao: "" }])
  }

  const removePonto = (index: number) => {
    setPontosIntermediarios(pontosIntermediarios.filter((_, i) => i !== index))
  }

  const updatePonto = (index: number, field: keyof PontoIntermediario, value: string) => {
    const updated = [...pontosIntermediarios]
    updated[index] = { ...updated[index], [field]: value }
    setPontosIntermediarios(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsLoading(false); return }

    const validPontos = pontosIntermediarios.filter(p => p.cidade.trim() !== "")

    const { data, error } = await supabase
      .from("rotas")
      .insert({
        nome: form.nome,
        origem_cidade: form.origem_cidade || null,
        origem_estado: form.origem_estado || null,
        destino_cidade: form.destino_cidade || null,
        destino_estado: form.destino_estado || null,
        km_planejado: form.km_planejado ? parseFloat(form.km_planejado) : null,
        pedagio_planejado: form.pedagio_planejado ? parseFloat(form.pedagio_planejado) : null,
        tempo_ciclo_esperado_horas: form.tempo_ciclo_esperado_horas ? parseFloat(form.tempo_ciclo_esperado_horas) : null,
        locais_abastecimento: form.locais_abastecimento || null,
        pontos_intermediarios: validPontos.length > 0 ? validPontos : [],
        user_id: user.id,
      })
      .select()
      .single()

    if (!error && data) {
      onCreated(data)
      resetForm()
      onOpenChange(false)
    }
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            Cadastro Rapido - Rota
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label>Nome da Rota *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: SP-RJ Via Dutra" required />
          </div>

          {/* Origem */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-success flex items-center justify-center text-success-foreground text-xs font-bold">A</div>
              Origem
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Cidade</Label>
                <Input value={form.origem_cidade} onChange={(e) => setForm({ ...form, origem_cidade: e.target.value })} placeholder="Cidade" />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Estado</Label>
                <Select value={form.origem_estado} onValueChange={(v) => setForm({ ...form, origem_estado: v })}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{ESTADOS.map((uf) => (<SelectItem key={uf} value={uf}>{uf}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Pontos Intermediarios */}
          {pontosIntermediarios.length > 0 && (
            <div className="space-y-2">
              {pontosIntermediarios.map((ponto, index) => (
                <div key={index} className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                        <GripVertical className="h-3 w-3" />
                      </div>
                      Ponto {index + 1}
                    </h4>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removePonto(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <div className="col-span-2 grid gap-1">
                      <Label className="text-xs">Cidade</Label>
                      <Input value={ponto.cidade} onChange={(e) => updatePonto(index, "cidade", e.target.value)} placeholder="Cidade" />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">UF</Label>
                      <Select value={ponto.estado} onValueChange={(v) => updatePonto(index, "estado", v)}>
                        <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                        <SelectContent>{ESTADOS.map((uf) => (<SelectItem key={uf} value={uf}>{uf}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 grid gap-1">
                      <Label className="text-xs">Obs.</Label>
                      <Input value={ponto.observacao || ""} onChange={(e) => updatePonto(index, "observacao", e.target.value)} placeholder="Parada, descarga..." />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button type="button" variant="outline" size="sm" className="w-full border-dashed bg-transparent" onClick={addPonto}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Ponto Intermediario
          </Button>

          {/* Destino */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-destructive flex items-center justify-center text-destructive-foreground text-xs font-bold">B</div>
              Destino
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Cidade</Label>
                <Input value={form.destino_cidade} onChange={(e) => setForm({ ...form, destino_cidade: e.target.value })} placeholder="Cidade" />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Estado</Label>
                <Select value={form.destino_estado} onValueChange={(v) => setForm({ ...form, destino_estado: v })}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{ESTADOS.map((uf) => (<SelectItem key={uf} value={uf}>{uf}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">KM Planejado</Label>
              <Input type="number" value={form.km_planejado} onChange={(e) => setForm({ ...form, km_planejado: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Pedagio (R$)</Label>
              <Input type="number" step="0.01" value={form.pedagio_planejado} onChange={(e) => setForm({ ...form, pedagio_planejado: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Tempo Ciclo (h)</Label>
              <Input type="number" step="0.5" value={form.tempo_ciclo_esperado_horas} onChange={(e) => setForm({ ...form, tempo_ciclo_esperado_horas: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Locais de Abastecimento</Label>
            <Textarea value={form.locais_abastecimento} onChange={(e) => setForm({ ...form, locais_abastecimento: e.target.value })} placeholder="Ex: Posto Shell KM 150, Posto BR KM 320" rows={2} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
