import { parseToAST } from './parsing.ts'
import { evaluateExpression } from './evaluation.ts'
import { intrinsics } from './intrinsics.ts'

const args = process.argv.slice(2)
const options: Record<string, string | boolean> = {}
let currentOption = ''

for (const arg of args) {
  if (arg.startsWith('--')) {
    currentOption = arg.slice(2)
    options[currentOption] = true
  } else if (arg.startsWith('-')) {
    currentOption = arg.slice(1)
    options[currentOption] = true
  } else if (currentOption) {
    options[currentOption] = arg
    currentOption = ''
  }
}

if (options.input) {
  const fileContents = await Bun.file(options.input as string).text()
  const parsedAst = parseToAST(fileContents)
  if (options.parserOutput) {
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
