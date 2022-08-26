import { assertEquals } from 'asserts'
import { parseToAST } from './parsing.ts'

Deno.test('Parsing', async (t) => {
  await t.step('Empty source returns error', () => {
    assertEquals(parseToAST('  '), { error: 'No expressions found', span: { start: 0, end: 2 } })
  })
  await t.step('Parse number', () => {
    assertEquals(parseToAST('5'), { result: { kind: 'number', value: 5, span: { start: 0, end: 1 } } })
    assertEquals(parseToAST('  15 '), { result: { kind: 'number', value: 15, span: { start: 2, end: 4 } } })
  })
  await t.step('Parse string', () => {
    assertEquals(parseToAST('"s"'), { result: { kind: 'string', value: 's', span: { start: 0, end: 3 } } })
    assertEquals(parseToAST('  "ss" '), { result: { kind: 'string', value: 'ss', span: { start: 2, end: 6 } } })
    assertEquals(parseToAST('  "ss '), { error: "String literal doesn't end", span: { start: 2, end: 6 } })
  })
  await t.step('Parse atom', () => {
    assertEquals(parseToAST('false'), { result: { kind: 'atom', value: 'false', span: { start: 0, end: 5 } } })
    assertEquals(parseToAST('  true '), { result: { kind: 'atom', value: 'true', span: { start: 2, end: 6 } } })
    assertEquals(parseToAST('test!$%&|*+-/:<=>?&^_.'), {
      result: { kind: 'atom', value: 'test!$%&|*+-/:<=>?&^_.', span: { start: 0, end: 22 } },
    })
  })
  await t.step('Parse list', () => {
    assertEquals(parseToAST(' (false 5 "s") '), {
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
    assertEquals(parseToAST(' (false 5 ("s" 5)) '), {
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

  await t.step('Parse vector', () => {
    assertEquals(parseToAST(' [false 5 "s"] '), {
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
    assertEquals(parseToAST(' [false 5 ["s" 5]] '), {
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

  await t.step('Parse map', () => {
    assertEquals(parseToAST(' {false 5 "s"} '), {
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
    assertEquals(parseToAST(' {false 5 ["s" 5]} '), {
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

  await t.step('Parse quote', () => {
    assertEquals(parseToAST("'(1)"), {
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
  await t.step('Parse unquote', () => {
    assertEquals(parseToAST('~(1)'), {
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
  await t.step('Skip comments', () => {
    assertEquals(parseToAST('(\n5 ;comment\n 6)'), {
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
  await t.step('Parse skip expression', () => {
    assertEquals(parseToAST('#_(1)'), {
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

  await t.step('Need better errors', () => {
    assertEquals('result' in parseToAST('(let [a (fn [n] (if (= n 0) 5 (a (- n 1)))] (a 5)'), true)
  })
})
