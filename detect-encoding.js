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
	const roman_count = (text.match(/[A-Za-z0-9]/g) || []).length;
	const hiragana_count = (text.match(/[\u3040-\u309F]/g) || []).length;
	const katakana_count = (text.match(/[\u30A0-\u30FF]/g) || []).length;
	// https://www.unicode.org/charts/PDF/U3000.pdf
	// https://www.unicode.org/charts/PDF/UFF00.pdf
	const fullwidth_count = (text.match(/[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/g) || []).length;
	const symbol_count = (text.match(/[\u3008-\u3011\u301C\uFF01\uFF08\uFF09\uFF0C\uFF0E\uFF0F\uFF1A-\uFF20]/g) || []).length;
	const japanese_punctuation_count = (text.match(/[\u3001\u3002]/g) || []).length;
	return (
		roman_count * 1 +
		hiragana_count * 50 +
		katakana_count * 40 +
		fullwidth_count * 100 +
		symbol_count * 200 +
		japanese_punctuation_count * 1000
	)
}
