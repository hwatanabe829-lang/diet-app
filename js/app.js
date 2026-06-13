// ===== 計算ロジック =====

function calcBMR(profile) {
  const { gender, weight, height, age } = profile;
  const base = 10 * weight + 6.25 * height - 5 * age;
  return gender === "male" ? base + 5 : base - 161;
}

function calcTDEE(profile) {
  return calcBMR(profile) * profile.activityLevel;
}

function calcGoalKcal(profile) {
  return Math.max(calcTDEE(profile) - profile.deficit, 1200);
}

function calcPFCGrams(profile) {
  const goalKcal = calcGoalKcal(profile);
  const { p, f, c } = profile.pfcRatio;
  return {
    p: Math.round((goalKcal * (p / 100)) / 4),
    f: Math.round((goalKcal * (f / 100)) / 9),
    c: Math.round((goalKcal * (c / 100)) / 4),
  };
}

function calcWorkoutCalories(met, durationMin, weightKg) {
  return Math.round(met * weightKg * (durationMin / 60));
}

// ===== タブ切り替え =====

function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "dashboard") renderDashboard();
    });
  });
}

// ===== セレクトボックス初期化 =====

function initSelects() {
  const workoutSelect = document.getElementById("workoutType");
  BOXING_TYPES.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.name;
    opt.textContent = `${t.name} (MET ${t.met})`;
    workoutSelect.appendChild(opt);
  });
  workoutSelect.addEventListener("change", () => {
    document.getElementById("safetyNote").style.display =
      workoutSelect.value === "スパーリング" ? "block" : "none";
  });

  const foodSelect = document.getElementById("foodSelect");
  let lastCategory = "";
  FOODS.forEach((f) => {
    if (f.category !== lastCategory) {
      const group = document.createElement("optgroup");
      group.label = f.category;
      group.dataset.cat = f.category;
      foodSelect.appendChild(group);
      lastCategory = f.category;
    }
    const opt = document.createElement("option");
    opt.value = f.name;
    opt.textContent = `${f.name} (${f.kcal}kcal/100${f.unit})`;
    foodSelect.querySelector(`optgroup[label="${f.category}"]`).appendChild(opt);
  });

  foodSelect.addEventListener("change", updateNutrientPreview);
  document.getElementById("foodAmount").addEventListener("input", updateNutrientPreview);
  updateNutrientPreview();
}

function updateNutrientPreview() {
  const foodName = document.getElementById("foodSelect").value;
  const amount = parseFloat(document.getElementById("foodAmount").value) || 0;
  const food = FOODS.find((f) => f.name === foodName);
  if (!food) return;
  const ratio = amount / 100;
  const kcal = Math.round(food.kcal * ratio);
  const p = (food.p * ratio).toFixed(1);
  const f = (food.f * ratio).toFixed(1);
  const c = (food.c * ratio).toFixed(1);
  document.getElementById("nutrientPreview").textContent =
    `${kcal} kcal / P: ${p}g / F: ${f}g / C: ${c}g`;
}

// ===== ワークアウト =====

function handleWorkoutSubmit(e) {
  e.preventDefault();
  const profile = getProfile();
  const typeName = document.getElementById("workoutType").value;
  const duration = parseInt(document.getElementById("workoutDuration").value, 10);
  const note = document.getElementById("workoutNote").value.trim();
  const type = BOXING_TYPES.find((t) => t.name === typeName);
  const calories = calcWorkoutCalories(type.met, duration, profile.weight);

  addWorkout({
    date: todayStr(),
    type: typeName,
    duration,
    note,
    calories,
  });

  document.getElementById("workoutNote").value = "";
  renderBoxing();
  renderDashboard();
}

function renderBoxing() {
  const all = getWorkouts().sort((a, b) => b.id - a.id);
  const today = todayStr();
  const todayList = all.filter((w) => w.date === today);
  const historyList = all.filter((w) => w.date !== today).slice(0, 20);

  const todayContainer = document.getElementById("todayWorkoutList");
  todayContainer.innerHTML = "";
  if (todayList.length === 0) {
    todayContainer.innerHTML = `<div class="sub">まだ記録がありません</div>`;
  }
  todayList.forEach((w) => todayContainer.appendChild(renderWorkoutItem(w)));

  const total = todayList.reduce((sum, w) => sum + w.calories, 0);
  document.getElementById("todayWorkoutTotal").textContent = total;

  const historyContainer = document.getElementById("workoutHistory");
  historyContainer.innerHTML = "";
  if (historyList.length === 0) {
    historyContainer.innerHTML = `<div class="sub">過去の記録はありません</div>`;
  }
  historyList.forEach((w) => historyContainer.appendChild(renderWorkoutItem(w)));
}

