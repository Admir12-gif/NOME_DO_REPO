'use client'

import React, { useState } from "react"
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Truck, Route, BarChart3, Shield, ArrowRight, Eye, EyeOff } from 'lucide-react'

const features = [
  { icon: Route, text: "Gestão completa de ciclos e viagens" },
  { icon: BarChart3, text: "Painel analítico em tempo real" },
  { icon: Shield, text: "Controle financeiro e de frota" },
]

export default function Page() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/dashboard')
    } catch (error: unknown) {
      setError('E-mail ou senha inválidos. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative flex-col overflow-hidden"
        style={{ background: "linear-gradient(145deg, oklch(0.11 0.05 265) 0%, oklch(0.16 0.06 260) 50%, oklch(0.13 0.045 265) 100%)" }}>
        {/* Geometric decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, oklch(0.52 0.23 260) 0%, transparent 70%)" }} />
          <div className="absolute bottom-0 -left-24 w-80 h-80 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, oklch(0.56 0.19 155) 0%, transparent 70%)" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5"
            style={{ background: "radial-gradient(circle, oklch(0.52 0.23 260) 0%, transparent 60%)" }} />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `linear-gradient(oklch(0.9 0.01 250) 1px, transparent 1px), linear-gradient(90deg, oklch(0.9 0.01 250) 1px, transparent 1px)`,
              backgroundSize: "48px 48px"
            }} />
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full p-10 xl:p-14">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg, oklch(0.52 0.23 260) 0%, oklch(0.46 0.22 280) 100%)" }}>
              <Truck className="h-5.5 w-5.5 text-white h-[22px] w-[22px]" />
            </div>
            <div>
              <p className="text-base font-bold text-white leading-tight">TransLog TMS</p>
              <p className="text-[11px] text-white/50 leading-tight">Sistema de Gestão de Transporte</p>
            </div>
          </div>

          {/* Main copy */}
          <div>
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
              Gestão de transporte{" "}
              <span style={{ color: "oklch(0.72 0.18 200)" }}>inteligente</span>
              {" "}para o Brasil
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-md mb-8">
              Controle viagens, frota, financeiro e motoristas em uma plataforma completa, pensada para transportadoras brasileiras.
            </p>
            <div className="space-y-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: "oklch(0.52 0.23 260 / 0.25)" }}>
                    <f.icon className="h-3.5 w-3.5 text-white/80" />
                  </div>
                  <p className="text-sm text-white/70">{f.text}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/25 text-xs">© 2025 TransLog TMS · Todos os direitos reservados</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-sm">
              <Truck className="h-[18px] w-[18px] text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-tight">TransLog TMS</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Gestão de Transporte</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Bem-vindo de volta</h2>
            <p className="text-muted-foreground text-sm mt-1">Entre com suas credenciais para acessar o sistema</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Senha
                </Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/8 border border-destructive/20 rounded-lg px-4 py-3">
                <p className="text-sm text-destructive font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: isLoading ? "oklch(0.52 0.23 260 / 0.7)" : "linear-gradient(135deg, oklch(0.52 0.23 260) 0%, oklch(0.46 0.22 280) 100%)" }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Entrando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Entrar no sistema
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Não tem uma conta?{' '}
            <Link href="/auth/sign-up" className="text-primary font-medium hover:text-primary/80 transition-colors">
              Solicitar acesso
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
