export type BlogPostPreview = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  category: string;
  source: "migrated" | "planned";
};

export const blogPostPreviews: BlogPostPreview[] = [
  {
    slug: "kak-vybrat-bazovyy-garderob",
    title: "Как собрать базовый гардероб на сезон",
    excerpt:
      "Практическая подборка базовых позиций Imidge, которые легко комбинировать между собой в повседневных образах.",
    publishedAt: "2026-03-01",
    category: "Стилизация",
    source: "planned",
  },
  {
    slug: "uhod-za-trikotazhem",
    title: "Уход за трикотажем: 7 правил, чтобы вещи служили дольше",
    excerpt:
      "Короткий гайд по стирке, сушке и хранению трикотажа, который помогает сохранить форму и цвет изделий.",
    publishedAt: "2026-02-24",
    category: "Уход за одеждой",
    source: "planned",
  },
  {
    slug: "capsule-office-smart-casual",
    title: "Капсула для офиса в стиле smart casual",
    excerpt:
      "Готовые сочетания верха и низа из текущего ассортимента для гибкого офисного дресс-кода.",
    publishedAt: "2026-02-16",
    category: "Капсулы",
    source: "planned",
  },
];
