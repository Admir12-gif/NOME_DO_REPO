"use client"

import React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { DataTable } from "@/components/data-table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import type { Motorista } from "@/lib/types"
import { Users } from "lucide-react"

interface MotoristasClientProps {
  initialMotoristas: Motorista[]
}

const TIPOS_MOTORISTA = [
  { value: "CLT", label: "CLT" },
  { value: "Agregado", label: "Agregado" },
  { value: "Terceiro", label: "Terceiro" },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function MotoristasClient({ initialMotoristas }: MotoristasClientProps) {
  const [motoristas, setMotoristas] = useState(initialMotoristas)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedMotorista, setSelectedMotorista] = useState<Motorista | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    nome: "",
    tipo: "",
    custo_fixo_mensal: "",
    custo_variavel_padrao: "",
  })

  const resetForm = () => {
    setFormData({
      nome: "",
      tipo: "",
      custo_fixo_mensal: "",
      custo_variavel_padrao: "",
    })
    setSelectedMotorista(null)
  }

  const handleAdd = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleEdit = (motorista: Motorista) => {
    setSelectedMotorista(motorista)
    setFormData({
      nome: motorista.nome,
      tipo: motorista.tipo || "",
      custo_fixo_mensal: motorista.custo_fixo_mensal?.toString() || "",
      custo_variavel_padrao: motorista.custo_variavel_padrao?.toString() || "",
    })
    setIsDialogOpen(true)
  }

  const handleDelete = (motorista: Motorista) => {
    setSelectedMotorista(motorista)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedMotorista) return
    
    const supabase = createClient()
    const { error } = await supabase
      .from("motoristas")
      .delete()
      .eq("id", selectedMotorista.id)

    if (!error) {
      setMotoristas(motoristas.filter(m => m.id !== selectedMotorista.id))
    }
    setIsDeleteDialogOpen(false)
    setSelectedMotorista(null)
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

    const motoristaData = {
      nome: formData.nome,
      tipo: formData.tipo || null,
      custo_fixo_mensal: formData.custo_fixo_mensal ? parseFloat(formData.custo_fixo_mensal) : 0,
      custo_variavel_padrao: formData.custo_variavel_padrao ? parseFloat(formData.custo_variavel_padrao) : 0,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }

    if (selectedMotorista) {
      const { data, error } = await supabase
        .from("motoristas")
        .update(motoristaData)
        .eq("id", selectedMotorista.id)
        .select()
        .single()

      if (!error && data) {
        setMotoristas(motoristas.map(m => m.id === selectedMotorista.id ? data : m))
      }
    } else {
      const { data, error } = await supabase
        .from("motoristas")
        .insert(motoristaData)
        .select()
        .single()

      if (!error && data) {
        setMotoristas([...motoristas, data])
      }
    }

    setIsLoading(false)
    setIsDialogOpen(false)
    resetForm()
  }

  const tipoColors: Record<string, string> = {
    CLT: "bg-primary/10 text-primary",
    Agregado: "bg-chart-2/10 text-chart-2",
    Terceiro: "bg-chart-3/10 text-chart-3",
  }

  const columns = [
    { key: "nome" as const, label: "Nome" },
    { 
      key: "tipo" as const, 
      label: "Tipo",
      render: (m: Motorista) => m.tipo ? (
        <Badge className={tipoColors[m.tipo]}>{m.tipo}</Badge>
      ) : "-"
    },
    { 
      key: "custo_fixo_mensal" as const, 
      label: "Custo Fixo Mensal",
      render: (m: Motorista) => formatCurrency(m.custo_fixo_mensal)
    },
    { 
      key: "custo_variavel_padrao" as const, 
      label: "Custo Variavel/Viagem",
      render: (m: Motorista) => formatCurrency(m.custo_variavel_padrao)
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Users className="h-7 w-7 text-primary" />
          Motoristas
        </h1>
        <p className="text-muted-foreground">
          Gerencie os motoristas da sua transportadora
        </p>
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-6">
          <DataTable
            data={motoristas}
            columns={columns}
            searchKey="nome"
            searchPlaceholder="Buscar motorista..."
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            addLabel="Novo Motorista"
            emptyMessage="Nenhum motorista cadastrado"
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedMotorista ? "Editar Motorista" : "Novo Motorista"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tipo">Tipo de Vinculo</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_MOTORISTA.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="custo_fixo_mensal">Custo Fixo Mensal (R$)</Label>
                <Input
                  id="custo_fixo_mensal"
                  type="number"
                  step="0.01"
                  value={formData.custo_fixo_mensal}
                  onChange={(e) => setFormData({ ...formData, custo_fixo_mensal: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="custo_variavel_padrao">Custo Variavel/Viagem (R$)</Label>
                <Input
                  id="custo_variavel_padrao"
                  type="number"
                  step="0.01"
                  value={formData.custo_variavel_padrao}
                  onChange={(e) => setFormData({ ...formData, custo_variavel_padrao: e.target.value })}
                  placeholder="0.00"
                />
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
              Tem certeza que deseja excluir o motorista {selectedMotorista?.nome}?
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
