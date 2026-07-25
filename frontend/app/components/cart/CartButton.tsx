import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { openCart, selectCartCount } from "~/store/slices/cartSlice";

export function CartButton({ variant }: { variant?: "bar" }) {
  const dispatch = useAppDispatch();
  const count = useAppSelector(selectCartCount);
  const controls = useAnimationControls();
  const [ping, setPing] = useState(false);
  const prev = useRef(count);

  useEffect(() => {
    if (count > prev.current) {
      controls.start({
        scale: [1, 1.18, 0.94, 1],
        rotate: [0, -8, 6, 0],
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
      });
      setPing(true);
      const t = setTimeout(() => setPing(false), 650);
      return () => clearTimeout(t);
    }
    prev.current = count;
  }, [count, controls]);

  const label = count > 0 ? `Abrir carrito, ${count} artículo${count === 1 ? "" : "s"}` : "Abrir carrito";

  if (variant === "bar") {
    return (
      <button
        onClick={() => dispatch(openCart())}
        aria-label={label}
        className="relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] sm:text-[11px] font-medium text-muted transition-colors hover:text-accent-2"
      >
        <span className="relative">
          <motion.span animate={controls} className="block">
            <ShoppingBag className="h-5 w-5" />
          </motion.span>
          {ping && (
            <motion.span
              aria-hidden
              initial={{ scale: 0.6, opacity: 0.6 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute inset-0 rounded-full ring-2 ring-accent"
            />
          )}
          {count > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-pill bg-accent px-0.5 text-[9px] sm:text-[10px] sm:h-4 sm:min-w-4 sm:px-1 font-bold tabular-nums text-bg ring-2 ring-surface">
              {count}
            </span>
          )}
        </span>
        Carrito
      </button>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      onClick={() => dispatch(openCart())}
      aria-label={label}
      className="relative grid h-9 w-9 sm:h-11 sm:w-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <motion.span animate={controls} className="block">
        <ShoppingBag className="h-[18px] w-[18px] sm:h-[22px] sm:w-[22px]" />
      </motion.span>
      <AnimatePresence>
        {ping && (
          <motion.span
            aria-hidden
            initial={{ scale: 0.6, opacity: 0.7 }}
            animate={{ scale: 1.8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 rounded-full ring-2 ring-accent"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 20 }}
            className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-pill bg-accent px-1 text-[10px] sm:text-[11px] sm:h-5 sm:min-w-5 font-bold tabular-nums text-bg ring-2 ring-bg"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
