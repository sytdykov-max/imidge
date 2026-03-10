import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Корзина",
  description: "Корзина покупок Imidge: просмотр и изменение товаров перед оформлением.",
  alternates: {
    canonical: "/cart",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
