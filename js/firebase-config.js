/**
 * firebase-config.js — Firebase 接続設定
 *
 * ■ 初回セットアップ手順
 *
 * 1. https://console.firebase.google.com/ にアクセスしてプロジェクトを作成
 * 2. 左メニュー「構築」→「Realtime Database」→「データベースを作成」
 *    ・ロケーション: 任意（Asia-Northeast1 が日本に近い）
 *    ・セキュリティルール: テストモードで開始（後で変更可）
 * 3. プロジェクトの設定（歯車アイコン）→「全般」→「マイアプリ」→
 *    ウェブアプリを追加 → 表示される設定オブジェクトを以下に貼り付ける
 * 4. Realtime Database の「ルール」タブを開き、以下に書き換えて「公開」
 *    {
 *      "rules": {
 *        "hisaku": {
 *          ".read": true,
 *          ".write": true
 *        }
 *      }
 *    }
 *
 * ※ Firebase の設定値（apiKey 等）は公開しても安全な値です。
 *   セキュリティはルールで制御されます。
 */
const firebaseConfig = {
  apiKey: "AIzaSyBGJcRIGfdBal5JQZhnrtrrDawhxEAnVEU",
  authDomain: "hisaku-f2818.firebaseapp.com",
  databaseURL: "https://hisaku-f2818-default-rtdb.firebaseio.com",
  projectId: "hisaku-f2818",
  storageBucket: "hisaku-f2818.firebasestorage.app",
  messagingSenderId: "730399990359",
  appId: "1:730399990359:web:4557bfeaba69406c517912",
  measurementId: "G-LLL7RGMK9V"
};
