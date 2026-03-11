import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <div>
      <div className="error404-desktop-chrome">
        <SiteHeader />
      </div>
      <header className="error404-mobile-header" aria-label="Мобильная шапка страницы 404">
        <div className="container mobile-page-head-row">
          <Link href="/" className="mobile-page-logo" aria-label="Imidge">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/imidge_logo_mark_only_export.svg" alt="Imidge" />
          </Link>
          <p className="mobile-page-head-title">Ошибка 404</p>
          <Link href="/" className="mobile-page-back" aria-label="На главную">←</Link>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section className="section error404-section">
          <div className="container">
            <article className="error404-card" aria-labelledby="error404Title">
              <p className="error404-code">404</p>
              <h1 id="error404Title" className="error404-title">Страница не найдена</h1>
              <p className="error404-text">
                Возможно, ссылка устарела или адрес введён с ошибкой. Вернитесь на главную или перейдите в каталог.
              </p>
              <div className="error404-actions">
                <Link href="/catalog?v2=1" className="catalog-btn-v2 primary">Перейти в каталог</Link>
                <Link href="/" className="cart-v2-secondary-btn">На главную</Link>
              </div>
            </article>
          </div>
        </section>
      </main>
      <div className="error404-desktop-chrome">
        <SiteFooter />
      </div>
    </div>
  );
}
