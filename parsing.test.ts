import { expect, test } from 'bun:test'
import { parseFile, parseToAST } from './parsing.ts'

test('Expression parsing', async () => {
  test('Empty source returns error', () => {
    expect(parseToAST('  ')).toEqual({ error: 'No expressions found', span: { start: 0, end: 2 }, lastPosition: 2 })
  })
  test('Parse number', () => {
    expect(parseToAST('5')).toEqual({ result: { kind: 'number', value: 5, span: { start: 0, end: 1 } } })
    expect(parseToAST('  15 ')).toEqual({ result: { kind: 'number', value: 15, span: { start: 2, end: 4 } } })
  })
  test('Parse string', () => {
    expect(parseToAST('"s"')).toEqual({ result: { kind: 'string', value: 's', span: { start: 0, end: 3 } } })
    expect(parseToAST('  "ss" ')).toEqual({ result: { kind: 'string', value: 'ss', span: { start: 2, end: 6 } } })
    expect(parseToAST('  "ss ')).toEqual({ error: "String literal doesn't end", span: { start: 2, end: 6 }, lastPosition: 2 })
  })
  test('Parse atom', () => {
    expect(parseToAST('false')).toEqual({ result: { kind: 'atom', value: 'false', span: { start: 0, end: 5 } } })
    expect(parseToAST('  true ')).toEqual({ result: { kind: 'atom', value: 'true', span: { start: 2, end: 6 } } })
    expect(parseToAST('test!$%&|*+-/:<=>?&^_.')).toEqual({
      result: { kind: 'atom', value: 'test!$%&|*+-/:<=>?&^_.', span: { start: 0, end: 22 } },
    })
  })
  test('Parse list', () => {
    expect(parseToAST(' (false 5 "s") ')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: 'false', span: { start: 2, end: 7 } },
          { kind: 'number', value: 5, span: { start: 8, end: 9 } },
          { kind: 'string', value: 's', span: { start: 10, end: 13 } },
        ],
        span: { start: 1, end: 14 },
      },
    })
    expect(parseToAST(' (false 5 ("s" 5)) ')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: 'false', span: { start: 2, end: 7 } },
          { kind: 'number', value: 5, span: { start: 8, end: 9 } },
          {
            kind: 'list',
            value: [
              { kind: 'string', value: 's', span: { start: 11, end: 14 } },
              { kind: 'number', value: 5, span: { start: 15, end: 16 } },
            ],
            span: { start: 10, end: 17 },
          },
        ],
        span: { start: 1, end: 18 },
      },
    })
  })

  test('Parse vector', () => {
    expect(parseToAST(' [false 5 "s"] ')).toEqual({
      result: {
        kind: 'vector',
        value: [
          { kind: 'atom', value: 'false', span: { start: 2, end: 7 } },
          { kind: 'number', value: 5, span: { start: 8, end: 9 } },
          { kind: 'string', value: 's', span: { start: 10, end: 13 } },
        ],
        span: { start: 1, end: 14 },
      },
    })
    expect(parseToAST(' [false 5 ["s" 5]] ')).toEqual({
      result: {
        kind: 'vector',
        value: [
          { kind: 'atom', value: 'false', span: { start: 2, end: 7 } },
          { kind: 'number', value: 5, span: { start: 8, end: 9 } },
          {
            kind: 'vector',
            value: [
              { kind: 'string', value: 's', span: { start: 11, end: 14 } },
              { kind: 'number', value: 5, span: { start: 15, end: 16 } },
            ],
            span: { start: 10, end: 17 },
          },
        ],
        span: { start: 1, end: 18 },
      },
    })
  })

  test('Parse map', () => {
    expect(parseToAST(' {false 5 "s"} ')).toEqual({
      result: {
        kind: 'map',
        value: [
          { kind: 'atom', value: 'false', span: { start: 2, end: 7 } },
          { kind: 'number', value: 5, span: { start: 8, end: 9 } },
          { kind: 'string', value: 's', span: { start: 10, end: 13 } },
        ],
        span: { start: 1, end: 14 },
      },
    })
    expect(parseToAST(' {false 5 ["s" 5]} ')).toEqual({
      result: {
        kind: 'map',
        value: [
          { kind: 'atom', value: 'false', span: { start: 2, end: 7 } },
          { kind: 'number', value: 5, span: { start: 8, end: 9 } },
          {
            kind: 'vector',
            value: [
              { kind: 'string', value: 's', span: { start: 11, end: 14 } },
              { kind: 'number', value: 5, span: { start: 15, end: 16 } },
            ],
            span: { start: 10, end: 17 },
          },
        ],
        span: { start: 1, end: 18 },
      },
    })
  })

  test('Parse quote', () => {
    expect(parseToAST("'(1)")).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: 'quote', span: { start: 0, end: 1 } },
          {
            kind: 'list',
            value: [{ kind: 'number', value: 1, span: { start: 2, end: 3 } }],
            span: { start: 1, end: 4 },
          },
        ],
        span: { start: 0, end: 4 },
      },
    })
  })
  test('Parse unquote', () => {
    expect(parseToAST('~(1)')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: 'unquote', span: { start: 0, end: 1 } },
          {
            kind: 'list',
            value: [{ kind: 'number', value: 1, span: { start: 2, end: 3 } }],
            span: { start: 1, end: 4 },
          },
        ],
        span: { start: 0, end: 4 },
      },
    })
  })
  test('Skip comments', () => {
    expect(parseToAST('(\n5 ;comment\n 6)')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'number', value: 5, span: { start: 2, end: 3 } },
          { kind: 'number', value: 6, span: { start: 14, end: 15 } },
        ],
        span: { start: 0, end: 16 },
      },
    })
  })
  test('Parse skip expression', () => {
    expect(parseToAST('#_(1)')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: 'skip', span: { start: 0, end: 2 } },
          {
            kind: 'list',
            value: [{ kind: 'number', value: 1, span: { start: 3, end: 4 } }],
            span: { start: 2, end: 5 },
          },
        ],
        span: { start: 0, end: 5 },
      },
    })
  })
})

test('File parsing', () => {
  test('supports multiple expressions', () => {
    const results = parseFile('(executable ["module.clsk"]) (+ 1 2)')
    expect(results.length).toBe(2)
    expect(results[0]).toHaveProperty('result.kind', 'list')
    expect(results[1]).toHaveProperty('result.kind', 'list')
  })
})
