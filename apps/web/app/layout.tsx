import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "BuyFit — If you love this fit, buy it", template: "%s · BuyFit" },
  description:
    "De l'inspiration Pinterest à la commande : BuyFit trouve la tenue chez tes marques, te la montre sur toi et prépare la commande.",
};

export const viewport: Viewport = {
  themeColor: "#7A1F2B",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
        <Toaster position="bottom-center" richColors closeButton mobileOffset={{ bottom: 88 }} />
      </body>
    </html>
  );
}
