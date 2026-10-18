export const COUNTRIES = [
    ['Afghanistan', 'AF', 'AFN'],
    ['Albania', 'AL', 'ALL'],
    ['Algeria', 'DZ', 'DZD'],
    ['Angola', 'AO', 'AOA'],
    ['Argentina', 'AR', 'ARS'],
    ['Armenia', 'AM', 'AMD'],
    ['Australia', 'AU', 'AUD'],
    ['Austria', 'AT', 'EUR'],
    ['Azerbaijan', 'AZ', 'AZN'],
    ['Bahrain', 'BH', 'BHD'],
    ['Bangladesh', 'BD', 'BDT'],
    ['Belarus', 'BY', 'BYN'],
    ['Belgium', 'BE', 'EUR'],
    ['Bolivia', 'BO', 'BOB'],
    ['Bosnia and Herzegovina', 'BA', 'BAM'],
    ['Botswana', 'BW', 'BWP'],
    ['Brazil', 'BR', 'BRL'],
    ['Brunei', 'BN', 'BND'],
    ['Bulgaria', 'BG', 'EUR'],
    ['Cambodia', 'KH', 'KHR'],
    ['Cameroon', 'CM', 'XAF'],
    ['Canada', 'CA', 'CAD'],
    ['Chile', 'CL', 'CLP'],
    ['China', 'CN', 'CNY'],
    ['Colombia', 'CO', 'COP'],
    ['Costa Rica', 'CR', 'CRC'],
    ['Croatia', 'HR', 'EUR'],
    ['Cyprus', 'CY', 'EUR'],
    ['Czech Republic', 'CZ', 'CZK'],
    ['Denmark', 'DK', 'DKK'],
    ['Dominican Republic', 'DO', 'DOP'],
    ['Ecuador', 'EC', 'USD'],
    ['Egypt', 'EG', 'EGP'],
    ['El Salvador', 'SV', 'USD'],
    ['Estonia', 'EE', 'EUR'],
    ['Ethiopia', 'ET', 'ETB'],
    ['Finland', 'FI', 'EUR'],
    ['France', 'FR', 'EUR'],
    ['Georgia', 'GE', 'GEL'],
    ['Germany', 'DE', 'EUR'],
    ['Ghana', 'GH', 'GHS'],
    ['Greece', 'GR', 'EUR'],
    ['Guatemala', 'GT', 'GTQ'],
    ['Honduras', 'HN', 'HNL'],
    ['Hong Kong', 'HK', 'HKD'],
    ['Hungary', 'HU', 'HUF'],
    ['Iceland', 'IS', 'ISK'],
    ['India', 'IN', 'INR'],
    ['Indonesia', 'ID', 'IDR'],
    ['Iran', 'IR', 'IRR'],
    ['Iraq', 'IQ', 'IQD'],
    ['Ireland', 'IE', 'EUR'],
    ['Israel', 'IL', 'ILS'],
    ['Italy', 'IT', 'EUR'],
    ['Ivory Coast', 'CI', 'XOF'],
    ['Jamaica', 'JM', 'JMD'],
    ['Japan', 'JP', 'JPY'],
    ['Jordan', 'JO', 'JOD'],
    ['Kazakhstan', 'KZ', 'KZT'],
    ['Kenya', 'KE', 'KES'],
    ['Kuwait', 'KW', 'KWD'],
    ['Kyrgyzstan', 'KG', 'KGS'],
    ['Laos', 'LA', 'LAK'],
    ['Latvia', 'LV', 'EUR'],
    ['Lebanon', 'LB', 'LBP'],
    ['Libya', 'LY', 'LYD'],
    ['Lithuania', 'LT', 'EUR'],
    ['Luxembourg', 'LU', 'EUR'],
    ['Malaysia', 'MY', 'MYR'],
    ['Maldives', 'MV', 'MVR'],
    ['Malta', 'MT', 'EUR'],
    ['Mauritius', 'MU', 'MUR'],
    ['Mexico', 'MX', 'MXN'],
    ['Moldova', 'MD', 'MDL'],
    ['Mongolia', 'MN', 'MNT'],
    ['Morocco', 'MA', 'MAD'],
    ['Mozambique', 'MZ', 'MZN'],
    ['Myanmar', 'MM', 'MMK'],
    ['Namibia', 'NA', 'NAD'],
    ['Nepal', 'NP', 'NPR'],
    ['Netherlands', 'NL', 'EUR'],
    ['New Zealand', 'NZ', 'NZD'],
    ['Nicaragua', 'NI', 'NIO'],
    ['Nigeria', 'NG', 'NGN'],
    ['North Macedonia', 'MK', 'MKD'],
    ['Norway', 'NO', 'NOK'],
    ['Oman', 'OM', 'OMR'],
    ['Pakistan', 'PK', 'PKR'],
    ['Palestine', 'PS', 'ILS'],
    ['Panama', 'PA', 'USD'],
    ['Paraguay', 'PY', 'PYG'],
    ['Peru', 'PE', 'PEN'],
    ['Philippines', 'PH', 'PHP'],
    ['Poland', 'PL', 'PLN'],
    ['Portugal', 'PT', 'EUR'],
    ['Qatar', 'QA', 'QAR'],
    ['Romania', 'RO', 'RON'],
    ['Russia', 'RU', 'RUB'],
    ['Rwanda', 'RW', 'RWF'],
    ['Saudi Arabia', 'SA', 'SAR'],
    ['Senegal', 'SN', 'XOF'],
    ['Serbia', 'RS', 'RSD'],
    ['Singapore', 'SG', 'SGD'],
    ['Slovakia', 'SK', 'EUR'],
    ['Slovenia', 'SI', 'EUR'],
    ['Somalia', 'SO', 'SOS'],
    ['South Africa', 'ZA', 'ZAR'],
    ['South Korea', 'KR', 'KRW'],
    ['Spain', 'ES', 'EUR'],
    ['Sri Lanka', 'LK', 'LKR'],
    ['Sudan', 'SD', 'SDG'],
    ['Sweden', 'SE', 'SEK'],
    ['Switzerland', 'CH', 'CHF'],
    ['Syria', 'SY', 'SYP'],
    ['Taiwan', 'TW', 'TWD'],
    ['Tajikistan', 'TJ', 'TJS'],
    ['Tanzania', 'TZ', 'TZS'],
    ['Thailand', 'TH', 'THB'],
    ['Tunisia', 'TN', 'TND'],
    ['Turkey', 'TR', 'TRY'],
    ['Turkmenistan', 'TM', 'TMT'],
    ['Uganda', 'UG', 'UGX'],
    ['Ukraine', 'UA', 'UAH'],
    ['United Arab Emirates', 'AE', 'AED'],
    ['United Kingdom', 'GB', 'GBP'],
    ['United States', 'US', 'USD'],
    ['Uruguay', 'UY', 'UYU'],
    ['Uzbekistan', 'UZ', 'UZS'],
    ['Venezuela', 'VE', 'VES'],
    ['Vietnam', 'VN', 'VND'],
    ['Yemen', 'YE', 'YER'],
    ['Zambia', 'ZM', 'ZMW'],
    ['Zimbabwe', 'ZW', 'USD'],
] as const;

