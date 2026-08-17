export default function manifest() {
  return {
    name: "Legado Car",
    short_name: "Legado Car",
    description: "Seu carro. Sua história.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3fb",
    theme_color: "#074793",
    icons: [
      {
        src: "/legado-car-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
