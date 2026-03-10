import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { blogPostPreviews } from "@/lib/blog-content";

export const metadata: Metadata = {
  title: "Блог",
  description: "Материалы, статьи и обновления Imidge.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Блог Imidge",
    description: "Материалы, статьи и обновления Imidge.",
    url: "/blog",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Блог Imidge",
    description: "Материалы, статьи и обновления Imidge.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function BlogPage() {
  return (
    <div>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="section">
          <div className="container">
            <p className="hero-kicker">Blog</p>
            <h1 className="section-title">Блог</h1>
            <p className="section-subtitle">
              Структура блога уже подготовлена для миграции: ниже контентные карточки,
              которые заполняются из единого источника данных.
            </p>

            <div className="catalog-grid">
              {blogPostPreviews.map((post) => (
                <article className="product-card" key={post.slug}>
                  <p className="hero-kicker" style={{ marginBottom: 10 }}>
                    {post.category}
                  </p>
                  <h3>{post.title}</h3>
                  <p className="product-handle">{new Date(post.publishedAt).toLocaleDateString("ru-RU")}</p>
                  <p className="section-subtitle" style={{ fontSize: 14, marginBottom: 14 }}>
                    {post.excerpt}
                  </p>
                  <p className="product-handle" style={{ marginBottom: 0 }}>
                    Статус: {post.source === "migrated" ? "перенесено" : "в плане миграции"}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
