import { useEffect, useState } from "react";

import { IS_ADMOB_QA_TEST_MODE } from "@/lib/env";
import { recordAdActiveDate } from "@/lib/adGracePeriod";

export function useAdGracePeriod(input: {
  isLoading: boolean;
  hasExistingData: boolean;
  localDate: string;
}): boolean {
  const [complete, setComplete] = useState(IS_ADMOB_QA_TEST_MODE);

  useEffect(() => {
    if (IS_ADMOB_QA_TEST_MODE) {
      setComplete(true);
      return;
    }
    if (input.isLoading) {
      setComplete(false);
      return;
    }
    setComplete(recordAdActiveDate({
      localDate: input.localDate,
      hasExistingData: input.hasExistingData,
    }));
  }, [input.hasExistingData, input.isLoading, input.localDate]);

  return complete;
}
