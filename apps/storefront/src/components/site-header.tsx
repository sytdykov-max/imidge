"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCartStore } from "@/components/cart-store-provider";
import { getWishlistItems, getWishlistUpdateEventName } from "@/lib/wishlist";

const topMenuItems = [
  { href: "/catalog", label: "Копии часов" },
  { href: "/catalog", label: "Копии сумок" },
  { href: "/about", label: "О нас" },
  { href: "/delivery-payment", label: "Доставка и оплата" },
  { href: "/blog", label: "Новости и акции" },
  { href: "/contacts", label: "Контакты" },
];

const quickCatalogItems = [
  { href: "/catalog?cat=Часы", label: "Часы" },
  { href: "/catalog?cat=Одежда", label: "Одежда" },
  { href: "/catalog?cat=Обувь", label: "Обувь" },
  { href: "/catalog?cat=Сумки", label: "Сумки" },
  { href: "/catalog?cat=Ремни", label: "Ремни" },
  { href: "/catalog?cat=Кошельки", label: "Кошельки" },
  { href: "/catalog?cat=Подарки", label: "Сувениры и подарки" },
  { href: "/catalog?sort=discount", label: "Sale", className: "sale-link" },
  { href: "/catalog", label: "Бренды" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { itemCount } = useCartStore();
  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    const syncWishlistCount = () => {
      setWishlistCount(getWishlistItems().length);
    };

    syncWishlistCount();
    window.addEventListener("storage", syncWishlistCount);
    window.addEventListener(getWishlistUpdateEventName(), syncWishlistCount as EventListener);

    return () => {
      window.removeEventListener("storage", syncWishlistCount);
      window.removeEventListener(getWishlistUpdateEventName(), syncWishlistCount as EventListener);
    };
  }, []);

  const isCatalogRoute = pathname === "/catalog" || pathname.startsWith("/catalog/");

  return (
    <header className="site-header">
      <a href="#main-content" className="skip-link">
        К содержимому
      </a>

      <div className="top-line">
        <div className="container top-line-content">
          <ul className="top-menu" aria-label="Верхнее меню">
            {topMenuItems.map((item) => (
              <li key={item.label}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>

          <ul className="top-contacts" aria-label="Контакты">
            <li><a href="tel:+380443343715">(044) 334-37-15</a></li>
            <li><a href="tel:+380509939553">(050) 993-95-53</a></li>
            <li><Link href="/contacts" className="callback-link">Перезвонить вам?</Link></li>
            <li><Link href="/account">Вход / Регистрация</Link></li>
          </ul>

          <div className="lang-switch" aria-label="Переключение языка">
            <button type="button" className="active" aria-pressed="true">UA</button>
            <button type="button" aria-pressed="false">RU</button>
          </div>
        </div>
      </div>

      <div className="guarantee-strip">Доставка по Украине за 2 дня | Оплата после просмотра | Люкс качество 1:1</div>

      <div className="container main-header">
        <Link href="/" className="brand-logo" aria-label="Imidge">
          <span className="brand-logo-text">
            <strong>IMIDGE</strong>
            <span>WATCHES & ACCESSORIES</span>
          </span>
        </Link>

        <div className="header-center">
          <Link href="/catalog" className="catalog-btn" aria-label="Каталог товаров">
            ☰ Каталог товаров
          </Link>
          <label className="search-wrap" aria-label="Поиск">
            <input className="search-input" type="search" placeholder="Умный поиск по сайту: Rolex, Omega, Gucci..." />
            <span className="search-icon" aria-hidden="true">⌕</span>
          </label>
        </div>

        <nav className="header-actions" aria-label="Быстрые действия">
          <Link className="icon-btn" href="/wishlist" aria-label="Избранное">
            ♡
            {wishlistCount > 0 && <span className="count-badge" aria-hidden="true">{wishlistCount}</span>}
          </Link>
          <Link className="icon-btn" href="/cart" aria-label={`Корзина, ${itemCount} товаров`}>
            👜
            <span className="count-badge" aria-hidden="true">{itemCount}</span>
          </Link>
          <Link className="icon-btn" href="/blog" aria-label="Блог">
            ✦
          </Link>
        </nav>
      </div>

      <nav className="quick-nav" aria-label="Категории каталога">
        <div className="container">
          <ul className="quick-nav-list">
            {quickCatalogItems.map((item, index) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`${item.className ?? ""}${isCatalogRoute && index === 0 ? " active" : ""}`.trim()}
                  aria-current={isCatalogRoute && index === 0 ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
