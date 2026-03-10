import type { Metadata } from "next";
import { CartPageClient } from "@/components/cart-page-client";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CartPageProps = {
  searchParams?:
    | Promise<{
        v2?: string | string[];
      }>
    | {
        v2?: string | string[];
      };
};

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

export default async function CartPage({ searchParams }: CartPageProps) {
  void searchParams;
  const isCartRedesign = true;

  return (
    <div>
      <SiteHeader compact={isCartRedesign} />
      <main id="main-content" tabIndex={-1}>
        <section className={`section${isCartRedesign ? " cart-section-v2" : ""}`}>
          <div className="container">
            <CartPageClient isCartRedesign={isCartRedesign} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
