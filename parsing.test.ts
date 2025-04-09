import { describe, expect, test } from 'bun:test'
import { parseToAST } from './parsing'
import { ParserAST } from './types'

describe('parsing', () => {
  describe('numbers', () => {
    test('positive integers', () => {
      expect(parseToAST('123')).toEqual({ result: { kind: 'number', value: 123, span: { start: 0, end: 3 } } })
    })

    test('negative integers', () => {
      expect(parseToAST('-123')).toEqual({ result: { kind: 'number', value: -123, span: { start: 0, end: 4 } } })
      expect(parseToAST('(- 5 3)')).toEqual({
        result: {
          kind: 'list',
          value: [
            { kind: 'atom', value: '-', span: { start: 1, end: 2 } },
            { kind: 'number', value: 5, span: { start: 3, end: 4 } },
            { kind: 'number', value: 3, span: { start: 5, end: 6 } }
          ],
          span: { start: 0, end: 7 }
        }
      })
    })

    test('invalid number formats', () => {
      expect(parseToAST('--123')).toEqual({
        error: 'Invalid number format',
        span: { start: 0, end: 2 },
        lastPosition: 2
      })
      expect(parseToAST('-')).toEqual({
        error: 'Invalid number format',
        span: { start: 0, end: 1 },
        lastPosition: 1
      })
    })

    test('floating point numbers', () => {
      expect(parseToAST('123.45')).toEqual({ result: { kind: 'number', value: 123.45, span: { start: 0, end: 6 } } })
    })
  })

  describe('strings', () => {
    test('simple strings', () => {
      expect(parseToAST('"hello"')).toEqual({ result: { kind: 'string', value: 'hello', span: { start: 0, end: 7 } } })
    })

    test('strings with spaces', () => {
      expect(parseToAST('"hello world"')).toEqual({ result: { kind: 'string', value: 'hello world', span: { start: 0, end: 13 } } })
    })

    test('empty strings', () => {
      expect(parseToAST('""')).toEqual({ result: { kind: 'string', value: '', span: { start: 0, end: 2 } } })
    })
  })

  describe('atoms', () => {
    test('simple atoms', () => {
      expect(parseToAST('hello')).toEqual({ result: { kind: 'atom', value: 'hello', span: { start: 0, end: 5 } } })
    })

    test('atoms with special characters', () => {
      expect(parseToAST('hello-world')).toEqual({ result: { kind: 'atom', value: 'hello-world', span: { start: 0, end: 11 } } })
    })

    test('atoms with numbers', () => {
      expect(parseToAST('hello123')).toEqual({ result: { kind: 'atom', value: 'hello123', span: { start: 0, end: 8 } } })
    })
  })

  describe('lists', () => {
    test('empty list', () => {
      expect(parseToAST('()')).toEqual({ result: { kind: 'list', value: [], span: { start: 0, end: 2 } } })
    })

    test('simple list', () => {
      expect(parseToAST('(1 2 3)')).toEqual({
        result: {
          kind: 'list',
          value: [
            { kind: 'number', value: 1, span: { start: 1, end: 2 } },
            { kind: 'number', value: 2, span: { start: 3, end: 4 } },
            { kind: 'number', value: 3, span: { start: 5, end: 6 } }
          ],
          span: { start: 0, end: 7 }
        }
      })
    })

    test('nested lists', () => {
      expect(parseToAST('(1 (2 3) 4)')).toEqual({
        result: {
          kind: 'list',
          value: [
            { kind: 'number', value: 1, span: { start: 1, end: 2 } },
            {
              kind: 'list',
              value: [
                { kind: 'number', value: 2, span: { start: 4, end: 5 } },
                { kind: 'number', value: 3, span: { start: 6, end: 7 } }
              ],
              span: { start: 3, end: 8 }
            },
            { kind: 'number', value: 4, span: { start: 9, end: 10 } }
          ],
          span: { start: 0, end: 11 }
        }
      })
    })
  })

  describe('vectors', () => {
    test('empty vector', () => {
      expect(parseToAST('[]')).toEqual({ result: { kind: 'vector', value: [], span: { start: 0, end: 2 } } })
    })

    test('simple vector', () => {
      expect(parseToAST('[1 2 3]')).toEqual({
        result: {
          kind: 'vector',
          value: [
            { kind: 'number', value: 1, span: { start: 1, end: 2 } },
            { kind: 'number', value: 2, span: { start: 3, end: 4 } },
            { kind: 'number', value: 3, span: { start: 5, end: 6 } }
          ],
          span: { start: 0, end: 7 }
        }
      })
    })

    test('nested vectors', () => {
      expect(parseToAST('[1 [2 3] 4]')).toEqual({
        result: {
          kind: 'vector',
          value: [
            { kind: 'number', value: 1, span: { start: 1, end: 2 } },
            {
              kind: 'vector',
              value: [
                { kind: 'number', value: 2, span: { start: 4, end: 5 } },
                { kind: 'number', value: 3, span: { start: 6, end: 7 } }
              ],
              span: { start: 3, end: 8 }
            },
            { kind: 'number', value: 4, span: { start: 9, end: 10 } }
          ],
          span: { start: 0, end: 11 }
        }
      })
    })
  })

  describe('maps', () => {
    test('empty map', () => {
      expect(parseToAST('{}')).toEqual({ result: { kind: 'map', value: [], span: { start: 0, end: 2 } } })
    })

    test('simple map', () => {
      expect(parseToAST('{:a 1 :b 2}')).toEqual({
        result: {
          kind: 'map',
          value: [
            { kind: 'atom', value: ':a', span: { start: 1, end: 3 } },
            { kind: 'number', value: 1, span: { start: 4, end: 5 } },
            { kind: 'atom', value: ':b', span: { start: 6, end: 8 } },
            { kind: 'number', value: 2, span: { start: 9, end: 10 } }
          ],
          span: { start: 0, end: 11 }
        }
      })
    })
  })

  describe('error handling', () => {
    test('unmatched list', () => {
      expect(parseToAST('(1 2 3')).toEqual({
        error: "List doesn't end",
        span: { start: 0, end: 7 },
        lastPosition: 7
      })
    })

    test('unmatched vector', () => {
      expect(parseToAST('[1 2 3')).toEqual({
        error: "Vector doesn't end",
        span: { start: 0, end: 7 },
        lastPosition: 7
      })
    })

    test('unmatched map', () => {
      expect(parseToAST('{:a 1 :b 2')).toEqual({
        error: "Map doesn't end",
        span: { start: 0, end: 11 },
        lastPosition: 11
      })
    })

    test('unclosed string', () => {
      expect(parseToAST('"hello')).toEqual({
        error: "String literal doesn't end",
        span: { start: 0, end: 6 },
        lastPosition: 6
      })
    })

    test('empty source', () => {
      expect(parseToAST('')).toEqual({
        error: 'No expressions found',
        span: { start: 0, end: 0 },
        lastPosition: 0
      })
    })

    test('quote with whitespace', () => {
      expect(parseToAST("' hello")).toEqual({
        error: "Quote can't be followed by whitespace",
        span: { start: 0, end: 2 },
        lastPosition: 2
      })
    })

    test('unquote with whitespace', () => {
      expect(parseToAST('~ hello')).toEqual({
        error: "Unquote can't be followed by whitespace",
        span: { start: 0, end: 2 },
        lastPosition: 2
      })
    })

    test('invalid number formats', () => {
      expect(parseToAST('123.45.67')).toEqual({
        result: { kind: 'number', value: 123.45, span: { start: 0, end: 6 } }
      })
      expect(parseToAST('123a')).toEqual({
        result: { kind: 'number', value: 123, span: { start: 0, end: 3 } }
      })
    })

    test('invalid atom characters', () => {
      expect(parseToAST('hello@world')).toEqual({
        result: { kind: 'atom', value: 'hello', span: { start: 0, end: 5 } }
      })
      expect(parseToAST('hello#world')).toEqual({
        result: { kind: 'atom', value: 'hello', span: { start: 0, end: 5 } }
      })
    })

    test('comments', () => {
      expect(parseToAST('; comment\n123')).toEqual({
        result: { kind: 'number', value: 123, span: { start: 10, end: 13 } }
      })
      expect(parseToAST('; comment')).toEqual({
        error: 'No expressions found',
        span: { start: 0, end: 9 },
        lastPosition: 9
      })
    })
  })
})
