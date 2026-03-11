import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Наши преимущества",
  description: "Преимущества интернет-гипермаркета Имидж.",
  alternates: {
    canonical: "/our-advantages",
  },
};

const advantages = [
  "Огромный ассортимент — на страничках сайта представлено более 100 известных брендов реплик часов и аксессуаров.",
  "Удобная система поиска, которая учитывает все Ваши запросы.",
  "Безупречное качество товара — реализуется продукция, изготовленная только из современных высококачественных материалов. На все хронометры распространяется гарантия до 5 лет.",
  "Реплики часов упакованы в подарочную упаковку.",
  "Высокие стандарты обслуживания — менеджеры стремятся удовлетворить любое пожелание клиента.",
  "Полная гарантия возврата средств и обмен товара по закону Украины в течение 14 дней с момента приобретения.",
  "Самые низкие цены — функции «Сделай дешевле» и «Экономная цена» помогают приобрести товар по максимально выгодной стоимости. Для постоянных клиентов действует программа лояльности.",
  "Оплата покупки осуществляется только после получения товара и примерки.",
  "Удобная система доставки: если товар в наличии, доставка по Украине в течение 2 дней. Срок доставки товаров «под заказ» — 21 день.",
  "Бесплатная доставка по г. Киеву при покупке от 2500 грн.",
  "Сервисное обслуживание — 4 гарантийных мастерских находятся в г. Киеве, для клиентов из регионов предусмотрена бесплатная пересылка Новой Почтой.",
];

export default function OurAdvantagesPage() {
  return (
    <div>
      <SiteHeader />

      <main id="main-content" className="about-page info-page info-page-our-advantages" tabIndex={-1}>
        <section className="section about-shell">
          <div className="container about-layout">
            <aside className="about-sidebar">
              <p className="about-sidebar-title">О магазине⌚</p>
              <nav aria-label="Разделы о магазине">
                <ul className="about-sidebar-list">
                  <li><a href="/about">О нас</a></li>
                  <li><a href="/our-advantages" aria-current="page">Наши преимущества</a></li>
                  <li><a href="/cooperation-providers">Сотрудничество</a></li>
                  <li><a href="/celeb-clock">Часы знаменитостей</a></li>
                  <li><a href="/delivery-payment">Доставка и оплата</a></li>
                  <li><a href="/guarantee">Гарантия</a></li>
                  <li><a href="/return-repair">Возврат / ремонт</a></li>
                  <li><a href="/faq">Помощь (FAQ)</a></li>
                  <li><a href="/reviews">Отзывы клиентов</a></li>
                  <li><a href="/contacts">Контакты</a></li>
                </ul>
              </nav>
            </aside>

            <article className="about-content">
              <p className="about-kicker">О магазине</p>
              <h1 className="about-title">Наши преимущества</h1>

              <p className="about-lead">
                Девиз компании — «У нас Вы покупаете статус и стиль, а часы получаете в подарок».
              </p>

              <h2 className="section-title about-section-title">Преимущества интернет-гипермаркета Имидж</h2>
              <ol className="guarantee-ordered-list">
                {advantages.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>

              <h2 className="section-title about-section-title">Для оптовых покупателей</h2>
              <p>
                Для оптовых покупателей существует эксклюзивная система скидок. Если Вы представляете
                компанию, которая желает приобрести большое количество реплик часов с максимальной
                скидкой, свяжитесь с менеджерами по телефону, скайпу imidge.com.ua или email
                <a href="mailto:esale@imidge.com.ua"> esale@imidge.com.ua</a>.
              </p>
              <p>
                Мы стремимся завоевать доверие каждого покупателя путем оказания качественного и
                своевременного обслуживания, высокого уровня сервиса и быстрой системы доставки.
              </p>
              <p>Наша команда работает для Вас!</p>
            </article>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
