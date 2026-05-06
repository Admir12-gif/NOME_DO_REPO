'use client'

import React, { useState } from "react"
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Truck, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

export default function Page() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password !== repeatPassword) {
      setError('As senhas não coincidem.')
      setIsLoading(false)
      return
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
            `${window.location.origin}/dashboard`,
        },
      })
      if (error) throw error
      router.push('/auth/sign-up-success')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Ocorreu um erro ao criar sua conta.')
    } finally {
      setIsLoading(false)
    }
  }

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-sm">
            <Truck className="h-[18px] w-[18px] text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">TransLog TMS</p>
            <p className="text-[11px] text-muted-foreground leading-tight">Gestão de Transporte</p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">Criar conta</h2>
          <p className="text-muted-foreground text-sm mt-1">Preencha os dados abaixo para criar seu acesso</p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-foreground">E-mail</Label>
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
            <Label htmlFor="password" className="text-sm font-medium text-foreground">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 pr-10"
                placeholder="Mínimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="flex gap-1 mt-1.5">
                {[1, 2, 3].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      passwordStrength >= level
                        ? level === 1 ? "bg-destructive" : level === 2 ? "bg-warning" : "bg-success"
                        : "bg-border"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="repeat-password" className="text-sm font-medium text-foreground">Confirmar senha</Label>
            <div className="relative">
              <Input
                id="repeat-password"
                type="password"
                required
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                className="h-10 pr-10"
                placeholder="Repita a senha"
              />
              {repeatPassword.length > 0 && password === repeatPassword && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
              )}
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
            className="w-full h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            style={{ background: isLoading ? "oklch(0.52 0.23 260 / 0.7)" : "linear-gradient(135deg, oklch(0.52 0.23 260) 0%, oklch(0.46 0.22 280) 100%)" }}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Criando conta...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Criar minha conta
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem uma conta?{' '}
          <Link href="/auth/login" className="text-primary font-medium hover:text-primary/80 transition-colors">
            Entrar no sistema
          </Link>
        </p>
      </div>
    </div>
  )
}
