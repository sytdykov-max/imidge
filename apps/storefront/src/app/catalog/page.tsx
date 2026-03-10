import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ScrollFadeRow } from "@/components/scroll-fade-row";
import { CatalogV2FilterForm } from "@/components/catalog-v2-filter-form";
import { CatalogCardActions } from "@/components/catalog-card-actions";
import { CatalogSortSelectAuto } from "@/components/catalog-sort-select-auto";
import { CatalogV2SearchAuto } from "@/components/catalog-v2-search-auto";
import { extractProductBrand } from "@/lib/catalog-brand";
import { getCountMap, getPriceCountMap, getTopFacetValues } from "@/lib/catalog-facets";
import { matchPriceRange, sortByCatalogRule } from "@/lib/catalog-filters";
import { mapCatalogCategory } from "@/lib/catalog-mapping";
import {
  buildCatalogQuery,
  CATALOG_PAGE_SIZE,
  CATALOG_PRICE_LABELS,
  CATALOG_PRICE_RANGES,
  CATALOG_SORT_LABELS,
  CATALOG_SORT_OPTIONS,
  normalizeCatalogSearchParams,
  type CatalogQueryInput,
  type CatalogSearchParams,
} from "@/lib/catalog-query";
import { matchesQuery, normalizeQueryText, rankProductsByQuery } from "@/lib/catalog-search";
import { getAllStoreProducts, getMinProductPrice, type StoreProduct } from "@/lib/medusa-store";

type CatalogPageProps = {
  searchParams: Promise<CatalogSearchParams>;
};

