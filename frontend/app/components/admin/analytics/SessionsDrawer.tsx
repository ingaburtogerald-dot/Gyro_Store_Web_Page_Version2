import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, Monitor, Bot, ChevronDown, ChevronUp, Search, Eye, Globe } from "lucide-react";
import { Skeleton } from "~/components/ui/Skeleton";
import { cn } from "~/lib/utils";
import { useGetSearchSessionsQuery } from "~/store/api/searchAnalyticsApi";
import { cleanUserAgent, cleanProductUrl } from "./helpers";
import { EmptyRows } from "./shared";

export function SessionsDrawer({ open, onClose, days }: { open: boolean; onClose: () => void; days: number }) {
  const { data, isLoading } = useGetSearchSessionsQuery({ days }, { skip: !open });
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const toggleSession = (id: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="flex h-full w-full max-w-xl flex-col bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4 bg-surface/50 backdrop-blur-md">
          <div>
            <h2 className="text-xl font-bold text-text">Registro de Sesiones</h2>
            <p className="text-xs text-muted">Secuencia de acciones por usuario (Acordeón de Marketing)</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-surface-2 p-2 text-muted hover:text-text hover:bg-border transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 rounded-card" />
              <Skeleton className="h-20 rounded-card" />
              <Skeleton className="h-20 rounded-card" />
            </div>
          ) : !data?.sessions?.length ? (
            <EmptyRows text="No hay sesiones registradas en este rango." />
          ) : (
            data.sessions.map((s) => {
              const isExpanded = expandedSessions.has(s.id);
              const uaInfo = cleanUserAgent(s.userAgent);
              
              let DeviceIcon = Monitor;
              if (uaInfo.device === "Mobile") DeviceIcon = Smartphone;
              else if (uaInfo.device === "Bot") DeviceIcon = Bot;
              else if (uaInfo.device === "Desconocido") DeviceIcon = Globe;

              return (
                <div
                  key={s.id}
                  className="card-premium overflow-hidden rounded-card border border-border bg-surface shadow-premium transition-all duration-200"
                >
                  <button
                    onClick={() => toggleSession(s.id)}
                    className="w-full text-left flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-hover transition-colors focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-3">
                      <span className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                        uaInfo.device === "Bot" ? "bg-warning/10 text-warning" : "bg-accent/10 text-accent-2"
                      )}>
                        <DeviceIcon className="h-5 w-5" />
                      </span>
                      
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-sm text-text truncate">
                            {uaInfo.os}
                          </p>
                          <span className="text-[10px] text-muted font-normal">• {uaInfo.browser}</span>
                          
                          {s.isNewVisitor !== undefined && (
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider shrink-0",
                              s.isNewVisitor ? "bg-accent/15 text-accent" : "bg-badge/15 text-badge"
                            )}>
                              {s.isNewVisitor ? "NUEVO" : "RECURRENTE"}
                            </span>
                          )}
                        </div>
                        
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono bg-border/50 px-1.5 py-0.5 rounded text-[9px] text-muted">
                            ID: {s.id.slice(0, 8)}
                          </span>
                          
                          {s.utmSource && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-500/10 text-blue-400 font-medium border border-blue-500/20" title={`Campaña: ${s.utmCampaign || 'N/A'}`}>
                              Ads: {s.utmSource}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="block text-xs font-bold text-text tabular-nums">
                          {new Date(s.startTime).toLocaleTimeString("es-NI", { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="block text-[10px] text-muted">
                          {s.actions.length} {s.actions.length === 1 ? "acción" : "acciones"}
                        </span>
                      </div>
                      
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted shrink-0" />
                      )}
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border/50 bg-surface-2/15 p-5">
                          <div className="mb-4 text-xs space-y-1 text-muted border-b border-border/30 pb-3">
                            {s.entryType && (
                              <p>
                                <span className="font-semibold text-text">Entrada:</span>{" "}
                                {s.entryType === "direct_landing" ? "Tráfico Directo" : "Clic Interno"}
                              </p>
                            )}
                            {s.referrer && (
                              <p className="truncate" title={s.referrer}>
                                <span className="font-semibold text-text">Referente:</span>{" "}
                                {s.referrer}
                              </p>
                            )}
                            {s.userAgent && (
                              <p className="text-[10px] italic break-all" title={s.userAgent}>
                                <span className="font-semibold text-text not-italic">UA:</span> {s.userAgent}
                              </p>
                            )}
                          </div>

                          <ul className="relative space-y-6 before:absolute before:inset-y-2 before:left-[15px] before:w-[2px] before:bg-border/60 pl-2">
                            {s.actions.map((act: any, i: number) => (
                              <li key={i} className="relative pl-8 flex items-start gap-3">
                                <span className={cn(
                                  "absolute left-[-5px] top-0.5 grid h-6 w-6 place-items-center rounded-full ring-4 ring-surface",
                                  act.type === 'pageview' ? "bg-badge/15 text-badge" : "bg-accent/15 text-accent"
                                )}>
                                  {act.type === 'pageview' ? <Eye className="h-3 w-3" /> : <Search className="h-3 w-3" />}
                                </span>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                    <div className="text-sm font-medium text-text flex items-center flex-wrap gap-2 min-w-0">
                                      {act.type === 'pageview' ? (
                                        <>
                                          <span className="text-muted font-normal">Visitó:</span>
                                          
                                          {act.page?.startsWith("/producto") && (
                                            <div className="h-6 w-6 rounded bg-border/40 shrink-0 flex items-center justify-center text-[8px] text-muted font-bold" title="Miniatura del producto">
                                              IMG
                                            </div>
                                          )}
                                          
                                          <span className="text-accent-2 truncate font-semibold" title={act.page}>
                                            {cleanProductUrl(act.page || "")}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-muted font-normal">Buscó:</span>
                                          <span className="font-semibold">"{act.query}"</span>
                                          <span className={cn(
                                            "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0",
                                            act.resultsCount === 0 ? "bg-warning/15 text-warning" : "bg-accent/10 text-accent"
                                          )}>
                                            {act.resultsCount} res
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    <span className="shrink-0 text-xs text-muted tabular-nums">
                                      {new Date(act.timestamp).toLocaleTimeString("es-NI", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
