import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Контакты",
  description: "Контакты магазина Imidge и адреса гарантийных мастерских в Киеве.",
  alternates: {
    canonical: "/contacts",
  },
};

const serviceCenters = [
  "Украина, г. Киев, ст.м. Дорогожичи, ул. Парково-Сырецкая, 1 (фасад), тел.: +38 044 229-52-47, Пн.-Пт. 10:00-18:00, Сб.-Вс. выходные.",
  "Украина, г. Киев, р-н Караваевы дачи, б-р Чоколовский, 29, моб. тел.: +38 067 508-69-65, Пн.-Пт. 10:00-18:00, Сб.-Вс. выходные.",
  "Украина, г. Киев, ст. м. Палац Украины, ул. Предславенская, 34.",
  "Украина, г. Киев, ст. м. Минская, ул. Левка Лукьяненко, 21 корпус 14.",
];

export default function ContactsPage() {
  return (
    <div>
      <SiteHeader />

      <main id="main-content" className="about-page info-page info-page-contacts" tabIndex={-1}>
        <section className="section about-shell">
          <div className="container about-layout">
            <aside className="about-sidebar">
              <p className="about-sidebar-title">О магазине⌚</p>
              <nav aria-label="Разделы о магазине">
                <ul className="about-sidebar-list">
                  <li><a href="/about">О нас</a></li>
                  <li><a href="/our-advantages">Наши преимущества</a></li>
                  <li><a href="/cooperation-providers">Сотрудничество</a></li>
                  <li><a href="/delivery-payment">Доставка и оплата</a></li>
                  <li><a href="/guarantee">Гарантия</a></li>
                  <li><a href="/return-repair">Возврат / ремонт</a></li>
                  <li><a href="/faq">Помощь (FAQ)</a></li>
                  <li><a href="/reviews">Отзывы клиентов</a></li>
                  <li><a href="/contacts" aria-current="page">Контакты</a></li>
                </ul>
              </nav>
            </aside>

            <article className="about-content">
              <p className="about-kicker">О магазине</p>
              <h1 className="about-title">Контакты</h1>

              <p className="about-lead">Свяжитесь с нами удобным способом:</p>

              <ul>
                <li>
                  WhatsApp: <a href="whatsapp://send?text=Hello&phone=+380936240030&abid=+380936240030">+38 093 624-00-30</a>
                </li>
                <li>
                  Viber: <a href="viber://chat?number=+380936240030">+38 093 624-00-30</a>
                </li>
                <li>
                  Telegram: <a href="https://t.me/imidge_watch">+38 099 122-39-19</a>
                </li>
                <li>
                  Тел.: <a href="tel:+380443343715">+38 044 334-37-15</a>
                </li>
                <li>
                  Тел.: <a href="tel:+380509939553">+38 050 993-95-53 (Vodafone)</a>
                </li>
                <li>
                  Тел.: <a href="tel:+380675384500">+38 067 538-45-00 (Kyivstar)</a>
                </li>
                <li>
                  E-mail отдела продаж: <a href="mailto:contact@imidge.com.ua">contact@imidge.com.ua</a>
                </li>
                <li>
                  E-mail оптового отдела: <a href="mailto:esale@imidge.com.ua">esale@imidge.com.ua</a>
                </li>
                <li>
                  E-mail администрации: <a href="mailto:office@imidge.com.ua">office@imidge.com.ua</a>
                </li>
              </ul>

              <h2 className="section-title about-section-title">График работы</h2>
              <p>Понедельник – Суббота: с 9:00 до 19:00.</p>
              <p>Воскресенье – прием заказов онлайн.</p>
              <p>
                Доставка: города и график доставки согласно расписанию Новой Почты.
              </p>
              <p>N.B. Интернет-магазин работает без демонстрационного зала.</p>

              <h2 className="section-title about-section-title">Гарантийные мастерские интернет-магазина Имидж</h2>
              <ul>
                {serviceCenters.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
