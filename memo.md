## 仕様1:
1. HTTPヘッダのContent-TypeのcharsetをUTF-8に設定する
2. HTML本文の文字コードを判断する
3. HTML本文の文字コードがUTF-8でない場合、UTF-8に変換する

## 仕様2:
1. HTTPヘッダのContent-typeのcharsetを消去する
2. HTML本文の文字コードを判断する
3. HTML本文の文字コードがUTF-8でない場合、`<meta>`タグのcharset=[適切な文字コード]を削除する

## 仕様3:
1. HTTPヘッダのContent-typeのcharsetを保留する
2. HTML本文の文字コードを判断する
3. HTML本文の文字コードがUTF-8でない場合、HTTPヘッダのContent-typeのcharsetをUTF-8に設定する

## コメント:
- 仕様1は、もともとのデータを上書きしてしまうデメリットがあるが、確実に文字化けを防ぐことができる。
- 仕様2は、ブラウザが文字コードを判断することになるが、`<meta>`タグのcharsetを削除するのは安定性に欠ける。
- 仕様3は、実現が難しい

**仕様1**を実装することにする。
