import type { Metadata } from "next";
import { CheckoutPageClient } from "@/components/checkout-page-client";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
export const metadata: Metadata = {
  title: "Оформление заказа",
  description: "Оформление заказа в Imidge: контактные данные, доставка и подтверждение покупки.",
  alternates: {
    canonical: "/checkout",
  },
  openGraph: {
    title: "Checkout Imidge",
    description: "Оформление заказа в Imidge: контактные данные, доставка и подтверждение покупки.",
    url: "/checkout",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Checkout Imidge",
    description: "Оформление заказа в Imidge: контактные данные, доставка и подтверждение покупки.",
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function CheckoutPage() {

  return (
    <div>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="section">
          <div className="container">
            <CheckoutPageClient />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