type CatalogViewProduct = {
  product: StoreProduct;
  category: string;
  brand: string;
  minPrice: ReturnType<typeof getMinProductPrice>;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightTitle(title: string, query: string): ReactNode {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return title;
  }

  const regex = new RegExp(`(${escapeRegExp(trimmedQuery)})`, "ig");
  const parts = title.split(regex);

  return parts.map((part, index) =>
    part.toLowerCase() === trimmedQuery.toLowerCase() ? (
      <mark key={`${part}-${index}`} className="title-highlight">{part}</mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function sortProducts(items: CatalogViewProduct[], sort: string) {
  return sortByCatalogRule(
    items.map((item) => ({
      ...item,
      title: item.product.title,
      amount: item.minPrice?.amount,
    })),
    sort
  );
}

function pluralizeRuItems(value: number) {
  const absValue = Math.abs(value) % 100;
  const lastDigit = absValue % 10;

  if (absValue > 10 && absValue < 20) {
    return "товаров";
  }

  if (lastDigit === 1) {
    return "товар";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "товара";
  }

  return "товаров";
}

export async function generateMetadata({ searchParams }: CatalogPageProps): Promise<Metadata> {
  const query = await searchParams;
  const { selectedCategories, selectedSort, selectedBrands, selectedPrice, selectedQuery, requestedPage } = normalizeCatalogSearchParams(query);
  const isDeepPaginationPage = requestedPage > 10;
  const categoryQueryValue = selectedCategories.includes("all") ? undefined : selectedCategories;
  const brandQueryValue = selectedBrands.includes("all") ? undefined : selectedBrands;

  const canonicalUrl = buildCatalogQuery({
    cat: categoryQueryValue,
    sort: selectedSort !== "popular" ? selectedSort : undefined,
    brand: brandQueryValue,
    price: selectedPrice !== "all" ? selectedPrice : undefined,
    q: selectedQuery || undefined,
    page: requestedPage > 1 ? requestedPage : undefined,
  });

  return {
    title: "Каталог",
    description: "Каталог товаров Imidge с актуальными данными из Medusa Store API.",
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: "Каталог Imidge",
      description: "Каталог товаров Imidge с актуальными данными из Medusa Store API.",
      url: canonicalUrl,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Каталог Imidge",
      description: "Каталог товаров Imidge с актуальными данными из Medusa Store API.",
    },
    robots: isDeepPaginationPage
      ? {
          index: false,
          follow: true,
        }
      : {
          index: true,
          follow: true,
        },
  };
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const query = await searchParams;
  const redesignByEnv = process.env.NEXT_PUBLIC_ENABLE_CATALOG_REDESIGN === "1";
  const v2QueryValue = (query as Record<string, string | string[] | undefined>).v2;
  const redesignByQuery = Array.isArray(v2QueryValue) ? v2QueryValue.includes("1") : v2QueryValue === "1";
  const isCatalogRedesign = redesignByEnv || redesignByQuery;
  const {
    selectedCategory,
    selectedCategories,
    selectedSort,
    selectedBrand,
    selectedBrands,
    selectedPrice,
    selectedQuery,
    requestedPage,
  } = normalizeCatalogSearchParams(query);

  const hasCategoryFilter = !selectedCategories.includes("all");
  const hasBrandFilter = !selectedBrands.includes("all");
  const selectedCategorySet = new Set(hasCategoryFilter ? selectedCategories : []);
  const selectedBrandSet = new Set(hasBrandFilter ? selectedBrands : []);
  const categoryQueryValue = hasCategoryFilter ? selectedCategories : undefined;
  const brandQueryValue = hasBrandFilter ? selectedBrands : undefined;

  const buildCurrentQuery = (overrides: CatalogQueryInput = {}) => {
    return buildCatalogQuery({
      v2: isCatalogRedesign,
      cat: categoryQueryValue,
      sort: selectedSort !== "popular" ? selectedSort : undefined,
      brand: brandQueryValue,
      price: selectedPrice !== "all" ? selectedPrice : undefined,
      q: selectedQuery || undefined,
      ...overrides,
    });
  };

  const products = await getAllStoreProducts({ pageLimit: 100, maxPages: 100 });
  const mappedProducts: CatalogViewProduct[] = products.map((product) => ({
    product,
    category: mapCatalogCategory({
      title: product.title,
      handle: product.handle,
      type: product.type?.value,
      collection: product.collection?.title,
      metadata: product.metadata,
    }).label,
    brand: extractProductBrand(product),
    minPrice: getMinProductPrice(product),
  }));

  const normalizedQuery = normalizeQueryText(selectedQuery);
  const queryFilteredProducts = normalizedQuery
    ? mappedProducts.filter((item) => {
        return matchesQuery(
          {
            title: item.product.title,
            handle: item.product.handle,
            brand: item.brand,
            category: item.category,
          },
          selectedQuery
        );
      })
    : mappedProducts;

  const preCategoryProducts = !hasBrandFilter
    ? queryFilteredProducts
    : queryFilteredProducts.filter((item) => selectedBrandSet.has(item.brand));

  const preCategoryByPriceProducts = selectedPrice === "all"
    ? preCategoryProducts
    : preCategoryProducts.filter((item) => matchPriceRange(item.minPrice?.amount, selectedPrice, CATALOG_PRICE_RANGES));

  const categoryCountMap = getCountMap(preCategoryByPriceProducts.map((item) => item.category));
  const categories = getTopFacetValues(categoryCountMap, 10);

  const categoryFilteredProducts = !hasCategoryFilter
    ? preCategoryByPriceProducts
    : preCategoryByPriceProducts.filter((item) => selectedCategorySet.has(item.category));

  const preBrandProducts = selectedPrice === "all"
    ? categoryFilteredProducts
    : categoryFilteredProducts.filter((item) => matchPriceRange(item.minPrice?.amount, selectedPrice, CATALOG_PRICE_RANGES));

  const brandCountMap = getCountMap(preBrandProducts.map((item) => item.brand));
  const brands = getTopFacetValues(brandCountMap, 16);

  const filteredProducts = !hasBrandFilter
    ? preBrandProducts
    : preBrandProducts.filter((item) => selectedBrandSet.has(item.brand));

  const prePriceProducts = !hasCategoryFilter
    ? queryFilteredProducts
    : queryFilteredProducts.filter((item) => selectedCategorySet.has(item.category));

  const prePriceByBrandProducts = !hasBrandFilter
    ? prePriceProducts
    : prePriceProducts.filter((item) => selectedBrandSet.has(item.brand));

  const priceCountMap = getPriceCountMap(
    prePriceByBrandProducts.map((item) => ({ amount: item.minPrice?.amount })),
    CATALOG_PRICE_RANGES,
    matchPriceRange
  );

  const baseProducts = selectedQuery && selectedSort === "popular"
    ? rankProductsByQuery(filteredProducts.map((item) => ({
      ...item,
      title: item.product.title,
      handle: item.product.handle,
    })), selectedQuery)
    : filteredProducts;

  const visibleProducts = sortProducts(baseProducts, selectedSort);
  const suggestionPool = new Set<string>();
  if (normalizedQuery) {
    for (const item of mappedProducts) {
      if (normalizeQueryText(item.brand).includes(normalizedQuery)) {
        suggestionPool.add(item.brand);
      }
      if (normalizeQueryText(item.category).includes(normalizedQuery)) {
        suggestionPool.add(item.category);
      }
    }
  }
  const querySuggestions = Array.from(suggestionPool).slice(0, 6);
  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / CATALOG_PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * CATALOG_PAGE_SIZE;
  const pagedProducts = visibleProducts.slice(pageStart, pageStart + CATALOG_PAGE_SIZE);
  const visibleV2Products = visibleProducts.slice(0, currentPage * CATALOG_PAGE_SIZE);
  const renderedProducts = isCatalogRedesign ? visibleV2Products : pagedProducts;
  const shownProductsCount = renderedProducts.length;
  const pageFrom = Math.max(1, currentPage - 2);
  const pageTo = Math.min(totalPages, currentPage + 2);
  const pageNumbers = Array.from({ length: pageTo - pageFrom + 1 }, (_, index) => pageFrom + index);
  const maxV2VisiblePages = 10;
  const v2PageItems: Array<number | "start-ellipsis" | "end-ellipsis"> = [];
  if (totalPages <= maxV2VisiblePages) {
    for (let page = 1; page <= totalPages; page += 1) {
      v2PageItems.push(page);
    }
  } else {
    const innerWindowSize = 6;
    let innerStart = Math.max(2, currentPage - Math.floor(innerWindowSize / 2));
    let innerEnd = Math.min(totalPages - 1, innerStart + innerWindowSize - 1);
    innerStart = Math.max(2, innerEnd - innerWindowSize + 1);

    v2PageItems.push(1);

    if (innerStart > 2) {
      v2PageItems.push("start-ellipsis");
    }

    for (let page = innerStart; page <= innerEnd; page += 1) {
      v2PageItems.push(page);
    }

    if (innerEnd < totalPages - 1) {
      v2PageItems.push("end-ellipsis");
    }

    v2PageItems.push(totalPages);
  }
  const selectedPriceRange = CATALOG_PRICE_RANGES.find((range) => range.value === selectedPrice);
  const priceFromValue = selectedPriceRange && "min" in selectedPriceRange ? selectedPriceRange.min : 0;
  const priceToValue = selectedPriceRange && "max" in selectedPriceRange ? selectedPriceRange.max : 28000;
  const hasNextPage = currentPage < totalPages;
  const hasActiveFilters =
    hasCategoryFilter ||
    hasBrandFilter ||
    selectedPrice !== "all" ||
    selectedSort !== "popular" ||
    selectedQuery.length > 0 ||
    currentPage > 1;

  const catalogRootHref = isCatalogRedesign ? "/catalog?v2=1" : "/catalog";

  const activeFilterPills: Array<{ key: string; label: string; href: string }> = [];

  if (hasCategoryFilter) {
    for (const categoryValue of selectedCategories) {
      activeFilterPills.push({
        key: `cat-${categoryValue}`,
        label: `Категория: ${categoryValue}`,
        href: buildCatalogQuery({
          v2: isCatalogRedesign,
          cat: selectedCategories.filter((item) => item !== categoryValue),
          sort: selectedSort !== "popular" ? selectedSort : undefined,
          brand: brandQueryValue,
          price: selectedPrice !== "all" ? selectedPrice : undefined,
          q: selectedQuery || undefined,
          page: 1,
        }),
      });
    }
  }

  if (hasBrandFilter) {
    for (const brandValue of selectedBrands) {
      activeFilterPills.push({
        key: `brand-${brandValue}`,
        label: `Бренд: ${brandValue}`,
        href: buildCatalogQuery({
          v2: isCatalogRedesign,
          cat: categoryQueryValue,
          sort: selectedSort !== "popular" ? selectedSort : undefined,
          brand: selectedBrands.filter((item) => item !== brandValue),
          price: selectedPrice !== "all" ? selectedPrice : undefined,
          q: selectedQuery || undefined,
          page: 1,
        }),
      });
    }
  }

  if (selectedPrice !== "all") {
    activeFilterPills.push({
      key: "price",
      label: `Цена: ${CATALOG_PRICE_LABELS.get(selectedPrice) ?? selectedPrice}`,
      href: buildCurrentQuery({ price: undefined, page: 1 }),
    });
  }

  if (selectedSort !== "popular") {
    activeFilterPills.push({
      key: "sort",
      label: `Сортировка: ${CATALOG_SORT_LABELS.get(selectedSort) ?? selectedSort}`,
      href: buildCurrentQuery({ sort: undefined, page: 1 }),
    });
  }

  if (selectedQuery) {
    activeFilterPills.push({
      key: "q",
      label: `Поиск: ${selectedQuery}`,
      href: buildCurrentQuery({ q: undefined, page: 1 }),
    });
  }

  if (currentPage > 1) {
    activeFilterPills.push({
      key: "page",
      label: `Страница: ${currentPage}`,
      href: buildCurrentQuery({ page: undefined }),
    });
  }

  return (
    <div>
      <SiteHeader />

      <main id="main-content" tabIndex={-1}>
        <section className={`section${isCatalogRedesign ? " catalog-section-v2" : ""}`}>
          <div className="container">
          {!isCatalogRedesign && (
            <>
              <p className="hero-kicker">Catalog</p>
              <h1 className="section-title">Каталог товаров</h1>
              <p className="section-subtitle">
                Каталог показывает товары из Medusa Store API с серверной фильтрацией и сортировкой.
              </p>
            </>
          )}

          {isCatalogRedesign && (
            <nav className="catalog-v2-breadcrumbs" aria-label="Хлебные крошки">
              <Link href="/">Главная</Link>
              <span aria-hidden="true">›</span>
              <span>Каталог</span>
            </nav>
          )}

          <div className={isCatalogRedesign ? "catalog-v2-layout" : undefined}>
            {isCatalogRedesign && (
              <aside className="catalog-v2-sidebar" aria-label="Фильтры каталога">
                <div className="catalog-v2-panel">
                  <h3>Фильтры</h3>

                  <div className="catalog-v2-active-box" role="status" aria-live="polite">
                    <div className="catalog-v2-active-head">
                      <p>Активные фильтры</p>
                      {hasActiveFilters && (
                        <Link href={catalogRootHref} className="catalog-v2-reset-link">
                          Сбросить
                        </Link>
                      )}
                    </div>
                    {hasActiveFilters ? (
                      <div className="catalog-v2-active-list">
                        {activeFilterPills.map((pill) => (
                          <Link key={pill.key} href={pill.href} className="catalog-v2-active-item" aria-label={`Убрать фильтр: ${pill.label}`}>
                            {pill.label}
                            <span className="catalog-v2-active-remove" aria-hidden="true">×</span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="catalog-v2-active-empty">Пока нет активных фильтров</p>
                    )}
                  </div>

                  <CatalogV2FilterForm
                    selectedCategories={selectedCategories}
                    selectedBrands={selectedBrands}
                    selectedPrice={selectedPrice}
                    selectedSort={selectedSort}
                    selectedQuery={selectedQuery}
                    categoryOptions={[
                      { value: "all", label: "Все", count: preCategoryByPriceProducts.length },
                      ...categories.map((category) => ({
                        value: category,
                        label: category,
                        count: categoryCountMap.get(category) ?? 0,
                      })),
                    ]}
                    brandOptions={[
                      { value: "all", label: "Все бренды", count: preBrandProducts.length },
                      ...brands.map((brand) => ({
                        value: brand,
                        label: brand,
                        count: brandCountMap.get(brand) ?? 0,
                      })),
                    ]}
                    priceOptions={CATALOG_PRICE_RANGES.map((range) => ({
                      value: range.value,
                      label: range.label,
                      count: priceCountMap.get(range.value) ?? 0,
                    }))}
                    priceFromValue={priceFromValue}
                    priceToValue={priceToValue}
                  />
                </div>
              </aside>
            )}

            <div className={isCatalogRedesign ? "catalog-v2-main" : undefined}>

          <div className={`catalog-toolbar${isCatalogRedesign ? " catalog-toolbar-v2" : ""}`}>
            <p className="catalog-count">Найдено: {visibleProducts.length} · Стр. {currentPage}/{totalPages}</p>
            {isCatalogRedesign ? (
              <>
                <CatalogV2SearchAuto
                  initialQuery={selectedQuery}
                  selectedCategories={selectedCategories}
                  selectedBrands={selectedBrands}
                  selectedPrice={selectedPrice}
                  selectedSort={selectedSort}
                />

                <div className="catalog-toolbar-v2-right">
                <form className="catalog-sort-form-v2" method="get" action="/catalog" aria-label="Сортировка каталога">
                  <input type="hidden" name="v2" value="1" />
                  {(categoryQueryValue ?? []).map((category) => (
                    <input key={`sort-cat-${category}`} type="hidden" name="cat" value={category} />
                  ))}
                  {(brandQueryValue ?? []).map((brand) => (
                    <input key={`sort-brand-${brand}`} type="hidden" name="brand" value={brand} />
                  ))}
                  {selectedPrice !== "all" && <input type="hidden" name="price" value={selectedPrice} />}
                  {selectedQuery && <input type="hidden" name="q" value={selectedQuery} />}
                  <CatalogSortSelectAuto
                    name="sort"
                    defaultValue={selectedSort}
                    className="catalog-sort-select-v2"
                    ariaLabel="Сортировка"
                    options={CATALOG_SORT_OPTIONS}
                  />
                </form>
                </div>
              </>
            ) : (
              <>
                <form className="catalog-search-form" method="get" action="/catalog" role="search" aria-label="Поиск в каталоге">
                  {selectedCategory !== "all" && <input type="hidden" name="cat" value={selectedCategory} />}
                  {selectedSort !== "popular" && <input type="hidden" name="sort" value={selectedSort} />}
                  {selectedBrand !== "all" && <input type="hidden" name="brand" value={selectedBrand} />}
                  {selectedPrice !== "all" && <input type="hidden" name="price" value={selectedPrice} />}
                  <input
                    type="search"
                    name="q"
                    defaultValue={selectedQuery}
                    placeholder="Поиск по названию"
                    className="catalog-search-input"
                    aria-label="Поиск по каталогу"
                  />
                  <button type="submit" className="catalog-search-btn">Найти</button>
                </form>
                {hasActiveFilters && (
                  <Link href={catalogRootHref} className="catalog-reset-link">
                    Сбросить фильтры
                  </Link>
                )}
                <ScrollFadeRow className="catalog-sort">
                  {CATALOG_SORT_OPTIONS.map((option) => (
                    <Link
                      key={option.value}
                      href={buildCatalogQuery({
                        cat: categoryQueryValue,
                        sort:
                          selectedSort === option.value
                            ? undefined
                            : option.value !== "popular"
                              ? option.value
                              : undefined,
                        brand: brandQueryValue,
                        price: selectedPrice !== "all" ? selectedPrice : undefined,
                        q: selectedQuery || undefined,
                        page: 1,
                      })}
                      aria-label={
                        selectedSort === option.value
                          ? `Снять сортировку: ${option.label}`
                          : `Применить сортировку: ${option.label}`
                      }
                      className={`catalog-sort-link${selectedSort === option.value ? " active" : ""}`}
                    >
                      {option.label}
                    </Link>
                  ))}
                </ScrollFadeRow>
              </>
            )}
          </div>

          {!isCatalogRedesign && querySuggestions.length > 0 && (
            <ScrollFadeRow className="catalog-chips">
              {querySuggestions.map((suggestion) => (
                <Link
                  key={suggestion}
                  href={buildCatalogQuery({
                    q: suggestion,
                    cat: categoryQueryValue,
                    sort: selectedSort !== "popular" ? selectedSort : undefined,
                    brand: brandQueryValue,
                    price: selectedPrice !== "all" ? selectedPrice : undefined,
                    page: 1,
                  })}
                  className="catalog-chip"
                >
                  {suggestion}
                </Link>
              ))}
            </ScrollFadeRow>
          )}

          {!isCatalogRedesign && (
            <>
              <ScrollFadeRow className="catalog-chips">
                <Link
                  href={buildCatalogQuery({
                    sort: selectedSort !== "popular" ? selectedSort : undefined,
                    brand: brandQueryValue,
                    price: selectedPrice !== "all" ? selectedPrice : undefined,
                    q: selectedQuery || undefined,
                    page: 1,
                  })}
                  className={`catalog-chip${selectedCategory === "all" ? " active" : ""}`}
                >
                  Все ({preCategoryByPriceProducts.length})
                </Link>
                {categories.map((category) => (
                  <Link
                    key={category}
                    href={buildCatalogQuery({
                      cat: selectedCategory === category ? undefined : category,
                      sort: selectedSort !== "popular" ? selectedSort : undefined,
                      brand: brandQueryValue,
                      price: selectedPrice !== "all" ? selectedPrice : undefined,
                      q: selectedQuery || undefined,
                      page: 1,
                    })}
                    aria-label={
                      selectedCategory === category
                        ? `Снять фильтр категории: ${category}`
                        : `Применить фильтр категории: ${category}`
                    }
                    className={`catalog-chip${selectedCategory === category ? " active" : ""}`}
                  >
                    {category} ({categoryCountMap.get(category) ?? 0})
                  </Link>
                ))}
              </ScrollFadeRow>

              <div className="catalog-filter-group">
                <p className="catalog-filter-title">Бренд</p>
                <ScrollFadeRow className="catalog-chips">
                  <Link
                    href={buildCatalogQuery({
                      cat: categoryQueryValue,
                      sort: selectedSort !== "popular" ? selectedSort : undefined,
                      price: selectedPrice !== "all" ? selectedPrice : undefined,
                      q: selectedQuery || undefined,
                      page: 1,
                    })}
                    className={`catalog-chip${selectedBrand === "all" ? " active" : ""}`}
                  >
                    Все бренды ({preBrandProducts.length})
                  </Link>
                  {brands.map((brand) => (
                    <Link
                      key={brand}
                      href={buildCatalogQuery({
                        cat: categoryQueryValue,
                        sort: selectedSort !== "popular" ? selectedSort : undefined,
                        brand: selectedBrand === brand ? undefined : brand,
                        price: selectedPrice !== "all" ? selectedPrice : undefined,
                        q: selectedQuery || undefined,
                        page: 1,
                      })}
                      aria-label={
                        selectedBrand === brand
                          ? `Снять фильтр бренда: ${brand}`
                          : `Применить фильтр бренда: ${brand}`
                      }
                      className={`catalog-chip${selectedBrand === brand ? " active" : ""}`}
                    >
                      {brand} ({brandCountMap.get(brand) ?? 0})
                    </Link>
                  ))}
                </ScrollFadeRow>
              </div>
            </>
          )}

          {!isCatalogRedesign && (
          <div className="catalog-filter-group">
            <p className="catalog-filter-title">Цена</p>
            <ScrollFadeRow className="catalog-chips">
              {CATALOG_PRICE_RANGES.map((range) => (
                <Link
                  key={range.value}
                  href={buildCatalogQuery({
                    cat: categoryQueryValue,
                    sort: selectedSort !== "popular" ? selectedSort : undefined,
                    brand: brandQueryValue,
                    price:
                      selectedPrice === range.value
                        ? undefined
                        : range.value !== "all"
                          ? range.value
                          : undefined,
                    q: selectedQuery || undefined,
                    page: 1,
                  })}
                  aria-label={
                    selectedPrice === range.value
                      ? `Снять фильтр цены: ${range.label}`
                      : `Применить фильтр цены: ${range.label}`
                  }
                  className={`catalog-chip${selectedPrice === range.value ? " active" : ""}`}
                >
                  {range.label} ({priceCountMap.get(range.value) ?? 0})
                </Link>
              ))}
            </ScrollFadeRow>
          </div>
          )}

          {!isCatalogRedesign && hasActiveFilters && (
            <div className="active-filters" role="status" aria-live="polite">
              <p className="active-filters-title">Активные фильтры:</p>
              <div className="active-filters-list">
                {activeFilterPills.map((pill) => (
                  <Link key={pill.key} href={pill.href} className="active-filter-item" aria-label={`Убрать фильтр: ${pill.label}`}>
                    {pill.label}
                    <span className="active-filter-remove" aria-hidden="true">×</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className={`catalog-grid${isCatalogRedesign ? " catalog-grid-v2" : ""}`}>
            {renderedProducts.map(({ product, category, brand, minPrice }) => {
              const productHref = isCatalogRedesign ? `/product/${product.handle}?v2=1` : `/product/${product.handle}`;

              return (
              <article className={`product-card${isCatalogRedesign ? " product-card-v2" : ""}`} key={product.id}>
                <Link href={productHref} aria-label={`Открыть товар ${product.title}`}>
                  <div className={`product-image-wrap${isCatalogRedesign ? " product-image-wrap-v2" : ""}`}>
                    {product.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.thumbnail} alt={product.title} className="product-image" />
                    ) : (
                      <div className="product-image placeholder">IMIDGE</div>
                    )}
                  </div>
                </Link>

                {isCatalogRedesign ? (
                  <div className="catalog-card-body-v2">
                    <p className="product-kicker-v2">{brand || category}</p>
                    <h3 className="product-title-v2">
                      <Link href={productHref} aria-label={`Открыть товар ${product.title}`}>
                        {highlightTitle(product.title, selectedQuery)}
                      </Link>
                    </h3>
                    <div className="catalog-price-row-v2">
                      {minPrice && (
                        <span className="product-price-old-v2">
                          {Math.round(minPrice.amount * 1.2).toLocaleString("ru-RU")}
                        </span>
                      )}
                      <strong className="product-price-v2">
                        {minPrice ? `${minPrice.amount.toLocaleString("ru-RU")} ${minPrice.currency}` : "Цена уточняется"}
                      </strong>
                    </div>
                    <CatalogCardActions
                      href={productHref}
                      variantId={product.variants?.find((variant) =>
                        (variant.prices ?? []).some((price) => typeof price.amount === "number" && price.amount > 0)
                      )?.id}
                      wishlistItem={{
                        handle: product.handle,
                        title: product.title,
                        thumbnail: product.thumbnail,
                        priceText: minPrice ? `${minPrice.amount.toLocaleString("ru-RU")} ${minPrice.currency}` : undefined,
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <p className="hero-kicker">{category}</p>
                    <h3>
                      <Link href={productHref} aria-label={`Открыть товар ${product.title}`}>
                        {highlightTitle(product.title, selectedQuery)}
                      </Link>
                    </h3>
                    <p className="product-handle">/{product.handle}</p>
                    <p className="product-price">
                      {minPrice ? `${minPrice.amount.toLocaleString("ru-RU")} ${minPrice.currency}` : "Цена уточняется"}
                    </p>
                    <Link href={productHref} className="cta-btn product-btn">
                      Открыть товар
                    </Link>
                  </>
                )}
              </article>
              );
            })}
          </div>

          {isCatalogRedesign && totalPages > 1 && (
            <div className="catalog-more-v2">
              {hasNextPage && (
                <Link
                  href={buildCatalogQuery({
                    cat: categoryQueryValue,
                    sort: selectedSort !== "popular" ? selectedSort : undefined,
                    brand: brandQueryValue,
                    price: selectedPrice !== "all" ? selectedPrice : undefined,
                    q: selectedQuery || undefined,
                    page: currentPage + 1,
                  })}
                  className="catalog-more-btn-v2"
                >
                  Показать ещё товары
                </Link>
              )}
              <p className="catalog-more-info-v2">
                Показано {shownProductsCount} из {visibleProducts.length} · {CATALOG_PAGE_SIZE} {pluralizeRuItems(CATALOG_PAGE_SIZE)} на странице
              </p>
            </div>
          )}

          {totalPages > 1 && (
            isCatalogRedesign ? (
              <div className="catalog-pagination-wrap-v2">
                <nav className="catalog-pagination catalog-pagination-v2" aria-label="Пагинация каталога">
                  {v2PageItems.map((item, index) => (
                    typeof item === "number" ? (
                      <Link
                        key={`page-${item}`}
                        href={buildCatalogQuery({
                          cat: categoryQueryValue,
                          sort: selectedSort !== "popular" ? selectedSort : undefined,
                          brand: brandQueryValue,
                          price: selectedPrice !== "all" ? selectedPrice : undefined,
                          q: selectedQuery || undefined,
                          page: item,
                        })}
                        aria-current={item === currentPage ? "page" : undefined}
                        className={`pagination-link pagination-link-v2${item === currentPage ? " active" : ""}`}
                      >
                        {item}
                      </Link>
                    ) : (
                      <span key={`${item}-${index}`} className="pagination-ellipsis-v2" aria-hidden="true">…</span>
                    )
                  ))}
                </nav>
              </div>
            ) : (
              <nav className="catalog-pagination" aria-label="Пагинация каталога">
                {currentPage > 1 ? (
                  <Link
                    href={buildCatalogQuery({
                      cat: categoryQueryValue,
                      sort: selectedSort !== "popular" ? selectedSort : undefined,
                      brand: brandQueryValue,
                      price: selectedPrice !== "all" ? selectedPrice : undefined,
                      q: selectedQuery || undefined,
                      page: currentPage - 1,
                    })}
                    rel="prev"
                    className="pagination-link"
                  >
                    Назад
                  </Link>
                ) : (
                  <span className="pagination-link disabled">Назад</span>
                )}

                {pageNumbers.map((pageNumber) => (
                  <Link
                    key={pageNumber}
                    href={buildCatalogQuery({
                      cat: categoryQueryValue,
                      sort: selectedSort !== "popular" ? selectedSort : undefined,
                      brand: brandQueryValue,
                      price: selectedPrice !== "all" ? selectedPrice : undefined,
                      q: selectedQuery || undefined,
                      page: pageNumber,
                    })}
                    aria-current={pageNumber === currentPage ? "page" : undefined}
                    className={`pagination-link${pageNumber === currentPage ? " active" : ""}`}
                  >
                    {pageNumber}
                  </Link>
                ))}

                {currentPage < totalPages ? (
                  <Link
                    href={buildCatalogQuery({
                      cat: categoryQueryValue,
                      sort: selectedSort !== "popular" ? selectedSort : undefined,
                      brand: brandQueryValue,
                      price: selectedPrice !== "all" ? selectedPrice : undefined,
                      q: selectedQuery || undefined,
                      page: currentPage + 1,
                    })}
                    rel="next"
                    className="pagination-link"
                  >
                    Вперёд
                  </Link>
                ) : (
                  <span className="pagination-link disabled">Вперёд</span>
                )}
              </nav>
            )
          )}

            {visibleProducts.length === 0 && (
              <div className="empty-state">
                {selectedQuery
                  ? (
                    <>
                      По запросу «{selectedQuery}» ничего не найдено. {" "}
                      <Link
                        href={buildCatalogQuery({
                          cat: categoryQueryValue,
                          sort: selectedSort !== "popular" ? selectedSort : undefined,
                          brand: brandQueryValue,
                          price: selectedPrice !== "all" ? selectedPrice : undefined,
                          page: 1,
                        })}
                      >
                        Сбросить только поиск
                      </Link>
                    </>
                  )
                  : "Товары пока не найдены. Проверьте, что backend Medusa запущен и данные засидены."}
              </div>
            )}
            </div>
          </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
