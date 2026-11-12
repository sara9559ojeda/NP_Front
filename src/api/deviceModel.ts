/** Product names for the headset identifiers the VR app reports (`quest3`, `Oculus Quest 2`…). */
const KNOWN_MODELS: Record<string, string> = {
  quest: 'Meta Quest',
  quest2: 'Meta Quest 2',
  quest3: 'Meta Quest 3',
  quest3s: 'Meta Quest 3S',
  questpro: 'Meta Quest Pro',
};

export function deviceModelLabel(model: string): string {
  const key = model.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^(oculus|meta)/, '');
  return KNOWN_MODELS[key] ?? model;
}
