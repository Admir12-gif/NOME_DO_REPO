"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Truck,
  Route,
  Users,
  Building2,
  Wallet,
  LogOut,
  Menu,
  X,
  UserCheck,
  DollarSign,
  CreditCard,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface NavItem {
  title: string
  href: string
  icon: React.ReactNode
}

interface NavSection {
  label: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: "Principal",
    items: [
      { title: "Painel",   href: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
      { title: "Viagens",  href: "/viagens",   icon: <Route className="h-4 w-4" /> },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "A Receber", href: "/financeiro/receber", icon: <DollarSign className="h-4 w-4" /> },
      { title: "A Pagar",   href: "/financeiro/pagar",   icon: <CreditCard className="h-4 w-4" /> },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { title: "Clientes",   href: "/cadastros/clientes",   icon: <Users className="h-4 w-4" /> },
      { title: "Veículos",   href: "/cadastros/veiculos",   icon: <Truck className="h-4 w-4" /> },
      { title: "Motoristas", href: "/cadastros/motoristas", icon: <UserCheck className="h-4 w-4" /> },
      { title: "Rotas",      href: "/cadastros/rotas",      icon: <Building2 className="h-4 w-4" /> },
    ],
  },
]

export function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/")

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center shadow-sm shrink-0">
          <Truck className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-sidebar-foreground leading-tight">TransLog TMS</p>
          <p className="text-[10px] text-sidebar-muted leading-tight mt-0.5">Gestão de Transporte</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="nav-section-label">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150",
                      active
                        ? "nav-item-active"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                    )}
                  >
                    <span className={cn("opacity-80", active && "opacity-100 text-sidebar-primary")}>
                      {item.icon}
                    </span>
                    {item.title}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-150"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border z-40 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md gradient-primary flex items-center justify-center">
            <Truck className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-sm text-sidebar-foreground">TransLog TMS</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        "lg:hidden fixed inset-y-0 left-0 w-64 bg-sidebar z-50 transform transition-transform duration-200 ease-out shadow-2xl",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <button
          className="absolute top-3 right-3 p-1.5 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </button>
        <NavContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 shadow-lg">
        <NavContent />
      </aside>
    </>
  )
}
