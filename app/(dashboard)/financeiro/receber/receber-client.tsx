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
import type { ContaReceber, Cliente, Viagem } from "@/lib/types"
import { ArrowUpRight, CheckCircle } from "lucide-react"

interface ContasReceberClientProps {
  initialContas: ContaReceber[]
  clientes: Cliente[]
  viagens: Viagem[]
}

const FORMAS_PAGAMENTO = ["Boleto", "Deposito", "PIX", "Transferencia", "Cartao"]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR")
}

function isOverdue(dateStr: string, status: string) {
  if (status === "Recebido") return false
  return new Date(dateStr) < new Date()
}

export function ContasReceberClient({ 
  initialContas, 
  clientes,
  viagens 
}: ContasReceberClientProps) {
  const [contas, setContas] = useState(initialContas)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false)
  const [selectedConta, setSelectedConta] = useState<ContaReceber | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [receiveData, setReceiveData] = useState({
    data_recebimento: new Date().toISOString().split("T")[0],
    forma_pagamento: "",
  })
  const [formData, setFormData] = useState({
    cliente_id: "",
    viagem_id: "",
    data_emissao: new Date().toISOString().split("T")[0],
    data_vencimento: "",
    valor: "",
    forma_pagamento: "",
    observacao: "",
  })

  const resetForm = () => {
    setFormData({
      cliente_id: "",
      viagem_id: "",
      data_emissao: new Date().toISOString().split("T")[0],
      data_vencimento: "",
      valor: "",
      forma_pagamento: "",
      observacao: "",
    })
    setSelectedConta(null)
  }

  const handleAdd = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleEdit = (conta: ContaReceber) => {
    setSelectedConta(conta)
    setFormData({
      cliente_id: conta.cliente_id || "",
      viagem_id: conta.viagem_id || "",
      data_emissao: conta.data_emissao,
      data_vencimento: conta.data_vencimento,
      valor: conta.valor.toString(),
      forma_pagamento: conta.forma_pagamento || "",
      observacao: conta.observacao || "",
    })
    setIsDialogOpen(true)
  }

  const handleReceive = (conta: ContaReceber) => {
    setSelectedConta(conta)
    setReceiveData({
      data_recebimento: new Date().toISOString().split("T")[0],
      forma_pagamento: conta.forma_pagamento || "",
    })
    setIsReceiveDialogOpen(true)
  }

  const handleDelete = (conta: ContaReceber) => {
    setSelectedConta(conta)
    setIsDeleteDialogOpen(true)
  }

  const confirmReceive = async () => {
    if (!selectedConta) return
    
    const supabase = createClient()
    const { data, error } = await supabase
      .from("contas_receber")
      .update({
        status: "Recebido",
        data_recebimento: receiveData.data_recebimento,
        forma_pagamento: receiveData.forma_pagamento,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedConta.id)
      .select("*, cliente:clientes(*), viagem:viagens(*)")
      .single()

    if (!error && data) {
      setContas(contas.map(c => c.id === selectedConta.id ? data : c))
    }
    setIsReceiveDialogOpen(false)
    setSelectedConta(null)
  }

  const confirmDelete = async () => {
    if (!selectedConta) return
    
    const supabase = createClient()
    const { error } = await supabase
      .from("contas_receber")
      .delete()
      .eq("id", selectedConta.id)

    if (!error) {
      setContas(contas.filter(c => c.id !== selectedConta.id))
    }
    setIsDeleteDialogOpen(false)
    setSelectedConta(null)
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

    const contaData = {
      cliente_id: formData.cliente_id || null,
      viagem_id: formData.viagem_id || null,
      data_emissao: formData.data_emissao,
      data_vencimento: formData.data_vencimento,
      valor: parseFloat(formData.valor),
      forma_pagamento: formData.forma_pagamento || null,
      observacao: formData.observacao || null,
      status: isOverdue(formData.data_vencimento, "Em aberto") ? "Atrasado" : "Em aberto" as const,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }

    if (selectedConta) {
      const { data, error } = await supabase
        .from("contas_receber")
        .update(contaData)
        .eq("id", selectedConta.id)
        .select("*, cliente:clientes(*), viagem:viagens(*)")
        .single()

      if (!error && data) {
        setContas(contas.map(c => c.id === selectedConta.id ? data : c))
      }
    } else {
      const { data, error } = await supabase
        .from("contas_receber")
        .insert(contaData)
        .select("*, cliente:clientes(*), viagem:viagens(*)")
        .single()

      if (!error && data) {
        setContas([...contas, data])
      }
    }

    setIsLoading(false)
    setIsDialogOpen(false)
    resetForm()
  }

  const statusColors: Record<string, string> = {
    "Em aberto": "bg-warning/10 text-warning-foreground border-warning/30",
    Recebido: "bg-success/10 text-success",
    Atrasado: "bg-destructive/10 text-destructive",
  }

  const totalEmAberto = contas.filter(c => c.status === "Em aberto").reduce((sum, c) => sum + c.valor, 0)
  const totalRecebido = contas.filter(c => c.status === "Recebido").reduce((sum, c) => sum + c.valor, 0)
  const totalAtrasado = contas.filter(c => c.status === "Atrasado" || (c.status === "Em aberto" && isOverdue(c.data_vencimento, c.status))).reduce((sum, c) => sum + c.valor, 0)

  const columns = [
    { 
      key: "cliente.nome" as const, 
      label: "Cliente",
      render: (c: ContaReceber) => c.cliente?.nome || "-"
    },
    { 
      key: "data_vencimento" as const, 
      label: "Vencimento",
      render: (c: ContaReceber) => formatDate(c.data_vencimento)
    },
    { 
      key: "valor" as const, 
      label: "Valor",
      render: (c: ContaReceber) => formatCurrency(c.valor)
    },
    { 
      key: "status" as const, 
      label: "Status",
      render: (c: ContaReceber) => {
        const status = c.status === "Em aberto" && isOverdue(c.data_vencimento, c.status) ? "Atrasado" : c.status
        return <Badge className={statusColors[status]}>{status}</Badge>
      }
    },
    { 
      key: "actions" as const, 
      label: "",
      render: (c: ContaReceber) => c.status !== "Recebido" ? (
        <Button size="sm" variant="outline" onClick={() => handleReceive(c)}>
          <CheckCircle className="h-4 w-4 mr-1" />
          Receber
        </Button>
      ) : null
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <ArrowUpRight className="h-7 w-7 text-success" />
          Contas a Receber
        </h1>
        <p className="text-muted-foreground">
          Gerencie os recebimentos da sua transportadora
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Em Aberto</p>
            <p className="text-2xl font-bold text-warning-foreground">{formatCurrency(totalEmAberto)}</p>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Recebido</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(totalRecebido)}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Atrasado</p>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(totalAtrasado)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-6">
          <DataTable
            data={contas}
            columns={columns}
            searchPlaceholder="Buscar conta..."
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            addLabel="Nova Conta"
            emptyMessage="Nenhuma conta a receber"
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedConta ? "Editar Conta" : "Nova Conta a Receber"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label>Cliente</Label>
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
              <Label>Viagem (opcional)</Label>
              <Select
                value={formData.viagem_id}
                onValueChange={(value) => setFormData({ ...formData, viagem_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {viagens.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.origem_real} - {v.destino_real}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Data Emissao</Label>
                <Input
                  type="date"
                  value={formData.data_emissao}
                  onChange={(e) => setFormData({ ...formData, data_emissao: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Data Vencimento *</Label>
                <Input
                  type="date"
                  value={formData.data_vencimento}
                  onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Forma Pagamento</Label>
                <Select
                  value={formData.forma_pagamento}
                  onValueChange={(value) => setFormData({ ...formData, forma_pagamento: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Observacao</Label>
              <Textarea
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                rows={2}
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

      <Dialog open={isReceiveDialogOpen} onOpenChange={setIsReceiveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Recebimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Valor a receber</p>
              <p className="text-2xl font-bold text-success">
                {selectedConta && formatCurrency(selectedConta.valor)}
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Data do Recebimento</Label>
              <Input
                type="date"
                value={receiveData.data_recebimento}
                onChange={(e) => setReceiveData({ ...receiveData, data_recebimento: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Forma de Pagamento</Label>
              <Select
                value={receiveData.forma_pagamento}
                onValueChange={(value) => setReceiveData({ ...receiveData, forma_pagamento: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsReceiveDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmReceive} className="bg-success text-success-foreground hover:bg-success/90">
                Confirmar Recebimento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conta a receber?
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
