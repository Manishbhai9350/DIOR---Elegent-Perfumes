interface Color {
  r: number;
  g: number;
  b: number;
}

export const MultiplyColor = ({ r, g, b }: Color, factor: number) => {
  return { r: r * factor, g: g * factor, b: b * factor };
};
