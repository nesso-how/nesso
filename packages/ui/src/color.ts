const colorLuminance = (hex: string): number => {
  const channels = hex.slice(1).match(/.{2}/g)!.map((value) => parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

export const contrastColor = (hex: string): string => {
  const lightness = colorLuminance(hex)
  if ((lightness + 0.05) / (colorLuminance('#292929') + 0.05) >= 4.5) return '#292929'
  if (1.05 / (lightness + 0.05) >= 4.5) return '#ffffff'
  return '#000000'
}

export type Hsv = { h: number; s: number; v: number }

export const hexToHsv = (hex: string, previousHue: number): Hsv => {
  const [red, green, blue] = hex.slice(1).match(/.{2}/g)!.map((value) => parseInt(value, 16) / 255)
  const max = Math.max(red, green, blue)
  const delta = max - Math.min(red, green, blue)
  let hue = previousHue
  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta + 6) % 6)
    else if (max === green) hue = 60 * ((blue - red) / delta + 2)
    else hue = 60 * ((red - green) / delta + 4)
  }
  return { h: hue, s: max ? delta / max : 0, v: max }
}

export const hsvToHex = ({ h, s, v }: Hsv): string => {
  const channel = (offset: number) => {
    const position = (offset + h / 60) % 6
    const value = v - v * s * Math.max(0, Math.min(position, 4 - position, 1))
    return Math.round(value * 255).toString(16).padStart(2, '0')
  }
  return `#${channel(5)}${channel(3)}${channel(1)}`
}

export const presetColors = [
  { key: 'presetWhite', value: '#ffffff' },
  { key: 'presetSand', value: '#f3ead5' },
  { key: 'presetPeach', value: '#f5e3d5' },
  { key: 'presetRose', value: '#f5dfe2' },
  { key: 'presetSage', value: '#e1ecde' },
  { key: 'presetMint', value: '#dceee8' },
  { key: 'presetSky', value: '#dfeaf5' },
  { key: 'presetLavender', value: '#e9e2f3' },
] as const
