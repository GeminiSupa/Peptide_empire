import { nav } from '@/content/global';

const spanishCategories = new Map(
  nav.flatMap((item) => item.children || [])
    .filter((item) => item.label_en && item.label_es)
    .map((item) => [item.label_en, item.label_es]),
);

export function productCategoryLabel(category, lang) {
  return lang === 'es' ? spanishCategories.get(category) || category : category;
}
