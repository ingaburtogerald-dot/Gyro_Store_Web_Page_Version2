// Botón flotante del carrito con contador de ítems. Hidrata el carrito desde
// localStorage al montar (solo cliente).
import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { hydrate, openCart, selectCartCount } from "~/store/slices/cartSlice";

export function CartFab() {
  const dispatch = useAppDispatch();
  const count = useAppSelector(selectCartCount);
  const controls = useAnimationControls();
  const prevCount = useRef(count);

  useEffect(() => {
    dispatch(hydrate());
  }, [dispatch]);

  // "Pop" cuando se agrega algo (el conteo sube).
  useEffect(() => {
    if (count > prevCount.current) {
      controls.start({ scale: [1, 1.25, 0.95, 1], transition: { duration: 0.4, ease: "easeOut" } });
    }
    prevCount.current = count;
  }, [count, controls]);

  return (
    <motion.button
      animate={controls}
      onClick={() => dispatch(openCart())}
      aria-label="Abrir carrito"
      className="fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full bg-gradient-accent text-white shadow-lg shadow-accent/30 transition-transform active:scale-90"
    >
      <ShoppingBag className="h-6 w-6" />
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-whatsapp px-1 text-xs font-bold text-[#04201a]"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
