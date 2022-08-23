import { parseToAST } from './parsing.ts'
import { parse } from 'flags'
import { evaluateExpression } from './evaluation.ts'
import { intrinsics } from './intrinsics.ts'

const args = parse(Deno.args, {
  string: ['i', 'o'],
  boolean: ['c', 'm', 'p'],
  alias: { i: 'input', o: 'output', c: 'compile', m: 'macros', p: 'parserOutput' },
})

if (args.input) {
  const fileContents = await Deno.readTextFile(args.input)
  const parsedAst = parseToAST(fileContents)
  if (args.parserOutput) {
    console.dir(parsedAst)
  }
  if ('error' in parsedAst) {
    console.error(`Failed to parse: ${parsedAst.error}`)
  } else {
    const evalAst = evaluateExpression(parsedAst.result, intrinsics)
    if ('error' in evalAst) {
      console.error(`Failed to evaluate: ${evalAst.error}`)
    } else {
      console.log(evalAst)
    }
  }
}
