export function catalogProductName(label: string) {
  return label.replace(/\s*[-–]\s*DEMO_FICTIF\b/gi, '').trim();
}

export function catalogChannelName(channel: string) {
  const demoChannel = channel.match(/^DEMO_TV_(\d+)$/i);
  return demoChannel ? `Canal ${demoChannel[1]} · démo` : channel;
}

export function catalogDaypartName(daypart: string) {
  switch (daypart.toUpperCase()) {
    case 'DAY':
      return 'Journée';
    case 'PRIME':
      return 'Prime time';
    default:
      return daypart;
  }
}
