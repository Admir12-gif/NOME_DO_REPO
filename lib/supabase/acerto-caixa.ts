// lib/supabase/acerto-caixa.ts
// Utilities for cash reconciliation (acerto de caixa)

import { createClient } from '@supabase/supabase-js'
import type { AcertoCaixa, ContaReceber, ContaPagar } from '@/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface ItemAcerto {
  tipo: 'receber' | 'pagar'
  id: string
  valor: number
  data: string
  descricao: string
  status: string
}

export interface ResumoAcerto {
  totalReceber: number
  totalPagar: number
  saldoLiquido: number
  itensNaoAcertados: number
}

export async function obterItensNaoAcertados(
  userId: string,
  dias: number = 30
): Promise<ItemAcerto[]> {
  const dataLimite = new Date()
  dataLimite.setDate(dataLimite.getDate() - dias)

  // Contas a receber não acertadas
  const { data: contas_receber, error: errCR } = await supabase
    .from('contas_receber')
    .select('id, valor, data_vencimento, observacao, status')
    .eq('user_id', userId)
    .neq('status', 'Recebido')
    .gte('data_vencimento', dataLimite.toISOString())
    .order('data_vencimento', { ascending: true })

  // Contas a pagar não acertadas
  const { data: contas_pagar, error: errCP } = await supabase
    .from('contas_pagar')
    .select('id, valor, data_vencimento, observacao, status')
    .eq('user_id', userId)
    .neq('status', 'Pago')
    .gte('data_vencimento', dataLimite.toISOString())
    .order('data_vencimento', { ascending: true })

  const itens: ItemAcerto[] = []

  if (!errCR && contas_receber) {
    itens.push(
      ...contas_receber.map(cr => ({
        tipo: 'receber' as const,
        id: cr.id,
        valor: cr.valor,
        data: cr.data_vencimento,
        descricao: cr.observacao || 'Conta a receber',
        status: cr.status
      }))
    )
  }

  if (!errCP && contas_pagar) {
    itens.push(
      ...contas_pagar.map(cp => ({
        tipo: 'pagar' as const,
        id: cp.id,
        valor: cp.valor,
        data: cp.data_vencimento,
        descricao: cp.observacao || 'Conta a pagar',
        status: cp.status
      }))
    )
  }

  return itens.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
}

export async function criarAcerto(
  userId: string,
  contaReceberId: string | null,
  contaPagardId: string | null,
  valorAcertado: number,
  observacao?: string,
  acertadoPor?: string
): Promise<string | null> {
  const saldoPendente = await calcularSaldoPendente(
    userId,
    contaReceberId,
    contaPagardId,
    valorAcertado
  )

  const { data, error } = await supabase
    .from('acerto_caixa')
    .insert({
      user_id: userId,
      conta_receber_id: contaReceberId,
      conta_pagar_id: contaPagardId,
      data_acerto: new Date().toISOString(),
      valor_acertado: valorAcertado,
      saldo_pendente: saldoPendente,
      observacao,
      status: saldoPendente === 0 ? 'Acertado' : 'Parcial',
      acertado_por: acertadoPor || 'Sistema'
    })
    .select('id')
    .single()

  if (error) {
    console.error('Erro ao criar acerto de caixa:', error)
    return null
  }

  return data?.id || null
}

async function calcularSaldoPendente(
  userId: string,
  contaReceberId: string | null,
  contaPagardId: string | null,
  valorAcertado: number
): Promise<number> {
  let saldoTotal = 0

  if (contaReceberId) {
    const { data: cr } = await supabase
      .from('contas_receber')
      .select('valor')
      .eq('id', contaReceberId)
      .single()
    saldoTotal += cr?.valor || 0
  }

  if (contaPagardId) {
    const { data: cp } = await supabase
      .from('contas_pagar')
      .select('valor')
      .eq('id', contaPagardId)
      .single()
    saldoTotal -= cp?.valor || 0
  }

  return Math.max(0, Math.abs(saldoTotal) - valorAcertado)
}

export async function obterAcertos(
  userId: string,
  status?: string,
  dataInicio?: string,
  dataFim?: string
): Promise<AcertoCaixa[]> {
  let query = supabase
    .from('acerto_caixa')
    .select(`
      *,
      conta_receber:conta_receber_id(*),
      conta_pagar:conta_pagar_id(*)
    `)
    .eq('user_id', userId)

  if (status) {
    query = query.eq('status', status)
  }

  if (dataInicio) {
    query = query.gte('data_acerto', dataInicio)
  }

  if (dataFim) {
    query = query.lte('data_acerto', dataFim)
  }

  const { data, error } = await query.order('data_acerto', { ascending: false })

  if (error) {
    console.warn('Erro ao obter acertos:', error)
    return []
  }

  return (data || []) as AcertoCaixa[]
}

export async function obterResumoAcerto(userId: string): Promise<ResumoAcerto> {
  const { data: cr, error: errCR } = await supabase
    .from('contas_receber')
    .select('valor, status')
    .eq('user_id', userId)

  const { data: cp, error: errCP } = await supabase
    .from('contas_pagar')
    .select('valor, status')
    .eq('user_id', userId)

  let totalReceber = 0
  let totalPagar = 0
  let itensNaoAcertados = 0

  if (!errCR && cr) {
    totalReceber = cr.reduce((sum, item) => sum + (item.valor || 0), 0)
    itensNaoAcertados += cr.filter(c => c.status !== 'Recebido').length
  }

  if (!errCP && cp) {
    totalPagar = cp.reduce((sum, item) => sum + (item.valor || 0), 0)
    itensNaoAcertados += cp.filter(c => c.status !== 'Pago').length
  }

  return {
    totalReceber,
    totalPagar,
    saldoLiquido: totalReceber - totalPagar,
    itensNaoAcertados
  }
}

export async function revertarAcerto(
  userId: string,
  acertoId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('acerto_caixa')
    .update({
      status: 'Revertido',
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('id', acertoId)

  if (error) {
    console.error('Erro ao reverter acerto:', error)
    return false
  }

  return true
}

export async function obterAcertosDoMes(
  userId: string,
  mes: number,
  ano: number
): Promise<AcertoCaixa[]> {
  const dataInicio = new Date(ano, mes - 1, 1).toISOString()
  const dataFim = new Date(ano, mes, 0, 23, 59, 59).toISOString()

  return obterAcertos(userId, undefined, dataInicio, dataFim)
}
