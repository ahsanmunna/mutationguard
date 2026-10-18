import { describe, it, expect, afterEach } from 'vitest';
import { getExpectedDatabaseName } from '../../db/safety';

const saved = process.env.ALLOWED_DATABASE_NAME;

afterEach(() => {
  if (saved === undefined) delete process.env.ALLOWED_DATABASE_NAME;
  else process.env.ALLOWED_DATABASE_NAME = saved;
});

describe('getExpectedDatabaseName (hosted database support)', () => {
  it('defaults to antigravity_dev for development and antigravity_test for tests', () => {
    delete process.env.ALLOWED_DATABASE_NAME;
    expect(getExpectedDatabaseName('development')).toBe('antigravity_dev');
    expect(getExpectedDatabaseName('test')).toBe('antigravity_test');
  });

  it('uses ALLOWED_DATABASE_NAME for the hosted database', () => {
    process.env.ALLOWED_DATABASE_NAME = 'neondb';
    expect(getExpectedDatabaseName('development')).toBe('neondb');
  });

  it('never lets ALLOWED_DATABASE_NAME change the test database', () => {
    process.env.ALLOWED_DATABASE_NAME = 'neondb';
    expect(getExpectedDatabaseName('test')).toBe('antigravity_test');
  });

  it('ignores a blank value', () => {
    process.env.ALLOWED_DATABASE_NAME = '   ';
    expect(getExpectedDatabaseName('development')).toBe('antigravity_dev');
  });
});