import { useEffect, useState } from "react";

// True mientras el elemento (por id) esté intersectando el viewport. Se usa para
// ocultar la barra de compra flotante en móvil cuando el footer entra en vista.
export function useElementInView(id: string, rootMargin = "0px 0px 50px 0px") {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = document.getElementById(id);
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [id, rootMargin]);
  return inView;
}
