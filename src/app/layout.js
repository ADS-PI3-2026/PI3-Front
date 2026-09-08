import "./globals.css";

export const metadata = {
  title: "Legado Car",
  description: "Seu carro. Sua história.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