export type CountryName = (typeof COUNTRIES)[number][0];

const BY_NAME = new Map<string, readonly [string, string, string]>(COUNTRIES.map((row) => [row[0], row]));
const BY_CODE = new Map<string, readonly [string, string, string]>(COUNTRIES.map((row) => [row[1], row]));

export function countryCode(name: string): string | null {
    return BY_NAME.get(name)?.[1].toLowerCase() ?? null;
}

export function findCountry(value: string | null | undefined): string | null {
    if (!value) return null;
    const text = value.trim();
    if (BY_NAME.has(text)) return text;
    const lower = text.toLowerCase();
    for (const [name] of BY_NAME) if (name.toLowerCase() === lower) return name;
    return BY_CODE.get(text.toUpperCase())?.[0] ?? null;
}

/** The currency code usually used in a country, or null. */
export function currencyOfCountry(name: string): string | null {
    return BY_NAME.get(name)?.[2] ?? null;
}

export function guessCountry(): string | null {
    try {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const byZone = zone ? ZONE_COUNTRY[zone] : undefined;
        if (byZone && BY_CODE.has(byZone)) return BY_CODE.get(byZone)![0];
    } catch {
        /* fall through to the language */
    }
    for (const language of navigator.languages ?? [navigator.language]) {
        const region = language?.split('-')[1]?.toUpperCase();
        if (region && BY_CODE.has(region)) return BY_CODE.get(region)![0];
    }
    return null;
}

const ZONE_COUNTRY: Record<string, string> = {
    'Asia/Karachi': 'PK', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Dhaka': 'BD', 'Asia/Colombo': 'LK',
    'Asia/Kathmandu': 'NP', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA', 'Asia/Kuwait': 'KW',
    'Asia/Bahrain': 'BH', 'Asia/Muscat': 'OM', 'Asia/Tehran': 'IR', 'Asia/Baghdad': 'IQ', 'Asia/Amman': 'JO',
    'Asia/Beirut': 'LB', 'Asia/Jerusalem': 'IL', 'Asia/Istanbul': 'TR', 'Europe/Istanbul': 'TR', 'Asia/Kabul': 'AF',
    'Asia/Tashkent': 'UZ', 'Asia/Almaty': 'KZ', 'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Jakarta': 'ID',
    'Asia/Manila': 'PH', 'Asia/Bangkok': 'TH', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Saigon': 'VN', 'Asia/Hong_Kong': 'HK',
    'Asia/Shanghai': 'CN', 'Asia/Taipei': 'TW', 'Asia/Seoul': 'KR', 'Asia/Tokyo': 'JP', 'Africa/Cairo': 'EG',
    'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE', 'Africa/Johannesburg': 'ZA', 'Africa/Casablanca': 'MA',
    'Africa/Accra': 'GH', 'Africa/Addis_Ababa': 'ET', 'Europe/London': 'GB', 'Europe/Dublin': 'IE',
    'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT',
    'Europe/Amsterdam': 'NL', 'Europe/Zurich': 'CH', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO',
    'Europe/Copenhagen': 'DK', 'Europe/Warsaw': 'PL', 'Europe/Moscow': 'RU', 'Australia/Sydney': 'AU',
    'Australia/Melbourne': 'AU', 'Pacific/Auckland': 'NZ', 'America/Toronto': 'CA', 'America/Vancouver': 'CA',
    'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US',
    'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR', 'America/Argentina/Buenos_Aires': 'AR',
    'America/Bogota': 'CO', 'America/Lima': 'PE', 'America/Santiago': 'CL',
};
