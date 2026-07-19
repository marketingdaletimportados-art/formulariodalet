import { Package } from "lucide-react";

export function DaletLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Package className="h-6 w-6" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-base font-bold tracking-tight text-foreground">Dalet</span>
        <span className="text-xs text-muted-foreground">Importados</span>
      </div>
    </div>
  );
}
