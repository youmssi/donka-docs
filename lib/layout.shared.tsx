import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { uiTranslations } from 'fumadocs-ui/i18n';
import { appName, repositoryUrl } from './shared';
import { messages } from './messages';
import { i18n } from './i18n';
import Image from 'next/image';
import { ReadyThemeSwitch } from '@/components/theme-switch';

export const translations = i18n
  .translations()
  .extend(uiTranslations())
  .add({
    en: {
      displayName: 'English',
    },
    fr: {
      displayName: 'Français',
      'Back to Home(404 not found page)': "Retour à l'accueil",
      'Choose a language(language switcher)': 'Choisir une langue',
      'Choose a language(language switcher)(aria-label)': 'Choisir une langue',
      'Close Search(search dialog)(aria-label)': 'Fermer la recherche',
      'Close Sidebar(aria-label)': 'Fermer le panneau latéral',
      'Close Sidebar(sidebar)(aria-label)': 'Fermer le panneau latéral',
      'Collapse Sidebar(sidebar)(aria-label)': 'Réduire le panneau latéral',
      'Copy Anchor Link(heading anchor)(aria-label)': 'Copier le lien de la section',
      'Copied Anchor Link(heading anchor)(aria-label)': 'Lien de la section copié',
      'Copy Text(code block)(aria-label)': 'Copier le texte',
      'Copied Text(code block)(aria-label)': 'Texte copié',
      'Dark(theme switcher)(aria-label)': 'Sombre',
      'Edit on GitHub(edit page)': 'Modifier sur GitHub',
      'Language(language switcher)': 'Langue',
      'Last updated on(page footer)': 'Dernière mise à jour le',
      'Light(theme switcher)(aria-label)': 'Clair',
      'Next Page(pagination)': 'Page suivante',
      'No results found(search dialog)': 'Aucun résultat',
      'On this page(table of contents)': 'Sur cette page',
      'Open Search(search trigger)(aria-label)': 'Ouvrir la recherche',
      'Open Sidebar(aria-label)': 'Ouvrir le panneau latéral',
      'Open Sidebar(sidebar)(aria-label)': 'Ouvrir le panneau latéral',
      'Page Not Found(404 not found page)': 'Page introuvable',
      'Previous Page(pagination)': 'Page précédente',
      'Search(search dialog)': 'Rechercher',
      'Search(search trigger)': 'Rechercher',
      'Show Sidebar(sidebar)': 'Afficher le panneau latéral',
      'Hide Sidebar(sidebar)': 'Masquer le panneau latéral',
      'Skip to Content(skip link)': 'Aller au contenu',
      'System(theme switcher)(aria-label)': 'Système',
      'Table of Contents(inline table of contents)': 'Sommaire',
      'Theme(site menu)': 'Thème',
      'Toggle Menu(home layout header)(aria-label)': 'Ouvrir ou fermer le menu',
      'Search failed(search dialog)': 'La recherche a échoué',
      'Search failed, showing results for {query}(search dialog)': 'La recherche a échoué, résultats pour {query}',
      'Toggle Theme(theme switcher)(aria-label)': 'Basculer le thème',
      'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.(404 not found page)':
        'La page que vous cherchez a peut-être été supprimée, renommée, ou est temporairement indisponible.',
    },
  });

export function baseOptions(locale: string): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Image src="/donka-mark.svg" alt="" width={24} height={24} unoptimized />
          {appName}
        </>
      ),
      url: `/${locale}/`,
    },
    i18n: true,
    slots: { themeSwitch: ReadyThemeSwitch },
    links: [{ text: messages[locale === 'fr' ? 'fr' : 'en'].documentation, url: `/${locale}/docs/` }],
    githubUrl: repositoryUrl,
  };
}
