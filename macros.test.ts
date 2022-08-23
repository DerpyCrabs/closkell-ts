import { assertEquals } from 'asserts'
import { intrinsics } from './intrinsics.ts'
import { expandMacros, MacroExpansionError } from './macros.ts'
import { ASTParsingError, parseToAST } from './parsing.ts'
import { MacrosAST } from './types.ts'

Deno.test('Defining macros', () => {
  const fnDef = (parseAndExpand('(macro [a b] (quote (+ a b)))') as any).result
  assertEquals(fnDef.kind, 'macro')
  assertEquals(fnDef.arguments, ['a', 'b'])
  assertEquals(fnDef.body, {
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

Deno.test('Using macros', async (t) => {
  await t.step('Simple macro', () => {
    assertEquals(parseAndExpand('~((macro [a] ~a) 5)'), {
      result: { kind: 'number', value: 5, span: { start: 17, end: 18 } },
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
