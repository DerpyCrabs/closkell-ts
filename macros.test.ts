import { expect, test } from 'bun:test'
import { intrinsics } from './intrinsics.ts'
import { expandMacros, MacroExpansionError, verifyNoMacros } from './macros.ts'
import { ASTParsingError, parseToAST } from './parsing.ts'
import { MacrosAST, MMacro, ParserAST } from './types.ts'

function convertToMacrosAST(ast: ParserAST): MacrosAST {
  switch (ast.kind) {
    case 'string':
    case 'number':
    case 'atom':
      return { ...ast }
    case 'list':
      return {
        kind: 'list',
        value: ast.value.map(convertToMacrosAST),
        span: ast.span
      }
    case 'vector':
      return {
        kind: 'vector',
        value: ast.value.map(convertToMacrosAST),
        span: ast.span
      }
    case 'map':
      return {
        kind: 'map',
        value: ast.value.map(convertToMacrosAST),
        span: ast.span
      }
  }
}

function parseAndExpand(source: string, evaluate: boolean = false): { result: MacrosAST } | ASTParsingError | MacroExpansionError {
  console.log('Parsing source:', source)
  const parsed = parseToAST(source)
  if ('error' in parsed) {
    console.log('Parse error:', parsed.error)
    return parsed
  }
  console.log('Parsed AST:', JSON.stringify(parsed.result, null, 2))
  const macrosAST = convertToMacrosAST(parsed.result)
  console.log('Converted to MacrosAST:', JSON.stringify(macrosAST, null, 2))
  const result = expandMacros(macrosAST, intrinsics, evaluate)
  console.log('Expanded result:', JSON.stringify(result, null, 2))
  return result
}

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
  test('Invalid macro definition', () => {
    expect(parseAndExpand('(macro)')).toEqual({
      error: 'Non complete macro definition'
    })
    expect(parseAndExpand('(macro [a])')).toEqual({
      error: 'Non complete macro definition'
    })
    expect(parseAndExpand('(macro 5 (quote a))')).toEqual({
      error: 'Macro arguments should be in vector'
    })
    expect(parseAndExpand('(macro [5] (quote a))')).toEqual({
      error: 'Invalid argument'
    })
  })

  test('Invalid unquote usage', () => {
    expect(parseAndExpand('(unquote)')).toEqual({
      error: 'Expected 1 argument, got 0'
    })
    expect(parseAndExpand('(unquote 1 2)')).toEqual({
      error: 'Expected 1 argument, got 2'
    })
  })

  test('Invalid quote usage', () => {
    expect(parseAndExpand('(quote)')).toEqual({
      error: 'Expected 1 argument, got 0'
    })
    expect(parseAndExpand('(quote 1 2)')).toEqual({
      error: 'Expected 1 argument, got 2'
    })
  })

  test('Invalid function definition', () => {
    expect(parseAndExpand('(fn)')).toEqual({
      error: 'Incomplete function definition'
    })
    expect(parseAndExpand('(fn [a])')).toEqual({
      error: 'Incomplete function definition'
    })
    expect(parseAndExpand('(fn 5 (+ a 1))')).toEqual({
      error: 'Function arguments should be in vector'
    })
  })

  test('Invalid let binding', () => {
    expect(parseAndExpand('(let)')).toEqual({
      error: 'Incomplete let definition'
    })
    expect(parseAndExpand('(let [a])')).toEqual({
      error: 'Incomplete let definition'
    })
    expect(parseAndExpand('(let 5 (+ a 1))')).toEqual({
      error: 'Expected vector as first let argument, got number'
    })
    expect(parseAndExpand('(let [a] (+ a 1))')).toEqual({
      error: 'Incomplete let binding'
    })
    expect(parseAndExpand('(let [5 1] (+ a 1))')).toEqual({
      error: 'Expected atom got number'
    })
  })
})

