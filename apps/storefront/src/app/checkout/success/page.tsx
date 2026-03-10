import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

type CheckoutSuccessPageProps = {
  searchParams: Promise<{
    displayId?: string;
    orderId?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Заказ успешно создан",
  description: "Подтверждение заказа в магазине Imidge.",
  alternates: {
    canonical: "/checkout/success",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CheckoutSuccessPage({ searchParams }: CheckoutSuccessPageProps) {
  const params = await searchParams;
  const orderLabel = params.displayId ? `#${params.displayId}` : params.orderId || "";

  return (
    <div>
      <SiteHeader />

      <main id="main-content" tabIndex={-1}>
        <section className="section">
          <div className="container">
            <h1 className="section-title">Спасибо за заказ</h1>
            <p className="section-subtitle">
              Заказ успешно создан{orderLabel ? `: ${orderLabel}` : ""}. Мы свяжемся с вами для подтверждения
              деталей доставки.
            </p>

            <div className="product-actions-block" style={{ marginTop: 24 }}>
              <Link href="/catalog" className="cta-btn">
                Вернуться в каталог
              </Link>
              <Link href="/" className="secondary-btn">
                На главную
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
