import Link from 'next/link'
import { CheckCircle, Truck, ArrowRight } from 'lucide-react'

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm text-center">
        <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-sm mx-auto mb-6">
          <Truck className="h-[18px] w-[18px] text-white" />
        </div>

        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="h-8 w-8 text-emerald-600" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Conta criada com sucesso!</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Verifique seu e-mail para confirmar o cadastro antes de entrar no sistema.
        </p>

        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 shadow-sm hover:shadow-md"
          style={{ background: "linear-gradient(135deg, oklch(0.52 0.23 260) 0%, oklch(0.46 0.22 280) 100%)" }}
        >
          Ir para o login
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
