import { AbastecimentosClient } from "./abastecimentos-client"

export const metadata = {
  title: "Abastecimentos - TransLog",
  description: "Gerenciamento de abastecimentos da frota",
}

export default function AbastecimentosPage() {
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Abastecimentos</h1>
          <p className="page-subtitle">Controle de abastecimento e consumo de combustível</p>
        </div>
      </div>
      <AbastecimentosClient />
    </div>
  )
}
