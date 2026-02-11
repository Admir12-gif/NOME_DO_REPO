import { createClient } from "@/lib/supabase/server"
import { ClientesClient } from "./clientes-client"

export default async function ClientesPage() {
  const supabase = await createClient()
  
  const { data: clientes } = await supabase
    .from("clientes")
    .select("*")
    .order("nome", { ascending: true })

  return <ClientesClient initialClientes={clientes || []} />
}
