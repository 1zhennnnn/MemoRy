import { createContext, useContext } from "react";

export interface ExtColors {
  bg: string;
  surf1: string;
  surf2: string;
  border: string;
  borderSub: string;
  textHi: string;
  textMid: string;
  textLo: string;
  signal: string;
  done: string;
  failed: string;
  inputBg: string;
}

export const DARK: ExtColors = {
  bg:        "#090C14",
  surf1:     "#0F1219",
  surf2:     "#161A28",
  border:    "#1A2035",
  borderSub: "#2A3555",
  textHi:    "#DFE4F0",
  textMid:   "#8A96B2",
  textLo:    "#4A5272",
  signal:    "#5B7AE0",
  done:      "#34D4A8",
  failed:    "#F05068",
  inputBg:   "#161A28",
};

export const LIGHT: ExtColors = {
  bg:        "#F0F2F8",
  surf1:     "#FFFFFF",
  surf2:     "#F5F7FA",
  border:    "#E0E4EF",
  borderSub: "#C8CEDF",
  textHi:    "#1A2035",
  textMid:   "#4A5272",
  textLo:    "#8A96B2",
  signal:    "#5B7AE0",
  done:      "#1A8C6E",
  failed:    "#D03050",
  inputBg:   "#FFFFFF",
};

export type Theme = "dark" | "light";

export const ThemeContext = createContext<{ colors: ExtColors; theme: Theme; toggle: () => void }>({
  colors: DARK,
  theme: "dark",
  toggle: () => {},
});

export function useExtTheme() {
  return useContext(ThemeContext);
}

export const DASHBOARD_URL = "https://memo-ry-azure.vercel.app";
