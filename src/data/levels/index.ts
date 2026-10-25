import { Level } from '../../core/models/Level';
import level1 from './level1.json';
import level2 from './level2.json';
import level3 from './level3.json';
import level4 from './level4.json';

/** Níveis na ordem em que são jogados. Para adicionar um nível, crie o JSON e inclua-o aqui. */
export const RAW_LEVELS = [level1, level2, level3, level4] as Level[];
