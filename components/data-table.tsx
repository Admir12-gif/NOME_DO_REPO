"use client"

import React, { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Column<T> {
  key: keyof T | string
  label: string
  render?: (item: T) => React.ReactNode
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchPlaceholder?: string
  searchKey?: keyof T
  onAdd?: () => void
  onEdit?: (item: T) => void
  onDelete?: (item: T) => void
  addLabel?: string
  emptyMessage?: string
  emptyIcon?: React.ReactNode
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  searchPlaceholder = "Buscar...",
  searchKey,
  onAdd,
  onEdit,
  onDelete,
  addLabel = "Adicionar",
  emptyMessage = "Nenhum registro encontrado",
  emptyIcon,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const pageSize = 12

  const filteredData = searchKey
    ? data.filter((item) => {
        const value = item[searchKey]
        if (typeof value === "string") {
          return value.toLowerCase().includes(search.toLowerCase())
        }
        return true
      })
    : data

  const paginatedData = filteredData.slice(page * pageSize, (page + 1) * pageSize)
  const totalPages = Math.ceil(filteredData.length / pageSize)

  const getValue = (item: T, key: keyof T | string) => {
    if (typeof key === "string" && key.includes(".")) {
      const keys = key.split(".")
      let value: unknown = item
      for (const k of keys) {
        value = (value as Record<string, unknown>)?.[k]
      }
      return value
    }
    return item[key as keyof T]
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular hidden sm:inline">
            {filteredData.length} registro(s)
          </span>
          {onAdd && (
            <Button onClick={onAdd} size="sm" className="gap-1.5 h-9">
              <Plus className="h-4 w-4" />
              {addLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/60 hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  className="h-10 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30"
                >
                  {column.label}
                </TableHead>
              ))}
              {(onEdit || onDelete) && (
                <TableHead className="w-10 bg-muted/30" />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((item, idx) => (
                <TableRow
                  key={item.id}
                  className="border-b border-border/40 hover:bg-primary/5 transition-colors"
                >
                  {columns.map((column) => (
                    <TableCell key={String(column.key)} className="px-4 py-3 text-sm">
                      {column.render
                        ? column.render(item)
                        : String(getValue(item, column.key) ?? "—")}
                    </TableCell>
                  ))}
                  {(onEdit || onDelete) && (
                    <TableCell className="px-2 py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(item)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          {onEdit && onDelete && <DropdownMenuSeparator />}
                          {onDelete && (
                            <DropdownMenuItem
                              onClick={() => onDelete(item)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                  className="py-14 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    {emptyIcon && <div className="text-muted-foreground/40 mb-1">{emptyIcon}</div>}
                    <p className="text-sm text-muted-foreground font-medium">{emptyMessage}</p>
                    {onAdd && (
                      <Button variant="outline" size="sm" onClick={onAdd} className="mt-2 gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        {addLabel}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Exibindo{" "}
            <span className="font-medium text-foreground tabular">
              {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filteredData.length)}
            </span>{" "}
            de{" "}
            <span className="font-medium text-foreground tabular">{filteredData.length}</span>
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-1 tabular">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