test('If expressions', () => {
  test('Basic if expressions', () => {
    expect(parseAndExpand('(if true 1 2)', true)).toEqual({
      result: { kind: 'number', value: 1 }
    })
    expect(parseAndExpand('(if false 1 2)', true)).toEqual({
      result: { kind: 'number', value: 2 }
    })
  })

  test('Invalid if expressions', () => {
    expect(parseAndExpand('(if)', true)).toEqual({
      error: 'If takes 3 arguments, got 0'
    })
    expect(parseAndExpand('(if true)', true)).toEqual({
      error: 'If takes 3 arguments, got 1'
    })
    expect(parseAndExpand('(if 5 1 2)', true)).toEqual({
      error: 'Expected true or false, got number'
    })
  })

  test('Nested if expressions', () => {
    expect(parseAndExpand('(if true (if false 1 2) 3)', true)).toEqual({
      result: { kind: 'number', value: 2 }
    })
  })
})

test('Complex nested expressions', () => {
  test('Nested let bindings', () => {
    expect(parseAndExpand('(let [a 1] (let [b (+ a 1)] (+ a b)))')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: 'let' },
          {
            kind: 'vector',
            value: [
              { kind: 'atom', value: 'a' },
              { kind: 'number', value: 1 }
            ]
          },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: 'let' },
              {
                kind: 'vector',
                value: [
                  { kind: 'atom', value: 'b' },
                  {
                    kind: 'list',
                    value: [
                      { kind: 'atom', value: '+' },
                      { kind: 'atom', value: 'a' },
                      { kind: 'number', value: 1 }
                    ]
                  }
                ]
              },
              {
                kind: 'list',
                value: [
                  { kind: 'atom', value: '+' },
                  { kind: 'atom', value: 'a' },
                  { kind: 'atom', value: 'b' }
                ]
              }
            ]
          }
        ]
      }
    })
  })

  test('Nested macro expansions', () => {
    expect(parseAndExpand(`
      (let [
        add (macro [a b] '(+ ~a ~b))
        double (macro [x] '(* ~x 2))
      ] (add (double 3) 4))
    `)).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: '+' },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: '*' },
              { kind: 'number', value: 3 },
              { kind: 'number', value: 2 }
            ]
          },
          { kind: 'number', value: 4 }
        ]
      }
    })
  })
})

test('Environment handling', () => {
  test('Macro environment capture', () => {
    expect(parseAndExpand(`
      (let [
        x 1
        m (macro [a] '(+ ~x ~a))
      ] (let [x 2] (m 3)))
    `)).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: 'let' },
          {
            kind: 'vector',
            value: [
              { kind: 'atom', value: 'x' },
              { kind: 'number', value: 2 }
            ]
          },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: '+' },
              { kind: 'number', value: 1 },
              { kind: 'number', value: 3 }
            ]
          }
        ]
      }
    })
  })

  test('Function environment capture', () => {
    expect(parseAndExpand(`
      (let [
        x 1
        f (fn [a] (+ x a))
      ] (let [x 2] (f 3)))
    `)).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: 'let' },
          {
            kind: 'vector',
            value: [
              { kind: 'atom', value: 'x' },
              { kind: 'number', value: 2 }
            ]
          },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: 'let' },
              {
                kind: 'vector',
                value: [
                  { kind: 'atom', value: 'x' },
                  { kind: 'number', value: 1 }
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
        ]
      }
    })
  })
})

test('Complex macro expansion scenarios', () => {
  test('Macro with nested quotes and unquotes', () => {
    expect(parseAndExpand("(let [x 5] ((macro [y] '(+ ~y ~x)) 3))")).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: '+' },
          { kind: 'number', value: 3 },
          { kind: 'atom', value: 'x' }
        ]
      }
    })
  })

  test('Macro with multiple levels of nesting', () => {
    expect(parseAndExpand("((macro [x] '(+ ~((macro [y] '(+ ~y ~x)) 3) ~x)) 5)")).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: '+' },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: '+' },
              { kind: 'number', value: 3 },
              { kind: 'number', value: 5 }
            ]
          },
          { kind: 'number', value: 5 }
        ]
      }
    })
  })
})

