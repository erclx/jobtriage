import {
  ogCardAlt,
  ogCardContentType,
  ogCardSize,
  renderOgCard,
} from './og-card'

export const alt = ogCardAlt
export const size = ogCardSize
export const contentType = ogCardContentType

export default function Image() {
  return renderOgCard()
}
