export interface KSTDateTime {
  date: string;
  time: string;
  slotIndex: number;
  minuteOfDay: number;
}

export function getKSTDateTime(): KSTDateTime {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);

  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');
  const hours = String(kstDate.getUTCHours()).padStart(2, '0');
  const roundedMinutes = Math.floor(kstDate.getUTCMinutes() / 10) * 10;
  const minutes = String(roundedMinutes).padStart(2, '0');
  const minuteOfDay = kstDate.getUTCHours() * 60 + roundedMinutes;

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
    slotIndex: Math.floor(minuteOfDay / 10),
    minuteOfDay,
  };
}
