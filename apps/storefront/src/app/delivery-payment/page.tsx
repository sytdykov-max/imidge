import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Доставка и оплата",
  description: "Условия доставки и оплаты интернет-магазина Imidge.",
  alternates: {
    canonical: "/delivery-payment",
  },
};

const deliveryItems = [
  "Самовывоз из отделений и почтоматов курьерской службы Новая Почта в Киеве и других городах Украины. По тарифам Новой Почты, обычно не превышает 100 грн.",
  "Адресная доставка по Украине курьерской службой Новая Почта по указанному адресу. По тарифам Новой Почты, обычно не превышает 200 грн.",
  "Предоплата за доставку: для покрытия стоимости доставки некоторых товаров с удаленных складов мы просим клиентов сделать предоплату в размере 200 грн., которые уменьшают стоимость товара при оплате (возвращаются клиенту).",
  "Курьерская доставка по миру: после 100% предоплаты стоимости товара и доставки курьерскими службами Delivery, EMS и DHL в течение 10-14 рабочих дней.",
];

const paymentItems = [
  "Наложенный платеж: доставка товара курьерской службой «Новая Почта» дает возможность оплатить товар после получения и осмотра. Стоимость услуги наложенного платежа 20 грн. + 2% от стоимости товара.",
  "Оплата криптовалютой (USDT): товар доставляется только после поступления на счет оплаты за товар и доставку. Все необходимые документы (счет, накладная и товарный чек) отправляются вместе с товаром. Некоторые биржи взимают дополнительную комиссию за перевод, которую оплачивает клиент.",
  "Оплата картой Visa/Mastercard: после подтверждения наличия товара и условий доставки менеджер вышлет Вам номер банковской карты. Оплатить товар можно через Приват24, Моно, Интернет-банкинг, терминал самообслуживания или банковскую кассу.",
];

export default function DeliveryPaymentPage() {
  return (
    <div>
      <SiteHeader />

      <main id="main-content" className="about-page info-page info-page-delivery-payment" tabIndex={-1}>
        <section className="section about-shell">
          <div className="container about-layout">
            <aside className="about-sidebar">
              <p className="about-sidebar-title">О магазине⌚</p>
              <nav aria-label="Разделы о магазине">
                <ul className="about-sidebar-list">
                  <li><a href="/about">О нас</a></li>
                  <li><a href="/our-advantages">Наши преимущества</a></li>
                  <li><a href="/cooperation-providers">Сотрудничество</a></li>
                  <li><a href="/delivery-payment" aria-current="page">Доставка и оплата</a></li>
                  <li><a href="/guarantee">Гарантия</a></li>
                  <li><a href="/return-repair">Возврат / ремонт</a></li>
                  <li><a href="/faq">Помощь (FAQ)</a></li>
                  <li><a href="/reviews">Отзывы клиентов</a></li>
                  <li><a href="/contacts">Контакты</a></li>
                </ul>
              </nav>
            </aside>

            <article className="about-content">
              <p className="about-kicker">Покупателям</p>
              <h1 className="about-title">Доставка и оплата</h1>

              <h2 className="section-title about-section-title">Доставка</h2>
              <ul>
                {deliveryItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <h2 className="section-title about-section-title">Оплата</h2>
              <ul>
                {paymentItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <h2 className="section-title about-section-title">Контакты</h2>
              <p>
                Телефоны: <a href="tel:+380443343715">(044) 334-37-15</a>, <a href="tel:+380509939553">+38 (050) 993-95-53</a>, <a href="tel:+380675384500">+38 (067) 538-45-00</a>, <a href="tel:+380936240030">+38 (093) 624-00-30</a>
              </p>
              <p>
                Email: <a href="mailto:contact@imidge.com.ua">contact@imidge.com.ua</a>
              </p>
              <p>
                Telegram: <a href="https://t.me/Imidge_watch">@Imidge_watch</a>
              </p>
              <p>График работы: 9:00 до 19:00 (Пн.-Сб.).</p>
            </article>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
