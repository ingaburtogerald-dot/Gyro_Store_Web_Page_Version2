import { useNavigate } from "@remix-run/react";
import { MapPin, ArrowRight, Phone, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { Modal } from "~/components/ui/Modal";
import { Logo } from "~/components/ui/Logo";
import { SocialLink, TikTokIcon, SOCIAL_BRAND } from "~/components/ui/SocialIcon";
import { Instagram, Facebook } from "lucide-react";
import { useGetConfigQuery } from "~/store/api/catalogApi";

interface AboutUsModalProps {
  open: boolean;
  onClose: () => void;
}

export function AboutUsModal({ open, onClose }: AboutUsModalProps) {
  const { data: config } = useGetConfigQuery();
  const social = config?.socialLinks;
  const whatsapp = config?.whatsapp;
  const storeAddress = config?.storeAddress || "Managua, Nicaragua";
  const navigate = useNavigate();

  const whatsappUrl = whatsapp 
    ? `https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent("Hola Gyro Store, vengo de la página web!")}`
    : "#";

  const handleGoToCatalog = () => {
    onClose();
    navigate("/");
  };

  return (
    <Modal open={open} onClose={onClose} title="Quiénes Somos" maxWidth="max-w-3xl">
      <div className="flex flex-col items-center justify-center space-y-6 px-2 pb-4 pt-2 text-center sm:px-6">
        
        {/* Header: Logo and Address */}
        <div className="flex flex-col items-center gap-2 mb-2">
          <motion.div
            whileHover={{ y: -8, scale: 1.06, rotate: [-1, 1, -1, 0] }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="cursor-pointer"
          >
            <Logo size={110} />
          </motion.div>
          <h1 className="bg-gradient-accent bg-clip-text font-extrabold text-transparent text-4xl tracking-tight mt-1">
            Gyro Store
          </h1>
          <a 
            href="https://maps.app.goo.gl/WsvH83yGzzsrkYKE8"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 text-sm font-medium text-muted transition-transform hover:scale-105 active:scale-95"
            title="Ver ubicación en Google Maps"
          >
            <MapPin className="h-5 w-5 text-danger" />
            <span className="underline decoration-transparent underline-offset-2 transition-colors group-hover:decoration-current group-hover:text-text">
              {storeAddress}
            </span>
          </a>
        </div>

        {/* Story Content */}
        <div className="space-y-4 rounded-2xl bg-surface-2 p-5 text-sm leading-relaxed text-text sm:p-6 sm:text-base text-left">
          <p>
            <strong className="text-accent">Gyro Store</strong> nació con un sueño claro: acercar la mejor tecnología directamente a las manos de los nicaragüenses. Lo que comenzó como pequeñas importaciones para amigos y familiares, impulsado por la visión y pasión de nuestro fundador <strong>Gerald Aburto</strong>, rápidamente se transformó en un emprendimiento sólido.
          </p>
          <p>
            Somos un proyecto 100% nicaragüense, hecho por nicaragüenses y para nicaragüenses. Nos dedicamos a la importación de productos electrónicos desde China a Managua, trabajando tanto al detalle como al por mayor con marcas predominantes como <strong>KZ, Attack Shark, Koouri y Aula</strong>, entre otras.
          </p>
          <p>
            Actualmente somos una tienda en línea, pero trabajamos con entusiasmo hacia nuestra meta de abrir nuestra primera sucursal física. Además, para apoyar a nuestra comunidad, brindamos un confiable <strong>servicio de paquetería</strong> para facilitar tus propias importaciones desde China a Managua.
          </p>
          <p>
            También <strong>estamos en busca de socios que deseen emprender</strong> vendiendo nuestros productos. Ofrecemos precios especiales al por mayor para ayudarte a iniciar o crecer tu propio negocio.
          </p>
          <p className="font-medium text-accent">
            ¡Gracias por ser parte de la familia Gyro Store!
          </p>
        </div>

        {/* Founder Section */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <img 
            src="/images/founder.jpg" 
            alt="Gerald Aburto" 
            className="h-28 w-28 rounded-full border-4 border-surface-2 object-cover shadow-xl"
            onError={(e) => { e.currentTarget.src = "https://ui-avatars.com/api/?name=Gerald+Aburto&background=04201a&color=fff"; }}
          />
          <div className="text-center">
            <h3 className="font-bold text-text text-lg">Gerald Aburto</h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Fundador de Gyro Store</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm">
              <a 
                href="https://wa.me/50585944758" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 transition-colors px-4 py-2 rounded-full font-semibold shadow-sm"
              >
                <Phone className="h-4 w-4" />
                +505 8594 4758
              </a>
              <a 
                href="mailto:ingaburtogerald@gmail.com" 
                className="flex items-center gap-1.5 bg-blue-500/15 text-blue-500 hover:bg-blue-500/25 transition-colors px-4 py-2 rounded-full font-semibold shadow-sm"
              >
                <Mail className="h-4 w-4" />
                ingaburtogerald@gmail.com
              </a>
            </div>
          </div>
        </div>

        {/* Social Media and WhatsApp */}
        <div className="flex w-full flex-col gap-4 pt-4 sm:flex-row sm:justify-center">
          <div className="flex justify-center gap-3">
            <a 
              href={social?.instagram || "#"} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform hover:scale-105 active:scale-95" 
              style={{ backgroundColor: SOCIAL_BRAND.instagram.tint, color: SOCIAL_BRAND.instagram.color }}
              aria-label="Instagram"
            >
              <Instagram className="h-6 w-6" />
            </a>
            <a 
              href={social?.facebook || "#"} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform hover:scale-105 active:scale-95" 
              style={{ backgroundColor: SOCIAL_BRAND.facebook.tint, color: SOCIAL_BRAND.facebook.color }}
              aria-label="Facebook"
            >
              <Facebook className="h-6 w-6" />
            </a>
            <a 
              href={social?.tiktok || "#"} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform hover:scale-105 active:scale-95" 
              style={{ backgroundColor: SOCIAL_BRAND.tiktok.tint, color: SOCIAL_BRAND.tiktok.color }}
              aria-label="TikTok"
            >
              <TikTokIcon className="h-5 w-5" />
            </a>
          </div>
          
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl bg-whatsapp px-6 py-3 font-bold text-white shadow-lg shadow-whatsapp/20 transition-transform hover:scale-105 active:scale-95"
          >
            <svg 
              viewBox="0 0 24 24" 
              fill="currentColor" 
              className="h-6 w-6" 
              aria-hidden="true"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
            </svg>
            Contáctanos
          </a>
        </div>

        {/* Go to Catalog Action */}
        <div className="mt-4 border-t border-border pt-6 w-full flex justify-center">
          <button
            onClick={handleGoToCatalog}
            className="group flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-accent px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent/20 transition-all hover:scale-105 hover:bg-accent-hover active:scale-95"
          >
            Ir al Catálogo de Productos
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

      </div>
    </Modal>
  );
}
