import { createCsv } from './csv';

describe('createCsv', () => {
  test('quotes fields and escapes embedded quotes', () => {
    expect(createCsv(['Nom'], [['A, B'], ['O"Neil']]))
      .toBe('"Nom"\r\n"A, B"\r\n"O""Neil"');
  });

  test('neutralizes spreadsheet formulas, including after leading whitespace', () => {
    expect(createCsv(['Valeur'], [['=1+1'], ['  @SUM(A1:A2)']]))
      .toBe('"Valeur"\r\n"\'=1+1"\r\n"\'  @SUM(A1:A2)"');
  });
});
