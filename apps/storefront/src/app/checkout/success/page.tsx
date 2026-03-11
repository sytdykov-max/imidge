import { redirect } from "next/navigation";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ displayId?: string; orderId?: string }>;
}) {
  const params = await searchParams;
  const orderId = params.orderId || params.displayId || "";
  redirect(orderId ? `/thank-you?orderId=${encodeURIComponent(orderId)}` : "/thank-you");
}
