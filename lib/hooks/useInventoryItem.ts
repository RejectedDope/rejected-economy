"use client";

import { useReducer, useEffect } from "react";
import { scoreItem } from "@/lib/scoring";
import { MOCK_ITEMS } from "@/lib/mock-data";
import type { ScoredItem } from "@/lib/types";

type State = { item: ScoredItem | null; loading: boolean; isRealData: boolean };
type Action = { type: "loaded"; item: ScoredItem | null; isRealData: boolean };

function reducer(state: State, action: Action): State {
  return { item: action.item, loading: false, isRealData: action.isRealData };
}

export function useInventoryItem(id: string) {
  const mockFallback = MOCK_ITEMS.find((i) => i.id === id);

  const [state, dispatch] = useReducer(reducer, {
    item: mockFallback ? scoreItem(mockFallback) : null,
    loading: true,
    isRealData: false,
  });

  useEffect(() => {
    let cancelled = false;

    import("@/app/actions/inventory")
      .then(({ fetchInventoryItemById }) => fetchInventoryItemById(id))
      .then((result) => {
        if (cancelled) return;
        if (result.item) {
          dispatch({ type: "loaded", item: scoreItem(result.item), isRealData: true });
        } else {
          const mock = MOCK_ITEMS.find((i) => i.id === id);
          dispatch({ type: "loaded", item: mock ? scoreItem(mock) : null, isRealData: false });
        }
      })
      .catch(() => {
        if (cancelled) return;
        const mock = MOCK_ITEMS.find((i) => i.id === id);
        dispatch({ type: "loaded", item: mock ? scoreItem(mock) : null, isRealData: false });
      });

    return () => { cancelled = true; };
  }, [id]);

  return state;
}
