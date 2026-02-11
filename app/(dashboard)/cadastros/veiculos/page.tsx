import { createClient } from "@/lib/supabase/server"
import { VeiculosClient } from "./veiculos-client"

export default async function VeiculosPage() {
  const supabase = await createClient()
  
  const { data: veiculos } = await supabase
    .from("veiculos")
    .select("*")
    .order("placa_cavalo", { ascending: true })

  return <VeiculosClient initialVeiculos={veiculos || []} />
}
