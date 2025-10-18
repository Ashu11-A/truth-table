import { Analyzer, isError } from './class/Analyzer.js'
import { Structure } from './class/structure.js'
import { Table } from './class/table.js'

console.time()
const input = '~(x ˅ (x ^ y ^ z) ˅ (y ^ z ^ x) ˅ (w ^ x) ˅ (w ^ x) ˅ (x ^ w))'
// const input = '~p ^ q'
const parser = new Analyzer({ input }) // Loader must be initialized at least once, before any parse interaction
const ast = parser.parse()

if (isError(ast)) throw new Error(JSON.stringify(ast, null, 2))

await parser.save('ast.json')

const structure = new Structure(parser.ast)

const table = new Table({
  structure,
  display: 'boolean',
  // type: 'csv'
})

// const content = table.csv()
// const content = table.markdown()
console.timeEnd()

await structure.save('structure.json')
table.type = 'markdown'
await table.create('table.md')

table.type = 'csv'
await table.create('table.csv')

