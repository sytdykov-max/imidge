import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThankYouPageClient } from "@/components/thank-you-page-client";

type ThankYouPageProps = {
  searchParams?:
    | Promise<{
        orderId?: string;
        v2?: string;
      }>
    | {
        orderId?: string;
        v2?: string;
      };
};

export const metadata: Metadata = {
  title: "Спасибо за заказ",
  description: "Страница подтверждения заказа в магазине Imidge.",
  alternates: {
    canonical: "/thank-you",
  },
  robots: {
    index: false,
    follow: false,
  },
};

function fallbackOrderId() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const randomPart = String(Math.floor(1000 + Math.random() * 9000));
  return `IM-${datePart}-${randomPart}`;
}

export default async function ThankYouPage({ searchParams }: ThankYouPageProps) {
  const params = searchParams && typeof (searchParams as Promise<unknown>).then === "function"
    ? await (searchParams as Promise<{ orderId?: string }>)
    : (searchParams as { orderId?: string } | undefined);

  const orderId = params?.orderId?.trim() || fallbackOrderId();

  return (
    <div>
      <div className="thank-you-desktop-chrome">
        <SiteHeader />
      </div>
      <header className="thank-you-mobile-header" aria-label="Мобильная шапка страницы спасибо за заказ">
        <div className="container mobile-page-head-row">
          <Link href="/" className="mobile-page-logo" aria-label="Imidge">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/imidge_logo_mark_only_export.svg" alt="Imidge" />
          </Link>
          <p className="mobile-page-head-title">Заказ оформлен</p>
          <Link href="/catalog?v2=1" className="mobile-page-back" aria-label="В каталог">←</Link>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section className="section thank-you-section">
          <div className="container">
            <article className="thank-you-card" aria-labelledby="thankYouTitle">
              <h1 id="thankYouTitle" className="thank-you-title">Спасибо за заказ</h1>
              <p className="thank-you-text">
                Мы получили вашу заявку и уже передали её менеджеру. В ближайшее время с вами свяжутся для подтверждения деталей доставки и оплаты.
              </p>

              <ThankYouPageClient orderId={orderId} />

              <div className="thank-you-actions">
                <Link href="/catalog?v2=1" className="catalog-btn-v2 primary">Продолжить покупки</Link>
                <Link href="/" className="cart-v2-secondary-btn">На главную</Link>
              </div>
            </article>
          </div>
        </section>
      </main>
      <div className="thank-you-desktop-chrome">
        <SiteFooter />
      </div>
    </div>
  );
}
