"use client"

import React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { DataTable } from "@/components/data-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import type { Cliente } from "@/lib/types"
import { Building2 } from "lucide-react"

interface ClientesClientProps {
  initialClientes: Cliente[]
}

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
]

const FORMAS_PAGAMENTO = [
  "Boleto",
  "Deposito",
  "PIX",
  "Transferencia",
  "Cartao",
]

const CONDICOES_PAGAMENTO = [
  "A vista",
  "7 dias",
  "14 dias",
  "21 dias",
  "28 dias",
  "30 dias",
  "45 dias",
  "60 dias",
]

export function ClientesClient({ initialClientes }: ClientesClientProps) {
  const router = useRouter()
  const [clientes, setClientes] = useState(initialClientes)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    nome: "",
    cidade: "",
    estado: "",
    condicao_pagamento: "",
    forma_pagamento: "",
    observacoes: "",
  })

  const resetForm = () => {
    setFormData({
      nome: "",
      cidade: "",
      estado: "",
      condicao_pagamento: "",
      forma_pagamento: "",
      observacoes: "",
    })
    setSelectedCliente(null)
  }

  const handleAdd = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleEdit = (cliente: Cliente) => {
    setSelectedCliente(cliente)
    setFormData({
      nome: cliente.nome,
      cidade: cliente.cidade || "",
      estado: cliente.estado || "",
      condicao_pagamento: cliente.condicao_pagamento || "",
      forma_pagamento: cliente.forma_pagamento || "",
      observacoes: cliente.observacoes || "",
    })
    setIsDialogOpen(true)
  }

  const handleDelete = (cliente: Cliente) => {
    setSelectedCliente(cliente)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedCliente) return
    
    const supabase = createClient()
    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("id", selectedCliente.id)

    if (!error) {
      setClientes(clientes.filter(c => c.id !== selectedCliente.id))
    }
    setIsDeleteDialogOpen(false)
    setSelectedCliente(null)
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

    const clienteData = {
      ...formData,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }

    if (selectedCliente) {
      const { data, error } = await supabase
        .from("clientes")
        .update(clienteData)
        .eq("id", selectedCliente.id)
        .select()
        .single()

      if (!error && data) {
        setClientes(clientes.map(c => c.id === selectedCliente.id ? data : c))
      }
    } else {
      const { data, error } = await supabase
        .from("clientes")
        .insert(clienteData)
        .select()
        .single()

      if (!error && data) {
        setClientes([...clientes, data])
      }
    }

    setIsLoading(false)
    setIsDialogOpen(false)
    resetForm()
  }

  const columns = [
    { key: "nome" as const, label: "Nome" },
    { key: "cidade" as const, label: "Cidade" },
    { key: "estado" as const, label: "UF" },
    { key: "condicao_pagamento" as const, label: "Cond. Pagamento" },
    { key: "forma_pagamento" as const, label: "Forma Pagamento" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Building2 className="h-7 w-7 text-primary" />
          Clientes
        </h1>
        <p className="text-muted-foreground">
          Gerencie os clientes da sua transportadora
        </p>
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-6">
          <DataTable
            data={clientes}
            columns={columns}
            searchKey="nome"
            searchPlaceholder="Buscar cliente..."
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            addLabel="Novo Cliente"
            emptyMessage="Nenhum cliente cadastrado"
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedCliente ? "Editar Cliente" : "Novo Cliente"}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={formData.cidade}
                  onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="estado">Estado</Label>
                <Select
                  value={formData.estado}
                  onValueChange={(value) => setFormData({ ...formData, estado: value })}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="condicao_pagamento">Condicao Pagamento</Label>
                <Select
                  value={formData.condicao_pagamento}
                  onValueChange={(value) => setFormData({ ...formData, condicao_pagamento: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDICOES_PAGAMENTO.map((cond) => (
                      <SelectItem key={cond} value={cond}>{cond}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="forma_pagamento">Forma Pagamento</Label>
                <Select
                  value={formData.forma_pagamento}
                  onValueChange={(value) => setFormData({ ...formData, forma_pagamento: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map((forma) => (
                      <SelectItem key={forma} value={forma}>{forma}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="observacoes">Observacoes</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
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

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente {selectedCliente?.nome}?
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
