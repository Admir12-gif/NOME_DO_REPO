// components/dashboard-alerts.tsx
'use client'

import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, AlertCircle, Bell, X } from 'lucide-react'
import { obterAlertasAtivos, resolverAlerta } from '@/lib/supabase/alertas'
import type { Alerta } from '@/lib/types'

interface DashboardAlertsProps {
  userId: string
}

export function DashboardAlerts({ userId }: DashboardAlertsProps) {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const carregarAlertas = async () => {
      try {
        setLoading(true)
        const dados = await obterAlertasAtivos(userId, 'normal')
        setAlertas(dados)
      } catch (error) {
        console.error('Erro ao carregar alertas:', error)
      } finally {
        setLoading(false)
      }
    }

    carregarAlertas()
    // Recarregar alertas a cada 5 minutos
    const intervalo = setInterval(carregarAlertas, 5 * 60 * 1000)

    return () => clearInterval(intervalo)
  }, [userId])

  const handleResolverAlerta = async (alertaId: string) => {
    try {
      const sucesso = await resolverAlerta(userId, alertaId)
      if (sucesso) {
        setAlertas(alertas.filter(a => a.id !== alertaId))
      }
    } catch (error) {
      console.error('Erro ao resolver alerta:', error)
    }
  }

  if (loading) {
    return null
  }

  if (alertas.length === 0) {
    return null
  }

  const alertasCriticos = alertas.filter(a => a.severity === 'critico')
  const alertasAltos = alertas.filter(a => a.severity === 'alto')
  const alertasNormais = alertas.filter(a => a.severity === 'normal')

  return (
    <Card className="border-orange-200 bg-orange-50 mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-lg">Alertas do Sistema</CardTitle>
            <Badge variant="secondary" className="ml-2">
              {alertas.length}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alertas Críticos */}
        {alertasCriticos.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-red-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Críticos ({alertasCriticos.length})
            </h4>
            {alertasCriticos.map(alerta => (
              <Alert key={alerta.id} className="bg-red-100 border-red-300">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-red-900">{alerta.titulo}</p>
                      {alerta.descricao && (
                        <p className="text-sm text-red-800 mt-1">{alerta.descricao}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResolverAlerta(alerta.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Alertas Altos */}
        {alertasAltos.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-yellow-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Importantes ({alertasAltos.length})
            </h4>
            {alertasAltos.map(alerta => (
              <Alert key={alerta.id} className="bg-yellow-100 border-yellow-300">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-yellow-900">{alerta.titulo}</p>
                      {alerta.descricao && (
                        <p className="text-sm text-yellow-800 mt-1">{alerta.descricao}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResolverAlerta(alerta.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Alertas Normais - Resumido */}
        {alertasNormais.length > 0 && (
          <details className="cursor-pointer">
            <summary className="font-semibold text-blue-900 flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notificações ({alertasNormais.length})
            </summary>
            <div className="mt-2 space-y-2 ml-4">
              {alertasNormais.map(alerta => (
                <div
                  key={alerta.id}
                  className="flex items-start justify-between gap-2 p-2 bg-white rounded border border-blue-200"
                >
                  <div>
                    <p className="text-sm font-medium text-blue-900">{alerta.titulo}</p>
                    {alerta.descricao && (
                      <p className="text-xs text-blue-700 mt-1">{alerta.descricao}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResolverAlerta(alerta.id)}
                    className="h-6 w-6 p-0 flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
