export interface UAInfo {
  os: string;
  browser: string;
  device: "Desktop" | "Mobile" | "Bot" | "Desconocido";
}

export function cleanUserAgent(ua: string): UAInfo {
  if (!ua) return { os: "Desconocido", browser: "Desconocido", device: "Desconocido" };
  const lowercaseUA = ua.toLowerCase();
  
  let os = "Desconocido";
  if (lowercaseUA.includes("windows")) os = "Windows";
  else if (lowercaseUA.includes("iphone")) os = "iOS (iPhone)";
  else if (lowercaseUA.includes("ipad")) os = "iOS (iPad)";
  else if (lowercaseUA.includes("android")) os = "Android";
  else if (lowercaseUA.includes("macintosh") || lowercaseUA.includes("mac os")) os = "macOS";
  else if (lowercaseUA.includes("linux")) os = "Linux";
  
  let browser = "Desconocido";
  if (lowercaseUA.includes("chrome") || lowercaseUA.includes("chromium")) browser = "Chrome";
  else if (lowercaseUA.includes("safari") && !lowercaseUA.includes("chrome")) browser = "Safari";
  else if (lowercaseUA.includes("firefox")) browser = "Firefox";
  else if (lowercaseUA.includes("edge")) browser = "Edge";
  else if (lowercaseUA.includes("opera") || lowercaseUA.includes("opr")) browser = "Opera";
  else if (lowercaseUA.includes("bot") || lowercaseUA.includes("crawl") || lowercaseUA.includes("spider")) browser = "Bot/Crawler";
  
  let device: "Desktop" | "Mobile" | "Bot" | "Desconocido" = "Desconocido";
  if (lowercaseUA.includes("bot") || lowercaseUA.includes("crawl") || lowercaseUA.includes("spider")) {
    device = "Bot";
  } else if (/mobile|android|iphone|ipad|ipod|windows phone/i.test(lowercaseUA)) {
    device = "Mobile";
  } else if (/macintosh|windows|linux/i.test(lowercaseUA)) {
    device = "Desktop";
  }
  
  return { os, browser, device };
}

export function cleanProductUrl(url: string): string {
  if (!url) return "";
  
  if (url.startsWith("/producto/")) {
    const raw = url.slice("/producto/".length).split(/[?#]/)[0];
    const withoutId = raw.split("--")[0];
    const name = withoutId.replace(/[-_]/g, " ");
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  
  if (url.startsWith("/combo/")) {
    const raw = url.slice("/combo/".length).split(/[?#]/)[0];
    const withoutId = raw.split("--")[0];
    const name = withoutId.replace(/[-_]/g, " ");
    return "Combo: " + name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  if (url === "/") return "Página de Inicio";
  if (url === "/combos") return "Catálogo de Combos";
  if (url === "/contacto") return "Formulario de Contacto";
  
  return url;
}
