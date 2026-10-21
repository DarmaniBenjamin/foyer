// The shared data (DataProvider.jsx) is read in any page or component
// with: const { sites, currentSite, ... } = useData();
import { createContext, useContext } from "react";

export const DataContext = createContext(null);

export default function useData() {
  return useContext(DataContext);
}