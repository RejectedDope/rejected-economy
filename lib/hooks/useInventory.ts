"use client";

import { useState, useEffect, useReducer } from "react";
import { scoreAll } from "@/lib/scoring";
import type { ScoredItem, InventoryItem } from "@/lib/types";
import { MOCK_ITEMS } from "@/lib/mock-data";
import { supabaseConfigured } from "@/lib/env";

type FetchResult =
  | { authenticated: false; demo: boolean }  // demo=true → show mock, demo=false → show empty error
  | { authenticated: true; items: InventoryItem[] };

async function fetchInventoryClient(): Promise<FetchResult> {
  // If Supabase isn't configured, this is a demo environment — show mock data
  if (!supabaseConfigured) return { authenticated: false, demo: true };

  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    // Not logged in → demo mode for visitors
    if (!user) return { authenticated: false, demo: true };

    const { fetchUserInventory } = await import("@/app/actions/inventory");
    const result = await fetchUserInventory("active", 500);
    return { authenticated: true, items: result.items ?? [] };
  } catch {
    // Supabase IS configured but request failed — don't leak mock data
    return { authenticated: false, demo: false };
  }
}

type State = {
  items: ScoredItem[];
  loading: boolean;
  error: string | null;
  isRealData: boolean;
  isAuthenticated: boolean;
};

type Action =
  | { type: "loaded"; items: ScoredItem[]; isRealData: boolean; isAuthenticated: boolean }
  | { type: "error"; error: string };

function reducer(state: State, action: Action): State {
  if (action.type === "loaded") {
    return { ...state, items: action.items, loading: false, isRealData: action.isRealData, isAuthenticated: action.isAuthenticated, error: null };
  }
  return { ...state, loading: false, error: action.error };
}

export interface UseInventoryState {
  items: ScoredItem[];
  loading: boolean;
  error: string | null;
  isRealData: boolean;
  isAuthenticated: boolean;
  refresh: () => void;
}

export function useInventory(): UseInventoryState {
  const [state, dispatch] = useReducer(reducer, {
    // Start with empty items — never flash mock data during loading
    items: [],
    loading: true,
    error: null,
    isRealData: false,
    isAuthenticated: false,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchInventoryClient().then((result) => {
      if (cancelled) return;
      if (!result.authenticated) {
        // demo=true → visitor without account, show demo data
        // demo=false → Supabase configured but auth failed, show nothing
        const items = result.demo ? scoreAll(MOCK_ITEMS) : [];
        dispatch({ type: "loaded", items, isRealData: false, isAuthenticated: false });
        return;
      }
      dispatch({
        type: "loaded",
        items: result.items.length > 0 ? scoreAll(result.items) : [],
        isRealData: true,
        isAuthenticated: true,
      });
    }).catch((err: unknown) => {
      if (cancelled) return;
      dispatch({ type: "error", error: String(err) });
    });

    return () => { cancelled = true; };
  }, [tick]);

  return { ...state, refresh: () => setTick((t) => t + 1) };
}
