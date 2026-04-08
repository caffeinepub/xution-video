import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface CollapsiblePanelProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  titleExtra?: React.ReactNode;
}

export function CollapsiblePanel({
  title,
  children,
  defaultOpen = true,
  className,
  titleExtra,
}: CollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "border border-[#FFD700]/40 bg-black font-mono overflow-hidden",
        className,
      )}
      style={{ borderRadius: "2px" }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[#111] hover:bg-[#1a1a00] transition-colors duration-200 group"
        data-ocid="panel-toggle"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[#FFD700] text-xs font-bold tracking-widest uppercase truncate">
            {title}
          </span>
          {titleExtra && (
            <span className="text-[#FFD700]/50 text-xs">{titleExtra}</span>
          )}
        </div>
        <span className="text-[#FFD700]/70 group-hover:text-[#FFD700] transition-colors flex-shrink-0 ml-2">
          {isOpen ? (
            <ChevronDown size={14} strokeWidth={2.5} />
          ) : (
            <ChevronRight size={14} strokeWidth={2.5} />
          )}
        </span>
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isOpen ? "2000px" : "0px",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="border-t border-[#FFD700]/20 p-3">{children}</div>
      </div>
    </div>
  );
}
