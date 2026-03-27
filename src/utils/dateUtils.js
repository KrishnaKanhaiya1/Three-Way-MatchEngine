export const normalizeDate = (dateStr) => {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleaned)) {
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  const monthNames = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
    apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
    aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
    nov: 10, november: 10, dec: 11, december: 11,
  };

  const mdy = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (mdy) {
    const monthIdx = monthNames[mdy[1].toLowerCase()];
    if (monthIdx !== undefined) {
      const d = new Date(Number(mdy[3]), monthIdx, Number(mdy[2]));
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  const dmy2 = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dmy2) {
    const monthIdx = monthNames[dmy2[2].toLowerCase()];
    if (monthIdx !== undefined) {
      const d = new Date(Number(dmy2[3]), monthIdx, Number(dmy2[1]));
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  const fallback = new Date(cleaned);
  if (!isNaN(fallback.getTime())) return fallback.toISOString();

  return null;
};
