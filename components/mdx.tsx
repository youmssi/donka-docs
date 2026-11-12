import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { ArchitectureDiagram } from './architecture-diagram';

export function getMDXComponents(components?: MDXComponents) {
  return { ...defaultMdxComponents, ArchitectureDiagram, ...components } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
