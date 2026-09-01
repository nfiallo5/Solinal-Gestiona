/**
 * Pure unit tests for the coding-rule engine in `src/lib/documentCode.ts` —
 * the piece that turns a saved `CodingRule` into an actual document code.
 * No DB needed; see `codingRule.test.ts` for the DB-backed route + creation
 * integration coverage.
 */
import { describe, expect, it } from 'vitest';

import {
  buildDocumentCode,
  DEFAULT_CODING_RULE,
  nextDocumentCodeFrom,
  type CodingRuleShape,
} from '../src/lib/documentCode.js';

describe('nextDocumentCodeFrom', () => {
  it('matches the default TIPO-AREA-NNN shape', () => {
    expect(nextDocumentCodeFrom(DEFAULT_CODING_RULE, 'Procedimiento', 'CAL', [])).toBe(
      'PRO-CAL-001',
    );
    expect(
      nextDocumentCodeFrom(DEFAULT_CODING_RULE, 'Procedimiento', 'CAL', [
        'PRO-CAL-009',
        'POL-GER-003',
      ]),
    ).toBe('PRO-CAL-010');
  });

  it('respects the separador and digitos of a custom rule', () => {
    const rule: CodingRuleShape = {
      tokens: ['TIPO', 'PROCESO', 'CORRELATIVO'],
      separador: '.',
      digitos: 4,
      prefijoVer: 'V',
      formatoAnio: '26',
      empresaSigla: 'SOL',
    };
    expect(nextDocumentCodeFrom(rule, 'Checklist', 'HAC', [])).toBe('CHK.HAC.0001');
    expect(nextDocumentCodeFrom(rule, 'Checklist', 'HAC', ['CHK.HAC.0001'])).toBe('CHK.HAC.0002');
  });

  it('supports "ninguno" (no separator)', () => {
    const rule: CodingRuleShape = { ...DEFAULT_CODING_RULE, separador: 'ninguno' };
    expect(nextDocumentCodeFrom(rule, 'Manual', 'GER', [])).toBe('MANGER001');
  });

  it('honors a reordered token list, e.g. CORRELATIVO before TIPO/PROCESO', () => {
    const rule: CodingRuleShape = { ...DEFAULT_CODING_RULE, tokens: ['CORRELATIVO', 'TIPO', 'PROCESO'] };
    expect(nextDocumentCodeFrom(rule, 'Instructivo', 'PRD', ['001-INS-PRD'])).toBe('002-INS-PRD');
  });

  it('includes SIGLA when present', () => {
    const rule: CodingRuleShape = {
      ...DEFAULT_CODING_RULE,
      tokens: ['SIGLA', 'TIPO', 'PROCESO', 'CORRELATIVO'],
      empresaSigla: 'SOL',
    };
    expect(nextDocumentCodeFrom(rule, 'Política', 'GER', [])).toBe('SOL-POL-GER-001');
  });

  it('formats ANIO short and long', () => {
    const shortYear: CodingRuleShape = {
      ...DEFAULT_CODING_RULE,
      tokens: ['TIPO', 'PROCESO', 'ANIO', 'CORRELATIVO'],
    };
    expect(nextDocumentCodeFrom(shortYear, 'Procedimiento', 'CAL', [], 2026)).toBe(
      'PRO-CAL-26-001',
    );

    const longYear: CodingRuleShape = { ...shortYear, formatoAnio: '2026' };
    expect(nextDocumentCodeFrom(longYear, 'Procedimiento', 'CAL', [], 2026)).toBe(
      'PRO-CAL-2026-001',
    );
  });

  it('appends VERSION as prefijoVer + "01" for a new document', () => {
    const rule: CodingRuleShape = {
      ...DEFAULT_CODING_RULE,
      tokens: ['TIPO', 'PROCESO', 'CORRELATIVO', 'VERSION'],
      prefijoVer: 'Rev.',
    };
    expect(nextDocumentCodeFrom(rule, 'Procedimiento', 'CAL', [])).toBe('PRO-CAL-001-Rev.01');
  });

  it('only counts codes matching the current fixed prefix/suffix for the series', () => {
    // A "PRO-CAL-*" correlativo series must not be bumped by an unrelated
    // "POL-GER-*" code, nor by a same-series code from a different area.
    expect(
      nextDocumentCodeFrom(DEFAULT_CODING_RULE, 'Procedimiento', 'CAL', [
        'PRO-CAL-005',
        'PRO-GER-099',
        'POL-CAL-777',
      ]),
    ).toBe('PRO-CAL-006');
  });
});

describe('buildDocumentCode', () => {
  it('builds a specific correlativo without scanning existing codes', () => {
    expect(buildDocumentCode(DEFAULT_CODING_RULE, 'Manual', 'GER', 7)).toBe('MAN-GER-007');
  });
});
