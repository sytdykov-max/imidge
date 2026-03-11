import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "О нас",
  description: "О магазине Imidge: миссия, принципы работы, контроль качества, гарантии и контакты.",
  alternates: {
    canonical: "/about",
  },
};

const qualityControlItems = [
  "работаем только с проверенными поставщиками",
  "все товары проверяются нашими сотрудниками при закупке",
  "делаем реальные фото и видео-обзоры товаров",
  "перед отправкой клиенту все товары проверяются специалистом",
  "менеджеры контролируют процесс доставки и коммуникации с клиентом",
];

const guaranteeItems = [
  "качественный товар (реплики только самого высокого качества)",
  "доступные цены",
  "конфиденциальность работы (сохранение инкогнито)",
  "комфортная покупка: оперативная доставка, выбор моделей, удобные способы оплаты",
  "дополнительные фото товара с любого ракурса по запросу",
  "гарантии качества и долговечности",
  "сервис на самом высоком уровне",
];

const plans = [
  "Дальнейшее расширение ассортимента новинками часов и модной одежды",
  "Создание украиноязычной версии сайта",
  "Расширение географии доставок",
  "Усовершенствование форм работы магазина, чтобы сотрудничество стало еще выгоднее и удобнее",
];

const aboutMenu = [
  { label: "О нас", href: "/about" },
  { label: "О качестве копий", href: "/blog" },
  { label: "Наши преимущества", href: "/our-advantages" },
  { label: "Часы знаменитостей", href: "/celeb-clock" },
  { label: "Сотрудничество", href: "/cooperation-providers" },
  { label: "Доставка и оплата", href: "/delivery-payment" },
  { label: "Гарантия", href: "/guarantee" },
  { label: "Отзывы клиентов", href: "/reviews" },
  { label: "Контакты", href: "/contacts" },
];

