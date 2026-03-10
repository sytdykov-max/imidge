import type { Metadata } from "next";
import { CatalogSearchClient } from "@/components/catalog-search-client";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { extractProductBrand } from "@/lib/catalog-brand";
import { mapCatalogCategory } from "@/lib/catalog-mapping";
import { getAllStoreProducts } from "@/lib/medusa-store";

export const metadata: Metadata = {
  title: "Поиск",
  description: "Поиск товаров по каталогу Imidge.",
  alternates: {
    canonical: "/search",
  },
  openGraph: {
    title: "Поиск Imidge",
    description: "Поиск товаров по каталогу Imidge.",
    url: "/search",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Поиск Imidge",
    description: "Поиск товаров по каталогу Imidge.",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SearchPage() {
  const products = await getAllStoreProducts({ pageLimit: 100, maxPages: 100 });
  const items = products.map((product) => ({
    id: product.id,
    title: product.title,
    handle: product.handle,
    thumbnail: product.thumbnail,
    brand: extractProductBrand(product),
    category: mapCatalogCategory({
      title: product.title,
      handle: product.handle,
      type: product.type?.value,
      collection: product.collection?.title,
    }).label,
  }));

  return (
    <div>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="section">
          <div className="container">
            <h1 className="section-title">Поиск</h1>
            <p className="section-subtitle">Живой поиск по товарам с ранжированием по релевантности.</p>
            <CatalogSearchClient initialQuery="" items={items} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
