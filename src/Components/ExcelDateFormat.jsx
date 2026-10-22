// "Dates in Excel": how First seen and Last seen look in the guest list
// download. They stay real dates in Excel (so sorting and filters work),
// only the way they're shown changes. The choice is kept in this browser.
import { useState } from "react";
import { CalendarDays } from "lucide-react";

// numFmt: Excel's own format code for the column
export const DATE_FORMATS = [
  { id: "dmy24", label: "21/10/2026 14:30", numFmt: "dd/mm/yyyy hh:mm" },
  { id: "dmy12", label: "21/10/2026 2:30 PM", numFmt: "dd/mm/yyyy h:mm AM/PM" },
  { id: "dmy", label: "21/10/2026 (date only)", numFmt: "dd/mm/yyyy" },
  { id: "mdy12", label: "10/21/2026 2:30 PM (US)", numFmt: "mm/dd/yyyy h:mm AM/PM" },
  { id: "iso", label: "2026-10-21 14:30", numFmt: "yyyy-mm-dd hh:mm" },
  { id: "words", label: "21 Oct 2026 2:30 PM", numFmt: "d mmm yyyy h:mm AM/PM" },
];

const KEY = "foyer-excel-dates";

const saved = () => {
  try {
    return DATE_FORMATS.find((f) => f.id === localStorage.getItem(KEY)) ?? DATE_FORMATS[0];
  } catch {
    return DATE_FORMATS[0];
  }
};

// [the chosen format, change it]
export function useExcelDateFormat() {
  const [format, setFormat] = useState(saved);
  function choose(id) {
    const next = DATE_FORMATS.find((f) => f.id === id) ?? DATE_FORMATS[0];
    setFormat(next);
    try {
      localStorage.setItem(KEY, next.id);
    } catch {
      // Not kept in this browser; still used for this download
    }
  }
  return [format, choose];
}

export default function ExcelDateFormat({ value, onChange }) {
  return (
    <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white pr-1 pl-3 text-[13px] text-muted sm:h-9">
      <CalendarDays size={15} className="shrink-0" />
      <span className="whitespace-nowrap">Dates in Excel</span>
      <select
        value={value.id}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-0 cursor-pointer rounded-md bg-transparent pr-1 text-base font-medium text-ink outline-none sm:h-7 sm:text-[13px]"
      >
        {DATE_FORMATS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
    </label>
  );
}
