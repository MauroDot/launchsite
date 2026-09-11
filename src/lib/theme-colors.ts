const fallback = "#0f172a";

function rgb(hex: string) {
  const value = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
  return [1, 3, 5].map((start) => Number.parseInt(value.slice(start, start + 2), 16) / 255);
}

function luminance(hex: string) {
  return rgb(hex).map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

export function contrastRatio(foreground: string, background: string) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

export function readableForeground(background: string, preferred: string, autoContrast: boolean) {
  if (!autoContrast || contrastRatio(preferred, background) >= 4.5) return preferred;
  return contrastRatio("#ffffff", background) >= contrastRatio("#111827", background) ? "#ffffff" : "#111827";
}

export function borderColor(background: string) {
  return contrastRatio("#111827", background) > contrastRatio("#ffffff", background) ? "#d1d5db" : "#4b5563";
}
