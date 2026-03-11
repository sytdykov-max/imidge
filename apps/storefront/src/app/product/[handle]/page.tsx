import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WishlistToggleButton } from "@/components/wishlist-toggle-button";
import { RecentlyViewedProducts } from "@/components/recently-viewed-products";
import { extractProductBrand } from "@/lib/catalog-brand";
import { getAllStoreProducts, getMinProductPrice, getStoreProductByHandle } from "@/lib/medusa-store";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3002";

type ProductPageProps = {
  params: Promise<{
    handle: string;
  }>;
  searchParams?: Promise<{
    v2?: string;
  }>;
};

function textFromMetadata(metadata: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!metadata) {
    return undefined;
  }

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function buildProductSeoDescription(product: {
  title: string;
  description?: string | null;
  collection?: { title?: string } | null;
  type?: { value?: string } | null;
}) {
  if (product.description?.trim()) {
    return product.description;
  }

  const category = product.collection?.title?.trim() || product.type?.value?.trim() || "одежда";
  return `${product.title} от бренда Imidge. Категория: ${category}. Доставка и оформление заказа онлайн.`;
}

async function getRegionCurrencyCodes(): Promise<string[]> {
  const baseUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

  if (!baseUrl || !publishableKey) {
    return [];
  }

  const response = await fetch(`${baseUrl}/store/regions?limit=100`, {
    headers: {
      "x-publishable-api-key": publishableKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    regions?: Array<{
      currency_code?: string;
    }>;
  };

  return (data.regions ?? [])
    .map((region) => region.currency_code?.toLowerCase())
    .filter((currency): currency is string => Boolean(currency));
}

async function getDefaultRegionCurrencyCode(): Promise<string | null> {
  const baseUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

  if (!baseUrl || !publishableKey) {
    return null;
  }

  const response = await fetch(`${baseUrl}/store/regions?limit=1`, {
    headers: {
      "x-publishable-api-key": publishableKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    regions?: Array<{
      currency_code?: string;
    }>;
  };

  return data.regions?.[0]?.currency_code?.toLowerCase() ?? null;
}

function buildProductJsonLd(product: {
  title: string;
  handle: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  thumbnail?: string | null;
  collection?: { title?: string } | null;
  type?: { value?: string } | null;
  variants?: Array<{
    manage_inventory?: boolean;
    inventory_quantity?: number;
    prices?: Array<{
      amount?: number;
      currency_code?: string;
    }>;
  }>;
}) {
  const description = buildProductSeoDescription(product);
  const category = product.collection?.title?.trim() || product.type?.value?.trim();
  const metadata = product.metadata ?? {};

  const numberFrom = (value: unknown) => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  };

  const textFrom = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

  const ratingValue = numberFrom(metadata.rating_value ?? metadata.ratingValue);
  const ratingCount = numberFrom(metadata.rating_count ?? metadata.ratingCount);
  const reviewCount = numberFrom(metadata.review_count ?? metadata.reviewCount ?? metadata.rating_count);

  const aggregateRating =
    typeof ratingValue === "number" && typeof ratingCount === "number" && ratingCount > 0
      ? {
          "@type": "AggregateRating",
          ratingValue,
          ratingCount,
          reviewCount: typeof reviewCount === "number" ? reviewCount : ratingCount,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined;

  const reviewAuthor = textFrom(metadata.review_author ?? metadata.reviewAuthor);
  const reviewBody = textFrom(metadata.review_body ?? metadata.reviewBody);
  const reviewRatingValue = numberFrom(metadata.review_rating ?? metadata.reviewRating);

  const review =
    reviewAuthor && reviewBody && typeof reviewRatingValue === "number"
      ? [
          {
            "@type": "Review",
            author: {
              "@type": "Person",
              name: reviewAuthor,
            },
            reviewBody,
            reviewRating: {
              "@type": "Rating",
              ratingValue: reviewRatingValue,
              bestRating: 5,
              worstRating: 1,
            },
          },
        ]
      : undefined;

  const primaryVariant = product.variants?.[0];
  const preferredPrice =
    primaryVariant?.prices?.find((price) => price.currency_code?.toLowerCase() === "eur") ||
    primaryVariant?.prices?.[0];
  const hasStock =
    primaryVariant?.manage_inventory === false ||
    (typeof primaryVariant?.inventory_quantity === "number" && primaryVariant.inventory_quantity > 0);

  const offers =
    typeof preferredPrice?.amount === "number" && preferredPrice.currency_code
      ? {
          "@type": "Offer",
          priceCurrency: preferredPrice.currency_code.toUpperCase(),
          price: preferredPrice.amount,
          availability: hasStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url: `${siteUrl}/product/${product.handle}`,
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description,
    image: product.thumbnail ? [product.thumbnail] : undefined,
    brand: {
      "@type": "Brand",
      name: "Imidge",
    },
    category,
    sku: product.handle,
    url: `${siteUrl}/product/${product.handle}`,
    offers,
    aggregateRating,
    review,
  };
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { handle } = await params;
  const product = await getStoreProductByHandle(handle);

  if (!product) {
    return {
      title: "Товар не найден",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const description = buildProductSeoDescription(product);
  const canonicalUrl = `/product/${product.handle}`;

  return {
    title: product.title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: product.title,
      description,
      type: "website",
      url: canonicalUrl,
      images: product.thumbnail ? [product.thumbnail] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description,
      images: product.thumbnail ? [product.thumbnail] : undefined,
    },
  };
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const { handle } = await params;
  if (handle === "<handle>" || handle === "%3Chandle%3E") {
    redirect("/catalog?v2=1");
  }
  const query = searchParams ? await searchParams : undefined;
  const redesignByEnv = process.env.NEXT_PUBLIC_ENABLE_PRODUCT_REDESIGN === "1";
  const redesignByQuery = query?.v2 === "1";
  const isProductRedesign = redesignByEnv || redesignByQuery;
  const catalogHref = isProductRedesign ? "/catalog?v2=1" : "/catalog";
  const [product, regionCurrencyCodes, defaultRegionCurrencyCode] = await Promise.all([
    getStoreProductByHandle(handle),
    getRegionCurrencyCodes(),
    getDefaultRegionCurrencyCode(),
  ]);
  const hasPositivePrice = (variant?: {
    prices?: Array<{
      amount?: number;
      currency_code?: string;
    }>;
  }) =>
    (variant?.prices ?? []).some((price) => {
      const hasAmount = typeof price.amount === "number" && price.amount > 0;
      if (!hasAmount) {
        return false;
      }

      if (regionCurrencyCodes.length === 0) {
        return true;
      }

      return regionCurrencyCodes.includes(price.currency_code?.toLowerCase() ?? "");
    });
  const defaultVariantId =
    product?.variants?.find(
      (variant) =>
        hasPositivePrice(variant) &&
        (variant.manage_inventory === false ||
          typeof variant.inventory_quantity !== "number" ||
          variant.inventory_quantity > 0)
    )?.id;
  const hasPurchasableVariant = Boolean(
    product?.variants?.some(
      (variant) =>
        hasPositivePrice(variant) &&
        (variant.manage_inventory === false ||
          typeof variant.inventory_quantity !== "number" ||
          variant.inventory_quantity > 0)
    )
  );

  if (!product) {
    notFound();
  }

  const productPageImage = product.images?.find((image) => image?.url)?.url ?? product.thumbnail;
  const galleryImages = [
    ...(product.images ?? []).map((image) => image?.url).filter((url): url is string => Boolean(url)),
    ...(product.thumbnail ? [product.thumbnail] : []),
  ].filter((value, index, array) => array.indexOf(value) === index);
  const primaryGalleryImage = galleryImages[0] ?? productPageImage;
  const productBrand = extractProductBrand(product);
  const productCategory = product.collection?.title?.trim() || product.type?.value?.trim() || "Каталог";
  const sku = textFromMetadata(product.metadata, "sku", "code") ?? product.handle?.toUpperCase();
  const availabilityLabel = hasPurchasableVariant ? "В наличии" : "Нет в наличии";

  const availablePrices = (product.variants ?? [])
    .flatMap((variant) => variant.prices ?? [])
    .filter((price): price is { amount: number; currency_code: string } => {
      return typeof price.amount === "number" && price.amount > 0 && typeof price.currency_code === "string";
    });

  const regionCurrency = defaultRegionCurrencyCode?.toLowerCase();
  const displayPrice =
    (regionCurrency
      ? availablePrices.find((price) => price.currency_code.toLowerCase() === regionCurrency)
      : undefined) ||
    availablePrices.find((price) => regionCurrencyCodes.includes(price.currency_code.toLowerCase())) ||
    availablePrices[0];

  const currentPriceText = displayPrice
    ? `${displayPrice.amount.toLocaleString("ru-RU")} ${displayPrice.currency_code.toUpperCase()}`
    : "Цена уточняется";
  const oldPriceText = displayPrice
    ? `${Math.round(displayPrice.amount * 1.2).toLocaleString("ru-RU")} ${displayPrice.currency_code.toUpperCase()}`
    : undefined;

  const optionDefinitions = (product.options ?? [])
    .map((option) => {
      const optionId = option.id?.trim();
      const optionTitle = option.title?.trim();
      if (!optionId || !optionTitle) {
        return null;
      }

      const values = new Set<string>();
      for (const value of option.values ?? []) {
        if (typeof value?.value === "string" && value.value.trim()) {
          values.add(value.value.trim());
        }
      }

      for (const variant of product.variants ?? []) {
        const variantValue = variant.options?.find((entry) => entry.option_id === optionId)?.value;
        if (typeof variantValue === "string" && variantValue.trim()) {
          values.add(variantValue.trim());
        }
      }

      return {
        id: optionId,
        title: optionTitle,
        values: Array.from(values),
      };
    })
    .filter((option): option is { id: string; title: string; values: string[] } => Boolean(option && option.values.length > 0));

  const variantSelections = (product.variants ?? []).map((variant) => ({
    id: variant.id,
    isPurchasable:
      hasPositivePrice(variant) &&
      (variant.manage_inventory === false ||
        typeof variant.inventory_quantity !== "number" ||
        variant.inventory_quantity > 0),
    options: (variant.options ?? []).map((option) => ({
      optionId: option.option_id,
      value: option.value,
    })),
  }));

  const specs = [
    textFromMetadata(product.metadata, "case_material", "material") ? `Материал: ${textFromMetadata(product.metadata, "case_material", "material")}` : "Материал: Премиум",
    textFromMetadata(product.metadata, "glass") ? `Стекло: ${textFromMetadata(product.metadata, "glass")}` : "Стекло: Минеральное",
    textFromMetadata(product.metadata, "strap", "strap_type") ? `Ремешок: ${textFromMetadata(product.metadata, "strap", "strap_type")}` : "Ремешок: Браслет",
    textFromMetadata(product.metadata, "water_resistance", "waterproof") ? `Водозащита: ${textFromMetadata(product.metadata, "water_resistance", "waterproof")}` : "Водозащита: Базовая",
  ];

  const candidateProducts = await getAllStoreProducts({ pageLimit: 100, maxPages: 100 });
  const relatedProducts = candidateProducts
    .filter((candidate) => candidate.handle !== product.handle)
    .map((candidate) => ({
      ...candidate,
      brand: extractProductBrand(candidate),
      minPrice: getMinProductPrice(candidate),
      variantId: candidate.variants?.find((variant) =>
        (variant.prices ?? []).some((price) => typeof price.amount === "number" && price.amount > 0)
      )?.id,
    }))
    .filter((candidate) => candidate.brand === productBrand)
    .slice(0, 4);

  const productJsonLd = buildProductJsonLd(product);

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      <SiteHeader />

      <main id="main-content" tabIndex={-1}>
        <section className={`section${isProductRedesign ? " product-section-v2" : ""}`}>
          <div className="container">
            {isProductRedesign ? (
              <nav className="product-v2-breadcrumbs" aria-label="Хлебные крошки">
                <Link href="/">Главная</Link>
                <span aria-hidden="true">›</span>
                <Link href={catalogHref}>Каталог</Link>
                <span aria-hidden="true">›</span>
                <span>{product.title}</span>
              </nav>
            ) : (
              <nav aria-label="Хлебные крошки">
                <Link href={catalogHref} className="hero-kicker" rel="up">
                  ← Назад в каталог
                </Link>
              </nav>
            )}

            <div className={`product-layout${isProductRedesign ? " product-layout-v2" : ""}`}>
              <div className={`product-media${isProductRedesign ? " product-media-v2" : ""}`}>
                {primaryGalleryImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={primaryGalleryImage} alt={product.title} className={`product-page-image${isProductRedesign ? " product-page-image-v2" : ""}`} />
                ) : (
                  <div className="product-page-image placeholder">IMIDGE</div>
                )}

                {isProductRedesign && galleryImages.length > 1 && (
                  <div className="product-thumbs-v2" aria-label="Галерея товара">
                    {galleryImages.slice(0, 4).map((imageUrl, index) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={`${imageUrl}-${index}`} src={imageUrl} alt={`${product.title} ${index + 1}`} className="product-thumb-v2" />
                    ))}
                  </div>
                )}
              </div>

              <div className={`product-info${isProductRedesign ? " product-info-v2" : ""}`}>
                {isProductRedesign && <p className="product-brand-v2">{productBrand}</p>}
                <h1 className={`section-title${isProductRedesign ? " product-title-page-v2" : ""}`}>{product.title}</h1>
                {!isProductRedesign && <p className="product-handle">/{product.handle}</p>}

                {isProductRedesign && (
                  <p className="product-meta-v2">
                    <span>Код: {sku}</span>
                    <span>{availabilityLabel}</span>
                    <span>Доставка 1–2 дня</span>
                  </p>
                )}

                {isProductRedesign && (
                  <div className="product-price-row-v2">
                    {oldPriceText && <span className="product-price-old-v2">{oldPriceText}</span>}
                    <strong className="product-price-new-v2">{currentPriceText}</strong>
                  </div>
                )}

                <p className={`product-description${isProductRedesign ? " product-description-v2" : ""}`}>
                  {product.description || "Описание будет уточнено при переносе контента из текущего сайта."}
                </p>

                <AddToCartButton
                  variantId={hasPurchasableVariant ? defaultVariantId : undefined}
                  disabledReason={
                    hasPurchasableVariant
                      ? undefined
                      : "Товар временно недоступен для заказа (цена не настроена для доступных регионов)."
                  }
                  optionDefinitions={optionDefinitions}
                  variants={variantSelections}
                  replacePrimaryButton={
                    <WishlistToggleButton
                      mode="inline"
                      item={{
                        handle: product.handle,
                        title: product.title,
                        brand: productBrand || "Без бренда",
                        thumbnail: product.thumbnail,
                        priceText: currentPriceText,
                      }}
                    />
                  }
                />

                {isProductRedesign && (
                  <div className="product-specs-v2">
                    <h3>Характеристики</h3>
                    <div className="product-specs-grid-v2">
                      {specs.map((spec) => (
                        <span key={spec}>{spec}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {relatedProducts.length > 0 && (
              <div className={isProductRedesign ? "product-related-v2" : undefined}>
                {isProductRedesign ? (
                  <h2 className="product-related-title-v2">Похожие товары</h2>
                ) : (
                  <p className="hero-kicker">Похожие товары</p>
                )}
                <div className={`catalog-grid${isProductRedesign ? " catalog-grid-v2 product-related-grid-v2" : ""}`}>
                  {relatedProducts.map((related) => {
                    const relatedHref = isProductRedesign ? `/product/${related.handle}?v2=1` : `/product/${related.handle}`;

                    return (
                      <article className={`product-card${isProductRedesign ? " product-card-v2" : ""}`} key={related.id}>
                        <Link href={relatedHref} aria-label={`Открыть товар ${related.title}`}>
                          <div className={`product-image-wrap${isProductRedesign ? " product-image-wrap-v2" : ""}`}>
                            {related.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={related.thumbnail} alt={related.title} className="product-image" />
                            ) : (
                              <div className="product-image placeholder">IMIDGE</div>
                            )}
                          </div>
                        </Link>

                        {isProductRedesign ? (
                          <div className="catalog-card-body-v2 catalog-card-body-v2-simple">
                            <h3 className="product-title-v2">
                              <Link href={relatedHref} aria-label={`Открыть товар ${related.title}`}>
                                {related.title}
                              </Link>
                            </h3>
                            <div className="catalog-price-row-v2">
                              {related.minPrice && (
                                <span className="product-price-old-v2">
                                  {Math.round(related.minPrice.amount * 1.2).toLocaleString("ru-RU")}
                                </span>
                              )}
                              <strong className="product-price-v2">
                                {related.minPrice
                                  ? `${related.minPrice.amount.toLocaleString("ru-RU")} ${related.minPrice.currency}`
                                  : "Цена уточняется"}
                              </strong>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="hero-kicker">{related.brand}</p>
                            <h3>
                              <Link href={relatedHref} aria-label={`Открыть товар ${related.title}`}>
                                {related.title}
                              </Link>
                            </h3>
                            <p className="product-handle">/{related.handle}</p>
                            <Link href={relatedHref} className="cta-btn product-btn">
                              Открыть товар
                            </Link>
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            <RecentlyViewedProducts
              isProductRedesign={isProductRedesign}
              currentItem={{
                handle: product.handle,
                title: product.title,
                brand: productBrand || "Без бренда",
                category: productCategory,
                thumbnail: product.thumbnail,
                priceText: currentPriceText,
                oldPriceText,
                variantId: defaultVariantId,
              }}
            />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