export default function AboutPage() {
  return (
    <div>
      <SiteHeader />

      <main id="main-content" className="about-page" tabIndex={-1}>
        <section className="section about-shell">
          <div className="container about-layout">
            <aside className="about-sidebar">
              <p className="about-sidebar-title">О магазине⌚</p>
              <nav aria-label="Разделы о магазине">
                <ul className="about-sidebar-list">
                  {aboutMenu.map((item) => (
                    <li key={item.label}>
                      <a href={item.href}>{item.label}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>

            <article className="about-content">
              <p className="about-kicker">О магазине</p>
              <h1 className="about-title">О магазине Имидж</h1>

              <img
                className="about-hero-image"
                src="https://img.imidge.com.ua/upload/medialibrary/9a6/o_magazine_imidge_1.jpg"
                alt="Магазин реплик швейцарских часов"
              />

              <p className="about-lead">
                Интернет-магазин Имидж специализируется на продаже часов, брендовых аксессуаров,
                вещей и предметов роскоши. Но не простых, а являющихся точными репликами товаров,
                которые относят к высокому часовому искусству, люкс и premium-категории.
              </p>
              <p className="about-lead">
                Среди самых востребованных марок: Breguet, Patek Philippe, Audemars Piguet, Ulysse
                Nardin, Breitling, Cartier. Всего в ассортименте более 120 брендов.
              </p>

              <h2 className="section-title about-section-title">Миссия магазина</h2>
              <p>
                Наш магазин возник в 2007 году, когда основатели проекта впервые столкнулись с
                невероятно высокими ценами на швейцарские часы. Тогда они задались целью найти в
                Европе качественные часовые бренды, у которых не будет огромной переплаты за
                «историю марки».
              </p>
              <p>
                В процессе изучения часового мира были найдены фабрики, которые производят копии
                часов, неотличимые от оригиналов. С тех пор миссия Imidge — дать возможность
                каждому прикоснуться к высокой эстетике швейцарских часов и произведений ведущих
                домов моды.
              </p>
              <p>
                Купить оригинал доступно не каждому, поэтому Имидж предлагает отличные копии
                легендарных часов. Изготовленные из качественных материалов и в полном соответствии
                с оригиналами, они могут стать достойной альтернативой для тех, кому важно выглядеть
                успешно.
              </p>

              <img
                className="about-inline-image"
                src="https://img.imidge.com.ua/upload/medialibrary/f28/o_magazine_imidge_8.jpg"
                alt="Реплики модных аксессуаров"
              />

              <p>
                Именно поэтому мы предлагаем огромный, а главное разноплановый ассортимент часов и
                аксессуаров по доступным ценам. Выбрать из более чем 11500 наименований,
                представленных на сайте, получится даже у самых взыскательных покупателей.
              </p>
              <p>
                Если искомый вариант не найден, мы предлагаем дополнительные услуги — поиск часов по
                фотографии и пошив ремешка на заказ из кожи экзотических животных.
              </p>

              <h3 className="about-subhead">Принцип работы</h3>
              <p>
                В своей работе магазин Имидж ориентируется прежде всего на довольного клиента. О
                том, что мы на правильном пути, говорит цифра: 97% покупателей остались довольны
                покупкой.
              </p>
              <p>
                <a className="about-link" href="/reviews">
                  Прочитать отзывы
                </a>
              </p>

              <h3 className="about-subhead">Схема и способ контроля качества продукции магазина</h3>
              <ul>
                {qualityControlItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <h3 className="about-subhead">Мы гарантируем клиентам</h3>
              <ul>
                {guaranteeItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <div className="about-clients-block">
                <img
                  className="about-clients-image"
                  src="https://imidge.com.ua/upload/medialibrary/dad/showroom_watch.jpg"
                  alt="Наши клиенты"
                />
                <div>
                  <h3 className="about-subhead">Наши клиенты</h3>
                  <p>
                    За весь период работы нашими клиентами стали уже более 30 000 человек в Украине
                    и за границей.
                  </p>
                  <p>
                    Среди наших клиентов много известных людей: представители бизнеса, публичной
                    сферы, шоу-бизнеса и модной индустрии.
                  </p>
                  <p>
                    У каждого свой вкус и предпочтения, но объединяет их одно — желание выглядеть
                    модно и респектабельно за разумные деньги.
                  </p>
                </div>
              </div>

              <h2 className="section-title about-section-title">Наши планы</h2>
              <p>А планы у нас грандиозные!</p>
              <ul>
                {plans.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>
                Мы с удовольствием читаем комментарии и воплощаем пожелания клиентов в жизнь.
                Ждём ваших откликов!
              </p>
            </article>
          </div>
        </section>

        <section className="section about-contacts-section">
          <div className="container about-meta-grid">
            <div className="about-card">
              <h3>Контакты</h3>
              <p>
                <a href="tel:+380443343715">(044) 334-37-15</a> · <a href="tel:+380509939553">+38 (050) 993-95-53</a>
              </p>
              <p>
                <a href="tel:+380675384500">+38 (067) 538-45-00</a> · <a href="tel:+380936240030">+38 (093) 624-00-30</a>
              </p>
              <p>
                <a href="mailto:contact@imidge.com.ua">contact@imidge.com.ua</a>
              </p>
              <p>
                Telegram: <a href="https://t.me/Imidge_watch">@Imidge_watch</a>
              </p>
            </div>

            <div className="about-card">
              <h3>Реквизиты и график</h3>
              <p>График работы: 9:00 до 19:00 (Пн.–Сб.).</p>
              <p>Гарантийная мастерская: Украина, Киев, ул. Парково-Сырецкая, 1.</p>
            </div>

            <div className="about-card">
              <h3>Мы в соцсетях</h3>
              <div className="about-social-icons" aria-label="Ссылки на соцсети">
                <a
                  className="about-social-icon-btn"
                  href="https://t.me/+4rLfxsskbiU3Y2Ey"
                  aria-label="Telegram"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M21.6 4.2a1 1 0 0 0-1-.1L3.4 11a1 1 0 0 0 .1 1.9l4.7 1.5 1.7 5.3a1 1 0 0 0 1.8.2l2.6-3.5 4.5 3.3a1 1 0 0 0 1.6-.6l2.2-13.8a1 1 0 0 0-.5-1.1Zm-3 2.3-8.3 7.7a1 1 0 0 0-.3.5l-.5 2.8-.8-2.4a1 1 0 0 0-.6-.6l-2.9-.9 13.4-5.1Z" />
                  </svg>
                </a>
                <a
                  className="about-social-icon-btn"
                  href="https://www.tiktok.com/@imidge.shop"
                  aria-label="TikTok"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M14.8 3h2.5c.2 1.9 1.3 3.3 3.2 3.5v2.6a6.4 6.4 0 0 1-3.2-1V14a5.6 5.6 0 1 1-5.6-5.6c.5 0 .9.1 1.3.2v2.9a2.7 2.7 0 1 0 1.8 2.5V3Z" />
                  </svg>
                </a>
                <a
                  className="about-social-icon-btn"
                  href="https://www.youtube.com/channel/UCv2ObgugaaZ4iUVH4VvhIsw"
                  aria-label="YouTube"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M23 12c0-2.3-.3-3.8-.6-4.7-.3-.8-.9-1.4-1.8-1.7C19.3 5 12 5 12 5s-7.3 0-8.6.6c-.9.3-1.5.9-1.8 1.7C1.3 8.2 1 9.7 1 12s.3 3.8.6 4.7c.3.8.9 1.4 1.8 1.7C4.7 19 12 19 12 19s7.3 0 8.6-.6c.9-.3 1.5-.9 1.8-1.7.3-.9.6-2.4.6-4.7Zm-13.1 3V9l5.2 3-5.2 3Z" />
                  </svg>
                </a>
              </div>
              <p className="about-rating-note">
                97% наших клиентов остались довольны —{" "}
                <a href="/reviews">Прочитать отзывы</a>
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
