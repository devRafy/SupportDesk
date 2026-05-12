import type { Faq } from "@workspace/db";

export function botReply(userMessage: string, faqList: Faq[]): string {
  const words = userMessage.toLowerCase().split(/\s+/);
  let bestMatch: Faq | null = null;
  let highestScore = 0;

  for (const faq of faqList) {
    const score = faq.keywords.filter((k) => words.includes(k.toLowerCase())).length;
    if (score > highestScore) {
      highestScore = score;
      bestMatch = faq;
    }
  }

  if (highestScore === 0 || !bestMatch) {
    return "I didn't find an answer for that. An agent will be with you shortly.";
  }
  return bestMatch.answer;
}
