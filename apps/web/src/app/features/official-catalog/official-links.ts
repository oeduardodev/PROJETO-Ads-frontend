import { NATIONAL_INSTITUTIONS } from './national-institutions';
import { AUDITED_INSTITUTIONAL_WEBSITES } from './audited-websites';

export interface OfficialInstitution {
  id: number;
  acronym: string;
  name: string;
  jurisdiction: 'FEDERAL' | 'ESTADUAL' | 'MUNICIPAL';
  administrativeCategory: number;
  state: string;
  stateName: string;
  city: string;
  censusYear: number;
  selectionsUrl: string | null;
  websiteUrl: string | null;
}

export interface OfficialListing {
  institution: string;
  title: string;
  url: string;
  category: 'Reopção' | 'Transferência' | 'Ingresso de graduados' | 'Processo Seletivo Especial';
}

// URLs point to pages on the institutions' own domains. Dates, vacancies and
// eligibility must be checked on those pages; they are deliberately not copied here.
const SELECTION_PORTALS: Record<number, string> = {
  579: 'https://www.prg.ufpb.br/editais/',
  2564: 'https://comprov.ufcg.edu.br/graduacao.html',
  550: 'https://uepb.edu.br/prograd/processos-seletivos/',
  1166: 'https://estudante.ifpb.edu.br/editais/',
};

export const OFFICIAL_INSTITUTIONS: readonly OfficialInstitution[] = NATIONAL_INSTITUTIONS.map(
  (institution) => ({
    ...institution,
    selectionsUrl: SELECTION_PORTALS[institution.id] ?? null,
    websiteUrl: AUDITED_INSTITUTIONAL_WEBSITES[institution.id] ?? null,
  }),
);

export const OFFICIAL_LISTINGS: readonly OfficialListing[] = [
  {
    institution: 'UFPB',
    title: 'Reopção de cursos de graduação presenciais — PSRC 2027',
    category: 'Reopção',
    url: 'https://www.prg.ufpb.br/edital/processo-seletivo-de-reopcao-de-cursos-de-graduacao-presenciais-da-ufpb-psrc-2027/',
  },
  {
    institution: 'UFPB',
    title: 'Transferência voluntária para cursos de graduação — PSTV 2027',
    category: 'Transferência',
    url: 'https://www.prg.ufpb.br/edital/processo-seletivo-de-transferencia-voluntaria-para-cursos-de-graduacao-presenciais-pstv-2027/',
  },
  {
    institution: 'UFPB',
    title: 'Ingresso de graduados em cursos presenciais — PSIG 2027',
    category: 'Ingresso de graduados',
    url: 'https://www.prg.ufpb.br/edital/processo-seletivo-para-ingresso-de-graduados-nos-cursos-de-graduacao-presenciais-psig-2027/',
  },
  {
    institution: 'UEPB',
    title: 'Ingresso de graduados — 2027.1, Edital 014/2026',
    category: 'Ingresso de graduados',
    url: 'https://uepb.edu.br/prograd/download/ingresso-de-graduados-2027-1-edital-014-2026-prograd-sel-prograd-reitoria/',
  },
  {
    institution: 'UFCG',
    title: 'Ingresso de graduados — editais da COMPROV',
    category: 'Ingresso de graduados',
    url: 'https://comprov.ufcg.edu.br/graduacao/166-ingresso-de-graduado.html',
  },
  {
    institution: 'IFPB',
    title: 'Processo Seletivo Especial para cursos superiores',
    category: 'Processo Seletivo Especial',
    url: 'https://estudante.ifpb.edu.br/processoseletivo/processo/3/',
  },
];

export function normalizeOfficialSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('pt-BR');
}