function renderWorkoutItem(w) {
  const div = document.createElement("div");
  div.className = "record-item";
  div.innerHTML = `
    <div>
      <div>${w.type} - ${w.duration}分${w.note ? "（" + w.note + "）" : ""}</div>
      <div class="meta">${w.date} / ${w.calories} kcal</div>
    </div>
    <button class="del-btn" title="削除">✕</button>
  `;
  div.querySelector(".del-btn").addEventListener("click", () => {
    deleteWorkout(w.id);
    renderBoxing();
    renderDashboard();
  });
  return div;
}

// ===== 食事 =====

function handleMealSubmit(e) {
  e.preventDefault();
  const mealType = document.getElementById("mealType").value;
  const foodName = document.getElementById("foodSelect").value;
  const amount = parseFloat(document.getElementById("foodAmount").value);
  const food = FOODS.find((f) => f.name === foodName);
  const ratio = amount / 100;

  addMeal({
    date: todayStr(),
    mealType,
    name: food.name,
    amount,
    unit: food.unit,
    kcal: Math.round(food.kcal * ratio),
    p: Math.round(food.p * ratio * 10) / 10,
    f: Math.round(food.f * ratio * 10) / 10,
    c: Math.round(food.c * ratio * 10) / 10,
  });

  renderMeals();
  renderDashboard();
}

