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

test('Quote/unquote operations', () => {
  test('Simple quote', () => {
    expect(parseAndExpand("'(+ 5 3)")).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: '+' },
          { kind: 'number', value: 5 },
          { kind: 'number', value: 3 }
        ]
      }
    })
  })

  test('Simple unquote', () => {
    expect(parseAndExpand("'(+ ~5 3)")).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: '+' },
          { kind: 'number', value: 5 },
          { kind: 'number', value: 3 }
        ]
      }
    })
  })

  test('Unquote with function call', () => {
    expect(parseAndExpand("'(+ ~((fn [x] x) 5) 3)")).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: '+' },
          { kind: 'number', value: 5 },
          { kind: 'number', value: 3 }
        ]
      }
    })
  })
})

test('Macro expansion', () => {
  test('Simple macro expansion', () => {
    expect(parseAndExpand('((macro [x] ~(+ x 1)) 5)')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: '+' },
          { kind: 'number', value: 5 },
          { kind: 'number', value: 1 }
        ]
      }
    })
  })

  test('Nested macro expansion', () => {
    expect(parseAndExpand('((macro [x] ~((macro [y] ~(+ x y)) 3)) 5)')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: '+' },
          { kind: 'number', value: 5 },
          { kind: 'number', value: 3 }
        ]
      }
    })
  })

  test('Macro with multiple arguments', () => {
    expect(parseAndExpand('((macro [x y] ~(+ x y)) 5 3)')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: '+' },
          { kind: 'number', value: 5 },
          { kind: 'number', value: 3 }
        ]
      }
    })
  })

  test('Macro with let bindings', () => {
    expect(parseAndExpand('(let [x 5] ((macro [y] ~(+ x y)) 3))')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: 'let' },
          {
            kind: 'vector',
            value: [
              { kind: 'atom', value: 'x' },
              { kind: 'number', value: 5 }
            ]
          },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: '+' },
              { kind: 'atom', value: 'x' },
              { kind: 'number', value: 3 }
            ]
          }
        ]
      }
    })
  })

  test('Macro with if expressions', () => {
    expect(parseAndExpand('((macro [x] ~(if (> x 0) x 0)) 5)')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: 'if' },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: '>' },
              { kind: 'number', value: 5 },
              { kind: 'number', value: 0 }
            ]
          },
          { kind: 'number', value: 5 },
          { kind: 'number', value: 0 }
        ]
      }
    })
  })

  test('Macro with function definitions', () => {
    expect(parseAndExpand('((macro [x] ~(fn [y] (+ x y))) 5)')).toEqual({
      result: {
        kind: 'function',
        env: [],
        arguments: ['y'],
        body: {
          kind: 'list',
          value: [
            { kind: 'atom', value: '+' },
            { kind: 'number', value: 5 },
            { kind: 'atom', value: 'y' }
          ]
        }
      }
    })
  })
})

test('Macro expansion with evaluating', () => {
  test('Simple macro expansion with evaluating', () => {
    expect(parseAndExpand('((macro [x] ~(+ x 1)) 5)', true)).toEqual({
      result: { kind: 'number', value: 6 }
    })
  })

  test('Nested macro expansion with evaluating', () => {
    expect(parseAndExpand('((macro [x] ~((macro [y] ~(+ x y)) 3)) 5)', true)).toEqual({
      result: { kind: 'number', value: 8 }
    })
  })

  test('Macro with multiple arguments with evaluating', () => {
    expect(parseAndExpand('((macro [x y] ~(+ x y)) 5 3)', true)).toEqual({
      result: { kind: 'number', value: 8 }
    })
  })

  test('Macro with let bindings with evaluating', () => {
    expect(parseAndExpand('(let [x 5] ((macro [y] ~(+ x y)) 3))', true)).toEqual({
      result: { kind: 'number', value: 8 }
    })
  })

  test('Macro with if expressions with evaluating', () => {
    expect(parseAndExpand('((macro [x] ~(if (> x 0) x 0)) 5)', true)).toEqual({
      result: { kind: 'number', value: 5 }
    })
  })

  test('Macro with function definitions with evaluating', () => {
    expect(parseAndExpand('((macro [x] ~(fn [y] (+ x y))) 5)', true)).toEqual({
      result: {
        kind: 'function',
        env: [],
        arguments: ['y'],
        body: {
          kind: 'list',
          value: [
            { kind: 'atom', value: '+' },
            { kind: 'number', value: 5 },
            { kind: 'atom', value: 'y' }
          ]
        }
      }
    })
  })
})

