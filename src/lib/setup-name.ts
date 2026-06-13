const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface NameableVariant {
  name: string;
  model: { name: string };
}

export function generateSetupName(
  vehicle: NameableVariant,
  caravan: NameableVariant | null,
  date: Date = new Date(),
): string {
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  const vehiclePart = `${vehicle.model.name} ${vehicle.name}`;
  const caravanPart = caravan ? ` + ${caravan.model.name} ${caravan.name}` : '';
  return `${vehiclePart}${caravanPart} ${month} ${year}`;
}