// ===== 写真からのカロリー解析 =====

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // data:<mime>;base64,<data>
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function analyzeFoodPhoto(base64, mediaType) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("設定タブでAnthropic APIキーを保存してください");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            {
              type: "text",
              text:
                "この写真に写っている食事の内容を分析してください。料理名と、写っている量から推定した栄養価(1食分)を、" +
                '次のJSON形式のみで答えてください(説明文や前後の文章は不要): ' +
                '{"name":"料理名","kcal":数値,"p":数値,"f":数値,"c":数値}',
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`APIエラー (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  const text = data.content.map((c) => c.text || "").join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("解析結果を読み取れませんでした: " + text);
  return JSON.parse(match[0]);
}

function handlePhotoInputChange(e) {
  const file = e.target.files[0];
  const preview = document.getElementById("photoPreview");
  if (!file) {
    preview.style.display = "none";
    return;
  }
  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";
  document.getElementById("photoResultForm").style.display = "none";
}

async function handleAnalyzePhoto() {
  const fileInput = document.getElementById("photoInput");
  const status = document.getElementById("photoStatus");
  const resultForm = document.getElementById("photoResultForm");
  const file = fileInput.files[0];

  if (!file) {
    alert("写真を選択してください");
    return;
  }

  status.style.display = "block";
  status.textContent = "解析中...";
  resultForm.style.display = "none";

  try {
    const base64 = await fileToBase64(file);
    const result = await analyzeFoodPhoto(base64, file.type);

    document.getElementById("photoName").value = result.name || "";
    document.getElementById("photoKcal").value = Math.round(result.kcal) || 0;
    document.getElementById("photoP").value = result.p ?? 0;
    document.getElementById("photoF").value = result.f ?? 0;
    document.getElementById("photoC").value = result.c ?? 0;

    status.style.display = "none";
    resultForm.style.display = "grid";
  } catch (err) {
    status.textContent = "エラー: " + err.message;
  }
}

function handlePhotoResultSubmit(e) {
  e.preventDefault();
  addMeal({
    date: todayStr(),
    mealType: document.getElementById("photoMealType").value,
    name: document.getElementById("photoName").value.trim(),
    amount: null,
    unit: "",
    kcal: parseFloat(document.getElementById("photoKcal").value),
    p: parseFloat(document.getElementById("photoP").value),
    f: parseFloat(document.getElementById("photoF").value),
    c: parseFloat(document.getElementById("photoC").value),
  });

  e.target.reset();
  document.getElementById("photoResultForm").style.display = "none";
  document.getElementById("photoPreview").style.display = "none";
  document.getElementById("photoInput").value = "";
  renderMeals();
  renderDashboard();
}

// ===== APIキー設定 =====

function loadApiKeyForm() {
  document.getElementById("apiKeyInput").value = getApiKey();
}

function handleApiKeySubmit(e) {
  e.preventDefault();
  saveApiKey(document.getElementById("apiKeyInput").value.trim());
  alert("APIキーを保存しました");
}

function handleCustomFoodSubmit(e) {
  e.preventDefault();
  const mealType = document.getElementById("customMealType").value;
  const name = document.getElementById("customName").value.trim();
  const kcal = parseFloat(document.getElementById("customKcal").value);
  const p = parseFloat(document.getElementById("customP").value);
  const f = parseFloat(document.getElementById("customF").value);
  const c = parseFloat(document.getElementById("customC").value);

  addMeal({
    date: todayStr(),
    mealType,
    name,
    amount: null,
    unit: "",
    kcal,
    p,
    f,
    c,
  });

  e.target.reset();
  renderMeals();
  renderDashboard();
}

function renderMeals() {
  const today = todayStr();
  const meals = getMeals().filter((m) => m.date === today).sort((a, b) => b.id - a.id);
  const container = document.getElementById("todayMealList");
  container.innerHTML = "";
  if (meals.length === 0) {
    container.innerHTML = `<div class="sub">まだ記録がありません</div>`;
  }
  meals.forEach((m) => container.appendChild(renderMealItem(m)));

  const totalKcal = meals.reduce((s, m) => s + m.kcal, 0);
  const totalP = meals.reduce((s, m) => s + m.p, 0);
  const totalF = meals.reduce((s, m) => s + m.f, 0);
  const totalC = meals.reduce((s, m) => s + m.c, 0);

  document.getElementById("todayMealKcal").textContent = totalKcal;
  document.getElementById("todayMealP").textContent = totalP.toFixed(1);
  document.getElementById("todayMealF").textContent = totalF.toFixed(1);
  document.getElementById("todayMealC").textContent = totalC.toFixed(1);
}

function renderMealItem(m) {
  const div = document.createElement("div");
  div.className = "record-item";
  const amountText = m.amount ? `${m.amount}${m.unit}` : "カスタム";
  div.innerHTML = `
    <div>
      <div>[${m.mealType}] ${m.name} (${amountText})</div>
      <div class="meta">${m.kcal} kcal / P:${m.p}g F:${m.f}g C:${m.c}g</div>
    </div>
    <button class="del-btn" title="削除">✕</button>
  `;
  div.querySelector(".del-btn").addEventListener("click", () => {
    deleteMeal(m.id);
    renderMeals();
    renderDashboard();
  });
  return div;
}

// ===== 睡眠 =====

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function handleSleepSubmit(e) {
  e.preventDefault();
  const date = document.getElementById("sleepDate").value;
  const bedTime = document.getElementById("bedTime").value;
  const wakeTime = document.getElementById("wakeTime").value;
  const quality = document.getElementById("sleepQuality").value;

  let bed = timeToMinutes(bedTime);
  let wake = timeToMinutes(wakeTime);
  let diff = wake - bed;
  if (diff <= 0) diff += 24 * 60; // 日をまたぐ場合
  const hours = Math.round((diff / 60) * 10) / 10;

  addSleep({ date, bedTime, wakeTime, quality, hours });
  renderSleep();
  renderDashboard();
}

const QUALITY_LABEL = { good: "良い", normal: "普通", bad: "悪い" };

function renderSleep() {
  const all = getSleeps().sort((a, b) => (a.date < b.date ? 1 : -1));
  const container = document.getElementById("sleepHistory");
  container.innerHTML = "";
  if (all.length === 0) {
    container.innerHTML = `<div class="sub">まだ記録がありません</div>`;
  }
  all.slice(0, 20).forEach((s) => {
    const div = document.createElement("div");
    div.className = "record-item";
    div.innerHTML = `
      <div>
        <div>${s.date}: ${s.bedTime} 〜 ${s.wakeTime}</div>
        <div class="meta">${s.hours}時間 / 質: ${QUALITY_LABEL[s.quality] || s.quality}</div>
      </div>
      <button class="del-btn" title="削除">✕</button>
    `;
    div.querySelector(".del-btn").addEventListener("click", () => {
      deleteSleep(s.id);
      renderSleep();
      renderDashboard();
    });
    container.appendChild(div);
  });

  // 週間平均
  const last7 = getLastNDates(7);
  const recent = all.filter((s) => last7.includes(s.date));
  if (recent.length > 0) {
    const avg = recent.reduce((sum, s) => sum + s.hours, 0) / recent.length;
    document.getElementById("weeklyAvgSleep").textContent = avg.toFixed(1);
  } else {
    document.getElementById("weeklyAvgSleep").textContent = "-";
  }
}

// ===== 設定 =====

function loadProfileForm() {
  const profile = getProfile();
  document.getElementById("profName").value = profile.name;
  document.getElementById("profGender").value = profile.gender;
  document.getElementById("profAge").value = profile.age;
  document.getElementById("profHeight").value = profile.height;
  document.getElementById("profWeight").value = profile.weight;
  document.getElementById("profActivity").value = profile.activityLevel;
  document.getElementById("profDeficit").value = profile.deficit;
  document.getElementById("ratioP").value = profile.pfcRatio.p;
  document.getElementById("ratioF").value = profile.pfcRatio.f;
  document.getElementById("ratioC").value = profile.pfcRatio.c;
  document.getElementById("profSleepGoal").value = profile.sleepGoalHours;
  renderGoals(profile);
}

function handleProfileSubmit(e) {
  e.preventDefault();
  const p = parseInt(document.getElementById("ratioP").value, 10);
  const f = parseInt(document.getElementById("ratioF").value, 10);
  const c = parseInt(document.getElementById("ratioC").value, 10);

  if (p + f + c !== 100) {
    alert("PFC比率の合計は100%にしてください(現在: " + (p + f + c) + "%)");
    return;
  }

  const profile = {
    name: document.getElementById("profName").value.trim(),
    gender: document.getElementById("profGender").value,
    age: parseInt(document.getElementById("profAge").value, 10),
    height: parseFloat(document.getElementById("profHeight").value),
    weight: parseFloat(document.getElementById("profWeight").value),
    activityLevel: parseFloat(document.getElementById("profActivity").value),
    deficit: parseInt(document.getElementById("profDeficit").value, 10),
    pfcRatio: { p, f, c },
    sleepGoalHours: parseFloat(document.getElementById("profSleepGoal").value),
  };

  saveProfile(profile);
  renderGoals(profile);
  renderDashboard();
  alert("保存しました");
}

function renderGoals(profile) {
  const bmr = calcBMR(profile);
  const tdee = calcTDEE(profile);
  const goalKcal = calcGoalKcal(profile);
  const pfc = calcPFCGrams(profile);

  document.getElementById("calcBMR").textContent = Math.round(bmr) + " kcal";
  document.getElementById("calcTDEE").textContent = Math.round(tdee) + " kcal";
  document.getElementById("calcGoalKcal").textContent = Math.round(goalKcal) + " kcal";
  document.getElementById("calcGoalP").textContent = pfc.p + " g";
  document.getElementById("calcGoalF").textContent = pfc.f + " g";
  document.getElementById("calcGoalC").textContent = pfc.c + " g";
}

// ===== データのエクスポート/インポート =====

function handleExport() {
  const data = {
    profile: getProfile(),
    workouts: getWorkouts(),
    meals: getMeals(),
    sleeps: getSleeps(),
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `diet-app-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.profile) saveProfile(data.profile);
      if (data.workouts) saveJSON(STORAGE_KEYS.WORKOUTS, data.workouts);
      if (data.meals) saveJSON(STORAGE_KEYS.MEALS, data.meals);
      if (data.sleeps) saveJSON(STORAGE_KEYS.SLEEPS, data.sleeps);
      alert("インポートが完了しました");
      loadProfileForm();
      renderDashboard();
      renderBoxing();
      renderMeals();
      renderSleep();
    } catch (err) {
      alert("インポートに失敗しました: " + err.message);
    }
  };
  reader.readAsText(file);
}

