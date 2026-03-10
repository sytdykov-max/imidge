import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3002";

function getOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Imidge",
    url: siteUrl,
    logo: `${siteUrl}/favicon.ico`,
  };
}

export const metadata: Metadata = {
  title: "Главная",
  description: "Главная страница нового storefront Imidge на Next.js и Medusa.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Imidge — интернет-магазин одежды",
    description: "Главная страница нового storefront Imidge на Next.js и Medusa.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Imidge — интернет-магазин одежды",
    description: "Главная страница нового storefront Imidge на Next.js и Medusa.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function Home() {
  const organizationJsonLd = getOrganizationJsonLd();

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      <SiteHeader />

      <main id="main-content" tabIndex={-1}>
        <section className="hero">
          <div className="container hero-content">
            <p className="hero-kicker">New Imidge Storefront</p>
            <h1>Дизайн dark уже перенесён в новый headless-проект</h1>
            <p>
              Это стартовая версия главной страницы на Next.js. Следующим шагом подключим реальные
              товары из Medusa и соберём полноценный каталог.
            </p>
            <Link className="cta-btn" href="/catalog">
              Перейти в каталог
            </Link>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2 className="section-title">План ближайших шагов</h2>
            <p className="section-subtitle">
              1) Подключение API Medusa, 2) карточки товаров на странице каталога, 3) корзина,
              4) checkout и личный кабинет на новом стеке.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
