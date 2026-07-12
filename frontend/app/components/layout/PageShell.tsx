import { ReactNode } from "react";
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";
import { PublicSidebar } from "./PublicSidebar";
import { cn } from "~/lib/utils";

interface PageShellProps {
  children: ReactNode;
  header?: ReactNode;
  hideHeader?: boolean;
  sidebar?: ReactNode;
  hideSidebar?: boolean;
  footer?: ReactNode;
  hideFooter?: boolean;
  className?: string;
}

export function PageShell({
  children,
  header,
  hideHeader,
  sidebar,
  hideSidebar,
  footer,
  hideFooter,
  className,
}: PageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text selection:bg-accent/20">
      {!hideSidebar && (sidebar || <PublicSidebar categories={[]} />)}
      {!hideHeader && (header || <PublicHeader />)}
      
      <main className={cn("flex-1", className)}>
        {children}
      </main>

      {!hideFooter && (footer || <PublicFooter />)}
    </div>
  );
}
