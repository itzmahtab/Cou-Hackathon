import PaymentCorrectionClient from './client';

/**
 * The correction token comes from the URL, so this route is only known at
 * request time. `instant = false` allows the route to block while rendering
 * instead of requiring a streaming Suspense boundary.
 */
export const instant = false;

export default async function PaymentCorrectionPage({
  params,
}: PageProps<'/payment-correction/[token]'>) {
  const { token } = await params;
  return <PaymentCorrectionClient token={token} />;
}
