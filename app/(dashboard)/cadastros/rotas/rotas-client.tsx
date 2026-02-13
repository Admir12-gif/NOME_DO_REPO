"use client"

import React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { DataTable } from "@/components/data-table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import type { Rota, PontoIntermediario, PostoAbastecimento } from "@/lib/types"
import { Route, ArrowRight, Plus, X, GripVertical } from "lucide-react"

interface RotasClientProps {
  initialRotas: Rota[]
  initialPostos: PostoAbastecimento[]
}

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function RotasClient({ initialRotas, initialPostos }: RotasClientProps) {
  const [rotas, setRotas] = useState(initialRotas)
  const [postos, setPostos] = useState(initialPostos)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedRota, setSelectedRota] = useState<Rota | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    nome: "",
    origem_cidade: "",
    origem_estado: "",
    destino_cidade: "",
    destino_estado: "",
    km_planejado: "",
    pedagio_planejado: "",
    tempo_ciclo_esperado_horas: "",
  })
  const [selectedPostos, setSelectedPostos] = useState<string[]>([])
  const [pontosIntermediarios, setPontosIntermediarios] = useState<PontoIntermediario[]>([])

  const resetForm = () => {
    setFormData({
      nome: "",
      origem_cidade: "",
      origem_estado: "",
      destino_cidade: "",
      destino_estado: "",
      km_planejado: "",
      pedagio_planejado: "",
      tempo_ciclo_esperado_horas: "",
    })
    setSelectedPostos([])
    setPontosIntermediarios([])
    setSelectedRota(null)
  }

  const handleAdd = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleEdit = (rota: Rota) => {
    setSelectedRota(rota)
    setFormData({
      nome: rota.nome,
      origem_cidade: rota.origem_cidade || "",
      origem_estado: rota.origem_estado || "",
      destino_cidade: rota.destino_cidade || "",
      destino_estado: rota.destino_estado || "",
      km_planejado: rota.km_planejado?.toString() || "",
      pedagio_planejado: rota.pedagio_planejado?.toString() || "",
      tempo_ciclo_esperado_horas: rota.tempo_ciclo_esperado_horas?.toString() || "",
    })
    setSelectedPostos(rota.postos?.map(p => p.id) || [])
    setPontosIntermediarios(rota.pontos_intermediarios || [])
    setIsDialogOpen(true)
  }

  const handleDelete = (rota: Rota) => {
    setSelectedRota(rota)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedRota) return
    
    const supabase = createClient()
    const { error } = await supabase
      .from("rotas")
      .delete()
      .eq("id", selectedRota.id)

    if (!error) {
      setRotas(rotas.filter(r => r.id !== selectedRota.id))
    }
    setIsDeleteDialogOpen(false)
    setSelectedRota(null)
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

    if (!user) {
      setIsLoading(false)
      return
    }

    const validPontos = pontosIntermediarios.filter(p => p.cidade.trim() !== "")

    const rotaData = {
      nome: formData.nome,
      origem_cidade: formData.origem_cidade || null,
      origem_estado: formData.origem_estado || null,
      destino_cidade: formData.destino_cidade || null,
      destino_estado: formData.destino_estado || null,
      km_planejado: formData.km_planejado ? parseFloat(formData.km_planejado) : null,
      pedagio_planejado: formData.pedagio_planejado ? parseFloat(formData.pedagio_planejado) : null,
      tempo_ciclo_esperado_horas: formData.tempo_ciclo_esperado_horas ? parseFloat(formData.tempo_ciclo_esperado_horas) : null,
      locais_abastecimento: null, // Deprecated - using rota_postos junction table now
      pontos_intermediarios: validPontos.length > 0 ? validPontos : [],
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }

    if (selectedRota) {
      const { data, error } = await supabase
        .from("rotas")
        .update(rotaData)
        .eq("id", selectedRota.id)
        .select()
        .single()

      if (!error && data) {
        // Delete old rota_postos entries
        await supabase.from("rota_postos").delete().eq("rota_id", selectedRota.id)
        
        // Insert new rota_postos entries
        if (selectedPostos.length > 0) {
          const rotaPostosData = selectedPostos.map((postoId, index) => ({
            rota_id: selectedRota.id,
            posto_id: postoId,
            ordem: index,
          }))
          await supabase.from("rota_postos").insert(rotaPostosData)
        }
        
        setRotas(rotas.map(r => r.id === selectedRota.id ? data : r))
      }
    } else {
      const { data, error } = await supabase
        .from("rotas")
        .insert(rotaData)
        .select()
        .single()

      if (!error && data) {
        // Insert rota_postos entries
        if (selectedPostos.length > 0) {
          const rotaPostosData = selectedPostos.map((postoId, index) => ({
            rota_id: data.id,
            posto_id: postoId,
            ordem: index,
          }))
          await supabase.from("rota_postos").insert(rotaPostosData)
        }
        
        setRotas([...rotas, data])
      }
    }

    setIsLoading(false)
    setIsDialogOpen(false)
    resetForm()
  }

  const columns = [
    { key: "nome" as const, label: "Nome" },
    { 
      key: "origem" as const, 
      label: "Origem",
      render: (r: Rota) => r.origem_cidade ? `${r.origem_cidade}/${r.origem_estado}` : "-"
    },
    {
      key: "pontos" as const,
      label: "Pontos",
      render: (r: Rota) => {
        const pontos = r.pontos_intermediarios || []
        if (pontos.length === 0) return "-"
        return (
          <Badge variant="secondary" className="font-normal">
            {pontos.length} {pontos.length === 1 ? "ponto" : "pontos"}
          </Badge>
        )
      }
    },
    { 
      key: "destino" as const, 
      label: "Destino",
      render: (r: Rota) => r.destino_cidade ? `${r.destino_cidade}/${r.destino_estado}` : "-"
    },
    { 
      key: "km_planejado" as const, 
      label: "KM",
      render: (r: Rota) => r.km_planejado?.toLocaleString("pt-BR") || "-"
    },
    { 
      key: "pedagio_planejado" as const, 
      label: "Pedagio",
      render: (r: Rota) => r.pedagio_planejado ? formatCurrency(r.pedagio_planejado) : "-"
    },
    { 
      key: "tempo_ciclo_esperado_horas" as const, 
      label: "Tempo Ciclo (h)",
      render: (r: Rota) => r.tempo_ciclo_esperado_horas || "-"
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Route className="h-7 w-7 text-primary" />
          Rotas
        </h1>
        <p className="text-muted-foreground">
          Gerencie as rotas planejadas da sua transportadora
        </p>
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-6">
          <DataTable
            data={rotas}
            columns={columns}
            searchKey="nome"
            searchPlaceholder="Buscar rota..."
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            addLabel="Nova Rota"
            emptyMessage="Nenhuma rota cadastrada"
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRota ? "Editar Rota" : "Nova Rota"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome da Rota *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: SP-RJ Via Dutra"
                required
              />
            </div>

            {/* Origem */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-success flex items-center justify-center text-success-foreground text-xs font-bold">A</div>
                Origem
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs" htmlFor="origem_cidade">Cidade</Label>
                  <Input
                    id="origem_cidade"
                    value={formData.origem_cidade}
                    onChange={(e) => setFormData({ ...formData, origem_cidade: e.target.value })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs" htmlFor="origem_estado">Estado</Label>
                  <Select
                    value={formData.origem_estado}
                    onValueChange={(value) => setFormData({ ...formData, origem_estado: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
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
                <ArrowRight className="h-4 w-4" /> Destino
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs" htmlFor="destino_cidade">Cidade</Label>
                  <Input
                    id="destino_cidade"
                    value={formData.destino_cidade}
                    onChange={(e) => setFormData({ ...formData, destino_cidade: e.target.value })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs" htmlFor="destino_estado">Estado</Label>
                  <Select
                    value={formData.destino_estado}
                    onValueChange={(value) => setFormData({ ...formData, destino_estado: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="km_planejado">KM Planejado</Label>
                <Input
                  id="km_planejado"
                  type="number"
                  value={formData.km_planejado}
                  onChange={(e) => setFormData({ ...formData, km_planejado: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pedagio_planejado">Pedagio (R$)</Label>
                <Input
                  id="pedagio_planejado"
                  type="number"
                  step="0.01"
                  value={formData.pedagio_planejado}
                  onChange={(e) => setFormData({ ...formData, pedagio_planejado: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tempo_ciclo_esperado_horas">Tempo Ciclo (h)</Label>
                <Input
                  id="tempo_ciclo_esperado_horas"
                  type="number"
                  step="0.5"
                  value={formData.tempo_ciclo_esperado_horas}
                  onChange={(e) => setFormData({ ...formData, tempo_ciclo_esperado_horas: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Postos de Abastecimento</Label>
              <div className="flex flex-wrap gap-2 p-3 min-h-[100px] rounded-md border border-input bg-background">
                {postos.map((posto) => {
                  const isSelected = selectedPostos.includes(posto.id)
                  return (
                    <Button
                      key={posto.id}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedPostos(
                          isSelected
                            ? selectedPostos.filter(id => id !== posto.id)
                            : [...selectedPostos, posto.id]
                        )
                      }}
                    >
                      {posto.nome}
                      {posto.localidade && ` (${posto.localidade})`}
                    </Button>
                  )
                })}
                {postos.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum posto cadastrado</p>
                )}
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

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a rota {selectedRota?.nome}?
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
    </div>
  )
}
