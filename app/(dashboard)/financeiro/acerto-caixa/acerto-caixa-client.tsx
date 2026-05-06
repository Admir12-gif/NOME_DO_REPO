// app/(dashboard)/financeiro/acerto-caixa/acerto-caixa-client.tsx
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DataTable } from '@/components/data-table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Plus, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import {
  obterItensNaoAcertados,
  criarAcerto,
  obterResumoAcerto,
  obterAcertos
} from '@/lib/supabase/acerto-caixa'
import type { ItemAcerto, ResumoAcerto, AcertoCaixa } from '@/lib/supabase/acerto-caixa'
import { formatCurrency } from '@/lib/utils'

interface AcertoCaixaClientProps {
  userId: string
}

export function AcertoCaixaClient({ userId }: AcertoCaixaClientProps) {
  const [itensNaoAcertados, setItensNaoAcertados] = useState<ItemAcerto[]>([])
  const [acertos, setAcertos] = useState<AcertoCaixa[]>([])
  const [resumo, setResumo] = useState<ResumoAcerto | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNovoAcerto, setShowNovoAcerto] = useState(false)

  // State para novo acerto
  const [formData, setFormData] = useState({
    contaReceberId: '',
    contaPagardId: '',
    valorAcertado: '',
    observacao: ''
  })

  useEffect(() => {
    carregarDados()
  }, [userId])

  const carregarDados = async () => {
    try {
      setLoading(true)
      const [itens, resumoData, acertosData] = await Promise.all([
        obterItensNaoAcertados(userId, 90),
        obterResumoAcerto(userId),
        obterAcertos(userId)
      ])
      setItensNaoAcertados(itens)
      setResumo(resumoData)
      setAcertos(acertosData)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCriarAcerto = async () => {
    try {
      if (!formData.valorAcertado) {
        alert('Informe o valor do acerto')
        return
      }

      const novoAcertoId = await criarAcerto(
        userId,
        formData.contaReceberId || null,
        formData.contaPagardId || null,
        parseFloat(formData.valorAcertado),
        formData.observacao
      )

      if (novoAcertoId) {
        // Limpar form
        setFormData({
          contaReceberId: '',
          contaPagardId: '',
          valorAcertado: '',
          observacao: ''
        })
        setShowNovoAcerto(false)
        
        // Recarregar dados
        await carregarDados()
      }
    } catch (error) {
      console.error('Erro ao criar acerto:', error)
      alert('Erro ao criar acerto')
    }
  }

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      {/* Resumo de Caixa */}
      {resumo && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contas a Receber</CardTitle>
              <TrendingDown className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(resumo.totalReceber)}</div>
              <p className="text-xs text-muted-foreground">Valor total em aberto</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contas a Pagar</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(resumo.totalPagar)}</div>
              <p className="text-xs text-muted-foreground">Valor total em aberto</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Líquido</CardTitle>
              <DollarSign className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${resumo.saldoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(resumo.saldoLiquido)}
              </div>
              <p className="text-xs text-muted-foreground">
                {resumo.saldoLiquido >= 0 ? 'Superávit' : 'Déficit'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Badge>{resumo.itensNaoAcertados}</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{resumo.itensNaoAcertados}</div>
              <p className="text-xs text-muted-foreground">Itens não acertados</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Botão Novo Acerto */}
      <Dialog open={showNovoAcerto} onOpenChange={setShowNovoAcerto}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Acerto
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Acerto de Caixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="contaReceber">Conta a Receber (opcional)</Label>
              <select
                id="contaReceber"
                className="w-full px-3 py-2 border rounded-md"
                value={formData.contaReceberId}
                onChange={e => setFormData({ ...formData, contaReceberId: e.target.value })}
              >
                <option value="">Selecione...</option>
                {itensNaoAcertados
                  .filter(i => i.tipo === 'receber')
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.descricao} - {formatCurrency(item.valor)}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <Label htmlFor="contaPagar">Conta a Pagar (opcional)</Label>
              <select
                id="contaPagar"
                className="w-full px-3 py-2 border rounded-md"
                value={formData.contaPagardId}
                onChange={e => setFormData({ ...formData, contaPagardId: e.target.value })}
              >
                <option value="">Selecione...</option>
                {itensNaoAcertados
                  .filter(i => i.tipo === 'pagar')
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.descricao} - {formatCurrency(item.valor)}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <Label htmlFor="valor">Valor do Acerto</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.valorAcertado}
                onChange={e => setFormData({ ...formData, valorAcertado: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Input
                id="observacao"
                placeholder="Detalhes do acerto"
                value={formData.observacao}
                onChange={e => setFormData({ ...formData, observacao: e.target.value })}
              />
            </div>

            <Button onClick={handleCriarAcerto} className="w-full">
              Criar Acerto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tabelas */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contas a Receber Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {itensNaoAcertados
                .filter(i => i.tipo === 'receber')
                .slice(0, 5)
                .map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <div>
                      <p className="font-sm">{item.descricao.substring(0, 30)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.data).toLocaleDateString('pt-BR')} - {item.status}
                      </p>
                    </div>
                    <p className="font-semibold text-blue-600">{formatCurrency(item.valor)}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contas a Pagar Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {itensNaoAcertados
                .filter(i => i.tipo === 'pagar')
                .slice(0, 5)
                .map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <div>
                      <p className="font-sm">{item.descricao.substring(0, 30)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.data).toLocaleDateString('pt-BR')} - {item.status}
                      </p>
                    </div>
                    <p className="font-semibold text-orange-600">{formatCurrency(item.valor)}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Histórico de Acertos */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Acertos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {acertos.slice(0, 10).map(acerto => (
              <div
                key={acerto.id}
                className="flex items-center justify-between p-3 border rounded bg-slate-50"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {acerto.conta_receber ? 'AR → AP' : 'Acerto Manual'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(acerto.data_acerto).toLocaleDateString('pt-BR')} •{' '}
                    {acerto.status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(acerto.valor_acertado)}</p>
                  {acerto.saldo_pendente > 0 && (
                    <p className="text-xs text-orange-600">
                      Pendente: {formatCurrency(acerto.saldo_pendente)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
