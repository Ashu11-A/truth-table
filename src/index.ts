import'./methods/operation.js'
import'./methods/proposition.js'
import'./methods/subExpression.js'
import './cli.js'

export * from './class/index.js'
export * from './types/index.js'
export * from './lib/index.js'

export const lettersAllowed = 'abcdefghijklmnopqrsuwxyz'.split('')

export const negationExpressions = ['¬', '~']
export const conjunctionExpressions = ['^', '∧']
export const disjunctionExpressions = ['∨', '˅', 'v']
export const conditionalExpressions = ['→', '->']
export const biconditionalExpressions = ['↔', '<>', '<->']
export const xorExpressions = ['⊕']
export const subExpressions = ['(', ')']

export const operationsAllowed = [negationExpressions, conjunctionExpressions, disjunctionExpressions, conditionalExpressions, biconditionalExpressions, xorExpressions].flat()