test('Error handling', () => {
  test('Macro definition errors', () => {
    expect(parseAndExpand('(macro [x])')).toEqual({
      error: 'Non complete macro definition'
    })

    expect(parseAndExpand('(macro x ~(+ x 1))')).toEqual({
      error: 'Macro arguments should be in vector'
    })

    expect(parseAndExpand('(macro [(+ x y)] ~(+ x 1))')).toEqual({
      error: 'Invalid argument'
    })
  })

  test('Quote/Unquote errors', () => {
    expect(parseAndExpand('(quote)')).toEqual({
      error: 'Expected 1 argument, got 0'
    })

    expect(parseAndExpand('(quote a b)')).toEqual({
      error: 'Expected 1 argument, got 2'
    })

    expect(parseAndExpand('(unquote)')).toEqual({
      error: 'Expected 1 argument, got 0'
    })

    expect(parseAndExpand('(unquote a b)')).toEqual({
      error: 'Expected 1 argument, got 2'
    })
  })

  test('Let expression errors', () => {
    expect(parseAndExpand('(let [x])')).toEqual({
      error: 'Incomplete let definition'
    })

    expect(parseAndExpand('(let x 5)')).toEqual({
      error: 'Expected vector as first let argument, got atom'
    })

    expect(parseAndExpand('(let [x 5 y] x)')).toEqual({
      error: 'Incomplete let binding'
    })

    expect(parseAndExpand('(let [(+ x y) 5] x)')).toEqual({
      error: 'Expected atom got list'
    })
  })

  test('If expression errors', () => {
    expect(parseAndExpand('(if true 5)')).toEqual({
      error: 'If takes 3 arguments, got 2'
    })

    expect(parseAndExpand('(if true 5 3 7)')).toEqual({
      error: 'If takes 3 arguments, got 4'
    })

    expect(parseAndExpand('(if 5 3 7)')).toEqual({
      error: 'Expected true or false, got number'
    })
  })

  test('List evaluation errors', () => {
    expect(parseAndExpand('(5 3)')).toEqual({
      error: 'Expression not callable'
    })

    expect(parseAndExpand('((macro [x y] ~(+ x y)) 5)')).toEqual({
      error: 'Expected 2 arguments, got 1'
    })
  })
})

test('Let bindings with macros', () => {
  test('Simple let with macro', () => {
    expect(parseAndExpand('(let [x (macro [y] ~(+ y 1))] (x 5))')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: '+' },
          { kind: 'number', value: 5 },
          { kind: 'number', value: 1 }
        ]
      }
    })
  })

  test('Multiple let bindings with macro', () => {
    expect(parseAndExpand('(let [x (macro [y] ~(+ y 1)) z 3] (+ (x 5) z))')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: '+' },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: '+' },
              { kind: 'number', value: 5 },
              { kind: 'number', value: 1 }
            ]
          },
          { kind: 'number', value: 3 }
        ]
      }
    })
  })

  test('Nested let bindings with macro', () => {
    expect(parseAndExpand('(let [x (macro [y] ~(+ y 1))] (let [z 3] (+ (x 5) z)))')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: 'let' },
          {
            kind: 'vector',
            value: [
              { kind: 'atom', value: 'z' },
              { kind: 'number', value: 3 }
            ]
          },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: '+' },
              {
                kind: 'list',
                value: [
                  { kind: 'atom', value: '+' },
                  { kind: 'number', value: 5 },
                  { kind: 'number', value: 1 }
                ]
              },
              { kind: 'atom', value: 'z' }
            ]
          }
        ]
      }
    })
  })
})

test('If expressions with macros', () => {
  test('Simple if with macro', () => {
    expect(parseAndExpand('(if true (macro [x] ~(+ x 1)) (macro [x] ~(- x 1)))')).toEqual({
      result: {
        kind: 'macro',
        env: [],
        arguments: ['x'],
        body: {
          kind: 'list',
          value: [
            { kind: 'atom', value: '+' },
            { kind: 'atom', value: 'x' },
            { kind: 'number', value: 1 }
          ]
        }
      }
    })
  })

  test('Nested if with macro', () => {
    expect(parseAndExpand('(if (if true false true) (macro [x] ~(+ x 1)) (macro [x] ~(- x 1)))')).toEqual({
      result: {
        kind: 'macro',
        env: [],
        arguments: ['x'],
        body: {
          kind: 'list',
          value: [
            { kind: 'atom', value: '-' },
            { kind: 'atom', value: 'x' },
            { kind: 'number', value: 1 }
          ]
        }
      }
    })
  })

  test('If with macro in condition', () => {
    expect(parseAndExpand('(if ((macro [x] ~(> x 0)) 5) (+ 1 2) (- 1 2))')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: 'if' },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: '>' },
              { kind: 'number', value: 5 },
              { kind: 'number', value: 0 }
            ]
          },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: '+' },
              { kind: 'number', value: 1 },
              { kind: 'number', value: 2 }
            ]
          },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: '-' },
              { kind: 'number', value: 1 },
              { kind: 'number', value: 2 }
            ]
          }
        ]
      }
    })
  })
})

function parseAndExpand(source: string, evaluate: boolean = false): { result: MacrosAST } | ASTParsingError | MacroExpansionError {
  const ast = parseToAST(source)
  if ('error' in ast) {
    return ast
  }
  return expandMacros(ast.result, intrinsics, evaluate)
}
