import sportingCodeHtml from '../../content/gt-sporting-code.html?raw'
import { SportingCode } from './SportingCode'

export function GtSportingCode() {
  return <SportingCode league="gt" defaultHtml={sportingCodeHtml} />
}
