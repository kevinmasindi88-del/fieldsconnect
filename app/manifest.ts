import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FieldsConnect",
    short_name: "FieldsConnect",
    description: "Mentorship and professional connection platform.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icons/fc-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/fc-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