test('Quote/unquote edge cases', () => {
  test('Nested quotes', () => {
    expect(parseAndExpand("''(+ 1 2)")).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: 'quote' },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: '+' },
              { kind: 'number', value: 1 },
              { kind: 'number', value: 2 }
            ]
          }
        ]
      }
    })
  })

  test('Unquote in non-evaluating context', () => {
    expect(parseAndExpand("'(~5)")).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'number', value: 5 }
        ]
      }
    })
  })
})

test('verifyNoMacros function', () => {
  test('Detects macro definitions', () => {
    const ast = parseToAST('(macro [x] x)')
    if ('error' in ast) {
      throw new Error('Failed to parse AST')
    }
    expect(() => verifyNoMacros(ast.result)).toThrow('Unexpected macro')
  })

  test('Detects quote expressions', () => {
    const ast = parseToAST("'(+ 1 2)")
    if ('error' in ast) {
      throw new Error('Failed to parse AST')
    }
    expect(() => verifyNoMacros(ast.result)).toThrow('Unexpected quote')
  })
})

test('Macro expansion with different expression types', () => {
  test('Macro with vector arguments', () => {
    expect(parseAndExpand('((macro [x] ~[x x]) 5)')).toEqual({
      result: {
        kind: 'vector',
        value: [
          { kind: 'number', value: 5 },
          { kind: 'number', value: 5 }
        ]
      }
    })
  })

  test('Macro with map arguments', () => {
    expect(parseAndExpand('((macro [x] ~{:a x :b x}) 5)')).toEqual({
      result: {
        kind: 'map',
        value: [
          { kind: 'atom', value: 'a' },
          { kind: 'number', value: 5 },
          { kind: 'atom', value: 'b' },
          { kind: 'number', value: 5 }
        ]
      }
    })
  })
})

test('Macro expansion with function definitions', () => {
  test('Macro with fn definition', () => {
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

  test('Macro with nested fn definitions', () => {
    expect(parseAndExpand('((macro [x] ~(fn [y] (fn [z] (+ x y z)))) 5)')).toEqual({
      result: {
        kind: 'function',
        env: [],
        arguments: ['y'],
        body: {
          kind: 'list',
          value: [
            { kind: 'atom', value: 'fn' },
            { kind: 'vector', value: [{ kind: 'atom', value: 'z' }] },
            {
              kind: 'list',
              value: [
                { kind: 'atom', value: '+' },
                { kind: 'number', value: 5 },
                { kind: 'atom', value: 'y' },
                { kind: 'atom', value: 'z' }
              ]
            }
          ]
        }
      }
    })
  })
})

test('Macro expansion with let expressions', () => {
  test('Macro with let binding', () => {
    expect(parseAndExpand('((macro [x] ~(let [y x] (+ y 1))) 5)')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: 'let' },
          {
            kind: 'vector',
            value: [
              { kind: 'atom', value: 'y' },
              { kind: 'number', value: 5 }
            ]
          },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: '+' },
              { kind: 'atom', value: 'y' },
              { kind: 'number', value: 1 }
            ]
          }
        ]
      }
    })
  })

  test('Macro with multiple let bindings', () => {
    expect(parseAndExpand('((macro [x] ~(let [y x z (+ y 1)] (+ z 1))) 5)')).toEqual({
      result: {
        kind: 'list',
        value: [
          { kind: 'atom', value: 'let' },
          {
            kind: 'vector',
            value: [
              { kind: 'atom', value: 'y' },
              { kind: 'number', value: 5 },
              { kind: 'atom', value: 'z' },
              {
                kind: 'list',
                value: [
                  { kind: 'atom', value: '+' },
                  { kind: 'atom', value: 'y' },
                  { kind: 'number', value: 1 }
                ]
              }
            ]
          },
          {
            kind: 'list',
            value: [
              { kind: 'atom', value: '+' },
              { kind: 'atom', value: 'z' },
              { kind: 'number', value: 1 }
            ]
          }
        ]
      }
    })
  })
})

