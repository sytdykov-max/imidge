import type { Metadata } from "next";
import { CheckoutPageClient } from "@/components/checkout-page-client";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

type CheckoutPageProps = {
  searchParams?: Promise<{
    v2?: string;
  }>;
};

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

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const query = searchParams ? await searchParams : undefined;
  const redesignByEnv = process.env.NEXT_PUBLIC_ENABLE_CHECKOUT_REDESIGN === "1";
  const redesignByQuery = query?.v2 === "1";
  const isCheckoutRedesign = redesignByEnv || redesignByQuery;

  return (
    <div>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className={`section${isCheckoutRedesign ? " checkout-section-v2" : ""}`}>
          <div className="container">
            <CheckoutPageClient isCheckoutRedesign={isCheckoutRedesign} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
