import { expect, test } from 'bun:test'
import { ASTParsingError, parseToAST } from './parsing.ts'
import { expandMacros, MacroExpansionError, verifyNoMacros } from './macros.ts'
import { intrinsics } from './intrinsics.ts'
import { evaluateExpression, EvaluationError } from './evaluation.ts'
import { EvalAST } from './types.ts'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

test('samples', async () => {
  const samples = await getSamples()

  for (const sample of samples) {
    test(sample.filename, () => {
      const result = testSample(sample)
      expect(result).toEqual(sample.expected)
    })
  }
})

function testSample({ source, expected }: { filename: string; source: string; expected: EvalAST }): EvalAST {
  const parsedAst = parseToAST(source)
  expect('result' in parsedAst).toBe(true)
  if (!('result' in parsedAst)) {
    throw new Error(JSON.stringify((parsedAst as ASTParsingError).error))
  }
  const macroExpandedAst = expandMacros(parsedAst.result, intrinsics)
  expect('result' in macroExpandedAst).toBe(true)
  if (!('result' in macroExpandedAst)) {
    throw new Error(JSON.stringify((macroExpandedAst as MacroExpansionError).error))
  }
  const evaledAst = evaluateExpression(verifyNoMacros(macroExpandedAst.result), intrinsics)
  expect('result' in evaledAst).toBe(true)
  if (!('result' in evaledAst)) {
    throw new Error(JSON.stringify((evaledAst as EvaluationError).error))
  }
  return evaledAst.result
}

async function getSamples(): Promise<{ filename: string; source: string; expected: EvalAST }[]> {
  const samplesDir = join(__dirname, 'samples')
  const results: { filename: string; source: string; expected: EvalAST }[] = []
  
  for (const file of readdirSync(samplesDir)) {
    const content = await Bun.file(join(samplesDir, file)).text()
    const [expectedComment, ...sourceLines] = content.split('\n')
    const headerRE = /;[ ]*expected (.*)/
    const match = expectedComment.match(headerRE)
    if (!match || !match[1]) {
      throw new Error(`Invalid expected header in file samples/${file}`)
    }
    const expected = match[1]
    results.push({ filename: file, source: sourceLines.join('\n'), expected: JSON.parse(expected) })
  }
  return results
}
