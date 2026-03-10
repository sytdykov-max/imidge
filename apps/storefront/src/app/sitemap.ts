import type { MetadataRoute } from "next";

type Product = {
  handle: string;
};

type ProductsResponse = {
  products: Product[];
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3002";

async function getProductHandles(): Promise<string[]> {
  const baseUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

  if (!baseUrl || !publishableKey) {
    return [];
  }

  const response = await fetch(`${baseUrl}/store/products?limit=200&fields=handle`, {
    headers: {
      "x-publishable-api-key": publishableKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as ProductsResponse;
  return data.products?.map((product) => product.handle).filter(Boolean) ?? [];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/catalog",
    "/blog",
  ].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.7,
  }));

  const productHandles = await getProductHandles();

  const productRoutes: MetadataRoute.Sitemap = productHandles.map((handle) => ({
    url: `${siteUrl}/product/${handle}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...staticRoutes, ...productRoutes];
}
