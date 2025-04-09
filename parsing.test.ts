import { describe, expect, test } from 'bun:test'
import { parseToAST, parseFile } from './parsing'

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
      expect(parseToAST('; comment\n123')).toEqual({ result: { kind: 'number', value: 123, span: { start: 10, end: 13 } } })
    })

    test('parseFile function', () => {
      expect(parseFile('123 456')).toEqual([
        { result: { kind: 'number', value: 123, span: { start: 0, end: 3 } } },
        { result: { kind: 'number', value: 456, span: { start: 4, end: 7 } } }
      ])
      expect(parseFile('123\n456')).toEqual([
        { result: { kind: 'number', value: 123, span: { start: 0, end: 3 } } },
        { result: { kind: 'number', value: 456, span: { start: 4, end: 7 } } }
      ])
    })

    test('skip operator', () => {
      expect(parseToAST('#123')).toEqual({ result: { kind: 'atom', value: '#123', span: { start: 0, end: 4 } } })
      expect(parseToAST('# hello')).toEqual({
        error: "Skip can't be followed by whitespace",
        span: { start: 0, end: 2 },
        lastPosition: 2
      })
    })

    test('complex nested expressions', () => {
      expect(parseToAST('(1 [2 {:a 3}])')).toEqual({
        result: {
          kind: 'list',
          value: [
            { kind: 'number', value: 1, span: { start: 1, end: 2 } },
            {
              kind: 'vector',
              value: [
                { kind: 'number', value: 2, span: { start: 4, end: 5 } },
                {
                  kind: 'map',
                  value: [
                    { kind: 'atom', value: ':a', span: { start: 7, end: 9 } },
                    { kind: 'number', value: 3, span: { start: 10, end: 11 } }
                  ],
                  span: { start: 6, end: 12 }
                }
              ],
              span: { start: 3, end: 13 }
            }
          ],
          span: { start: 0, end: 14 }
        }
      })
    })

    test('edge cases in number parsing', () => {
      expect(parseToAST('123.')).toEqual({
        result: { kind: 'number', value: 123, span: { start: 0, end: 4 } }
      })
      expect(parseToAST('.123')).toEqual({
        result: { kind: 'number', value: 0.123, span: { start: 0, end: 4 } }
      })
      expect(parseToAST('123e')).toEqual({
        result: { kind: 'number', value: 123, span: { start: 0, end: 3 } }
      })
      expect(parseToAST('123..')).toEqual({
        result: { kind: 'number', value: 123, span: { start: 0, end: 3 } }
      })
      expect(parseToAST('123.0')).toEqual({
        result: { kind: 'number', value: 123.0, span: { start: 0, end: 5 } }
      })
      expect(parseToAST('0.')).toEqual({
        result: { kind: 'number', value: 0, span: { start: 0, end: 2 } }
      })
    })

    test('edge cases in string parsing', () => {
      expect(parseToAST('"hello\\"world"')).toEqual({
        result: { kind: 'string', value: 'hello"world', span: { start: 0, end: 14 } }
      })
      expect(parseToAST('"hello\\"\\"world"')).toEqual({
        result: { kind: 'string', value: 'hello""world', span: { start: 0, end: 16 } }
      })
      expect(parseToAST('"\\""')).toEqual({
        result: { kind: 'string', value: '"', span: { start: 0, end: 4 } }
      })
      expect(parseToAST('"\\\\"')).toEqual({
        result: { kind: 'string', value: '\\', span: { start: 0, end: 4 } }
      })
    })

    test('edge cases in atom parsing', () => {
      expect(parseToAST('+')).toEqual({
        result: { kind: 'atom', value: '+', span: { start: 0, end: 1 } }
      })
      expect(parseToAST('*')).toEqual({
        result: { kind: 'atom', value: '*', span: { start: 0, end: 1 } }
      })
      expect(parseToAST('/')).toEqual({
        result: { kind: 'atom', value: '/', span: { start: 0, end: 1 } }
      })
      expect(parseToAST('$hello')).toEqual({
        result: { kind: 'atom', value: '$hello', span: { start: 0, end: 6 } }
      })
      expect(parseToAST('!hello')).toEqual({
        result: { kind: 'atom', value: '!hello', span: { start: 0, end: 6 } }
      })
      expect(parseToAST('_')).toEqual({
        result: { kind: 'atom', value: '_', span: { start: 0, end: 1 } }
      })
      expect(parseToAST('?')).toEqual({
        result: { kind: 'atom', value: '?', span: { start: 0, end: 1 } }
      })
    })

    test('edge cases in list parsing', () => {
      expect(parseToAST('(1 . 2)')).toEqual({
        result: {
          kind: 'list',
          value: [
            { kind: 'number', value: 1, span: { start: 1, end: 2 } },
            { kind: 'atom', value: '.', span: { start: 3, end: 4 } },
            { kind: 'number', value: 2, span: { start: 5, end: 6 } }
          ],
          span: { start: 0, end: 7 }
        }
      })
      expect(parseToAST('(1 ; comment\n2)')).toEqual({
        result: {
          kind: 'list',
          value: [
            { kind: 'number', value: 1, span: { start: 1, end: 2 } },
            { kind: 'number', value: 2, span: { start: 13, end: 14 } }
          ],
          span: { start: 0, end: 15 }
        }
      })
      expect(parseToAST('((()))')).toEqual({
        result: {
          kind: 'list',
          value: [
            {
              kind: 'list',
              value: [
                { kind: 'list', value: [], span: { start: 2, end: 4 } }
              ],
              span: { start: 1, end: 5 }
            }
          ],
          span: { start: 0, end: 6 }
        }
      })
      expect(parseToAST('(1 2 . 3)')).toEqual({
        result: {
          kind: 'list',
          value: [
            { kind: 'number', value: 1, span: { start: 1, end: 2 } },
            { kind: 'number', value: 2, span: { start: 3, end: 4 } },
            { kind: 'atom', value: '.', span: { start: 5, end: 6 } },
            { kind: 'number', value: 3, span: { start: 7, end: 8 } }
          ],
          span: { start: 0, end: 9 }
        }
      })
    })

    test('edge cases in vector parsing', () => {
      expect(parseToAST('[1 . 2]')).toEqual({
        result: {
          kind: 'vector',
          value: [
            { kind: 'number', value: 1, span: { start: 1, end: 2 } },
            { kind: 'atom', value: '.', span: { start: 3, end: 4 } },
            { kind: 'number', value: 2, span: { start: 5, end: 6 } }
          ],
          span: { start: 0, end: 7 }
        }
      })
      expect(parseToAST('[[[]]]')).toEqual({
        result: {
          kind: 'vector',
          value: [
            {
              kind: 'vector',
              value: [
                { kind: 'vector', value: [], span: { start: 2, end: 4 } }
              ],
              span: { start: 1, end: 5 }
            }
          ],
          span: { start: 0, end: 6 }
        }
      })
      expect(parseToAST('[1 2 . 3]')).toEqual({
        result: {
          kind: 'vector',
          value: [
            { kind: 'number', value: 1, span: { start: 1, end: 2 } },
            { kind: 'number', value: 2, span: { start: 3, end: 4 } },
            { kind: 'atom', value: '.', span: { start: 5, end: 6 } },
            { kind: 'number', value: 3, span: { start: 7, end: 8 } }
          ],
          span: { start: 0, end: 9 }
        }
      })
    })

    test('edge cases in map parsing', () => {
      expect(parseToAST('{:a 1 :b 2 :c 3}')).toEqual({
        result: {
          kind: 'map',
          value: [
            { kind: 'atom', value: ':a', span: { start: 1, end: 3 } },
            { kind: 'number', value: 1, span: { start: 4, end: 5 } },
            { kind: 'atom', value: ':b', span: { start: 6, end: 8 } },
            { kind: 'number', value: 2, span: { start: 9, end: 10 } },
            { kind: 'atom', value: ':c', span: { start: 11, end: 13 } },
            { kind: 'number', value: 3, span: { start: 14, end: 15 } }
          ],
          span: { start: 0, end: 16 }
        }
      })
      expect(parseToAST('{:a 1 ; comment\n:b 2}')).toEqual({
        result: {
          kind: 'map',
          value: [
            { kind: 'atom', value: ':a', span: { start: 1, end: 3 } },
            { kind: 'number', value: 1, span: { start: 4, end: 5 } },
            { kind: 'atom', value: ':b', span: { start: 16, end: 18 } },
            { kind: 'number', value: 2, span: { start: 19, end: 20 } }
          ],
          span: { start: 0, end: 21 }
        }
      })
    })

    test('edge cases in quote/unquote parsing', () => {
      expect(parseToAST("'hello")).toEqual({
        result: {
          kind: 'list',
          value: [
            { kind: 'atom', value: 'quote', span: { start: 0, end: 1 } },
            { kind: 'atom', value: 'hello', span: { start: 1, end: 6 } }
          ],
          span: { start: 0, end: 6 }
        }
      })
      expect(parseToAST('~hello')).toEqual({
        result: {
          kind: 'list',
          value: [
            { kind: 'atom', value: 'unquote', span: { start: 0, end: 1 } },
            { kind: 'atom', value: 'hello', span: { start: 1, end: 6 } }
          ],
          span: { start: 0, end: 6 }
        }
      })
      expect(parseToAST("'; comment\nhello")).toEqual({
        result: {
          kind: 'list',
          value: [
            { kind: 'atom', value: 'quote', span: { start: 0, end: 1 } },
            { kind: 'atom', value: 'hello', span: { start: 11, end: 16 } }
          ],
          span: { start: 0, end: 16 }
        }
      })
      expect(parseToAST('~; comment\nhello')).toEqual({
        result: {
          kind: 'list',
          value: [
            { kind: 'atom', value: 'unquote', span: { start: 0, end: 1 } },
            { kind: 'atom', value: 'hello', span: { start: 11, end: 16 } }
          ],
          span: { start: 0, end: 16 }
        }
      })
    })

    test('parseFile function edge cases', () => {
      expect(parseFile('123 456')).toEqual([
        { result: { kind: 'number', value: 123, span: { start: 0, end: 3 } } },
        { result: { kind: 'number', value: 456, span: { start: 4, end: 7 } } }
      ])
      expect(parseFile('123\n456')).toEqual([
        { result: { kind: 'number', value: 123, span: { start: 0, end: 3 } } },
        { result: { kind: 'number', value: 456, span: { start: 4, end: 7 } } }
      ])
      expect(parseFile('; comment\n123\n; another comment\n456')).toEqual([
        { result: { kind: 'number', value: 123, span: { start: 10, end: 13 } } },
        { result: { kind: 'number', value: 456, span: { start: 32, end: 35 } } }
      ])
      expect(parseFile('')).toEqual([])
    })
  })
})
