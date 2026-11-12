import { createTranslator } from '@nesso-how/i18n'
import en from './en.json'
import it from './it.json'
import zhCN from './zh-CN.json'

export const translate = createTranslator(en, { it, 'zh-CN': zhCN })
