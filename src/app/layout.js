import "./globals.css";
import PwaProvider from "./components/pwa-provider";
import SessionProvider from "./components/session-provider";
import NavigationTransitionProvider from "./components/navigation-transition-provider";

export const metadata = {
  applicationName: "LegadoCar",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LegadoCar",
  },
  description: "Seu carro. Sua história.",
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { sizes: "192x192", type: "image/png", url: "/pwa-icon-192.png" },
      { sizes: "512x512", type: "image/png", url: "/pwa-icon-512.png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  title: "LegadoCar",
};

export const viewport = {
  themeColor: "#074793",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <PwaProvider>
          <SessionProvider>
            <NavigationTransitionProvider>{children}</NavigationTransitionProvider>
          </SessionProvider>
        </PwaProvider>
      </body>
    </html>
  );
}
