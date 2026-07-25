import { useState } from "react";
import { cn } from "~/lib/utils";

export function Avatar({ label, src, className }: { label: React.ReactNode; src?: string; className?: string }) {
  const [imgError, setImgError] = useState(false);
  const showImg = !!src && !imgError;
  return (
    <span className={cn("relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-semibold", className)}>
      {label}
      {showImg && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setImgError(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}
