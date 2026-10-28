export default function manifest() {
  return {
    name: "LegadoCar",
    short_name: "LegadoCar",
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
