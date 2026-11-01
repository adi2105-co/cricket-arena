// National teams (men and women). Kit colours are generic national colours, not licensed designs.
const N = (c, n, col, col2, test = false) => ({ c, n, col, col2, test });
export const NATIONS = [
  N('IND', 'India', '#1f6fe0', '#ffd24a', true), N('AUS', 'Australia', '#f2c200', '#0b6b3a', true), N('ENG', 'England', '#1b3a8a', '#e23b3b', true),
  N('RSA', 'South Africa', '#0b7a3e', '#f2c200', true), N('NZ', 'New Zealand', '#222831', '#e8e8e8', true), N('PAK', 'Pakistan', '#0a6b36', '#e8f5e9', true),
  N('WI', 'West Indies', '#7b1e2b', '#f2c200', true), N('SL', 'Sri Lanka', '#1b3f94', '#f2c200', true), N('AFG', 'Afghanistan', '#0f5ea8', '#e23b3b', true),
  N('BAN', 'Bangladesh', '#0b7a4a', '#e23b3b', true), N('IRE', 'Ireland', '#2db34b', '#ffffff', true), N('ZIM', 'Zimbabwe', '#c8102e', '#f2c200', true),
  N('NED', 'Netherlands', '#ff7a00', '#12366b'), N('SCO', 'Scotland', '#12366b', '#ffffff'), N('USA', 'United States', '#0a3161', '#e23b3b'),
  N('CAN', 'Canada', '#d52b1e', '#ffffff'), N('UAE', 'UAE', '#c8102e', '#ffffff'), N('NEP', 'Nepal', '#b3123a', '#12366b'),
  N('OMA', 'Oman', '#d0202f', '#ffffff'), N('NAM', 'Namibia', '#1f5fbf', '#e23b3b'),
];
export const NATION_BY_CODE = Object.fromEntries(NATIONS.map((n) => [n.c, n]));
export const WOMEN_NATIONS = ['AUS', 'IND', 'ENG', 'RSA', 'NZ', 'WI', 'PAK', 'SL', 'BAN', 'SCO', 'IRE'];
export const TEST_NATIONS = NATIONS.filter((n) => n.test).map((n) => n.c);
