// 食品データベース (100gあたりの栄養価)
// kcal: カロリー, p: タンパク質(g), f: 脂質(g), c: 炭水化物(g)
const FOODS = [
  // 主食
  { name: "白米(ごはん)", category: "主食", unit: "g", kcal: 156, p: 2.5, f: 0.3, c: 37.1 },
  { name: "玄米ごはん", category: "主食", unit: "g", kcal: 152, p: 2.8, f: 1.0, c: 35.6 },
  { name: "食パン", category: "主食", unit: "g", kcal: 264, p: 9.3, f: 4.4, c: 46.7 },
  { name: "うどん(ゆで)", category: "主食", unit: "g", kcal: 95, p: 2.6, f: 0.4, c: 21.6 },
  { name: "そば(ゆで)", category: "主食", unit: "g", kcal: 132, p: 4.8, f: 1.0, c: 26.0 },
  { name: "パスタ(ゆで)", category: "主食", unit: "g", kcal: 165, p: 5.8, f: 0.9, c: 32.2 },
  { name: "オートミール", category: "主食", unit: "g", kcal: 380, p: 13.7, f: 5.7, c: 69.1 },

  // 肉類
  { name: "鶏むね肉(皮なし)", category: "肉類", unit: "g", kcal: 116, p: 23.3, f: 1.9, c: 0 },
  { name: "鶏もも肉(皮なし)", category: "肉類", unit: "g", kcal: 127, p: 19.0, f: 5.0, c: 0 },
  { name: "鶏ささみ", category: "肉類", unit: "g", kcal: 109, p: 23.9, f: 0.8, c: 0 },
  { name: "豚ロース(赤身)", category: "肉類", unit: "g", kcal: 150, p: 21.1, f: 5.6, c: 0.2 },
  { name: "豚もも肉", category: "肉類", unit: "g", kcal: 128, p: 20.5, f: 3.7, c: 0.2 },
  { name: "牛もも肉(赤身)", category: "肉類", unit: "g", kcal: 140, p: 21.3, f: 5.0, c: 0.5 },
  { name: "合いびき肉", category: "肉類", unit: "g", kcal: 251, p: 17.2, f: 19.8, c: 0.5 },

  // 魚類
  { name: "鮭(切り身)", category: "魚類", unit: "g", kcal: 133, p: 22.3, f: 4.1, c: 0.1 },
  { name: "さば", category: "魚類", unit: "g", kcal: 211, p: 20.6, f: 16.8, c: 0.3 },
  { name: "まぐろ(赤身)", category: "魚類", unit: "g", kcal: 125, p: 26.4, f: 1.4, c: 0.1 },
  { name: "ツナ缶(水煮)", category: "魚類", unit: "g", kcal: 70, p: 16.0, f: 0.7, c: 0.1 },
  { name: "えび", category: "魚類", unit: "g", kcal: 82, p: 18.4, f: 0.3, c: 0.3 },

  // 卵・大豆製品
  { name: "卵", category: "卵・大豆", unit: "g", kcal: 151, p: 12.3, f: 10.3, c: 0.3 },
  { name: "納豆", category: "卵・大豆", unit: "g", kcal: 200, p: 16.5, f: 10.0, c: 12.1 },
  { name: "豆腐(木綿)", category: "卵・大豆", unit: "g", kcal: 73, p: 6.7, f: 4.5, c: 1.6 },
  { name: "豆乳", category: "卵・大豆", unit: "ml", kcal: 46, p: 3.6, f: 2.0, c: 3.1 },
  { name: "油揚げ", category: "卵・大豆", unit: "g", kcal: 377, p: 23.4, f: 34.4, c: 0.4 },

  // 乳製品・補助食品
  { name: "牛乳", category: "乳製品", unit: "ml", kcal: 67, p: 3.3, f: 3.8, c: 4.8 },
  { name: "ヨーグルト(無糖)", category: "乳製品", unit: "g", kcal: 56, p: 3.6, f: 3.0, c: 4.9 },
  { name: "チーズ(プロセス)", category: "乳製品", unit: "g", kcal: 339, p: 22.7, f: 26.0, c: 1.3 },
  { name: "プロテイン(ホエイ)", category: "乳製品", unit: "g", kcal: 390, p: 70.0, f: 5.0, c: 10.0 },

  // 野菜・芋類
  { name: "ブロッコリー", category: "野菜", unit: "g", kcal: 33, p: 4.3, f: 0.5, c: 5.2 },
  { name: "トマト", category: "野菜", unit: "g", kcal: 19, p: 0.7, f: 0.1, c: 4.7 },
  { name: "キャベツ", category: "野菜", unit: "g", kcal: 21, p: 1.3, f: 0.2, c: 5.2 },
  { name: "ほうれん草", category: "野菜", unit: "g", kcal: 18, p: 2.2, f: 0.4, c: 2.8 },
  { name: "きゅうり", category: "野菜", unit: "g", kcal: 13, p: 1.0, f: 0.1, c: 3.0 },
  { name: "もやし", category: "野菜", unit: "g", kcal: 14, p: 1.7, f: 0.1, c: 2.3 },
  { name: "玉ねぎ", category: "野菜", unit: "g", kcal: 33, p: 1.0, f: 0.1, c: 7.2 },
  { name: "にんじん", category: "野菜", unit: "g", kcal: 35, p: 0.6, f: 0.1, c: 8.7 },
  { name: "さつまいも", category: "野菜", unit: "g", kcal: 126, p: 1.2, f: 0.2, c: 29.7 },
  { name: "じゃがいも", category: "野菜", unit: "g", kcal: 59, p: 1.6, f: 0.1, c: 13.1 },

  // 果物
  { name: "バナナ", category: "果物", unit: "g", kcal: 86, p: 1.1, f: 0.2, c: 21.4 },
  { name: "りんご", category: "果物", unit: "g", kcal: 53, p: 0.2, f: 0.1, c: 14.1 },
  { name: "みかん", category: "果物", unit: "g", kcal: 45, p: 0.7, f: 0.1, c: 11.0 },

  // 油脂・ナッツ
  { name: "オリーブオイル", category: "油脂", unit: "g", kcal: 894, p: 0, f: 100.0, c: 0 },
  { name: "バター", category: "油脂", unit: "g", kcal: 700, p: 0.6, f: 74.5, c: 0.2 },
  { name: "アーモンド", category: "油脂", unit: "g", kcal: 587, p: 19.6, f: 51.8, c: 20.3 },
];

// ボクシングエクササイズの種類とMET値(運動強度)
const BOXING_TYPES = [
  { name: "シャドーボクシング", met: 7.0 },
  { name: "ミット打ち", met: 8.0 },
  { name: "サンドバッグ", met: 8.0 },
  { name: "縄跳び", met: 11.0 },
  { name: "ロードワーク(ジョギング)", met: 8.0 },
  { name: "筋トレ・補強運動", met: 5.0 },
  { name: "スパーリング", met: 10.0 },
  { name: "ストレッチ・クールダウン", met: 2.5 },
];
