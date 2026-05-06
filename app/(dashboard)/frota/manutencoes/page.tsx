import { ManutencoesClient } from "./manutencoes-client"

export const metadata = {
  title: "Manutencoes - TransLog",
  description: "Gerenciamento de manutencoes da frota",
}

export default function ManutencoesPage() {
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Manutenções</h1>
          <p className="page-subtitle">Histórico e programação de manutenções da frota</p>
        </div>
      </div>
      <ManutencoesClient />
    </div>
  )
}
