import { assertObjectMatch } from 'https://deno.land/std@0.151.0/testing/asserts.ts'
import { parseModule, ParseModuleError, ParseModuleResult } from './modules.ts'
import { ASTParsingError, parseFile } from './parsing.ts'
import { ParserAST } from './types.ts'

Deno.test('Executable modules', async (t) => {
  await t.step('supports modules without header parsing', () => {
    assertObjectMatch(parse('(+ 1 2)'), { result: { isExecutable: true, imports: [] } })
  })
  await t.step('supports executable modules parsing', () => {
    assertObjectMatch(parse('(executable ["module.clsk" unqualified]) (+ 1 2)'), {
      result: { isExecutable: true, imports: [{ url: 'module.clsk', kind: 'unqualified' }] },
    })
    assertObjectMatch(parse('(executable ["module.clsk" as module]) (+ 1 2)'), {
      result: { isExecutable: true, imports: [{ url: 'module.clsk', kind: 'qualified', name: 'module' }] },
    })
    assertObjectMatch(parse('(executable ["module.clsk" unqualified [f1 f2]]) (+ 1 2)'), {
      result: {
        isExecutable: true,
        imports: [{ url: 'module.clsk', kind: 'unqualifiedAllowlist', bindings: [{ name: 'f1' }, { name: 'f2' }] }],
      },
    })
  })
})

Deno.test('Importable modules', async (t) => {
  await t.step('supports importable modules parsing', () => {
    assertObjectMatch(parse('(module [f1] ["module.clsk" unqualified]) [f1 (+ 1 2)] [f2 (- 2 1)]'), {
      result: {
        isExecutable: false,
        definitions: [
          { name: 'f1', isPublic: true },
          { name: 'f2', isPublic: false },
        ],
        imports: [{ url: 'module.clsk', kind: 'unqualified' }],
      },
    })
    assertObjectMatch(parse('(module [] ["module.clsk" as module]) [f1 (+ 1 2)] [f2 (- 2 1)]'), {
      result: { isExecutable: false, imports: [{ url: 'module.clsk', kind: 'qualified', name: 'module' }] },
    })
    assertObjectMatch(parse('(module [] ["module.clsk" unqualified [f1 f2]]) [f1 (+ 1 2)] [f2 (- 2 1)]'), {
      result: {
        isExecutable: false,
        imports: [{ url: 'module.clsk', kind: 'unqualifiedAllowlist', bindings: [{ name: 'f1' }, { name: 'f2' }] }],
      },
    })
  })
})

function parse(source: string): ParseModuleResult | ASTParsingError | ParseModuleError {
  const parsingResults = parseFile(source)
  const maybeError = parsingResults.find((p) => 'error' in p)
  if (maybeError) {
    return maybeError as ASTParsingError
  }
  return parseModule(
    '',
    (parsingResults as { result: ParserAST }[]).map((r) => r.result)
  )
}
