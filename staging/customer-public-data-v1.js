(() => {
  "use strict";
  if (window.StagingCustomerPublicData) return;

  const PREFIX = "__chicken_eggs_staging__::";
  const KEYS = {
    app2: "chickenEggApp2V1",
    inventory: "chickenEggInventoryV2",
    entries: "chickenEggEntriesV102",
    settings: "chickenEggSettingsV102",
    weather: "chickenEggWeatherIntelligenceV2",
    deluxe: "chickenEggDeluxeV1",
    photos: "chickenEggLocalBirdPhotosV1",
    seed: "chickenEggStagingSeedV1"
  };

  const FACTS = [
    "Chickens experience REM sleep, the sleep stage associated with dreaming in people.",
    "A chicken can rest one half of its brain while the other half stays alert.",
    "Chickens can recognize many individual flock mates and remember their social relationships.",
    "A hen may make a special soft call to her chicks before they even hatch.",
    "Chicks can communicate with their mother from inside the egg before hatching.",
    "Chickens use dozens of different calls for food, danger, contact, nesting, and more.",
    "Roosters can give different alarm calls for threats in the sky and threats on the ground.",
    "A chicken's comb helps release body heat, so it works a little like a built-in radiator.",
    "Chicken earlobe color can sometimes hint at egg color, but breed genetics are what really decide it.",
    "Eggshell color does not change the nutrition inside the egg.",
    "A hen forms an eggshell mostly from calcium during the final hours before laying.",
    "Chickens are excellent scratchers because their feet are built for uncovering seeds and insects.",
    "Dust bathing helps chickens keep feathers in good condition and can help control external parasites.",
    "Sunbathing is normal chicken behavior; birds often stretch a wing and lie sideways in the sun.",
    "Chickens have very good color vision and can see colors humans cannot see as well.",
    "A rooster often calls hens over to a tasty food find before eating much of it himself.",
    "Hens can remember good nesting locations and may strongly prefer a favorite box.",
    "The pecking order is a real social ranking that helps a flock decide access to food, space, and preferred spots.",
    "Chickens can learn simple routines quickly, especially when food or treats are involved.",
    "A broody hen may turn her eggs many times a day to help embryos develop evenly.",
    "Chicken eggs normally take about 21 days to hatch, though timing can vary a little.",
    "Newly hatched chicks can live briefly on nutrients absorbed from the yolk just before hatch.",
    "A chicken's crop is a temporary food-storage pouch that lets it eat quickly and digest later.",
    "Food is ground in a chicken's gizzard because chickens do not have teeth.",
    "Small stones and grit in the gizzard help chickens grind tougher foods.",
    "Chickens naturally prefer to sleep on a perch because getting off the ground can feel safer.",
    "Many hens sing a loud 'egg song' before or after laying.",
    "Roosters do not crow only at sunrise; they can crow throughout the day for many reasons.",
    "A healthy flock spends a surprising amount of its day foraging, scratching, preening, and exploring.",
    "Individual chickens can have noticeably different personalities, from bold and curious to quiet and cautious.",
    "Chickens can learn to come when called when a sound is consistently paired with treats.",
    "Feather color can change slightly after a molt because fresh feathers have not yet been worn or sun-faded.",
    "Molting is the natural process of replacing old feathers and often temporarily reduces egg production.",
    "Daylight length strongly influences laying because a hen's reproductive cycle responds to light.",
    "A rooster's hackle and saddle feathers are specialized pointed feathers that become more obvious as he matures.",
    "Some hens squat when approached because the posture is part of normal reproductive behavior.",
    "Chickens can run surprisingly fast for short distances when they decide a treat is worth chasing.",
    "Flock mates often preen near one another when they feel relaxed and secure.",
    "A hen may use different calls when she finds food than when she is warning the flock about danger.",
    "Every chicken has its own voice, and flock keepers can often learn who is calling without seeing the bird."
  ];

  function read(key, fallback) {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  function n(v) { return Number(v) || 0; }
  function whole(v) { return Math.max(0, Math.round(n(v))); }
  function localDate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function addDays(date, amount) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + amount);
    return localDate(d);
  }
  function avg(values) {
    return values.length ? values.reduce((a,b)=>a+b,0) / values.length : 0;
  }
  function ageText(date) {
    if (!date) return "Age unknown";
    const born = new Date(String(date) + "T12:00:00");
    if (Number.isNaN(born.getTime())) return "Age unknown";
    const days = Math.max(0, Math.floor((Date.now() - born.getTime()) / 86400000));
    if (days < 14) return `${days} days old`;
    if (days < 112) return `${Math.floor(days/7)} weeks old`;
    const months = Math.floor(days / 30.44);
    if (months < 24) return `${months} months old`;
    return `${Math.floor(months/12)}y ${months%12}m old`;
  }
  function imageValue(value) {
    return typeof value === "string" && (value.startsWith("data:image/") || /^https?:\/\//i.test(value)) ? value : "";
  }
  function weatherCode(code) {
    const c = Number(code);
    if (c === 0) return { emoji:"☀️", text:"Clear" };
    if (c === 1) return { emoji:"🌤️", text:"Mainly clear" };
    if (c === 2) return { emoji:"⛅", text:"Partly cloudy" };
    if (c === 3) return { emoji:"☁️", text:"Overcast" };
    if ([45,48].includes(c)) return { emoji:"🌫️", text:"Foggy" };
    if ([51,53,55,56,57].includes(c)) return { emoji:"🌦️", text:"Drizzle" };
    if ([61,63,65,66,67].includes(c)) return { emoji:"🌧️", text:"Rain" };
    if ([71,73,75,77].includes(c)) return { emoji:"🌨️", text:"Snow" };
    if ([80,81,82].includes(c)) return { emoji:"🌦️", text:"Rain showers" };
    if ([85,86].includes(c)) return { emoji:"🌨️", text:"Snow showers" };
    if ([95,96,99].includes(c)) return { emoji:"⛈️", text:"Thunderstorms" };
    return { emoji:"🌤️", text:"Weather" };
  }

  function publicFlock(app2, photos) {
    const hidden = /^(sold|removed|rehomed|deceased|inactive)$/i;
    const flock = Array.isArray(app2?.flock) ? app2.flock : [];
    return flock
      .filter(b => b && !hidden.test(String(b.status || "Active").trim()))
      .map(b => ({
        id: String(b.id || ""),
        name: String(b.name || "Chicken").trim() || "Chicken",
        breed: String(b.breed || "Breed not listed").trim() || "Breed not listed",
        sex: String(b.sex || "Unknown").trim() || "Unknown",
        hatchDate: /^\d{4}-\d{2}-\d{2}$/.test(String(b.hatchDate || "")) ? String(b.hatchDate) : "",
        age: ageText(b.hatchDate),
        photo: imageValue(photos?.[String(b.id || "")])
      }));
  }

  function eggMap(entries) {
    const map = {};
    for (const e of Array.isArray(entries) ? entries : []) {
      if (e?.type !== "eggs" || !e.date) continue;
      const date = String(e.date).slice(0,10);
      map[date] = (map[date] || 0) + whole(e.eggs);
    }
    return map;
  }

  function productionForecast(entries, settings) {
    const map = eggMap(entries);
    const today = localDate();
    const allDates = Object.keys(map).filter(d => d <= today).sort();
    const recentCutoff = addDays(today, -21);
    let recentDates = allDates.filter(d => d >= recentCutoff).slice(-7);
    if (recentDates.length < 3) recentDates = allDates.slice(-7);
    const recentValues = recentDates.map(d => whole(map[d]));
    const last3Values = recentValues.slice(-3);
    const recentAvg = avg(recentValues);
    const last3Avg = avg(last3Values);
    const lifetimeAvg = allDates.length ? avg(allDates.map(d => whole(map[d]))) : 0;

    let adaptiveDaily = recentAvg || lifetimeAvg || 0;
    if (recentValues.length >= 3) {
      const accelerating = recentAvg > 0 && last3Avg > recentAvg * 1.15;
      adaptiveDaily = accelerating ? last3Avg * .70 + recentAvg * .30 : last3Avg * .55 + recentAvg * .45;
    }

    const now = new Date();
    now.setHours(12,0,0,0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartKey = localDate(weekStart);
    const weekEggs = allDates.filter(d => d >= weekStartKey && d <= today).reduce((s,d)=>s+whole(map[d]),0);
    const elapsedWeekDays = now.getDay() + 1;
    const remainingWeekDays = Math.max(0, 7 - elapsedWeekDays);
    const observedWeekPace = weekEggs > 0 ? weekEggs / elapsedWeekDays : 0;
    if (observedWeekPace > adaptiveDaily) {
      const weekWeight = Math.min(.65, .25 + elapsedWeekDays * .07);
      adaptiveDaily = adaptiveDaily * (1-weekWeight) + observedWeekPace * weekWeight;
    }

    const hens = Math.max(0, n(settings?.hens));
    const recentMax = recentValues.length ? Math.max(...recentValues) : 0;
    if (hens > 0 && recentMax <= hens * 1.20) adaptiveDaily = Math.min(adaptiveDaily, hens);
    adaptiveDaily = Math.max(0, adaptiveDaily);

    const predictedWeek = Math.max(weekEggs, Math.round(weekEggs + adaptiveDaily * remainingWeekDays));
    const monthPrefix = today.slice(0,7);
    const monthEggs = allDates.filter(d => d.startsWith(monthPrefix)).reduce((s,d)=>s+whole(map[d]),0);
    const year = Number(today.slice(0,4));
    const monthIndex = Number(today.slice(5,7)) - 1;
    const dayOfMonth = Number(today.slice(8,10));
    const daysInMonth = new Date(year, monthIndex+1, 0).getDate();
    const remainingMonthDays = Math.max(0, daysInMonth - dayOfMonth);
    const predictedMonth = Math.max(monthEggs, Math.round(monthEggs + adaptiveDaily * remainingMonthDays));
    const alreadyToday = whole(map[today]);
    const todayLow = adaptiveDaily ? Math.max(alreadyToday, Math.round(adaptiveDaily * .85)) : alreadyToday;
    const todayHigh = adaptiveDaily ? Math.max(todayLow, alreadyToday, Math.round(adaptiveDaily * 1.15)) : alreadyToday;

    return {
      todayCollected: alreadyToday,
      todayLow,
      todayHigh,
      dailyPace: Math.round(adaptiveDaily * 10) / 10,
      weekCollected: weekEggs,
      predictedWeek,
      monthCollected: monthEggs,
      predictedMonth,
      confidence: recentDates.length >= 7 ? "Strong recent data" : recentDates.length >= 4 ? "Building recent data" : "Learning the flock"
    };
  }

  function safeWeather(state) {
    state = state && typeof state === "object" ? state : {};
    const today = localDate();
    const f = state.forecast?.[today] || {};
    const c = state.current || {};
    const cond = weatherCode(c.code ?? f.code);
    return {
      location: String(state.label || state.location || "High Point, NC").trim() || "High Point, NC",
      emoji: cond.emoji,
      condition: cond.text,
      temperature: Number.isFinite(Number(c.temperature)) ? Math.round(Number(c.temperature)) : null,
      feelsLike: Number.isFinite(Number(c.apparent)) ? Math.round(Number(c.apparent)) : null,
      high: Number.isFinite(Number(f.max)) ? Math.round(Number(f.max)) : null,
      low: Number.isFinite(Number(f.min)) ? Math.round(Number(f.min)) : null,
      rainChance: Number.isFinite(Number(f.precipProbability)) ? Math.round(Number(f.precipProbability)) : null,
      humidity: Number.isFinite(Number(c.humidity)) ? Math.round(Number(c.humidity)) : null,
      updatedAt: whole(state.lastRefreshAt || state.updatedAt)
    };
  }

  function availability(inventory, app2) {
    const physical = whole(inventory?.dozens) * 12 + whole(inventory?.packs18) * 18 + whole(inventory?.loose);
    const reserved = (Array.isArray(app2?.orders) ? app2.orders : [])
      .filter(o => o?.status === "pending")
      .reduce((sum,o)=>sum + whole(o.dozen) * 12 + whole(o.packs18) * 18, 0);
    const available = Math.max(0, physical - reserved);
    let label = "Plenty available";
    let tone = "good";
    if (available === 0) { label = "Currently spoken for"; tone = "none"; }
    else if (available < 12) { label = "A few available"; tone = "low"; }
    else if (available < 36) { label = "Limited availability"; tone = "medium"; }
    return {
      eggs: available,
      dozenEquivalent: Math.floor(available / 12),
      remainder: available % 12,
      label,
      tone,
      updatedAt: whole(inventory?.updatedAt)
    };
  }

  function dailyBird(flock, deluxe) {
    if (!flock.length) return null;
    const today = localDate();
    if (deluxe?.photoOverrideDate === today && deluxe?.photoOverrideBirdId) {
      const selected = flock.find(b => b.id === String(deluxe.photoOverrideBirdId));
      if (selected) return selected;
    }
    const seed = today.replace(/-/g, "").split("").reduce((a,b)=>a+n(b),0);
    return flock[seed % flock.length];
  }

  function build() {
    const app2 = read(KEYS.app2, {});
    const inventory = read(KEYS.inventory, {});
    const entries = read(KEYS.entries, []);
    const settings = read(KEYS.settings, {});
    const weatherState = read(KEYS.weather, {});
    const deluxe = read(KEYS.deluxe, {});
    const photos = read(KEYS.photos, {});
    const seed = read(KEYS.seed, {});
    const flock = publicFlock(app2, photos);
    const forecast = productionForecast(entries, settings);
    const weather = safeWeather(weatherState);
    const available = availability(inventory, app2);
    const chicken = dailyBird(flock, deluxe);
    const today = localDate();
    const factIndex = today.replace(/-/g, "").split("").reduce((a,b)=>a+n(b),0) % FACTS.length;

    return {
      schema: "customer-public-v1",
      environment: "staging-preview",
      farm: {
        name: String(settings?.farmName || "Rose Family Poultry").trim() || "Rose Family Poultry",
        location: weather.location
      },
      availability: available,
      production: forecast,
      weather,
      chickenOfTheDay: chicken,
      flock,
      facts: FACTS.slice(),
      factIndex,
      meta: {
        generatedAt: Date.now(),
        sourceSnapshotAt: whole(seed?.importedAt),
        flockCount: flock.length,
        photoCount: flock.filter(b=>!!b.photo).length
      }
    };
  }

  window.StagingCustomerPublicData = {
    version: 1,
    prefix: PREFIX,
    build,
    facts: () => FACTS.slice()
  };
})();