test('Macro expansion with if expressions', () => {
  test('Macro with if condition', () => {
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

  test('Macro with nested if expressions', () => {
    expect(parseAndExpand('((macro [x] ~(if (> x 0) (if (< x 10) x 10) 0)) 5)')).toEqual({
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
              { kind: 'atom', value: 'if' },
              {
                kind: 'list',
                value: [
                  { kind: 'atom', value: '<' },
                  { kind: 'number', value: 5 },
                  { kind: 'number', value: 10 }
                ]
              },
              { kind: 'number', value: 5 },
              { kind: 'number', value: 10 }
            ]
          },
          { kind: 'number', value: 0 }
        ]
      }
    })
  })
})

test('Macro expansion with error cases', () => {
  test('Macro with wrong number of arguments', () => {
    expect(parseAndExpand('((macro [x y] ~(+ x y)) 5)')).toEqual({
      error: 'Expected 2 arguments, got 1'
    })
  })

  test('Macro with non-callable expression', () => {
    expect(parseAndExpand('(5 3)')).toEqual({
      error: 'Expression not callable'
    })
  })

  test('Macro with invalid let binding', () => {
    expect(parseAndExpand('(let [(+ 1 2) 3] 4)')).toEqual({
      error: 'Expected atom got list'
    })
  })
})

test('Macro expansion with intrinsic functions', () => {
  test('Macro with arithmetic intrinsics', () => {
    expect(parseAndExpand('((macro [x] ~(+ x 1)) 5)', true)).toEqual({
      result: { kind: 'number', value: 6 }
    })
  })

  test('Macro with comparison intrinsics', () => {
    expect(parseAndExpand('((macro [x] ~(> x 0)) 5)', true)).toEqual({
      result: { kind: 'atom', value: 'true' }
    })
  })

  test('Macro with string intrinsics', () => {
    expect(parseAndExpand('((macro [x] ~(str x "!")) "hello")', true)).toEqual({
      result: { kind: 'string', value: 'hello!' }
    })
  })
})

test('Macro expansion with environment handling', () => {
  test('Macro preserving environment', () => {
    expect(parseAndExpand('(let [x 5] ((macro [y] ~(+ x y)) 3))', true)).toEqual({
      result: { kind: 'number', value: 8 }
    })
  })

  test('Macro with nested environments', () => {
    expect(parseAndExpand('(let [x 5] (let [y 3] ((macro [z] ~(+ x y z)) 2)))', true)).toEqual({
      result: { kind: 'number', value: 10 }
    })
  })

  test('Macro with shadowed bindings', () => {
    expect(parseAndExpand('(let [x 5] ((macro [x] ~(+ x x)) 3))', true)).toEqual({
      result: { kind: 'number', value: 6 }
    })
  })
})

test('Macro expansion with more error cases', () => {
  test('Macro with incomplete if expression', () => {
    expect(parseAndExpand('(if true 1)', true)).toEqual({
      error: 'If takes 3 arguments, got 2'
    })
  })

  test('Macro with non-boolean if condition', () => {
    expect(parseAndExpand('(if 42 1 2)', true)).toEqual({
      error: 'Expected true or false, got number'
    })
  })

  test('Macro with incomplete let binding', () => {
    expect(parseAndExpand('(let [x] 1)')).toEqual({
      error: 'Incomplete let binding'
    })
  })

  test('Macro with odd number of let bindings', () => {
    expect(parseAndExpand('(let [x 1 y] 1)')).toEqual({
      error: 'Incomplete let binding'
    })
  })

  test('Macro with non-vector let bindings', () => {
    expect(parseAndExpand('(let (x 1) 1)')).toEqual({
      error: 'Expected vector as first let argument, got list'
    })
  })
})

