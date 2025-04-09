import { expect, test } from 'bun:test'
import { intrinsics } from './intrinsics.ts'
import { expandMacros, MacroExpansionError } from './macros.ts'
import { ASTParsingError, parseToAST } from './parsing.ts'
import { MacrosAST, MMacro } from './types.ts'

test('Defining macros', () => {
  const fnDef = (parseAndExpand('(macro [a b] (quote (+ a b)))') as { result: MacrosAST }).result as MMacro
  expect(fnDef.kind).toBe('macro')
  expect(fnDef.arguments).toEqual(['a', 'b'])
  expect(fnDef.body).toEqual({
    kind: 'list',
    span: {
      end: 28,
      start: 13,
    },
    value: [
      {
        kind: 'atom',
        span: {
          end: 19,
          start: 14,
        },
        value: 'quote',
      },
      {
        kind: 'list',
        value: [
          {
            kind: 'atom',
            span: {
              end: 22,
              start: 21,
            },
            value: '+',
          },
          {
            kind: 'atom',
            span: {
              end: 24,
              start: 23,
            },
            value: 'a',
          },
          {
            kind: 'atom',
            span: {
              end: 26,
              start: 25,
            },
            value: 'b',
          },
        ],
        span: { start: 20, end: 27 },
      },
    ],
  })
})

test('Using macros', () => {
  test('Simple macro', () => {
    expect(parseAndExpand('((macro [a] ~a) 5)')).toEqual({
      result: { kind: 'number', value: 5 },
    })
  })
  test('Calling macro in macro', () => {
    expect(parseAndExpand('((macro [a] ~((macro [b] ~(+ a b)) 3)) 5)')).toEqual({
      result: { kind: 'number', value: 8 },
    })
  })
  test('Supports macros in let bindings', () => {
    expect(parseAndExpand('(let [macroA (macro [a] ~a)] (macroA 5))')).toEqual({
      result: { kind: 'number', value: 5 },
    })
    expect(parseAndExpand('(let [macroA (macro [a] ~a) b 15] (+ b (macroA 5)))')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: 'let' },
          {
            kind: 'vector',
            value: [
              { kind: 'atom', value: 'b' },
              { kind: 'number', value: 15 },
            ],
          },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: '+' },
              { kind: 'atom', value: 'b' },
              { kind: 'number', value: 5 },
            ],
          },
        ],
      },
    })
  })
  test('Supports quote and unquote', () => {
    expect(parseAndExpand("(let [macroA (macro [a] '(+ ~a ~a))] (macroA 5))")).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: '+' },
          { kind: 'number', value: 5 },
          { kind: 'number', value: 5 },
        ],
      },
    })
    expect(parseAndExpand("(let [macroA (macro [a] '(+ ~((fn [b] b) '(+ ~a 3)) ~a))] (macroA 5))")).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: '+' },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: '+' },
              { kind: 'number', value: 5 },
              { kind: 'number', value: 3 },
            ],
          },
          { kind: 'number', value: 5 },
        ],
      },
    })
  })
})

function parseAndExpand(source: string): { result: MacrosAST } | ASTParsingError | MacroExpansionError {
  const ast = parseToAST(source)
  if ('error' in ast) {
    return ast
  }
  return expandMacros(ast.result, intrinsics)
}
