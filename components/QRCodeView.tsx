import React, { useMemo } from "react";
import { View } from "react-native";
import qrGen from "qrcode-generator";

interface Props {
  value: string;
  size?: number;
  backgroundColor?: string;
  foregroundColor?: string;
}

interface QrLayout {
  cellSize: number;
  margin: number;
  moduleCount: number;
  totalSize: number;
}

function generateMatrix(value: string): boolean[][] {
  const qr = qrGen(0, "H");
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const matrix: boolean[][] = [];

  for (let row = 0; row < count; row++) {
    const nextRow: boolean[] = [];
    for (let column = 0; column < count; column++) {
      nextRow.push(qr.isDark(row, column));
    }
    matrix.push(nextRow);
  }

  return matrix;
}

function getLayout(size: number, moduleCount: number): QrLayout {
  const quietZoneModules = 4;
  const cellSize = Math.max(2, Math.floor(size / (moduleCount + quietZoneModules * 2)));
  const margin = quietZoneModules * cellSize;
  const totalSize = moduleCount * cellSize + margin * 2;

  return {
    cellSize,
    margin,
    moduleCount,
    totalSize,
  };
}

export function QRCodeView({
  value,
  size = 220,
  backgroundColor = "#ffffff",
  foregroundColor = "#0a0a0d",
}: Props) {
  const matrix = useMemo(() => generateMatrix(value || "placeholder"), [value]);
  const layout = useMemo(() => getLayout(size, matrix.length), [matrix.length, size]);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: layout.totalSize,
          height: layout.totalSize,
          backgroundColor,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: layout.margin,
            top: layout.margin,
          }}
        >
          {matrix.map((row, rowIndex) => (
            <View
              key={`row-${rowIndex}`}
              style={{ flexDirection: "row", height: layout.cellSize }}
            >
              {row.map((isDark, columnIndex) => (
                <View
                  key={`cell-${rowIndex}-${columnIndex}`}
                  style={{
                    width: layout.cellSize,
                    height: layout.cellSize,
                    backgroundColor: isDark ? foregroundColor : backgroundColor,
                  }}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export default QRCodeView;
