import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3002";

function getOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Imidge",
    url: siteUrl,
    logo: `${siteUrl}/favicon.ico`,
  };
}

export const metadata: Metadata = {
  title: "Главная",
  description: "Главная страница нового storefront Imidge на Next.js и Medusa.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Imidge — интернет-магазин одежды",
    description: "Главная страница нового storefront Imidge на Next.js и Medusa.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Imidge — интернет-магазин одежды",
    description: "Главная страница нового storefront Imidge на Next.js и Medusa.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function Home() {
  const organizationJsonLd = getOrganizationJsonLd();
  const categoryTiles = [
    {
      title: "Часы",
      href: "https://imidge.com.ua/ru/f-watches/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/bf4/600_480_10bcdf2ffa4a6625b617c01ff490c7234/muzhskie_chasy_longines_model_mx3895.png",
    },
    {
      title: "Одежда",
      href: "https://imidge.com.ua/ru/f-1184-1851-1852-1853-1890-1919-1927-1933-1934-1935-1939/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/d73/600_480_10bcdf2ffa4a6625b617c01ff490c7234/futbolka_polo_gucci_model_ts0121.jpg",
    },
    {
      title: "Обувь",
      href: "https://imidge.com.ua/ru/f-1797-1798-1824-1926-1938/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/169/600_480_10bcdf2ffa4a6625b617c01ff490c7234/krossovki_kiton_model_f428.jpg",
    },
    {
      title: "Сумки",
      href: "https://imidge.com.ua/ru/f-1199-1225-1284-1285/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/f74/600_480_10bcdf2ffa4a6625b617c01ff490c7234/sumka_chanel_model_s1238.jpg",
    },
    {
      title: "Ремни",
      href: "https://imidge.com.ua/ru/f-belts/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/4f7/600_480_10bcdf2ffa4a6625b617c01ff490c7234/remen_celine_model_b239.jpg",
    },
    {
      title: "Кошельки",
      href: "https://imidge.com.ua/ru/f-1199-1201/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/24c/600_480_10bcdf2ffa4a6625b617c01ff490c7234/koshelek_louis_vuitton_model_s827.png",
    },
    {
      title: "Сувениры и подарки",
      href: "https://imidge.com.ua/ru/f-1174-1175-1176-1177-1178-1179-1180-1181-1184-1185-1186-1188-1191-1192-1193-1196-1197-1198-1210/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/d62/600_480_10bcdf2ffa4a6625b617c01ff490c7234/ruchka_montblanc_model_0607.jpg",
    },
  ];

  const products = [
    {
      brand: "Longines",
      model: "Мужские часы Модель MX3895",
      href: "https://imidge.com.ua/ru/muzhskie-chasy-longines-model-mx3895/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/bf4/600_480_10bcdf2ffa4a6625b617c01ff490c7234/muzhskie_chasy_longines_model_mx3895.png",
      imageAlt:
        "https://imidge.com.ua/upload/resize_cache/iblock/5b7/600_480_10bcdf2ffa4a6625b617c01ff490c7234/muzhskie_chasy_longines_model_mx3895_1.png",
      oldPrice: "18 900 грн",
      newPrice: "14 990 грн",
    },
    {
      brand: "Gucci",
      model: "Сумка Модель S711",
      href: "https://imidge.com.ua/ru/sumka-gucci-model-s711/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/e8c/600_480_10bcdf2ffa4a6625b617c01ff490c7234/sumka_gucci_model_s711.jpg",
      imageAlt:
        "https://imidge.com.ua/upload/resize_cache/iblock/280/600_480_10bcdf2ffa4a6625b617c01ff490c7234/sumka_gucci_model_s711_1.jpg",
      oldPrice: "16 700 грн",
      newPrice: "12 480 грн",
    },
    {
      brand: "Gucci",
      model: "Мужская футболка-поло Модель TS0121",
      href: "https://imidge.com.ua/ru/futbolka-polo-gucci-model-ts0121/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/d73/600_480_10bcdf2ffa4a6625b617c01ff490c7234/futbolka_polo_gucci_model_ts0121.jpg",
      imageAlt:
        "https://imidge.com.ua/upload/resize_cache/iblock/884/600_480_10bcdf2ffa4a6625b617c01ff490c7234/futbolka_polo_gucci_model_ts0121_1.jpg",
      oldPrice: "2 393 грн",
      newPrice: "1 914 грн",
    },
    {
      brand: "Kiton",
      model: "Мужские кроссовки Модель F428",
      href: "https://imidge.com.ua/ru/krossovki-kiton-model-f428/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/169/600_480_10bcdf2ffa4a6625b617c01ff490c7234/krossovki_kiton_model_f428.jpg",
      imageAlt:
        "https://imidge.com.ua/upload/resize_cache/iblock/5ca/600_480_10bcdf2ffa4a6625b617c01ff490c7234/krossovki_kiton_model_f428_1.jpg",
      oldPrice: "10 005 грн",
      newPrice: "9 505 грн",
    },
    {
      brand: "Tag Heuer",
      model: "Мужские часы Модель MX3834",
      href: "https://imidge.com.ua/ru/muzhskie-chasy-tag-heuer-model-mx3834/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/f4b/600_480_10bcdf2ffa4a6625b617c01ff490c7234/muzhskie_chasy_tag_heuer_model_mx3834.jpg",
      imageAlt:
        "https://imidge.com.ua/upload/resize_cache/iblock/92d/600_480_10bcdf2ffa4a6625b617c01ff490c7234/muzhskie_chasy_tag_heuer_model_mx3834_2.jpg",
      oldPrice: "34 365 грн",
      newPrice: "27 492 грн",
    },
    {
      brand: "Chanel",
      model: "Женская сумка Модель S1238",
      href: "https://imidge.com.ua/ru/sumka-chanel-model-s1238/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/f74/600_480_10bcdf2ffa4a6625b617c01ff490c7234/sumka_chanel_model_s1238.jpg",
      imageAlt:
        "https://imidge.com.ua/upload/resize_cache/iblock/463/600_480_10bcdf2ffa4a6625b617c01ff490c7234/sumka_chanel_model_s1238_1.jpg",
      oldPrice: "24 360 грн",
      newPrice: "23 142 грн",
    },
    {
      brand: "Dsquared2",
      model: "Мужская футболка Модель TS0119",
      href: "https://imidge.com.ua/ru/futbolka-dsquared2-model-ts0119/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/761/600_480_10bcdf2ffa4a6625b617c01ff490c7234/futbolka_dsquared2_model_ts0119.jpg",
      imageAlt:
        "https://imidge.com.ua/upload/resize_cache/iblock/012/600_480_10bcdf2ffa4a6625b617c01ff490c7234/futbolka_dsquared2_model_ts0119.jpg",
      oldPrice: "7 800 грн",
      newPrice: "5 990 грн",
    },
    {
      brand: "Loro Piana",
      model: "Мужские туфли (лоферы) Модель F371",
      href: "https://imidge.com.ua/ru/tufli-loro-piana-model-f371/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/89a/600_480_10bcdf2ffa4a6625b617c01ff490c7234/tufli_loro_piana_model_f371.jpg",
      imageAlt:
        "https://imidge.com.ua/upload/resize_cache/iblock/b88/600_480_10bcdf2ffa4a6625b617c01ff490c7234/tufli_loro_piana_model_f371_1.jpg",
      oldPrice: "13 600 грн",
      newPrice: "10 490 грн",
    },
  ];

  const monthProducts = [
    {
      brand: "Longines",
      model: "Мужские часы Модель MX3895",
      href: "https://imidge.com.ua/ru/muzhskie-chasy-longines-model-mx3895/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/bf4/600_480_10bcdf2ffa4a6625b617c01ff490c7234/muzhskie_chasy_longines_model_mx3895.png",
      imageAlt:
        "https://imidge.com.ua/upload/resize_cache/iblock/5b7/600_480_10bcdf2ffa4a6625b617c01ff490c7234/muzhskie_chasy_longines_model_mx3895_1.png",
      oldPrice: "10 440 грн",
      newPrice: "9 918 грн",
    },
    {
      brand: "Miu Miu",
      model: "Женская сумка Модель S1167",
      href: "https://imidge.com.ua/ru/sumka-miu-miu-model-s1167/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/844/600_480_10bcdf2ffa4a6625b617c01ff490c7234/sumka_miu_miu_model_s1167.png",
      imageAlt:
        "https://imidge.com.ua/upload/resize_cache/iblock/189/600_480_10bcdf2ffa4a6625b617c01ff490c7234/sumka_miu_miu_model_s1167_1.jpg",
      oldPrice: "2 175 грн",
      newPrice: "2 066 грн",
    },
    {
      brand: "Stefano Ricci",
      model: "Мужская футболка Модель TS0176",
      href: "https://imidge.com.ua/ru/futbolka-stefano-ricci-model-ts0176/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/10d/600_480_10bcdf2ffa4a6625b617c01ff490c7234/futbolka_stefano_ricci_model_ts0176.jpg",
      imageAlt:
        "https://imidge.com.ua/upload/resize_cache/iblock/705/600_480_10bcdf2ffa4a6625b617c01ff490c7234/futbolka_stefano_ricci_model_ts0176_1.jpg",
      oldPrice: "4 133 грн",
      newPrice: "3 306 грн",
    },
    {
      brand: "Cartier",
      model: "Ремень двухсторонний Модель B338",
      href: "https://imidge.com.ua/ru/remen-cartier-model-b338/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/121/600_480_10bcdf2ffa4a6625b617c01ff490c7234/remen_cartier_model_b338_1.jpg",
      imageAlt:
        "https://imidge.com.ua/upload/resize_cache/iblock/837/601_480_10bcdf2ffa4a6625b617c01ff490c7234/remen_cartier_model_b338.jpg",
      oldPrice: "4 350 грн",
      newPrice: "4 133 грн",
    },
  ];

  const newsPosts = [
    {
      date: "18.02.2026",
      title: "Какие наручные часы самые точные",
      text: "Разбираем типы механизмов и объясняем, на что смотреть при выборе часов на каждый день.",
      href: "https://imidge.com.ua/news/stati/kakie-naruchnye-chasy-samye-tochnye/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/92d/600_480_10bcdf2ffa4a6625b617c01ff490c7234/muzhskie_chasy_tag_heuer_model_mx3834_2.jpg",
    },
    {
      date: "11.02.2026",
      title: "Гравировки на часовых механизмах",
      text: "Как тонкие детали отделки влияют на визуальную ценность модели и общее впечатление.",
      href: "https://imidge.com.ua/news/stati/gravirovki-na-chasovykh-mekhanizmakh/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/463/600_480_10bcdf2ffa4a6625b617c01ff490c7234/sumka_chanel_model_s1238_1.jpg",
    },
    {
      date: "05.02.2026",
      title: "Тренды брендовых аксессуаров 2026",
      text: "Подборка актуальных категорий: сумки, ремни, кошельки и аксессуары для подарков.",
      href: "https://imidge.com.ua/news/",
      image:
        "https://imidge.com.ua/upload/resize_cache/iblock/189/600_480_10bcdf2ffa4a6625b617c01ff490c7234/sumka_miu_miu_model_s1167_1.jpg",
    },
  ];

  const brands = [
    "Rolex",
    "Omega",
    "Hublot",
    "Patek Philippe",
    "Gucci",
    "Louis Vuitton",
    "Dior",
    "Prada",
    "Chanel",
    "Hermes",
    "Balenciaga",
    "Versace",
  ];

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      <SiteHeader />

      <main id="main-content" className="home-main" tabIndex={-1}>
        <section className="home-hero" aria-label="Главный баннер">
          <div
            className="home-hero-image"
            aria-hidden={true}
            style={{
              backgroundImage:
                "url('https://imidge.com.ua/upload/resize_cache/iblock/92d/600_480_10bcdf2ffa4a6625b617c01ff490c7234/muzhskie_chasy_tag_heuer_model_mx3834_2.jpg')",
            }}
          />
          <div className="container home-hero-inner">
            <div className="home-hero-content">
              <p className="home-hero-kicker">Эксклюзивная акция Imidge</p>
              <h1>Супер скидка до -75% на все модели мужских часов Rolex.</h1>
              <p>
                Только ограниченное время: премиальные модели Rolex в люкс качестве 1:1 с
                доставкой по Украине и оплатой после осмотра.
              </p>
              <a className="cta-btn" href="https://imidge.com.ua/ru/f-watches-rolex/">
                Смотреть коллекцию Rolex
              </a>
            </div>
          </div>
        </section>

        <section className="home-promo-links">
          <div className="container home-promo-grid">
            <a className="home-promo-pill" href="https://imidge.com.ua/ru/f-sale/">
              Ликвидация старых коллекций
            </a>
            <a
              className="home-promo-pill"
              href="https://imidge.com.ua/ru/f-1851-1852-1853-1890/"
            >
              Брендовая одежда 2026
            </a>
            <a className="home-promo-pill" href="https://imidge.com.ua/ru/f-male-handbags/">
              Брендовые сумки 2026
            </a>
            <a className="home-promo-pill" href="https://imidge.com.ua/ru/f-belts/">
              Брендовые ремни 2026
            </a>
          </div>
          <div className="container">
            <div className="home-telegram-banner">
              <p>Подпишитесь на Telegram-канал Imidge, чтобы первыми видеть новинки и акции</p>
              <a href="https://t.me/Imidge_watch">Перейти в Telegram</a>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="home-trust-grid">
              <article className="home-trust-card">
                <div className="home-trust-icon">★</div>
                <h3>Люкс качество 1:1</h3>
                <p>Максимально точные реплики топовых брендов с аккуратной отделкой деталей.</p>
              </article>
              <article className="home-trust-card">
                <div className="home-trust-icon">◆</div>
                <h3>Премиальные материалы</h3>
                <p>Сапфировое стекло, закаленная сталь, титан и натуральная кожа.</p>
              </article>
              <article className="home-trust-card">
                <div className="home-trust-icon">✓</div>
                <h3>Гарантия на весь ассортимент</h3>
                <p>Поддержка после покупки и прозрачные правила обмена и возврата.</p>
              </article>
              <article className="home-trust-card">
                <div className="home-trust-icon">◍</div>
                <h3>Оплата после осмотра</h3>
                <p>Проверяйте товар перед оплатой и примеряйте без лишнего риска.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2 className="section-title">Популярные категории</h2>
            <div className="home-category-grid">
              {categoryTiles.map((tile) => (
                <a key={tile.title} className="home-category-tile" href={tile.href}>
                  <img src={tile.image} alt={tile.title} />
                  <span>{tile.title}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2 className="section-title">Хиты продаж и новинки</h2>
            <div className="home-tabs" role="tablist" aria-label="Тип витрины">
              <button className="home-tab-btn active" type="button">
                Хиты продаж
              </button>
              <button className="home-tab-btn" type="button">
                Новинки
              </button>
            </div>
            <div className="home-subcats" role="tablist" aria-label="Подкатегории">
              <button className="home-subcat-btn active" type="button">
                Все
              </button>
              <button className="home-subcat-btn" type="button">
                Часы
              </button>
              <button className="home-subcat-btn" type="button">
                Сумки
              </button>
              <button className="home-subcat-btn" type="button">
                Одежда
              </button>
              <button className="home-subcat-btn" type="button">
                Обувь
              </button>
            </div>
            <div className="home-product-grid home-product-grid-main">
              {products.map((product) => (
                <article key={product.href} className="home-product-card">
                  <a className="home-product-media" href={product.href}>
                    <img className="home-product-image-main" src={product.image} alt={product.model} />
                    <img className="home-product-image-alt" src={product.imageAlt} alt={product.model} />
                  </a>
                  <div className="home-product-meta">
                    <p className="home-product-brand">{product.brand}</p>
                    <p className="home-product-model">
                      <a href={product.href}>{product.model}</a>
                    </p>
                    <div className="home-price-row">
                      <span className="home-old-price">{product.oldPrice}</span>
                      <span className="home-new-price">{product.newPrice}</span>
                    </div>
                    <div className="home-mini-actions">
                      <a className="home-mini-btn" href={product.href}>
                        👜
                      </a>
                      <button className="home-mini-btn" type="button">
                        ♡
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2 className="section-title">Популярные бренды</h2>
            <div className="home-brands-grid">
              {brands.map((brand) => (
                <a key={brand} className="home-brand-tile" href="https://imidge.com.ua/manufacturers/">
                  {brand}
                </a>
              ))}
            </div>
            <div className="home-brands-cta">
              <a href="https://imidge.com.ua/manufacturers/">Все бренды</a>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2 className="section-title">Товары месяца</h2>
            <div className="home-product-grid home-product-grid-month">
              {monthProducts.map((product) => (
                <article key={product.href} className="home-product-card">
                  <a className="home-product-media" href={product.href}>
                    <img className="home-product-image-main" src={product.image} alt={product.model} />
                    <img className="home-product-image-alt" src={product.imageAlt} alt={product.model} />
                  </a>
                  <div className="home-product-meta">
                    <p className="home-product-brand">{product.brand}</p>
                    <p className="home-product-model">
                      <a href={product.href}>{product.model}</a>
                    </p>
                    <div className="home-price-row">
                      <span className="home-old-price">{product.oldPrice}</span>
                      <span className="home-new-price">{product.newPrice}</span>
                    </div>
                    <div className="home-mini-actions">
                      <a className="home-mini-btn" href={product.href}>
                        👜
                      </a>
                      <button className="home-mini-btn" type="button">
                        ♡
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2 className="section-title">Новости и статьи</h2>
            <div className="home-news-grid">
              {newsPosts.map((post) => (
                <article key={post.href} className="home-news-card">
                  <img className="home-news-image" src={post.image} alt={post.title} />
                  <p className="home-news-date">{post.date}</p>
                  <h3 className="home-news-title">{post.title}</h3>
                  <p className="home-news-text">{post.text}</p>
                  <a className="home-news-link" href={post.href}>
                    Читать статью
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section home-seo-block">
          <div className="container">
            <h2 className="section-title">Люксовые копии часов, сумок, одежды и обуви в магазине Имидж</h2>
            <p className="home-seo-copy">
              Imidge — интернет-магазин премиальных реплик, где эстетика и надежность важны так же,
              как цена. Мы собрали модели, которые визуально повторяют оригинальные бутики и
              помогают подчеркнуть статус в повседневном образе. В каталоге представлены люксовые
              копии часов с японскими и швейцарскими механизмами, сумки из качественной экокожи и
              натуральной кожи, брендовая одежда и обувь в актуальных коллекциях.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
