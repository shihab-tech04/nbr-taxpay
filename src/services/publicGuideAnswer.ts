import type { GuideEntry } from '../data/publicGuideContent';

type GuideLanguage = 'en' | 'bn';

const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');

/** Return only an answer maintained in the public guide; unsupported prompts stay unanswered. */
export function getMaintainedGuideAnswer(
  query: string,
  content: readonly GuideEntry[],
  language: GuideLanguage,
): string | null {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 3) return null;

  const languageIndex = language === 'bn' ? 1 : 0;
  const faqEntries = content.flatMap((group) => group.faqs.map((faq) => ({
    questions: faq.q.map(normalize),
    answer: faq.a[languageIndex],
  })));
  const matchingFaq = faqEntries.find(({ questions }) => questions.some((question) =>
    question === normalizedQuery || question.includes(normalizedQuery) || normalizedQuery.includes(question),
  ));
  if (matchingFaq) return matchingFaq.answer;

  const matchingTopic = content.find((group) => [group.en, group.bn].some((label) => {
    const normalizedLabel = normalize(label);
    return normalizedQuery.includes(normalizedLabel) || normalizedLabel.includes(normalizedQuery);
  }));
  return matchingTopic?.faqs[0]?.a[languageIndex] ?? matchingTopic?.description[languageIndex] ?? null;
}
