import React, { useMemo } from "react";
import { View, Platform } from "react-native";
import qrGen from "qrcode-generator";

interface Props {
  value: string;
  size?: number;
  backgroundColor?: string;
  foregroundColor?: string;
  logoColor?: string;
}

function generateMatrix(value: string): boolean[][] {
  const qr = qrGen(0, "M");
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const matrix: boolean[][] = [];
  for (let r = 0; r < count; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < count; c++) {
      row.push(qr.isDark(r, c));
    }
    matrix.push(row);
  }
  return matrix;
}

export function QRCodeView({
  value,
  size = 220,
  backgroundColor = "#ffffff",
  foregroundColor = "#0a0a0d",
  logoColor = "#ff5ca8",
}: Props) {
  const matrix = useMemo(() => generateMatrix(value || "placeholder"), [value]);
  const count = matrix.length;
  const cell = size / count;
  const logoSize = Math.floor(size * 0.22);

  if (Platform.OS === "web") {
    let rects = "";
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (matrix[r][c]) {
          rects += `<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="${foregroundColor}"/>`;
        }
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="background:${backgroundColor};border-radius:12px"><rect width="${size}" height="${size}" fill="${backgroundColor}"/>${rects}<rect x="${(size - logoSize) / 2}" y="${(size - logoSize) / 2}" width="${logoSize}" height="${logoSize}" rx="8" fill="${backgroundColor}"/><rect x="${(size - logoSize * 0.7) / 2}" y="${(size - logoSize * 0.7) / 2}" width="${logoSize * 0.7}" height="${logoSize * 0.7}" rx="6" fill="${logoColor}"/></svg>`;
    return (
      <View
        style={{ width: size, height: size }}
        // @ts-expect-error - web-only prop
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor,
        borderRadius: 12,
      }}
    >
      {matrix.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", height: cell }}>
          {row.map((isDark, c) => (
            <View
              key={c}
              style={{
                width: cell,
                height: cell,
                backgroundColor: isDark ? foregroundColor : backgroundColor,
              }}
            />
          ))}
        </View>
      ))}
      <View
        style={{
          position: "absolute",
          left: (size - logoSize) / 2,
          top: (size - logoSize) / 2,
          width: logoSize,
          height: logoSize,
          borderRadius: 8,
          backgroundColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: logoSize * 0.7,
            height: logoSize * 0.7,
            borderRadius: 6,
            backgroundColor: logoColor,
          }}
        />
      </View>
    </View>
  );
}

export default QRCodeView;
