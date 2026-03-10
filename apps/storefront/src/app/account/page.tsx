import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

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
        <section className="section">
          <div className="container">
            <h1 className="section-title">Личный кабинет</h1>
            <p className="section-subtitle">Подключение авторизации и профиля будет следующим шагом после checkout.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
