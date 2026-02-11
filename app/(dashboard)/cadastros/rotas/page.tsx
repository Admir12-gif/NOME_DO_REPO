import { createClient } from "@/lib/supabase/server"
import { RotasClient } from "./rotas-client"

export default async function RotasPage() {
  const supabase = await createClient()
  
  const { data: rotas } = await supabase
    .from("rotas")
    .select("*")
    .order("nome", { ascending: true })

  return <RotasClient initialRotas={rotas || []} />
}
