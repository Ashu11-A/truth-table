import { Analyzer } from '../class/Analyzer.js'
import { ErrorType } from '../lib/error.js'
import { Node } from './analyzer.js'
import { Tokenizer } from './tokenizer.js'

export type MethodRunner = {
  ast: Analyzer<string>,
  tokens: Tokenizer[],
  index: number
}

export type MethodTypes<Type> = {
  name: Type
  run: ({ ast, tokens, index }: MethodRunner) => Node | ErrorType
}

export type MethodProps<ASType extends Node['type']> = MethodTypes<ASType>