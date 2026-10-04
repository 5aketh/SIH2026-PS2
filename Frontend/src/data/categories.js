import AppleIcon from '../components/icons/AppleIcon';
import WheatIcon from '../components/icons/WheatIcon';
import MilkCartonIcon from '../components/icons/MilkCartonIcon';
import FishIcon from '../components/icons/FishIcon';
import ChipBagIcon from '../components/icons/ChipBagIcon';
import OilBottleIcon from '../components/icons/OilBottleIcon';

// Order matters: the first three are the top row and take the upper orbit slots.
export const CATEGORIES = [
  { id: 'produce', title: 'Fresh produce', description: 'Breathable films for fruits and vegetables', Icon: AppleIcon },
  { id: 'grains', title: 'Grains & pulses', description: 'Moisture-barrier solutions for dry staples', Icon: WheatIcon },
  { id: 'dairy', title: 'Dairy', description: 'Airtight, odour-blocking packaging for dairy', Icon: MilkCartonIcon },
  { id: 'meat', title: 'Meat & fish', description: 'High-barrier MAP packaging for proteins', Icon: FishIcon },
  { id: 'snacks', title: 'Snacks & dry foods', description: 'Oxygen-scavenging films for extended crunch', Icon: ChipBagIcon },
  { id: 'oils', title: 'Oils & fats', description: 'Light and oxidation barriers for lipid-rich goods', Icon: OilBottleIcon },
];
