// Country-driven locale config. The user's profile country (personal.location.
// country) is the single source of truth — it drives phone dial code, state
// options, salary wording/currency, and input placeholders across the app.
// India is the default. Add a country by extending CONFIG.

export interface LocaleConfig {
  country: string;
  dialCode: string; // e.g. '+91' ('' when unknown → free-form phone)
  phonePlaceholder: string;
  salaryTerm: 'CTC' | 'Salary';
  currency: string; // symbol or short code
  states?: string[]; // present → render a Select; absent → free text
}

export const DEFAULT_COUNTRY = 'India';

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

export const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas',
  'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
  'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming',
];

// Ordered list shown in the Country select (India first).
export const COUNTRIES = [
  'India',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'Singapore',
  'United Arab Emirates',
  'Other',
];

const CONFIG: Record<string, LocaleConfig> = {
  India: { country: 'India', dialCode: '+91', phonePlaceholder: '+91 98765 43210', salaryTerm: 'CTC', currency: '₹', states: INDIAN_STATES },
  'United States': { country: 'United States', dialCode: '+1', phonePlaceholder: '+1 (555) 123-4567', salaryTerm: 'Salary', currency: '$', states: US_STATES },
  'United Kingdom': { country: 'United Kingdom', dialCode: '+44', phonePlaceholder: '+44 7700 900123', salaryTerm: 'Salary', currency: '£' },
  Canada: { country: 'Canada', dialCode: '+1', phonePlaceholder: '+1 (555) 123-4567', salaryTerm: 'Salary', currency: '$' },
  Australia: { country: 'Australia', dialCode: '+61', phonePlaceholder: '+61 412 345 678', salaryTerm: 'Salary', currency: '$' },
  Germany: { country: 'Germany', dialCode: '+49', phonePlaceholder: '+49 1512 3456789', salaryTerm: 'Salary', currency: '€' },
  Singapore: { country: 'Singapore', dialCode: '+65', phonePlaceholder: '+65 8123 4567', salaryTerm: 'Salary', currency: '$' },
  'United Arab Emirates': { country: 'United Arab Emirates', dialCode: '+971', phonePlaceholder: '+971 50 123 4567', salaryTerm: 'Salary', currency: 'AED' },
};

// Common spellings/abbreviations → canonical country key.
const ALIASES: Record<string, string> = {
  in: 'India', ind: 'India', bharat: 'India',
  us: 'United States', usa: 'United States', 'u.s.': 'United States', 'u.s.a.': 'United States',
  'united states of america': 'United States', america: 'United States',
  uk: 'United Kingdom', gb: 'United Kingdom', 'great britain': 'United Kingdom', england: 'United Kingdom',
  ca: 'Canada', au: 'Australia', de: 'Germany', deutschland: 'Germany', sg: 'Singapore',
  uae: 'United Arab Emirates', 'u.a.e.': 'United Arab Emirates', emirates: 'United Arab Emirates',
};

function canonical(country: string): string | undefined {
  const trimmed = country.trim();
  if (CONFIG[trimmed]) return trimmed;
  return ALIASES[trimmed.toLowerCase()];
}

/** Locale config for a country string, with sensible fallback for unknown ones. */
export function localeFor(country?: string): LocaleConfig {
  if (!country || !country.trim()) return CONFIG[DEFAULT_COUNTRY];
  const key = canonical(country);
  if (key) return CONFIG[key];
  return { country: country.trim(), dialCode: '', phonePlaceholder: 'Phone number', salaryTerm: 'Salary', currency: '' };
}
