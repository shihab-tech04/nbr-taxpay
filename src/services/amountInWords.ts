/** Bank-cheque style wording for display only; never use for financial arithmetic. */
type Language = 'en' | 'bn';
const enSmall = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const enTens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
const bnSmall = 'শূন্য|এক|দুই|তিন|চার|পাঁচ|ছয়|সাত|আট|নয়|দশ|এগারো|বারো|তেরো|চৌদ্দ|পনেরো|ষোলো|সতেরো|আঠারো|উনিশ|বিশ|একুশ|বাইশ|তেইশ|চব্বিশ|পঁচিশ|ছাব্বিশ|সাতাশ|আটাশ|ঊনত্রিশ|ত্রিশ|একত্রিশ|বত্রিশ|তেত্রিশ|চৌত্রিশ|পঁয়ত্রিশ|ছত্রিশ|সাঁইত্রিশ|আটত্রিশ|ঊনচল্লিশ|চল্লিশ|একচল্লিশ|বিয়াল্লিশ|তেতাল্লিশ|চুয়াল্লিশ|পঁয়তাল্লিশ|ছেচল্লিশ|সাতচল্লিশ|আটচল্লিশ|ঊনপঞ্চাশ|পঞ্চাশ|একান্ন|বাহান্ন|তিপ্পান্ন|চুয়ান্ন|পঞ্চান্ন|ছাপ্পান্ন|সাতান্ন|আটান্ন|ঊনষাট|ষাট|একষট্টি|বাষট্টি|তেষট্টি|চৌষট্টি|পঁয়ষট্টি|ছেষট্টি|সাতষট্টি|আটষট্টি|ঊনসত্তর|সত্তর|একাত্তর|বাহাত্তর|তিয়াত্তর|চুয়াত্তর|পঁচাত্তর|ছিয়াত্তর|সাতাত্তর|আটাত্তর|ঊনআশি|আশি|একাশি|বিরাশি|তিরাশি|চুরাশি|পঁচাশি|ছিয়াশি|সাতাশি|আটাশি|ঊননব্বই|নব্বই|একানব্বই|বিরানব্বই|তিরানব্বই|চুরানব্বই|পঁচানব্বই|ছিয়ানব্বই|সাতানব্বই|আটানব্বই|নিরানব্বই'.split('|');

function english(n: number): string {
  if (n < 20) return enSmall[n];
  if (n < 100) return enTens[Math.floor(n / 10)] + (n % 10 ? ' ' + english(n % 10) : '');
  for (const [unit, name] of [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand'], [100, 'Hundred']] as const) {
    if (n >= unit) {
      const rem = n % unit;
      return english(Math.floor(n / unit)) + ' ' + name + (rem ? ' ' + english(rem) : '');
    }
  }
  return enSmall[n];
}
function bengali(n: number): string {
  if (n < 100) return bnSmall[n];
  for (const [unit, name] of [[10000000, 'কোটি'], [100000, 'লাখ'], [1000, 'হাজার'], [100, 'শত']] as const) {
    if (n >= unit) {
      const rem = n % unit;
      return bengali(Math.floor(n / unit)) + ' ' + name + (rem ? ' ' + bengali(rem) : '');
    }
  }
  return bnSmall[n];
}

/** Returns null when the amount cannot be written precisely from a safe numeric value. */
export function amountInTakaWords(amount: number | null, language: Language = 'en'): string | null {
  if (amount === null || !Number.isFinite(amount) || amount < 0) return null;
  // Amounts in this form are represented as decimal Taka; reject unsafe minor-unit totals.
  const minor = Math.round(amount * 100);
  if (!Number.isSafeInteger(minor)) return null;
  const taka = Math.floor(minor / 100);
  const paisa = minor % 100;
  if (language === 'bn') return bengali(taka) + ' টাকা' + (paisa ? ' এবং ' + bengali(paisa) + ' পয়সা' : '') + ' মাত্র';
  return english(taka) + ' Taka' + (paisa ? ' and ' + english(paisa) + ' Paisa' : '') + ' only';
}
