import catalogIndex from '@/data/qna-catalogs/index.json';

export const cpxCatalogs = catalogIndex.catalogs;
export type CpxCatalog = (typeof cpxCatalogs)[number];

export function isCpxCatalogId(value: string): boolean {
  return cpxCatalogs.some(catalog => catalog.id === value);
}

export function isSelectableCpxCatalogId(value: string): boolean {
  return cpxCatalogs.some(catalog => catalog.id === value && catalog.category === 'symptom');
}

export function findCpxCatalog(id: string | null): CpxCatalog | undefined {
  return id ? cpxCatalogs.find(catalog => catalog.id === id) : undefined;
}
