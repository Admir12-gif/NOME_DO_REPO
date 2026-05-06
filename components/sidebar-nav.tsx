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
  Fuel,
  Wrench,
  ChevronDown,
  LogOut,
  Menu,
  X,
  MapPin,
  BarChart3,
  Receipt,
  CreditCard,
  Gauge,
  Package,
  DollarSign,
  UserCheck,
  Settings,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface NavChild {
  title: string
  href: string
  icon?: React.ReactNode
}

interface NavItem {
  title: string
  href: string
  icon: React.ReactNode
  children?: NavChild[]
  badge?: string
}

interface NavSection {
  label: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: "Principal",
    items: [
      {
        title: "Painel",
        href: "/dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        title: "Viagens",
        href: "/viagens",
        icon: <Route className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "Operacional",
    items: [
      {
        title: "Frota",
        href: "/frota",
        icon: <Truck className="h-4 w-4" />,
        children: [
          { title: "Abastecimentos", href: "/frota/abastecimentos", icon: <Fuel className="h-3.5 w-3.5" /> },
          { title: "Manutenções", href: "/frota/manutencoes", icon: <Wrench className="h-3.5 w-3.5" /> },
          { title: "Custos & Consumo", href: "/custos-consumo", icon: <Gauge className="h-3.5 w-3.5" /> },
        ],
      },
    ],
  },
  {
    label: "Financeiro",
    items: [
      {
        title: "Financeiro",
        href: "/financeiro",
        icon: <Wallet className="h-4 w-4" />,
        children: [
          { title: "Contas a Receber", href: "/financeiro/receber", icon: <DollarSign className="h-3.5 w-3.5" /> },
          { title: "Contas a Pagar", href: "/financeiro/pagar", icon: <CreditCard className="h-3.5 w-3.5" /> },
          { title: "Acerto de Caixa", href: "/financeiro/acerto-caixa", icon: <Receipt className="h-3.5 w-3.5" /> },
        ],
      },
    ],
  },
  {
    label: "Cadastros",
    items: [
      {
        title: "Cadastros",
        href: "/cadastros",
        icon: <Building2 className="h-4 w-4" />,
        children: [
          { title: "Clientes", href: "/cadastros/clientes", icon: <Users className="h-3.5 w-3.5" /> },
          { title: "Veículos", href: "/cadastros/veiculos", icon: <Truck className="h-3.5 w-3.5" /> },
          { title: "Motoristas", href: "/cadastros/motoristas", icon: <UserCheck className="h-3.5 w-3.5" /> },
          { title: "Rotas", href: "/cadastros/rotas", icon: <MapPin className="h-3.5 w-3.5" /> },
          { title: "Postos de Abast.", href: "/cadastros/postos_abastecimento", icon: <Fuel className="h-3.5 w-3.5" /> },
          { title: "Comissões", href: "/cadastros/motorista-comissoes", icon: <Package className="h-3.5 w-3.5" /> },
        ],
      },
    ],
  },
  {
    label: "Relatórios",
    items: [
      {
        title: "Analítico",
        href: "/dashboard/analitico",
        icon: <BarChart3 className="h-4 w-4" />,
      },
    ],
  },
]

export function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    const initial: string[] = []
    navSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.children?.some((child) => pathname.startsWith(child.href))) {
          initial.push(item.title)
        }
        if (pathname.startsWith(item.href) && item.children) {
          initial.push(item.title)
        }
      })
    })
    return initial
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title) ? prev.filter((i) => i !== title) : [...prev, title]
    )
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const isActive = (href: string) => pathname === href
  const isActiveParent = (href: string) => pathname.startsWith(href + "/") || pathname === href
  const isChildActive = (children?: NavChild[]) =>
    children?.some((child) => pathname === child.href || pathname.startsWith(child.href + "/"))

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center shadow-sm flex-shrink-0">
          <Truck className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-sidebar-foreground leading-tight">TransLog TMS</p>
          <p className="text-[10px] text-sidebar-muted leading-tight mt-0.5">Gestão de Transporte</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-3">
        {navSections.map((section) => (
          <div key={section.label} className="mb-1">
            <p className="nav-section-label">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const childActive = isChildActive(item.children)
                const parentActive = isActiveParent(item.href)
                const expanded = expandedItems.includes(item.title)

                return (
                  <div key={item.title}>
                    {item.children ? (
                      <>
                        <button
                          onClick={() => toggleExpand(item.title)}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150",
                            childActive || (parentActive && !isActive(item.href))
                              ? "nav-item-active"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                          )}
                        >
                          <span className="flex items-center gap-2.5">
                            <span className={cn(
                              "opacity-80",
                              (childActive || parentActive) && "opacity-100 text-sidebar-primary"
                            )}>
                              {item.icon}
                            </span>
                            {item.title}
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 opacity-60 transition-transform duration-200",
                              expanded && "rotate-180"
                            )}
                          />
                        </button>
                        {expanded && (
                          <div className="mt-0.5 ml-2 pl-3 border-l border-sidebar-border/50 space-y-0.5">
                            {item.children.map((child) => {
                              const active = pathname === child.href || pathname.startsWith(child.href + "/")
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={() => setMobileOpen(false)}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-150",
                                    active
                                      ? "bg-sidebar-primary/20 text-sidebar-accent-foreground font-medium"
                                      : "text-sidebar-foreground/55 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                                  )}
                                >
                                  {child.icon && (
                                    <span className={cn("opacity-70", active && "opacity-100 text-sidebar-primary")}>
                                      {child.icon}
                                    </span>
                                  )}
                                  {child.title}
                                </Link>
                              )
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150",
                          isActive(item.href)
                            ? "nav-item-active"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                        )}
                      >
                        <span className={cn(
                          "opacity-80",
                          isActive(item.href) && "opacity-100 text-sidebar-primary"
                        )}>
                          {item.icon}
                        </span>
                        {item.title}
                        {item.badge && (
                          <span className="ml-auto text-[10px] font-semibold bg-sidebar-primary/20 text-sidebar-primary px-1.5 py-0.5 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )}
                  </div>
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
          Sair do sistema
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
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 w-64 bg-sidebar z-50 transform transition-transform duration-200 ease-out shadow-2xl",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          className="absolute top-3 right-3 p-1.5 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </button>
        <NavContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 shadow-lg">
        <NavContent />
      </aside>
    </>
  )
}
