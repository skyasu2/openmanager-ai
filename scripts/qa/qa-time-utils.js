function toSeoulParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const parsed = {};
  for (const part of parts) {
    if (part.type === 'literal') continue;
    parsed[part.type] = part.value;
  }

  return {
    year: parsed.year,
    month: parsed.month,
    day: parsed.day,
    hour: parsed.hour,
    minute: parsed.minute,
    second: parsed.second,
  };
}

function nowInSeoulText(date) {
  const p = toSeoulParts(date);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} KST`;
}

module.exports = {
  nowInSeoulText,
  toSeoulParts,
};
