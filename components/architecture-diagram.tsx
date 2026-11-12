import { BookOpen, FileInput, Network, Terminal, Workflow, Zap } from 'lucide-react';
import { messages, type Locale } from '@/lib/messages';

/** Shows the current product boundaries and explicitly identifies planned connections. */
export function ArchitectureDiagram({ locale }: { locale: Locale }) {
  const t = messages[locale];
  return (
    <figure className="architecture" aria-label={t.diagramTitle}>
      <div className="architecture-heading">
        <h2>{t.diagramTitle}</h2>
        <p>{t.diagramIntro}</p>
      </div>
      <div className="architecture-products architecture-main">
        <div className="architecture-node">
          <Workflow aria-hidden="true" />
          <h3>{t.studio}</h3>
          <p>{t.studioDetail}</p>
        </div>
        <div className="architecture-node architecture-runtime">
          <Zap aria-hidden="true" />
          <h3>{t.runtime}</h3>
          <p>{t.runtimeDetail}</p>
        </div>
        <div className="architecture-node">
          <Network aria-hidden="true" />
          <h3>{t.channels}</h3>
          <p>{t.channelsDetail}</p>
        </div>
      </div>
      <ul className="architecture-flows">
        <li>{t.releaseFlow}</li>
        <li>{t.requestFlow}</li>
        <li>{t.recordFlow}</li>
        <li>{t.connectorFlow}</li>
      </ul>
      <h3 className="architecture-related-title">{t.related}</h3>
      <div className="architecture-products">
        <div className="architecture-node">
          <BookOpen aria-hidden="true" />
          <h3>{t.docs}</h3>
          <p>{t.docsDetail}</p>
        </div>
        <div className="architecture-node">
          <Terminal aria-hidden="true" />
          <h3>{t.cli}</h3>
          <p>{t.cliDetail}</p>
        </div>
        <div className="architecture-node architecture-planned">
          <FileInput aria-hidden="true" />
          <h3>{t.fieldkit}</h3>
          <span className="phase-label">{t.roadmap}</span>
          <p>{t.fieldkitDetail}</p>
        </div>
      </div>
      <figcaption>{t.diagramCaption}</figcaption>
    </figure>
  );
}
