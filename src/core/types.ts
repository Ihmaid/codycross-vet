/** Par [resposta, pista] como vem do conteúdo do e-book. */
export type QuestionPair = [answer: string, clue: string];

export interface Stage {
  id: string;
  /** Nome curto (migalhas, botões). */
  short: string;
  title: string;
  /** Família viral ou tema (usado nos filtros). */
  tag: string;
  /** Nome da ilustração em public/assets/<image>.webp */
  image: string;
  description: string;
  /** Frase de abertura do capítulo no e-book (texto da equipe). */
  intro: string;
  review: string;
  source: string;
  cross: QuestionPair[];
  hunt: QuestionPair[];
  pdfPage?: number;
}

export interface StudyEntry {
  pages: number[];
  images: string[];
  text: string;
}

export interface Reference {
  page: number;
  image: string;
  text: string;
}

export type Mode = 'cross' | 'hunt';
