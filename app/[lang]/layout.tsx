import { RootProvider } from 'fumadocs-ui/provider/next';
import { i18nProvider } from 'fumadocs-ui/i18n';
import SearchDialog from '@/components/search';
import { translations } from '@/lib/layout.shared';
import { isLocale, messages } from '@/lib/messages';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import '../global.css';

export default async function Layout({ params, children }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html lang={lang} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider i18n={i18nProvider(translations, lang)} search={{ SearchDialog }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'fr' }];
}

export const dynamicParams = false;

export async function generateMetadata({ params }: LayoutProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return {
    title: { default: `Donka · ${messages[lang].documentation}`, template: '%s · Donka' },
    description: messages[lang].lead,
    icons: { icon: '/donka-mark.svg' },
  };
}
