import { assert, assertObjectMatch } from 'https://deno.land/std@0.151.0/testing/asserts.ts'
import { parseToAST } from './parsing.ts'
import { expandMacros } from './macros.ts'
import { intrinsics } from './intrinsics.ts'
import { evaluateExpression } from './evaluation.ts'
import { EvalAST } from './types.ts'

Deno.test('samples', async (t) => {
  const samples = await getSamples()

  await Promise.all(samples.map((s) => t.step(s.filename, () => testSample(s))))
})

function testSample({ source, expected }: { filename: string; source: string; expected: any }): void {
  const parsedAst = parseToAST(source)
  assert('result' in parsedAst, JSON.stringify((parsedAst as any).error))
  const macroExpandedAst = parsedAst
  // TODO enable macros after let implementation
  //   const macroExpandedAst = expandMacros(parsedAst.result, intrinsics)
  //   assert('result' in macroExpandedAst, JSON.stringify((macroExpandedAst as any).error))
  const evaledAst = evaluateExpression(macroExpandedAst.result as EvalAST, intrinsics)
  assert('result' in evaledAst, JSON.stringify((evaledAst as any).error))
  assertObjectMatch(evaledAst.result, expected)
}

async function getSamples(): Promise<{ filename: string; source: string; expected: any }[]> {
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
