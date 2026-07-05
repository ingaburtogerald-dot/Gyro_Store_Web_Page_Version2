// Variantes de Framer Motion compartidas por los formularios de la reportería.
// `formStagger` en el <form> y `fieldItem` en cada campo → los campos entran uno
// por uno (fade in up) al abrirse el panel de registro. Spring para un tacto vivo.
import type { Variants } from "framer-motion";

export const formStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

export const fieldItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};
