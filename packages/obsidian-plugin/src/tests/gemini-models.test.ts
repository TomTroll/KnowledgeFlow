// packages/obsidian-plugin/src/tests/gemini-models.test.ts
// Regression tests to ensure all embedding model references stay in sync.
// Written BEFORE the fix (TDD red phase) to prevent future model drift.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { EMBEDDING_MODEL } from '../gemini-models';

// ---------------------------------------------------------------------------
// Constant value pin
// ---------------------------------------------------------------------------

describe('EMBEDDING_MODEL constant', () => {
  it('equals "gemini-embedding-2"', () => {
    expect(EMBEDDING_MODEL).toBe('gemini-embedding-2');
  });
});

// ---------------------------------------------------------------------------
// Source-level consistency checks
// ---------------------------------------------------------------------------

describe('model consistency across source files', () => {
  const srcDir = resolve(__dirname, '..');

  it('gemini-api.ts imports EMBEDDING_MODEL and has no hardcoded model strings', () => {
    const source = readFileSync(resolve(srcDir, 'gemini-api.ts'), 'utf-8');
    // Must import the constant
    expect(source).toContain("import { EMBEDDING_MODEL } from './gemini-models'");
    // Must use the constant in the endpoint and request body
    expect(source).toContain('${EMBEDDING_MODEL}');
    // Must NOT contain any hardcoded model name
    expect(source).not.toContain('text-embedding-004');
    expect(source).not.toContain("'gemini-embedding-2'");
    expect(source).not.toContain('"gemini-embedding-2"');
  });

  it('settings-tab.ts imports EMBEDDING_MODEL and has no hardcoded model strings', () => {
    const source = readFileSync(resolve(srcDir, 'settings-tab.ts'), 'utf-8');
    // Must import the constant
    expect(source).toContain("import { EMBEDDING_MODEL } from './gemini-models'");
    // Must use the constant in the validation fetch
    expect(source).toContain('${EMBEDDING_MODEL}');
    // Must NOT contain the deprecated model
    expect(source).not.toContain('text-embedding-004');
    // Must NOT contain any hardcoded embedding model name
    expect(source).not.toContain("'gemini-embedding-2'");
    expect(source).not.toContain('"gemini-embedding-2"');
  });
});
