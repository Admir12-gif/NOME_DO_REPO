import { ManutencoesClient } from "./manutencoes-client"

export const metadata = {
  title: "Manutencoes - TransLog",
  description: "Gerenciamento de manutencoes da frota",
}

export default function ManutencoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manutencoes</h1>
        <p className="text-muted-foreground">
          Registre e acompanhe as manutencoes preventivas e corretivas
        </p>
      </div>
      <ManutencoesClient />
    </div>
  )
}
