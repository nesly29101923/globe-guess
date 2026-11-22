// Capital cities, for capital questions. Hand-kept (the generated map data has no capitals); English names.
// Left out on purpose: places with disputed, split or no official capital, where any single answer would be
// arguable (Bolivia: Sucre/La Paz, South Africa: three capitals, Israel: status disputed internationally,
// Sri Lanka: Sri Jayawardenepura Kotte/Colombo, Eswatini: Mbabane/Lobamba, Nauru: none). Those countries still
// appear as map and flag questions, and as wrong options never (a wrong option needs a capital too).
import type { Tier } from '../logic/types';

export const COUNTRY_CAPITALS: Record<string, string> = {
  AD: 'Andorra la Vella', AE: 'Abu Dhabi', AF: 'Kabul', AG: "Saint John's", AL: 'Tirana', AM: 'Yerevan', AO: 'Luanda',
  AR: 'Buenos Aires', AT: 'Vienna', AU: 'Canberra', AZ: 'Baku', BA: 'Sarajevo', BB: 'Bridgetown', BD: 'Dhaka',
  BE: 'Brussels', BF: 'Ouagadougou', BG: 'Sofia', BH: 'Manama', BI: 'Gitega', BJ: 'Porto-Novo', BN: 'Bandar Seri Begawan',
  BR: 'Brasília', BS: 'Nassau', BT: 'Thimphu', BW: 'Gaborone', BY: 'Minsk', BZ: 'Belmopan', CA: 'Ottawa',
  CD: 'Kinshasa', CF: 'Bangui', CG: 'Brazzaville', CH: 'Bern', CI: 'Yamoussoukro', CL: 'Santiago', CM: 'Yaoundé',
  CN: 'Beijing', CO: 'Bogotá', CR: 'San José', CU: 'Havana', CV: 'Praia', CY: 'Nicosia', CZ: 'Prague', DE: 'Berlin',
  DJ: 'Djibouti', DK: 'Copenhagen', DM: 'Roseau', DO: 'Santo Domingo', DZ: 'Algiers', EC: 'Quito', EE: 'Tallinn',
  EG: 'Cairo', ER: 'Asmara', ES: 'Madrid', ET: 'Addis Ababa', FI: 'Helsinki', FJ: 'Suva', FM: 'Palikir', FR: 'Paris',
  GA: 'Libreville', GB: 'London', GD: "St. George's", GE: 'Tbilisi', GH: 'Accra', GM: 'Banjul', GN: 'Conakry',
  GQ: 'Malabo', GR: 'Athens', GT: 'Guatemala City', GW: 'Bissau', GY: 'Georgetown', HN: 'Tegucigalpa', HR: 'Zagreb',
  HT: 'Port-au-Prince', HU: 'Budapest', ID: 'Jakarta', IE: 'Dublin', IN: 'New Delhi', IQ: 'Baghdad', IR: 'Tehran',
  IS: 'Reykjavík', IT: 'Rome', JM: 'Kingston', JO: 'Amman', JP: 'Tokyo', KE: 'Nairobi', KG: 'Bishkek', KH: 'Phnom Penh',
  KI: 'Tarawa', KM: 'Moroni', KN: 'Basseterre', KP: 'Pyongyang', KR: 'Seoul', KW: 'Kuwait City', KZ: 'Astana',
  LA: 'Vientiane', LB: 'Beirut', LC: 'Castries', LI: 'Vaduz', LR: 'Monrovia', LS: 'Maseru', LT: 'Vilnius',
  LU: 'Luxembourg', LV: 'Riga', LY: 'Tripoli', MA: 'Rabat', MC: 'Monaco', MD: 'Chișinău', ME: 'Podgorica',
  MG: 'Antananarivo', MH: 'Majuro', MK: 'Skopje', ML: 'Bamako', MM: 'Naypyidaw', MN: 'Ulaanbaatar', MR: 'Nouakchott',
  MT: 'Valletta', MU: 'Port Louis', MV: 'Malé', MW: 'Lilongwe', MX: 'Mexico City', MY: 'Kuala Lumpur', MZ: 'Maputo',
  NA: 'Windhoek', NE: 'Niamey', NG: 'Abuja', NI: 'Managua', NL: 'Amsterdam', NO: 'Oslo', NP: 'Kathmandu',
  NZ: 'Wellington', OM: 'Muscat', PA: 'Panama City', PE: 'Lima', PG: 'Port Moresby', PH: 'Manila', PK: 'Islamabad',
  PL: 'Warsaw', PT: 'Lisbon', PW: 'Ngerulmud', PY: 'Asunción', QA: 'Doha', RO: 'Bucharest', RS: 'Belgrade',
  RU: 'Moscow', RW: 'Kigali', SA: 'Riyadh', SB: 'Honiara', SC: 'Victoria', SD: 'Khartoum', SE: 'Stockholm',
  SG: 'Singapore', SI: 'Ljubljana', SK: 'Bratislava', SL: 'Freetown', SM: 'San Marino', SN: 'Dakar', SO: 'Mogadishu',
  SR: 'Paramaribo', SS: 'Juba', ST: 'São Tomé', SV: 'San Salvador', SY: 'Damascus', TD: "N'Djamena", TG: 'Lomé',
  TH: 'Bangkok', TJ: 'Dushanbe', TL: 'Dili', TM: 'Ashgabat', TN: 'Tunis', TO: "Nuku'alofa", TR: 'Ankara',
  TT: 'Port of Spain', TV: 'Funafuti', TZ: 'Dodoma', UA: 'Kyiv', UG: 'Kampala', US: 'Washington, D.C.',
  UY: 'Montevideo', UZ: 'Tashkent', VA: 'Vatican City', VC: 'Kingstown', VE: 'Caracas', VN: 'Hanoi', VU: 'Port Vila',
  WS: 'Apia', YE: "Sana'a", ZM: 'Lusaka', ZW: 'Harare',
};

