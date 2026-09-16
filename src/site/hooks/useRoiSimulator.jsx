import { useMemo, useState } from "react";
import { computeRoi } from "../utils/roiCalculator";

const DEFAULT_BASKET = 28;
const DEFAULT_MISSED = 12;

export function useRoiSimulator() {
  const [averageBasket, setAverageBasket] = useState(DEFAULT_BASKET);
  const [missedCallsPerWeek, setMissedCallsPerWeek] = useState(DEFAULT_MISSED);

  const result = useMemo(
    () => computeRoi(averageBasket, missedCallsPerWeek),
    [averageBasket, missedCallsPerWeek]
  );

  return {
    averageBasket,
    missedCallsPerWeek,
    setAverageBasket,
    setMissedCallsPerWeek,
    result,
  };
}
