import React, { useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";

interface GridBackdropProps {
  spacing?: number;
  dotSize?: number;
  color?: string;
}

interface DotPosition {
  key: string;
  left: number;
  top: number;
}

export function GridBackdrop({
  spacing = 22,
  dotSize = 2,
  color = "rgba(255,255,255,0.06)",
}: GridBackdropProps) {
  const { width, height } = useWindowDimensions();

  const dots = useMemo(() => {
    const columns = Math.ceil(width / spacing) + 1;
    const rows = Math.ceil(height / spacing) + 2;
    const next: Array<DotPosition> = [];

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        next.push({
          key: `${row}-${column}`,
          left: column * spacing,
          top: row * spacing,
        });
      }
    }

    return next;
  }, [height, spacing, width]);

  return (
    <View pointerEvents="none" style={styles.root}>
      {dots.map((dot) => (
        <View
          key={dot.key}
          style={[
            styles.dot,
            {
              left: dot.left,
              top: dot.top,
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: color,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  dot: {
    position: "absolute",
  },
});

export default GridBackdrop;