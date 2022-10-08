import { assertObjectMatch } from 'https://deno.land/std@0.151.0/testing/asserts.ts'
import { parseModule, ParseModuleError, ParseModuleResult } from './modules.ts'
import { ASTParsingError, parseFile } from './parsing.ts'
import { ParserAST } from './types.ts'

Deno.test('Executable modules', async (t) => {
  await t.step('supports modules without header', () => {
    assertObjectMatch(parse('(+ 1 2)'), { result: { isExecutable: true, imports: [] } })
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
