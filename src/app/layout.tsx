import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-[#F5F6F9] flex flex-row justify-center">
      <body className={cn(
        'max-w-[2000px]',
        'w-screen',
        inter.className,
        'antialiased'
      )}>
        {children}
      </body>
    </html>
  );
}
