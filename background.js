// background.js

/**
 * リクエストの流れ
 * [1]: `type`が`main_frame`または`sub_frame`である -> [2]へ
 * [2]: `Content-Type`のタイプが`text/html`である -> [3]へ
 *      `Content-Type`がない -> [4]へ
 * [3]: `Content-Type`の`charset`があれば`UTF-8`に書き換え、なければ`UTF-8`とし、[4]へ
 * [4]: `Content-Type`のタイプが`text/html`である -> [6]へ
 *      `Content-Type`がない -> [5]へ
 * [5]: HTML文書であると判定される -> [6]へ
 * [6]: charsetを判定し、`UTF-8`に変換する
 */

/**
 * @type {Map<string, {isHTML: boolean}>}
 * 処理を継続する各リクエストについて
 * `Content-Type`が`text/html`であったか
 * を記録するためのMap
 */
const requestStates = new Map();

// リクエストが開始されたときに呼び出されるリスナー
browser.webRequest.onBeforeRequest.addListener(
	(details) => {
		const url = new URL(details.url);
		if (!url.pathname.startsWith("/web/")) return;
		if (url.pathname.includes("*")) return;

		// リクエストを保存する
		requestStates.set(details.requestId, { isHTML: false });

		// レスポンスデータをフィルタリングするためのフィルターを作成する
		const filter = browser.webRequest.filterResponseData(details.requestId);
		const chunks = [];

		// データが受信されるたびに呼び出されるイベントハンドラー
		filter.ondata = (event) => {
			// バッファにデータを追加する
			chunks.push(new Uint8Array(event.data));
		};

		let start;

		// データの受信が完了したときに呼び出されるイベントハンドラー
		filter.onstop = () => {
			(async () => {
				try {
					start = performance.now();
					// 受信したデータを結合する
					const raw = concatUint8Arrays(chunks);

					// リクエスト情報を取得する
					const state = requestStates.get(details.requestId);

					if (!state) {
						// リクエスト情報がない場合は、受信したデータをそのまま返す
						filter.write(raw);
						return;
					}

					// Content-Typeがtext/htmlでない場合は、HTML文書であるかを判定する
					if (!state.isHTML && !looksLikeHtmlBytes(raw)) {
						// HTML文書でない場合は、受信したデータをそのまま返す
						filter.write(raw);
						return;
					}

					// charsetを判定する
					const encoding = detectEncoding(raw);

					// 判定したcharsetでデコードする
					const decoded = new TextDecoder(encoding, { fatal: false }).decode(raw);

					// UTF-8のUint8Arrayに変換する
					const encoded = new TextEncoder().encode(decoded);

					if (encoding !== "utf-8") {
						console.log(`Encoding Fixer: ${details.url} - ${encoding} -> utf-8`);
					}

					// 変換したデータを返す
					filter.write(encoded);
				} catch (err) {
					// エラーが発生した場合は、受信したデータをそのまま返す
					try {
						filter.write(concatUint8Arrays(chunks));
					} catch (_) {}
				} finally {
					// リクエスト情報を削除する
					requestStates.delete(details.requestId);
					end = performance.now();
					console.log(`Encoding Fixer: ${details.url} - ${end - start}ms`);
					try {
						filter.close();
					} catch (_) {}
				}
			})();
		};
	},
	{ urls: ["https://web.archive.org/*"], types: ["main_frame", "sub_frame"] },
	["blocking"]
);

// レスポンスヘッダが受信されたときに呼び出されるリスナー
browser.webRequest.onHeadersReceived.addListener(
	(details) => {

		const url = new URL(details.url);
		if (!url.pathname.startsWith("/web/")) return;
		if (url.pathname.includes("*")) return;

		// リクエスト情報を取得する
		const state = requestStates.get(details.requestId);

		// リクエスト情報がない場合は、何もしない
		if (!state) return;

		// Content-Typeがtext/htmlであるかを判定する
		state.isHTML = hasHeaderValue(details.responseHeaders, "content-type", "text/html") || !hasHeaderName(details.responseHeaders, "content-type");

		if (!state.isHTML) {
			// Content-Typeがtext/htmlでない場合は、何もしない
			return;
		}

		// Content-TypeのcharsetをUTF-8に書き換える
		const newHeaders = addMIMECharset(details.responseHeaders, "utf-8");

		return { responseHeaders: newHeaders };
	},
	{ urls: ["https://web.archive.org/*"], types: ["main_frame", "sub_frame"] },
	["responseHeaders", "blocking"]
);


function concatUint8Arrays(arrays) {
	let totalLength = 0;
	for (const arr of arrays) {
		totalLength += arr.length;
	}
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const arr of arrays) {
		result.set(arr, offset);
		offset += arr.length;
	}
	return result;
}

function looksLikeHtmlBytes(bytes) {
	const asciiLike = new TextDecoder("ascii").decode(bytes).toLowerCase();
	return (
		asciiLike.includes("<html") ||
		asciiLike.includes("<head") ||
		asciiLike.includes("<body") ||
		asciiLike.includes("<meta") ||
		asciiLike.includes("<!--")
	);
}

function hasHeaderName(headers, name) {
	if (!Array.isArray(headers)) return false;
	const target = name.toLowerCase();
	for (const header of headers) {
		if (!header || typeof header.name !== "string") continue;
		if (header.name.toLowerCase() === target) {
			return true;
		}
	}
	return false;
}

function hasHeaderValue(headers, name, value) {
	if (!Array.isArray(headers)) return false;
	const targetName = name.toLowerCase();
	const targetValue = value.toLowerCase();
	for (const header of headers) {
		if (!header || typeof header.name !== "string" || typeof header.value !== "string") continue;
		if (
			header.name.toLowerCase() === targetName
			 && header.value.toLowerCase().includes(targetValue)
		) {
			return true;
		}
	}
	return false;
}

function addMIMECharset(headers, charset) {
	if (!Array.isArray(headers)) return [];

	const newHeaders = [];
	let sawContentType = false;

	for (const header of headers) {
		if (!header || typeof header.name !== "string") continue;
		if (header.name.toLowerCase() === "content-type") {
			sawContentType = true;
			if (typeof header.value !== "string") continue;
			const parts = header.value.split(";");
			const type = parts.shift().trim();
			let sawCharset = false;
			for (let i = 0; i < parts.length; i++) {
				const part = parts[i].trim();
				const eq = part.indexOf("=");
				if (eq >= 0 && part.substring(0, eq).trim().toLowerCase() === "charset") {
					parts[i] = `charset=${charset}`;
					sawCharset = true;
					break;
				}
			}
			if (!sawCharset) {
				parts.push(`charset=${charset}`);
			}
			header.value = `${type}; ${parts.join("; ")}`;
		}
		newHeaders.push(header);
	}
	if (!sawContentType) {
		newHeaders.push({
			name: "Content-Type",
			value: `text/html; charset=${charset}`
		});
	}
	return newHeaders;
}
