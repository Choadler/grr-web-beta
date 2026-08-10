import sportingCodeHtml from '../../content/cup-sporting-code.html?raw'
import { SportingCode } from './SportingCode'

export function CupSportingCode() {
  return <SportingCode league="cup" defaultHtml={sportingCodeHtml} />
}