// ===== ダッシュボード =====

let weeklyChartInstance = null;

function calcStreak() {
  const workouts = getWorkouts();
  const meals = getMeals();
  const dateSet = new Set([...workouts.map((w) => w.date), ...meals.map((m) => m.date)]);

  let streak = 0;
  let d = new Date();
  while (true) {
    const ds = d.toISOString().slice(0, 10);
    if (dateSet.has(ds)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function renderDashboard() {
  const profile = getProfile();
  const today = todayStr();
  document.getElementById("todayDate").textContent = `(${today})`;

  // 摂取カロリー
  const meals = getMeals().filter((m) => m.date === today);
  const intake = meals.reduce((s, m) => s + m.kcal, 0);
  const intakeP = meals.reduce((s, m) => s + m.p, 0);
  const intakeF = meals.reduce((s, m) => s + m.f, 0);
  const intakeC = meals.reduce((s, m) => s + m.c, 0);

  const goalKcal = Math.round(calcGoalKcal(profile));
  const pfcGoal = calcPFCGrams(profile);

  document.getElementById("dashIntake").textContent = Math.round(intake);
  document.getElementById("dashGoalKcal").textContent = goalKcal;
  document.getElementById("barIntake").style.width = Math.min((intake / goalKcal) * 100, 100) + "%";

  document.getElementById("barP").style.width = Math.min((intakeP / pfcGoal.p) * 100, 100) + "%";
  document.getElementById("barF").style.width = Math.min((intakeF / pfcGoal.f) * 100, 100) + "%";
  document.getElementById("barC").style.width = Math.min((intakeC / pfcGoal.c) * 100, 100) + "%";
  document.getElementById("textP").textContent = `${intakeP.toFixed(1)} / ${pfcGoal.p} g`;
  document.getElementById("textF").textContent = `${intakeF.toFixed(1)} / ${pfcGoal.f} g`;
  document.getElementById("textC").textContent = `${intakeC.toFixed(1)} / ${pfcGoal.c} g`;

  // 運動消費
  const workouts = getWorkouts().filter((w) => w.date === today);
  const burn = workouts.reduce((s, w) => s + w.calories, 0);
  document.getElementById("dashBurn").textContent = burn;

  // 睡眠
  const sleeps = getSleeps();
  const lastNight = sleeps.find((s) => s.date === today) ||
    sleeps.sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  document.getElementById("dashSleep").textContent = lastNight ? lastNight.hours : "-";
  document.getElementById("dashSleepGoal").textContent = profile.sleepGoalHours;

  // 連続記録
  document.getElementById("streakBadge").textContent = `🔥 連続${calcStreak()}日`;

  renderWeeklyChart(profile);
}

function renderWeeklyChart(profile) {
  const dates = getLastNDates(7);
  const meals = getMeals();
  const workouts = getWorkouts();
  const sleeps = getSleeps();

  const intakeData = dates.map((d) =>
    meals.filter((m) => m.date === d).reduce((s, m) => s + m.kcal, 0)
  );
  const burnData = dates.map((d) =>
    workouts.filter((w) => w.date === d).reduce((s, w) => s + w.calories, 0)
  );
  const sleepData = dates.map((d) => {
    const s = sleeps.find((sl) => sl.date === d);
    return s ? s.hours : null;
  });

  const goalKcal = Math.round(calcGoalKcal(profile));

  const ctx = document.getElementById("weeklyChart").getContext("2d");
  if (weeklyChartInstance) weeklyChartInstance.destroy();

  weeklyChartInstance = new Chart(ctx, {
    data: {
      labels: dates.map((d) => d.slice(5)), // MM-DD
      datasets: [
        {
          type: "bar",
          label: "摂取カロリー",
          data: intakeData,
          backgroundColor: "#e63946",
          yAxisID: "y",
        },
        {
          type: "bar",
          label: "運動消費",
          data: burnData,
          backgroundColor: "#2a9d8f",
          yAxisID: "y",
        },
        {
          type: "line",
          label: "目標カロリー",
          data: dates.map(() => goalKcal),
          borderColor: "#999",
          borderDash: [5, 5],
          pointRadius: 0,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "睡眠時間",
          data: sleepData,
          borderColor: "#4361ee",
          backgroundColor: "#4361ee",
          yAxisID: "y1",
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          type: "linear",
          position: "left",
          title: { display: true, text: "kcal" },
        },
        y1: {
          type: "linear",
          position: "right",
          title: { display: true, text: "時間" },
          min: 0,
          max: 12,
          grid: { drawOnChartArea: false },
        },
      },
    },
  });
}

// ===== 初期化 =====

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initSelects();

  document.getElementById("workoutForm").addEventListener("submit", handleWorkoutSubmit);
  document.getElementById("mealForm").addEventListener("submit", handleMealSubmit);
  document.getElementById("customFoodForm").addEventListener("submit", handleCustomFoodSubmit);
  document.getElementById("sleepForm").addEventListener("submit", handleSleepSubmit);
  document.getElementById("profileForm").addEventListener("submit", handleProfileSubmit);
  document.getElementById("exportBtn").addEventListener("click", handleExport);
  document.getElementById("importFile").addEventListener("change", handleImport);

  document.getElementById("photoInput").addEventListener("change", handlePhotoInputChange);
  document.getElementById("analyzePhotoBtn").addEventListener("click", handleAnalyzePhoto);
  document.getElementById("photoResultForm").addEventListener("submit", handlePhotoResultSubmit);
  document.getElementById("apiKeyForm").addEventListener("submit", handleApiKeySubmit);

  document.getElementById("sleepDate").value = todayStr();

  loadApiKeyForm();
  loadProfileForm();
  renderBoxing();
  renderMeals();
  renderSleep();
  renderDashboard();
});
