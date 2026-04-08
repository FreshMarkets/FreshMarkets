import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Freshzilla — Supply Chain Automation',
  description:
    'Automate your fresh produce supply chain with AI-powered email generation, contact management, shipment tracking, and Google Workspace integration.',
  keywords: ['supply chain', 'logistics', 'fresh produce', 'automation', 'Freshzilla'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head />
      <body className="antialiased">{children}</body>
    </html>
  );
}
