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
            if (!href || /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(href)) return <a href={href} {...props} />;
            const localePrefix = `/${lang}`;
            const pagePath = page.url.startsWith(`${localePrefix}/docs/`) || page.url === `${localePrefix}/docs`
              ? page.url
              : page.url.startsWith('/docs/') || page.url === '/docs'
                ? `${localePrefix}${page.url}`
                : page.url.startsWith(`${localePrefix}/`)
                  ? `${localePrefix}/docs${page.url.slice(localePrefix.length)}`
                  : `${localePrefix}/docs${page.url.startsWith('/') ? page.url : `/${page.url}`}`;
            const basePath = pagePath.endsWith('/') ? pagePath : `${pagePath}/`;
            const target = new URL(href, new URL(basePath, 'https://docs.invalid'));
            const lastSegment = target.pathname.split('/').at(-1) ?? '';
            if (target.pathname === '/docs' || target.pathname.startsWith('/docs/')) {
              target.pathname = `${localePrefix}${target.pathname}`;
            } else if (
              /^\/(?:evidence|trust|architecture|reference)(?:\/|$)/.test(target.pathname) &&
              !lastSegment.includes('.')
            ) {
              target.pathname = `${localePrefix}/docs${target.pathname}`;
            }
            target.pathname = target.pathname.replace(
              new RegExp(`^${localePrefix}/docs/docs(?=/|$)`),
              `${localePrefix}/docs`,
            );
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
