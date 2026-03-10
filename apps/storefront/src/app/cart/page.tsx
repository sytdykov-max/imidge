import type { Metadata } from "next";
import { CartPageClient } from "@/components/cart-page-client";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
export const metadata: Metadata = {
  title: "Корзина",
  description: "Корзина покупок Imidge: управление выбранными товарами и переход к оформлению.",
  alternates: {
    canonical: "/cart",
  },
  openGraph: {
    title: "Корзина Imidge",
    description: "Корзина покупок Imidge: управление выбранными товарами и переход к оформлению.",
    url: "/cart",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Корзина Imidge",
    description: "Корзина покупок Imidge: управление выбранными товарами и переход к оформлению.",
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function CartPage() {

  return (
    <div>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="section">
          <div className="container">
            <CartPageClient />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
