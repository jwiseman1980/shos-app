"use client";

import { useRouter, useSearchParams } from "next/navigation";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function MonthPicker({ month, year, basePath }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (newMonth, newYear) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", newMonth);
    params.set("year", newYear);
    router.push(`${basePath}?${params.toString()}`);
  };

  const handlePrev = () => {
    if (month === 1) handleChange(12, year - 1);
    else handleChange(month - 1, year);
  };

  const handleNext = () => {
    if (month === 12) handleChange(1, year + 1);
    else handleChange(month + 1, year);
  };

  return (
    <div className="month-picker">
      <button className="month-picker-btn" onClick={handlePrev} title="Previous month">
        &#8592;
      </button>
      <div className="month-picker-label">
        {MONTHS[month - 1]} {year}
      </div>
      <button className="month-picker-btn" onClick={handleNext} title="Next month">
        &#8594;
      </button>
    </div>
  );
}
