// detect-encoding.js
/**
 * [エンコーディングAPIの`label`一覧](https://developer.mozilla.org/ja/docs/Web/API/Encoding_API/Encodings)
 */
const CANDIDATES = ["utf-8", "shift_jis", "euc-jp", "iso-2022-jp"];

function detectEncoding(bytes) {
	return getGuessByScoring(bytes, CANDIDATES);
}

function getGuessByScoring(bytes, candidates) {
	let bestScore = -1;
	let bestEncoding = "utf-8";

	for (const encoding of candidates) {
		try {
			const text = new TextDecoder(encoding, { fatal: false }).decode(bytes);
			const score = scoreEncoding(text);
			if (score > bestScore) {
				bestScore = score;
				bestEncoding = encoding;
			}
		} catch (_) {}
	}

	return bestEncoding;
}

function scoreEncoding(text) {
	const replaced_count = (text.match(/\uFFFD/g) || []).length;
	const ascii_count = (text.match(/[\u0000-\u007F]/g) || []).length;
	const hiragana_count = (text.match(/[\u3040-\u309F]/g) || []).length;
	const katakana_count = (text.match(/[\u30A0-\u30FF]/g) || []).length;
	// https://www.unicode.org/charts/PDF/U3000.pdf
	const japanese_punctuation_count = (text.match(/[\u3001-\u3003\u3005\u3008-\u3012\u301C]/g) || []).length;
	return (
		replaced_count * -1000 +
		ascii_count * 2 +
		hiragana_count * 50 +
		katakana_count * 40 +
		japanese_punctuation_count * 200
	)
}
