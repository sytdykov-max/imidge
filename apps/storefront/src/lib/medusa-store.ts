export type StoreProduct = {
  id: string;
  title: string;
  handle: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  thumbnail?: string | null;
  images?: Array<{
    url?: string | null;
  }>;
  collection?: {
    title?: string;
  } | null;
  type?: {
    value?: string;
  } | null;
  options?: Array<{
    id?: string;
    title?: string;
    values?: Array<{
      id?: string;
      value?: string;
    }>;
  }>;
  variants?: Array<{
    id: string;
    title?: string;
    manage_inventory?: boolean;
    inventory_quantity?: number;
    options?: Array<{
      option_id?: string;
      value?: string;
    }>;
    prices?: Array<{
      amount?: number;
      currency_code?: string;
    }>;
  }>;
};

type StoreProductsResponse = {
  products: StoreProduct[];
  count?: number;
  offset?: number;
  limit?: number;
};

export type StoreProductsPage = {
  products: StoreProduct[];
  count: number;
  offset: number;
  limit: number;
};

type StoreProductsCache = {
  expiresAt: number;
  products: StoreProduct[];
};

let allProductsCache: StoreProductsCache | null = null;

export function getMinProductPrice(product: StoreProduct): { amount: number; currency: string } | null {
  const prices = product.variants
    ?.flatMap((variant) => variant.prices ?? [])
    .filter(
      (price): price is { amount: number; currency_code: string } =>
        typeof price.amount === "number" && Boolean(price.currency_code)
    );

  if (!prices?.length) {
    return null;
  }

  const minPrice = prices.reduce((best, current) => (current.amount < best.amount ? current : best));
  return {
    amount: minPrice.amount,
    currency: minPrice.currency_code.toUpperCase(),
  };
}

function withResolvedThumbnail(product: StoreProduct): StoreProduct {
  if (product.thumbnail) {
    return product;
  }

  const fallbackImage = product.images?.find((image) => image?.url)?.url ?? null;
  if (!fallbackImage) {
    return product;
  }

  return {
    ...product,
    thumbnail: fallbackImage,
  };
}

export async function getStoreProductsPage(params?: { limit?: number; offset?: number }): Promise<StoreProductsPage> {
  const baseUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  const limit = params?.limit ?? 24;
  const offset = params?.offset ?? 0;

  if (!baseUrl || !publishableKey) {
    return {
      products: [],
      count: 0,
      offset,
      limit,
    };
  }

  const response = await fetch(
    `${baseUrl}/store/products?limit=${limit}&offset=${offset}&fields=title,handle,metadata,thumbnail,images.url,collection.title,type.value,variants.id,variants.prices.amount,variants.prices.currency_code`,
    {
      headers: {
        "x-publishable-api-key": publishableKey,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return {
      products: [],
      count: 0,
      offset,
      limit,
    };
  }

  const data = (await response.json()) as StoreProductsResponse;
  const products = (data.products ?? []).map(withResolvedThumbnail);

  return {
    products,
    count: typeof data.count === "number" ? data.count : products.length,
    offset: typeof data.offset === "number" ? data.offset : offset,
    limit: typeof data.limit === "number" ? data.limit : limit,
  };
}

export async function getStoreProducts(limit = 24): Promise<StoreProduct[]> {
  const page = await getStoreProductsPage({ limit, offset: 0 });
  return page.products;
}

export async function getAllStoreProducts(params?: { pageLimit?: number; maxPages?: number }): Promise<StoreProduct[]> {
  const pageLimit = params?.pageLimit ?? 120;
  const maxPages = params?.maxPages ?? 50;
  const cacheTtlMs = 90_000;

  if (allProductsCache && allProductsCache.expiresAt > Date.now()) {
    return allProductsCache.products;
  }

  const firstPage = await getStoreProductsPage({ limit: pageLimit, offset: 0 });
  const firstProducts = firstPage.products ?? [];
  const totalCount = Number.isFinite(firstPage.count) ? firstPage.count : firstProducts.length;

  if (firstProducts.length === 0) {
    allProductsCache = {
      expiresAt: Date.now() + cacheTtlMs,
      products: [],
    };
    return [];
  }

  if (totalCount <= firstProducts.length) {
    allProductsCache = {
      expiresAt: Date.now() + cacheTtlMs,
      products: firstProducts,
    };
    return firstProducts;
  }

  const maxItems = Math.min(totalCount, pageLimit * maxPages);
  const offsets: number[] = [];
  for (let offset = pageLimit; offset < maxItems; offset += pageLimit) {
    offsets.push(offset);
  }

  const remainingPages = await Promise.all(
    offsets.map((offset) => getStoreProductsPage({ limit: pageLimit, offset }))
  );

  const allProducts = [
    ...firstProducts,
    ...remainingPages.flatMap((page) => page.products ?? []),
  ];

  allProductsCache = {
    expiresAt: Date.now() + cacheTtlMs,
    products: allProducts,
  };

  return allProducts;
}

export async function getStoreProductByHandle(
  handle: string
): Promise<StoreProduct | null> {
  const baseUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

  if (!baseUrl || !publishableKey) {
    return null;
  }

  const response = await fetch(
    `${baseUrl}/store/products?handle=${encodeURIComponent(handle)}&limit=1&fields=title,handle,description,metadata,thumbnail,images.url,collection.title,type.value,options.id,options.title,options.values.id,options.values.value,variants.id,variants.title,variants.manage_inventory,variants.inventory_quantity,variants.options.option_id,variants.options.value,variants.prices.amount,variants.prices.currency_code`,
    {
      headers: {
        "x-publishable-api-key": publishableKey,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as StoreProductsResponse;
  const product = data.products?.[0];
  return product ? withResolvedThumbnail(product) : null;
}