export const STATE_CAPITALS: Record<string, string> = {
  'US-AL': 'Montgomery', 'US-AK': 'Juneau', 'US-AZ': 'Phoenix', 'US-AR': 'Little Rock', 'US-CA': 'Sacramento',
  'US-CO': 'Denver', 'US-CT': 'Hartford', 'US-DE': 'Dover', 'US-FL': 'Tallahassee', 'US-GA': 'Atlanta',
  'US-HI': 'Honolulu', 'US-ID': 'Boise', 'US-IL': 'Springfield', 'US-IN': 'Indianapolis', 'US-IA': 'Des Moines',
  'US-KS': 'Topeka', 'US-KY': 'Frankfort', 'US-LA': 'Baton Rouge', 'US-ME': 'Augusta', 'US-MD': 'Annapolis',
  'US-MA': 'Boston', 'US-MI': 'Lansing', 'US-MN': 'Saint Paul', 'US-MS': 'Jackson', 'US-MO': 'Jefferson City',
  'US-MT': 'Helena', 'US-NE': 'Lincoln', 'US-NV': 'Carson City', 'US-NH': 'Concord', 'US-NJ': 'Trenton',
  'US-NM': 'Santa Fe', 'US-NY': 'Albany', 'US-NC': 'Raleigh', 'US-ND': 'Bismarck', 'US-OH': 'Columbus',
  'US-OK': 'Oklahoma City', 'US-OR': 'Salem', 'US-PA': 'Harrisburg', 'US-RI': 'Providence', 'US-SC': 'Columbia',
  'US-SD': 'Pierre', 'US-TN': 'Nashville', 'US-TX': 'Austin', 'US-UT': 'Salt Lake City', 'US-VT': 'Montpelier',
  'US-VA': 'Richmond', 'US-WA': 'Olympia', 'US-WV': 'Charleston', 'US-WI': 'Madison', 'US-WY': 'Cheyenne',
};

/** Capitals people often get wrong (the big famous city is not the capital): one tier harder than the place. */
const TRICKY = new Set([
  'AU', 'CA', 'TR', 'BR', 'CH', 'NZ', 'MA', 'NG', 'PK', 'VN', 'MM', 'KZ', 'TZ', 'CI', 'BJ', 'BI', 'BZ', 'AE', 'NL',
  'US-CA', 'US-NY', 'US-FL', 'US-TX', 'US-IL', 'US-PA', 'US-NV', 'US-WA', 'US-MI', 'US-KY', 'US-MO', 'US-SD', 'US-VT',
  'US-OR', 'US-ME', 'US-MD', 'US-NJ', 'US-DE', 'US-WV', 'US-SC', 'US-AK',
]);

const ORDER: Tier[] = ['very_easy', 'easy', 'medium', 'hard', 'very_hard'];

export function capitalOf(id: string): string | undefined {
  return COUNTRY_CAPITALS[id] ?? STATE_CAPITALS[id];
}

/** How hard the capital question is: the place's own tier, one harder for the classic traps. */
export function capitalTier(id: string, placeTier: Tier): Tier {
  const i = ORDER.indexOf(placeTier);
  return TRICKY.has(id) ? ORDER[Math.min(4, i + 1)] : placeTier;
}