test('Macro expansion with different expression evaluations', () => {
  test('Evaluating atoms', () => {
    expect(parseAndExpand('((macro [x] x) true)', true)).toEqual({
      result: { kind: 'atom', value: 'true' }
    })
  })

  test('Evaluating numbers', () => {
    expect(parseAndExpand('((macro [x] ~(+ x x)) 5)', true)).toEqual({
      result: { kind: 'number', value: 10 }
    })
  })

  test('Evaluating strings', () => {
    expect(parseAndExpand('((macro [x] ~(str x x)) "hello")', true)).toEqual({
      result: { kind: 'string', value: 'hellohello' }
    })
  })

  test('Evaluating lists', () => {
    expect(parseAndExpand('((macro [x] ~[~x ~x]) 5)', true)).toEqual({
      result: {
        kind: 'vector',
        value: [
          { kind: 'number', value: 5 },
          { kind: 'number', value: 5 }
        ]
      }
    })
  })
})

test('Complex macro expansion scenarios with evaluation', () => {
  test('Nested macro definitions with evaluation', () => {
    expect(parseAndExpand(`
      (let [add1 (macro [x] ~(+ x 1))
            add2 (macro [x] ~(add1 (add1 x)))]
        (add2 5))`, true)).toEqual({
      result: { kind: 'number', value: 7 }
    })
  })

  test('Macro with multiple environment layers', () => {
    expect(parseAndExpand(`
      (let [x 1]
        (let [y 2]
          (let [z 3]
            ((macro [a] ~(+ x (+ y (+ z a)))) 4))))`, true)).toEqual({
      result: { kind: 'number', value: 10 }
    })
  })

  test('Macro with shadowed bindings in multiple scopes', () => {
    expect(parseAndExpand(`
      (let [x 1]
        (let [x 2]
          ((macro [x] ~(+ x x)) 3)))`, true)).toEqual({
      result: { kind: 'number', value: 6 }
    })
  })
})

test('Intrinsic function evaluation in macros', () => {
  test('Arithmetic operations with evaluation', () => {
    expect(parseAndExpand(`
      ((macro [x y]
        ~(+ (* x 2) (- y 1))) 5 3)`, true)).toEqual({
      result: { kind: 'number', value: 12 }
    })
  })

  test('String operations with evaluation', () => {
    expect(parseAndExpand(`
      ((macro [x y]
        ~(str x "-" y)) "hello" "world")`, true)).toEqual({
      result: { kind: 'string', value: 'hello-world' }
    })
  })

  test('Comparison operations with evaluation', () => {
    expect(parseAndExpand(`
      ((macro [x y]
        ~(if (> x y) x y)) 5 3)`, true)).toEqual({
      result: { kind: 'number', value: 5 }
    })
  })
})

test('Error propagation in nested expressions', () => {
  test('Error in nested function call', () => {
    expect(parseAndExpand(`
      ((macro [x]
        ~(+ (undefined-fn x) 1)) 5)`, true)).toEqual({
      error: 'Expression not callable'
    })
  })

  test('Error in nested let binding', () => {
    expect(parseAndExpand(`
      (let [x ((macro [y] ~(undefined-fn y)) 5)] x)`, true)).toEqual({
      error: 'Expression not callable'
    })
  })

  test('Error in nested if condition', () => {
    expect(parseAndExpand(`
      (if ((macro [x] ~(+ x 1)) true) 1 2)`, true)).toEqual({
      error: 'Expected true or false, got number'
    })
  })
})

test('Edge cases in macro expansion', () => {
  test('Empty list expansion', () => {
    expect(parseAndExpand('((macro [x] ~()) 5)')).toEqual({
      result: { kind: 'list', value: [] }
    })
  })

  test('Macro returning another macro', () => {
    expect(parseAndExpand(`
      ((macro [x]
        ~(macro [y] ~(+ x y))) 5)`)).toEqual({
      result: {
        kind: 'macro',
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

  test('Macro with empty vector', () => {
    expect(parseAndExpand('((macro [x] ~[]) 5)')).toEqual({
      result: { kind: 'vector', value: [] }
    })
  })

  test('Macro with empty map', () => {
    expect(parseAndExpand('((macro [x] ~{}) 5)')).toEqual({
      result: { kind: 'map', value: [] }
    })
  })
})
