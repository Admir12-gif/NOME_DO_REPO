"use client"

import React, { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import type { Rota, PostoAbastecimento } from "@/lib/types"

interface RotasClientProps {
  initialRotas: Rota[]
  initialPostos: PostoAbastecimento[]
}

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO"
]

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

export function RotasClient({ initialRotas, initialPostos }: RotasClientProps) {
  const [rotas, setRotas] = useState(initialRotas)
  const [postos] = useState(initialPostos)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedRota, setSelectedRota] = useState<Rota | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedPostos, setSelectedPostos] = useState<string[]>([])
  const [formData, setFormData] = useState({
    nome: "", origem_cidade: "", origem_estado: "",
    destino_cidade: "", destino_estado: "",
    km_planejado: "", pedagio_planejado: "", tempo_ciclo_esperado_horas: "",
  })

  const resetForm = () => {
    setFormData({ nome: "", origem_cidade: "", origem_estado: "", destino_cidade: "", destino_estado: "", km_planejado: "", pedagio_planejado: "", tempo_ciclo_esperado_horas: "" })
    setSelectedPostos([])
    setSelectedRota(null)
  }

  const handleAdd = () => { resetForm(); setDialogOpen(true) }

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
    setDialogOpen(true)
  }

  const handleDelete = (rota: Rota) => { setSelectedRota(rota); setDeleteDialogOpen(true) }

  const confirmDelete = async () => {
    if (!selectedRota) return
    const supabase = createClient()
    const { error } = await supabase.from("rotas").delete().eq("id", selectedRota.id)
    if (!error) setRotas(rotas.filter(r => r.id !== selectedRota.id))
    setDeleteDialogOpen(false)
    setSelectedRota(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsLoading(false); return }

    const rotaData = {
      nome: formData.nome,
      origem_cidade: formData.origem_cidade || null,
      origem_estado: formData.origem_estado || null,
      destino_cidade: formData.destino_cidade || null,
      destino_estado: formData.destino_estado || null,
      km_planejado: formData.km_planejado ? parseFloat(formData.km_planejado) : null,
      pedagio_planejado: formData.pedagio_planejado ? parseFloat(formData.pedagio_planejado) : null,
      tempo_ciclo_esperado_horas: formData.tempo_ciclo_esperado_horas ? parseFloat(formData.tempo_ciclo_esperado_horas) : null,
      pontos_intermediarios: [],
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }

    if (selectedRota) {
      const { data, error } = await supabase.from("rotas").update(rotaData).eq("id", selectedRota.id).select().single()
      if (!error && data) {
        await supabase.from("rota_postos").delete().eq("rota_id", selectedRota.id)
        if (selectedPostos.length > 0) {
          await supabase.from("rota_postos").insert(selectedPostos.map((postoId, i) => ({ rota_id: selectedRota.id, posto_id: postoId, ordem: i })))
        }
        setRotas(rotas.map(r => r.id === selectedRota.id ? data : r))
      }
    } else {
      const { data, error } = await supabase.from("rotas").insert(rotaData).select().single()
      if (!error && data) {
        if (selectedPostos.length > 0) {
          await supabase.from("rota_postos").insert(selectedPostos.map((postoId, i) => ({ rota_id: data.id, posto_id: postoId, ordem: i })))
        }
        setRotas([...rotas, data])
      }
    }

    setIsLoading(false)
    setDialogOpen(false)
    resetForm()
  }

  const columns = [
    { key: "nome" as const, label: "Nome" },
    { key: "origem" as const, label: "Origem", render: (r: Rota) => r.origem_cidade ? `${r.origem_cidade}/${r.origem_estado}` : "—" },
    { key: "destino" as const, label: "Destino", render: (r: Rota) => r.destino_cidade ? `${r.destino_cidade}/${r.destino_estado}` : "—" },
    { key: "km_planejado" as const, label: "KM", render: (r: Rota) => r.km_planejado?.toLocaleString("pt-BR") || "—" },
    { key: "pedagio_planejado" as const, label: "Pedágio", render: (r: Rota) => r.pedagio_planejado ? formatCurrency(r.pedagio_planejado) : "—" },
    { key: "tempo_ciclo_esperado_horas" as const, label: "Tempo (h)", render: (r: Rota) => r.tempo_ciclo_esperado_horas || "—" },
  ]

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Rotas</h1>
          <p className="page-subtitle">Rotas cadastradas com origens e destinos</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/60 shadow-sm p-5">
        <DataTable
          data={rotas} columns={columns} searchKey="nome"
          searchPlaceholder="Buscar por nome, origem, destino..."
          onAdd={handleAdd} onEdit={handleEdit} onDelete={handleDelete}
          addLabel="Nova Rota" emptyMessage="Nenhuma rota cadastrada"
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedRota ? "Editar Rota" : "Nova Rota"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">

            <div>
              <Label htmlFor="nome">Nome da Rota <span className="text-destructive">*</span></Label>
              <Input id="nome" className="mt-1.5" value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: SP-RJ Via Dutra" required />
            </div>

            {/* Origem */}
            <div className="rounded-xl border border-emerald-200/70 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50/60 border-b border-emerald-200/60">
                <div className="size-5 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[10px] font-bold">A</div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">Origem</p>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Cidade</Label>
                  <Input className="mt-1.5 text-sm" value={formData.origem_cidade} onChange={e => setFormData({ ...formData, origem_cidade: e.target.value })} placeholder="Ex: São Paulo" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Estado</Label>
                  <Select value={formData.origem_estado} onValueChange={v => setFormData({ ...formData, origem_estado: v })}>
                    <SelectTrigger className="mt-1.5 text-sm"><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>{ESTADOS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Destino */}
            <div className="rounded-xl border border-red-200/70 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50/60 border-b border-red-200/60">
                <div className="size-5 rounded-full bg-red-600 flex items-center justify-center text-white text-[10px] font-bold">B</div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-red-700">Destino</p>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Cidade</Label>
                  <Input className="mt-1.5 text-sm" value={formData.destino_cidade} onChange={e => setFormData({ ...formData, destino_cidade: e.target.value })} placeholder="Ex: Rio de Janeiro" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Estado</Label>
                  <Select value={formData.destino_estado} onValueChange={v => setFormData({ ...formData, destino_estado: v })}>
                    <SelectTrigger className="mt-1.5 text-sm"><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>{ESTADOS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Métricas */}
            <div className="rounded-xl border border-blue-200/70 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50/60 border-b border-blue-200/60">
                <div className="size-1.5 rounded-full bg-blue-500" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-blue-700">Métricas</p>
              </div>
              <div className="p-4 grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">KM Planejado</Label>
                  <Input type="number" className="mt-1.5 text-sm" value={formData.km_planejado} onChange={e => setFormData({ ...formData, km_planejado: e.target.value })} placeholder="2800" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Pedágio (R$)</Label>
                  <Input type="number" step="0.01" className="mt-1.5 text-sm" value={formData.pedagio_planejado} onChange={e => setFormData({ ...formData, pedagio_planejado: e.target.value })} placeholder="320" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Tempo (h)</Label>
                  <Input type="number" step="0.5" className="mt-1.5 text-sm" value={formData.tempo_ciclo_esperado_horas} onChange={e => setFormData({ ...formData, tempo_ciclo_esperado_horas: e.target.value })} placeholder="42" />
                </div>
              </div>
            </div>

            {/* Postos de abastecimento */}
            {postos.length > 0 && (
              <div className="rounded-xl border border-amber-200/70 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50/60 border-b border-amber-200/60">
                  <div className="size-1.5 rounded-full bg-amber-500" />
                  <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Postos de Abastecimento</p>
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {postos.map(posto => {
                    const sel = selectedPostos.includes(posto.id)
                    return (
                      <button
                        key={posto.id} type="button"
                        onClick={() => setSelectedPostos(sel ? selectedPostos.filter(id => id !== posto.id) : [...selectedPostos, posto.id])}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${sel ? "bg-amber-600 text-white border-amber-600" : "bg-background border-border/60 text-muted-foreground hover:border-amber-400 hover:text-foreground"}`}
                      >
                        {posto.nome}{posto.localidade ? ` (${posto.localidade})` : ""}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isLoading}>{isLoading ? "Salvando..." : "Salvar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir rota?</AlertDialogTitle>
            <AlertDialogDescription>A rota <strong>{selectedRota?.nome}</strong> será removida permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
