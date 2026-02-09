import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FoodOps',
  description: 'AI meal planning and grocery automation for families',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
