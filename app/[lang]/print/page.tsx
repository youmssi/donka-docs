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
        const components = getMDXComponents({
          a: ({ href, ...props }) => {
            if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) {
              return <a href={href} {...props} />;
            }
            const target = new URL(href, new URL(page.url, 'https://docs.invalid'));
            return <a href={`${target.pathname}${target.search}${target.hash}`} {...props} />;
          },
        });
        return (
          <article key={page.url}>
            <h1>{page.data.title}</h1>
            <MDX components={components} />
          </article>
        );
      })}
    </main>
  );
}
