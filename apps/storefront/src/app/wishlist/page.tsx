import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WishlistPageClient } from "@/components/wishlist-page-client";

export const metadata: Metadata = {
  title: "Избранное",
  description: "Список избранных товаров Imidge.",
  alternates: {
    canonical: "/wishlist",
  },
  openGraph: {
    title: "Избранное Imidge",
    description: "Список избранных товаров Imidge.",
    url: "/wishlist",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Избранное Imidge",
    description: "Список избранных товаров Imidge.",
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function WishlistPage() {
  return (
    <div>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="section">
          <div className="container">
            <WishlistPageClient />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
