import { assert, assertObjectMatch } from 'https://deno.land/std@0.151.0/testing/asserts.ts'
import { ASTParsingError, parseToAST } from './parsing.ts'
import { expandMacros, MacroExpansionError, verifyNoMacros } from './macros.ts'
import { intrinsics } from './intrinsics.ts'
import { evaluateExpression, EvaluationError } from './evaluation.ts'
import { EvalAST } from './types.ts'

Deno.test('samples', async (t) => {
  const samples = await getSamples()

  await Promise.all(samples.map((s) => t.step(s.filename, () => testSample(s))))
})

function testSample({ source, expected }: { filename: string; source: string; expected: EvalAST }): void {
  const parsedAst = parseToAST(source)
  assert('result' in parsedAst, JSON.stringify((parsedAst as ASTParsingError).error))
  const macroExpandedAst = expandMacros(parsedAst.result, intrinsics)
  assert('result' in macroExpandedAst, JSON.stringify((macroExpandedAst as MacroExpansionError).error))
  const evaledAst = evaluateExpression(verifyNoMacros(macroExpandedAst.result), intrinsics)
  assert('result' in evaledAst, JSON.stringify((evaledAst as EvaluationError).error))
  assertObjectMatch(evaledAst.result, expected)
}

async function getSamples(): Promise<{ filename: string; source: string; expected: EvalAST }[]> {
  const fileList = Deno.readDir('./samples')
  const results = []
  for await (const file of fileList) {
    const content = await Deno.readTextFile(`samples/${file.name}`)
    const [expectedComment, ...sourceLines] = content.split('\n')
    const headerRE = /;[ ]*expected (.*)/
    const match = expectedComment.match(headerRE)
    if (!match || !match[1]) {
      throw new Error(`Invalid expected header in file samples/${file.name}`)
    }
    const expected = match[1]
    results.push({ filename: file.name, source: sourceLines.join('\n'), expected: JSON.parse(expected) })
  }
  return results
}
