// localStorage を使ったデータ永続化ヘルパー

const STORAGE_KEYS = {
  PROFILE: "diet_app_profile",
  WORKOUTS: "diet_app_workouts",
  MEALS: "diet_app_meals",
  SLEEPS: "diet_app_sleeps",
  API_KEY: "diet_app_anthropic_api_key",
};

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error("読み込みエラー:", key, e);
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---- プロフィール ----
const DEFAULT_PROFILE = {
  name: "",
  gender: "male", // male | female
  age: 30,
  height: 170, // cm
  weight: 70, // kg
  activityLevel: 1.375, // 活動レベル係数
  deficit: 0, // 1日あたりの減量カロリー(kcal)
  pfcRatio: { p: 30, f: 20, c: 50 }, // %
  sleepGoalHours: 7.5,
};

function getProfile() {
  return loadJSON(STORAGE_KEYS.PROFILE, { ...DEFAULT_PROFILE });
}

function saveProfile(profile) {
  saveJSON(STORAGE_KEYS.PROFILE, profile);
}

// ---- ワークアウト(ボクシング運動) ----
function getWorkouts() {
  return loadJSON(STORAGE_KEYS.WORKOUTS, []);
}

function addWorkout(workout) {
  const list = getWorkouts();
  workout.id = Date.now();
  list.push(workout);
  saveJSON(STORAGE_KEYS.WORKOUTS, list);
  return workout;
}

function deleteWorkout(id) {
  const list = getWorkouts().filter((w) => w.id !== id);
  saveJSON(STORAGE_KEYS.WORKOUTS, list);
}

// ---- 食事記録 ----
function getMeals() {
  return loadJSON(STORAGE_KEYS.MEALS, []);
}

function addMeal(meal) {
  const list = getMeals();
  meal.id = Date.now();
  list.push(meal);
  saveJSON(STORAGE_KEYS.MEALS, list);
  return meal;
}

function deleteMeal(id) {
  const list = getMeals().filter((m) => m.id !== id);
  saveJSON(STORAGE_KEYS.MEALS, list);
}

// ---- 睡眠記録 ----
function getSleeps() {
  return loadJSON(STORAGE_KEYS.SLEEPS, []);
}

function addSleep(sleep) {
  const list = getSleeps();
  sleep.id = Date.now();
  // 同じ日付の記録は上書き
  const idx = list.findIndex((s) => s.date === sleep.date);
  if (idx >= 0) {
    list[idx] = sleep;
  } else {
    list.push(sleep);
  }
  saveJSON(STORAGE_KEYS.SLEEPS, list);
  return sleep;
}

function deleteSleep(id) {
  const list = getSleeps().filter((s) => s.id !== id);
  saveJSON(STORAGE_KEYS.SLEEPS, list);
}

// ---- Anthropic APIキー(写真解析用) ----
function getApiKey() {
  return localStorage.getItem(STORAGE_KEYS.API_KEY) || "";
}

function saveApiKey(key) {
  if (key) {
    localStorage.setItem(STORAGE_KEYS.API_KEY, key);
  } else {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
  }
}

// ---- 日付ユーティリティ ----
function getLastNDates(n) {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}
