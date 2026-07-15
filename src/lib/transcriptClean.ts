// Speech transcribers (Deepgram, OpenAI Realtime/Whisper) hallucinate non-English
// text (Korean/Hebrew/Hindi/etc.) and gibberish on noise or silence. This strips
// characters outside the Latin/basic set and rejects results with no real words,
// so hallucinated tokens never enter an English interview transcript.
const NON_LATIN = /[^ -ɏ -⁯₠-⃏\s]/g;

export function cleanTranscript(text: string): string {
  const stripped = text.replace(NON_LATIN, "").replace(/\s+/g, " ").trim();
  return /[a-zA-Z]{2,}/.test(stripped) ? stripped : "";
}