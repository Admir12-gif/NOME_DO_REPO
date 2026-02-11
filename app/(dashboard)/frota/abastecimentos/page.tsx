import { AbastecimentosClient } from "./abastecimentos-client"

export const metadata = {
  title: "Abastecimentos - TransLog",
  description: "Gerenciamento de abastecimentos da frota",
}

export default function AbastecimentosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Abastecimentos</h1>
        <p className="text-muted-foreground">
          Registre e acompanhe os abastecimentos dos veiculos
        </p>
      </div>
      <AbastecimentosClient />
    </div>
  )
}
