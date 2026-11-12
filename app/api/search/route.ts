import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const revalidate = false;

// The default tokenizer is multilingual; the index is built per language.
export const { staticGET: GET } = createFromSource(source);
