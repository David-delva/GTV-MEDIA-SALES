export function catalogProductName(label: string) {
  return label.replace(/\s*[-–]\s*DEMO_FICTIF\b/gi, '').trim();
}

export function catalogChannelName(channel: string) {
  const demoChannel = channel.match(/^DEMO_TV_(\d+)$/i);
  if (demoChannel) return `Canal ${demoChannel[1]} · démo`;
  const demoNames: Record<string, string> = {
    DEMO_WEB: 'Site web · démo',
    DEMO_SOCIAL: 'Réseaux sociaux · démo',
    DEMO_RADIO: 'Radio · démo',
    DEMO_AUDIO: 'Podcast et audio · démo',
    DEMO_STREAMING: 'Streaming · démo',
  };
  return demoNames[channel.toUpperCase()] ?? channel;
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
