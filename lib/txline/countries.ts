/**
 * Maps TxLINE participant names (countries) → flag emoji + 3-letter code, so
 * the app's Team shape ({ id, name, flag, code }) renders properly. Unknown
 * names fall back to a neutral flag + a derived code.
 */
const COUNTRIES: Record<string, { flag: string; code: string }> = {
  Argentina: { flag: "🇦🇷", code: "ARG" }, Brazil: { flag: "🇧🇷", code: "BRA" },
  France: { flag: "🇫🇷", code: "FRA" }, England: { flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", code: "ENG" },
  Spain: { flag: "🇪🇸", code: "ESP" }, Germany: { flag: "🇩🇪", code: "GER" },
  Portugal: { flag: "🇵🇹", code: "POR" }, Netherlands: { flag: "🇳🇱", code: "NED" },
  Belgium: { flag: "🇧🇪", code: "BEL" }, Italy: { flag: "🇮🇹", code: "ITA" },
  Croatia: { flag: "🇭🇷", code: "CRO" }, Uruguay: { flag: "🇺🇾", code: "URU" },
  Mexico: { flag: "🇲🇽", code: "MEX" }, USA: { flag: "🇺🇸", code: "USA" },
  "United States": { flag: "🇺🇸", code: "USA" }, Canada: { flag: "🇨🇦", code: "CAN" },
  Japan: { flag: "🇯🇵", code: "JPN" }, "South Korea": { flag: "🇰🇷", code: "KOR" },
  Morocco: { flag: "🇲🇦", code: "MAR" }, Senegal: { flag: "🇸🇳", code: "SEN" },
  Nigeria: { flag: "🇳🇬", code: "NGA" }, Ghana: { flag: "🇬🇭", code: "GHA" },
  Cameroon: { flag: "🇨🇲", code: "CMR" }, Egypt: { flag: "🇪🇬", code: "EGY" },
  Algeria: { flag: "🇩🇿", code: "ALG" }, "Ivory Coast": { flag: "🇨🇮", code: "CIV" },
  Chile: { flag: "🇨🇱", code: "CHI" }, Colombia: { flag: "🇨🇴", code: "COL" },
  Peru: { flag: "🇵🇪", code: "PER" }, Ecuador: { flag: "🇪🇨", code: "ECU" },
  Serbia: { flag: "🇷🇸", code: "SRB" }, Switzerland: { flag: "🇨🇭", code: "SUI" },
  Denmark: { flag: "🇩🇰", code: "DEN" }, Poland: { flag: "🇵🇱", code: "POL" },
  Sweden: { flag: "🇸🇪", code: "SWE" }, Turkey: { flag: "🇹🇷", code: "TUR" },
  Australia: { flag: "🇦🇺", code: "AUS" }, "Saudi Arabia": { flag: "🇸🇦", code: "KSA" },
  Qatar: { flag: "🇶🇦", code: "QAT" }, Iran: { flag: "🇮🇷", code: "IRN" },
  Ukraine: { flag: "🇺🇦", code: "UKR" }, Austria: { flag: "🇦🇹", code: "AUT" },
  "Cape Verde": { flag: "🇨🇻", code: "CPV" }, "Bosnia & Herzegovina": { flag: "🇧🇦", code: "BIH" },
  "Congo DR": { flag: "🇨🇩", code: "COD" }, Norway: { flag: "🇳🇴", code: "NOR" },
  Paraguay: { flag: "🇵🇾", code: "PAR" }, Tunisia: { flag: "🇹🇳", code: "TUN" },
  Panama: { flag: "🇵🇦", code: "PAN" }, Jordan: { flag: "🇯🇴", code: "JOR" },
  Uzbekistan: { flag: "🇺🇿", code: "UZB" }, "New Zealand": { flag: "🇳🇿", code: "NZL" },
  Scotland: { flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", code: "SCO" }, Wales: { flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", code: "WAL" },
};

export function countryInfo(name: string): { flag: string; code: string } {
  return COUNTRIES[name] ?? { flag: "🏳️", code: name.slice(0, 3).toUpperCase() };
}

/**
 * Country name → ISO 3166-1 alpha-2 (flagcdn slug). Windows/Chrome don't render
 * flag *emoji*, so we render real flag images from flagcdn.com instead. The
 * home nations use flagcdn's special gb-eng / gb-sct / gb-wls slugs.
 */
const ISO2: Record<string, string> = {
  Argentina: "ar", Brazil: "br", France: "fr", England: "gb-eng", Spain: "es",
  Germany: "de", Portugal: "pt", Netherlands: "nl", Belgium: "be", Italy: "it",
  Croatia: "hr", Uruguay: "uy", Mexico: "mx", USA: "us", "United States": "us",
  Canada: "ca", Japan: "jp", "South Korea": "kr", Morocco: "ma", Senegal: "sn",
  Nigeria: "ng", Ghana: "gh", Cameroon: "cm", Egypt: "eg", Algeria: "dz",
  "Ivory Coast": "ci", Chile: "cl", Colombia: "co", Peru: "pe", Ecuador: "ec",
  Serbia: "rs", Switzerland: "ch", Denmark: "dk", Poland: "pl", Sweden: "se",
  Turkey: "tr", Australia: "au", "Saudi Arabia": "sa", Qatar: "qa", Iran: "ir",
  Ukraine: "ua", Austria: "at", "Cape Verde": "cv", "Bosnia & Herzegovina": "ba",
  "Congo DR": "cd", Norway: "no", Paraguay: "py", Tunisia: "tn", Panama: "pa",
  Jordan: "jo", Uzbekistan: "uz", "New Zealand": "nz", Scotland: "gb-sct",
  Wales: "gb-wls", Curacao: "cw", "Curaçao": "cw", Haiti: "ht", Greece: "gr",
  Romania: "ro", Hungary: "hu", "Czech Republic": "cz", Czechia: "cz",
  Slovakia: "sk", Slovenia: "si", Iceland: "is", Ireland: "ie", Finland: "fi",
  Russia: "ru", Venezuela: "ve", Bolivia: "bo", "Costa Rica": "cr", Honduras: "hn",
  Jamaica: "jm", "South Africa": "za", Mali: "ml", "Burkina Faso": "bf",
  "DR Congo": "cd", Angola: "ao", Zambia: "zm", Kenya: "ke", "United Arab Emirates": "ae",
  Iraq: "iq", Oman: "om", Bahrain: "bh", China: "cn", "North Korea": "kp",
  Thailand: "th", Vietnam: "vn", Indonesia: "id", Malaysia: "my", India: "in",
};

/** ISO2 slug for a country (or null if we don't have it). */
export function countryIso2(name: string): string | null {
  return ISO2[name] ?? null;
}

/**
 * flagcdn image URL for a country name. `width` is a flagcdn size bucket
 * (e.g. 40, 80, 160). Returns null for unknown countries so callers can fall
 * back to a neutral placeholder.
 */
export function flagUrl(name: string | undefined | null, width: 40 | 80 | 160 = 80): string | null {
  if (!name) return null;
  const iso = ISO2[name];
  return iso ? `https://flagcdn.com/w${width}/${iso}.png` : null;
}
