import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AccountPageClient } from "@/components/account-page-client";

export const metadata: Metadata = {
  title: "Личный кабинет",
  description: "Управление профилем и заказами пользователя Imidge.",
  alternates: {
    canonical: "/account",
  },
  openGraph: {
    title: "Личный кабинет Imidge",
    description: "Управление профилем и заказами пользователя Imidge.",
    url: "/account",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Личный кабинет Imidge",
    description: "Управление профилем и заказами пользователя Imidge.",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountPage() {
  return (
    <div>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <AccountPageClient />
      </main>
      <SiteFooter />
    </div>
  );
}
