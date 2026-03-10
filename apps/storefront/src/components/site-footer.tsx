export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <h3 className="footer-title">Каталог</h3>
            <div className="footer-links">
              <a href="/catalog?cat=Часы">Часы</a>
              <a href="/catalog?cat=Сумки">Сумки</a>
              <a href="/catalog?cat=Одежда">Одежда</a>
              <a href="/catalog?cat=Обувь">Обувь</a>
              <a href="/catalog?cat=Ремни">Ремни</a>
              <a href="/catalog?cat=Кошельки">Кошельки</a>
            </div>
          </div>

          <div>
            <h3 className="footer-title">Покупателям</h3>
            <div className="footer-links">
              <a href="/delivery-payment">Доставка</a>
              <a href="/guarantee">Гарантия</a>
              <a href="/return-repair">Возврат</a>
              <a href="/faq">Помощь (FAQ)</a>
              <a href="/public-offer">Публичная оферта</a>
            </div>
          </div>

          <div>
            <h3 className="footer-title">О нас</h3>
            <div className="footer-links">
              <a href="/contacts">Контакты</a>
              <a href="/reviews">Отзывы</a>
              <a href="/blog">Новости и статьи</a>
              <a href="/blog?tag=sale">Акции и скидки</a>
            </div>
          </div>

          <div>
            <h3 className="footer-title">Скидка 5% на первый заказ</h3>
            <p className="subscribe-note">Оставьте email и получите промокод на первый заказ.</p>
            <form className="subscribe-row" action="#" method="post">
              <input type="email" placeholder="Ваш e-mail" required />
              <button type="submit">Получить</button>
            </form>
            <div className="socials">
              <a href="https://t.me/Imidge_watch" target="_blank" rel="noreferrer" aria-label="Telegram" title="Telegram">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21.6 4.3L3.9 11.1c-.8.3-.8 1.5 0 1.8l4.4 1.5 1.7 5c.2.7 1.1.9 1.6.4l2.6-2.6 4.6 3.4c.7.5 1.6.1 1.8-.7l2.2-14.1c.2-1-.8-1.8-1.8-1.5zM9.4 13.8l8.9-5.9-6.9 7-.3 2.7-1.7-3.8z" />
                </svg>
              </a>
              <a href="https://www.tiktok.com/@imidge.shop" target="_blank" rel="noreferrer" aria-label="TikTok" title="TikTok">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15.7 3.5c.4 1.2 1.5 2.4 2.8 2.9.7.3 1.3.4 2 .5v3.1c-1 0-2-.3-2.9-.7-.4-.2-.8-.5-1.2-.8v6.5c0 3-2.4 5.4-5.4 5.4S5.6 18 5.6 15s2.4-5.4 5.4-5.4c.2 0 .5 0 .7.1v3.1c-.2-.1-.5-.1-.7-.1-1.2 0-2.3 1-2.3 2.3s1 2.3 2.3 2.3 2.3-1 2.3-2.3V3.5h2.4z" />
                </svg>
              </a>
              <a href="https://www.youtube.com/channel/UCv2ObgugaaZ4iUVH4VvhIsw" target="_blank" rel="noreferrer" aria-label="YouTube" title="YouTube">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21.8 8.2c-.2-1.2-1.1-2.1-2.3-2.3C17.5 5.5 12 5.5 12 5.5s-5.5 0-7.5.4C3.3 6.1 2.4 7 2.2 8.2 1.8 10.2 1.8 12 1.8 12s0 1.8.4 3.8c.2 1.2 1.1 2.1 2.3 2.3 2 .4 7.5.4 7.5.4s5.5 0 7.5-.4c1.2-.2 2.1-1.1 2.3-2.3.4-2 .4-3.8.4-3.8s0-1.8-.4-3.8zM10.3 15.1V8.9L15.7 12l-5.4 3.1z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <details className="footer-seo">
          <summary>Доставка по Украине и SEO-разделы</summary>
          <div className="footer-seo-content">
            <div className="footer-seo-links">
              <a href="/sitemap">Карта сайта</a>
              <a href="/privacy-policy">Конфиденциальность</a>
              <a href="/collections">Коллекции</a>
              <a href="/celeb-clock">Часы знаменитостей</a>
              <a href="/dictionary">Словарь терминов</a>
              <a href="/blog">О часах</a>
              <a href="/catalog">Часы под заказ</a>
              <a href="/blog">Советы по уходу</a>
              <a href="https://www.youtube.com/channel/UCv2ObgugaaZ4iUVH4VvhIsw/videos" target="_blank" rel="noreferrer">Видеообзоры товаров</a>
            </div>
            <div className="footer-seo-cities">
              <a href="/watches-kyiv">Киев</a>
              <a href="/watches-odessa">Одесса</a>
              <a href="/watches-kharkiv">Харьков</a>
              <a href="/watches-dnipro">Днепр</a>
              <a href="/watches-lviv">Львов</a>
              <a href="/watches-zaporizhzhia">Запорожье</a>
              <a href="/delivery-payment">Доставка и оплата</a>
              <a href="/guarantee">Гарантия</a>
              <a href="/return-repair">Возврат и ремонт товара</a>
            </div>
          </div>
        </details>

        <div className="footer-bottom">
          <div>IMIDGE | (044) 334-37-15 | (050) 993-95-53 | contact@imidge.com.ua</div>
          <div>© Imidge. Все права защищены</div>
        </div>
      </div>
    </footer>
  );
}
