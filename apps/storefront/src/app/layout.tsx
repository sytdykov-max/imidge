import type { Metadata } from "next";
import { Inter, Montserrat, Playfair_Display } from "next/font/google";
import { CartStoreProvider } from "@/components/cart-store-provider";
import { ToastProvider } from "@/components/toast-provider";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3002";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "cyrillic"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Imidge — интернет-магазин одежды",
    template: "%s | Imidge",
  },
  description: "Интернет-магазин Imidge: каталог, карточки товаров, корзина и оформление заказа.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName: "Imidge",
    title: "Imidge — интернет-магазин одежды",
    description: "Интернет-магазин Imidge: каталог, карточки товаров, корзина и оформление заказа.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Imidge — интернет-магазин одежды",
    description: "Интернет-магазин Imidge: каталог, карточки товаров, корзина и оформление заказа.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} ${montserrat.variable} ${playfairDisplay.variable}`}>
        <ToastProvider>
          <CartStoreProvider>{children}</CartStoreProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
