import { notFound } from 'next/navigation';
import { source } from '@/lib/source';
import { isLocale, messages } from '@/lib/messages';
import { getMDXComponents } from '@/components/mdx';

export default async function PrintPage({ params }: PageProps<'/[lang]/print'>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const pages = source.getPages(lang);
  return (
    <main className="print-document">
      <header>
        <h1>Donka</h1>
        <p>{messages[lang].development}</p>
      </header>
      {pages.map((page) => {
        const MDX = page.data.body;
        return (
          <article key={page.url}>
            <h1>{page.data.title}</h1>
            <MDX components={getMDXComponents()} />
          </article>
        );
      })}
    </main>
  );
}
