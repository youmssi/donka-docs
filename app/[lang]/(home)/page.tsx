import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArchitectureDiagram } from '@/components/architecture-diagram';
import { isLocale, messages } from '@/lib/messages';

export default async function HomePage(props: PageProps<'/[lang]'>) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  const t = messages[lang];
  return (
    <main id="main-content" className="home-content">
      <header className="home-intro">
        <p className="version-label">{t.development}</p>
        <h1>{t.title}</h1>
        <p className="home-lead">{t.lead}</p>
        <Link className="primary-link" href={`/${lang}/docs/`}>
          {t.read}
          <span aria-hidden="true"> →</span>
        </Link>
      </header>
      <ArchitectureDiagram locale={lang} />
      <section className="home-reading" aria-labelledby="reading-title">
        <h2 id="reading-title">{t.nextTitle}</h2>
        <dl>
          <div>
            <dt>
              <Link href={`/${lang}/docs/`}>{t.read}</Link>
            </dt>
            <dd>{t.overviewDetail}</dd>
          </div>
          <div>
            <dt>
              <Link href={`/${lang}/docs/architecture/`}>{t.architecture}</Link>
            </dt>
            <dd>{t.architectureDetail}</dd>
          </div>
        </dl>
      </section>
      <p className="version-note">{t.versionNote}</p>
    </main>
  );
}
