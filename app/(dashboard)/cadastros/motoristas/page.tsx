import { createClient } from "@/lib/supabase/server"
import { MotoristasClient } from "./motoristas-client"

export default async function MotoristasPage() {
  const supabase = await createClient()
  
  const { data: motoristas } = await supabase
    .from("motoristas")
    .select("*")
    .order("nome", { ascending: true })

  return <MotoristasClient initialMotoristas={motoristas || []} />
}
