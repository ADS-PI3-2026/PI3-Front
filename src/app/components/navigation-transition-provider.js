"use client";

import { createContext, useContext, useState } from "react";

const NavigationTransitionContext = createContext(null);

export function useNavigationTransition() {
  const context = useContext(NavigationTransitionContext);
  if (!context) throw new Error("A navegação precisa estar dentro do NavigationTransitionProvider.");
  return context;
}

export default function NavigationTransitionProvider({ children }) {
  const transitionState = useState(null);

  return (
    <NavigationTransitionContext.Provider value={transitionState}>
      {children}
    </NavigationTransitionContext.Provider>
  );
}
