import { useNavigate } from "@remix-run/react";
import { MapPin, ArrowRight, Phone, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { Modal } from "~/components/ui/Modal";
import { Logo } from "~/components/ui/Logo";
import { Button } from "~/components/ui/Button";
import { SocialLink, TikTokIcon, SOCIAL_BRAND } from "~/components/ui/SocialIcon";
import { Instagram, Facebook } from "lucide-react";
import { useGetConfigQuery } from "~/store/api/catalogApi";
import { buildWhatsappUrl } from "~/lib/utils";

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
    ? buildWhatsappUrl(whatsapp, "Hola Gyro Store, vengo de la página web!")
    : "#";

  const handleGoToCatalog = () => {
    onClose();
    navigate("/");
  };

  return (
    <Modal open={open} onClose={onClose} title="Quiénes Somos" maxWidth="max-w-3xl">
      <div className="flex flex-col items-center justify-center space-y-6 px-2 pb-4 pt-2 text-center sm:px-6">
        
        {/* Header: Logo */}
        <div className="flex flex-col items-center mb-2">
          <motion.div
            whileHover={{ y: -8, scale: 1.06, rotate: [-1, 1, -1, 0] }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="cursor-pointer"
          >
            <Logo size={90} />
          </motion.div>
        </div>

        {/* Story Content */}
        <div className="space-y-3 sm:space-y-4 rounded-2xl bg-surface-2 p-4 sm:p-6 text-[13px] sm:text-base leading-relaxed text-text text-left">
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
            className="h-20 w-20 sm:h-28 sm:w-28 rounded-full border-4 border-surface-2 object-cover shadow-xl"
            onError={(e) => { e.currentTarget.src = "https://ui-avatars.com/api/?name=Gerald+Aburto&background=04201a&color=fff"; }}
          />
          <div className="text-center">
            <h3 className="font-bold text-text text-base sm:text-lg">Gerald Aburto</h3>
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted mb-2 sm:mb-3">Fundador de Gyro Store</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-[12px] sm:text-sm">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-whatsapp/15 text-whatsapp hover:bg-whatsapp/25 transition-colors px-3 py-1.5 sm:px-4 sm:py-2 rounded-full font-semibold shadow-sm"
              >
                <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {whatsapp || "+505 8594 4758"}
              </a>
              <a 
                href="mailto:ingaburtogerald@gmail.com" 
                className="flex items-center gap-1.5 bg-accent/15 text-accent hover:bg-accent/25 transition-colors px-3 py-1.5 sm:px-4 sm:py-2 rounded-full font-semibold shadow-sm"
              >
                <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                ingaburtogerald@gmail.com
              </a>
            </div>
          </div>
        </div>

        {/* Social Media and WhatsApp */}
        <div className="flex w-full flex-col gap-3 sm:gap-4 pt-3 sm:pt-4 sm:flex-row sm:justify-center">
          <div className="flex justify-center gap-2 sm:gap-3">
            <a 
              href={social?.instagram || "#"} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-[14px] sm:rounded-2xl transition-transform hover:scale-105 active:scale-95" 
              style={{ backgroundColor: SOCIAL_BRAND.instagram.tint, color: SOCIAL_BRAND.instagram.color }}
              aria-label="Instagram"
            >
              <Instagram className="h-5 w-5 sm:h-6 sm:w-6" />
            </a>
            <a 
              href={social?.facebook || "#"} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-[14px] sm:rounded-2xl transition-transform hover:scale-105 active:scale-95" 
              style={{ backgroundColor: SOCIAL_BRAND.facebook.tint, color: SOCIAL_BRAND.facebook.color }}
              aria-label="Facebook"
            >
              <Facebook className="h-5 w-5 sm:h-6 sm:w-6" />
            </a>
            <a 
              href={social?.tiktok || "https://www.tiktok.com/@gyro_store"} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-[14px] sm:rounded-2xl transition-transform hover:scale-105 active:scale-95" 
              style={{ backgroundColor: SOCIAL_BRAND.tiktok.tint, color: SOCIAL_BRAND.tiktok.color }}
              aria-label="TikTok"
            >
              <TikTokIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </a>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
            className="w-full sm:w-auto text-[12px] sm:text-sm border-whatsapp/40 text-whatsapp hover:bg-whatsapp/10 rounded-[14px]"
          >
            <svg 
              viewBox="0 0 24 24" 
              fill="currentColor" 
              className="h-4 w-4 sm:h-5 sm:w-5" 
              aria-hidden="true"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
            </svg>
            Contáctanos
          </Button>
        </div>

        {/* Go to Catalog Action */}
        <div className="mt-3 border-t border-border pt-4 w-full flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoToCatalog}
            className="group w-full sm:w-auto text-[12px] sm:text-sm border-accent/40 text-accent hover:bg-accent/10 rounded-[14px]"
          >
            Ir al Catálogo de Productos
            <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>

      </div>
    </Modal>
  );
}
