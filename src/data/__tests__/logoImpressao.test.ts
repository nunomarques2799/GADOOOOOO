import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

import { LOGO_SVG } from '../logoImpressao';

/**
 * O logótipo das folhas impressas é uma CÓPIA do mestre (o Metro não importa
 * um SVG como texto). Este teste é o que impede as duas de se afastarem: muda
 * o desenho em `assets/marca/` e esquece-se a cópia, e o papel continuava a
 * sair com o logo antigo sem ninguém dar por isso.
 */
describe('logótipo das folhas impressas', () => {
  const mestre = readFileSync(join(__dirname, '../../../assets/marca/terrabovina-logo.svg'), 'utf8');
  const normalizar = (s: string) =>
    s
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/>\s+</g, '><')
      .replace(/\s+/g, ' ')
      .trim();

  it('é o mesmo desenho do mestre em assets/marca', () => {
    expect(LOGO_SVG).toBe(normalizar(mestre));
  });

  it('diz o nome da app a quem não o vê', () => {
    expect(LOGO_SVG).toContain('aria-label="Terrabovina"');
  });
});
