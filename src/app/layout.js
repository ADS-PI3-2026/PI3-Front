import "./globals.css";
import SessionProvider from "./components/session-provider";

export const metadata = {
  title: "LegadoCar",
  description: "Seu carro. Sua história.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body><SessionProvider>{children}</SessionProvider></body>
    </html>
  );
}
