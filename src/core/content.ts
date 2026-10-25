import stagesJson from '../data/stages.json';
import studyJson from '../data/study.json';
import referencesJson from '../data/references.json';
import { Reference, Stage, StudyEntry } from './types';

/** As 28 fases, na ordem da trilha (conteúdo do e-book, sem alterações). */
export const STAGES = stagesJson as Stage[];
/** Páginas, imagens e transcrição do e-book por fase. */
export const STUDY: Record<string, StudyEntry> = studyJson;
export const REFERENCES: Reference[] = referencesJson;

/** Famílias/temas em ordem alfabética, para os filtros. */
export const FAMILIES = [...new Set(STAGES.map((s) => s.tag))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

export const stageIndex = (id: string): number => STAGES.findIndex((s) => s.id === id);

export const assetPath = (image: string): string => `assets/${image}.webp`;

export const PDF_PATH = 'Livro_de_Jogos_Virologia_Veterinaria.pdf';
