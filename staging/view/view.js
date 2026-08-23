(() => {
  "use strict";
  const api = window.StagingCustomerPublicData;
  if (!api?.build) {
    document.getElementById("missingData")?.removeAttribute("hidden");
    return;
  }

  let data = null;
  let filter = "all";
  let factIndex = 0;
  let publicPhotoMap = new Map();
  let publicPhotosLoaded = false;
  let publicPhotosLoading = false;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const resolvedPhoto = bird => {
    const direct = typeof bird?.photo === "string" ? bird.photo : "";
    if (direct) return direct;
    return publicPhotoMap.get(String(bird?.id || "")) || "";
  };
  const photoHtml = (bird, className = "") => {
    const photo = resolvedPhoto(bird);
    return photo
      ? `<img class="${className}" src="${esc(photo)}" alt="${esc(bird?.name || "Chicken")}">`
      : `<span aria-hidden="true">${["Rooster","Cockerel"].includes(bird?.sex) ? "🐓" : "🐔"}</span>`;
  };

  function relativeTime(timestamp) {
    const t = Number(timestamp) || 0;
    if (!t) return "Preview snapshot ready";
    const seconds = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (seconds < 60) return "Snapshot refreshed less than a minute ago";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Snapshot refreshed ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Snapshot refreshed ${hours} hour${hours === 1 ? "" : "s"} ago`;
    return `Snapshot refreshed ${new Date(t).toLocaleDateString(undefined,{month:"short",day:"numeric"})}`;
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function renderAvailability() {
    const a = data.availability;
    setText("availableEggs", a.eggs);
    const parts = [];
    if (a.dozenEquivalent) parts.push(`${a.dozenEquivalent} dozen equivalent`);
    if (a.remainder) parts.push(`${a.remainder} extra egg${a.remainder === 1 ? "" : "s"}`);
    if (!parts.length) parts.push("Check back after the next collection");
    setText("availabilityEquivalent", parts.join(" • "));
    const badge = $("availabilityBadge");
    if (badge) {
      badge.textContent = a.label;
      badge.className = `availability-badge ${a.tone || ""}`.trim();
    }
    setText("freshness", relativeTime(data.meta.sourceSnapshotAt || a.updatedAt));
  }

  function renderProduction() {
    const p = data.production;
    setText("todayCollected", p.todayCollected);
    setText("todayForecast", p.todayLow === p.todayHigh ? String(p.todayHigh) : `${p.todayLow}–${p.todayHigh}`);
    setText("weekForecast", p.predictedWeek);
    setText("monthForecast", p.predictedMonth);
    setText("forecastConfidence", p.confidence);
    setText("forecastNote", `${p.weekCollected} eggs are already logged this week • current flock pace ${p.dailyPace.toFixed(1)} eggs/day.`);
  }

  function renderWeather() {
    const w = data.weather || {};
    setText("weatherEmoji", w.emoji || "🌤️");
    setText("weatherTemp", w.temperature == null ? "—" : w.temperature);
    setText("weatherCondition", w.condition || "Weather unavailable");
    setText("weatherFeels", w.feelsLike == null ? "" : `• feels like ${w.feelsLike}°`);
    setText("weatherHighLow", w.high == null || w.low == null ? "—" : `${w.high}° / ${w.low}°`);
    setText("weatherRain", w.rainChance == null ? "—" : `${w.rainChance}%`);
    setText("weatherHumidity", w.humidity == null ? "—" : `${w.humidity}%`);
  }

  function renderChickenOfDay() {
    const bird = data.chickenOfTheDay;
    const photo = $("chickenDayPhoto");
    if (!bird) {
      setText("chickenDayName", "The flock is off camera");
      setText("chickenDayDetails", "A featured chicken will appear when profiles are available.");
      if (photo) photo.innerHTML = "<span>🐔</span>";
      return;
    }
    setText("chickenDayName", bird.name);
    setText("chickenDayDetails", `${bird.breed} • ${bird.sex} • ${bird.age}`);
    if (photo) photo.innerHTML = photoHtml(bird);
  }

  function fact() {
    const facts = data?.facts || [];
    if (!facts.length) return;
    factIndex = ((factIndex % facts.length) + facts.length) % facts.length;
    setText("factText", facts[factIndex]);
  }

  function matchesFilter(bird) {
    if (filter === "hens") return ["Hen","Pullet"].includes(bird.sex);
    if (filter === "roosters") return ["Rooster","Cockerel"].includes(bird.sex);
    return true;
  }

  function renderFlock() {
    const all = data.flock || [];
    const shown = all.filter(matchesFilter);
    setText("flockCount", all.length);
    const grid = $("flockGrid");
    const empty = $("emptyFlock");
    if (!grid) return;
    grid.innerHTML = shown.map(bird => `
      <button type="button" class="bird-card" data-bird-id="${esc(bird.id)}" aria-label="View ${esc(bird.name)} profile">
        <div class="bird-photo">${photoHtml(bird)}</div>
        <span class="bird-sex">${esc(bird.sex)}</span>
        <div class="bird-body">
          <strong>${esc(bird.name)}</strong>
          <span>${esc(bird.breed)}<br>${esc(bird.age)}</span>
        </div>
      </button>`).join("");
    if (empty) empty.hidden = shown.length > 0;
    grid.querySelectorAll("[data-bird-id]").forEach(button => button.addEventListener("click", () => openProfile(button.dataset.birdId)));
  }

  function openProfile(id) {
    const bird = data?.flock?.find(b => String(b.id) === String(id));
    if (!bird) return;
    const modal = $("profileModal");
    const photo = $("profilePhoto");
    if (photo) photo.innerHTML = photoHtml(bird);
    setText("profileName", bird.name);
    const facts = $("profileFacts");
    if (facts) facts.innerHTML = `
      <div><span>Breed</span><strong>${esc(bird.breed)}</strong></div>
      <div><span>Sex</span><strong>${esc(bird.sex)}</strong></div>
      <div><span>Age</span><strong>${esc(bird.age)}</strong></div>
      <div><span>Hatch date</span><strong>${esc(bird.hatchDate || "Not listed")}</strong></div>`;
    if (modal) {
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      modal.querySelector(".modal-close")?.focus();
    }
  }

  function closeProfile() {
    const modal = $("profileModal");
    if (modal) modal.hidden = true;
    document.body.style.overflow = "";
  }

  function render() {
    data = api.build();
    const ready = Number(data.meta.sourceSnapshotAt) > 0 || data.flock.length > 0 || data.availability.updatedAt > 0;
    const missing = $("missingData");
    if (missing) missing.hidden = ready;
    if (!ready) return data;

    setText("farmName", data.farm.name);
    setText("farmLocation", data.farm.location);
    setText("footerFarmName", data.farm.name);
    document.title = `${data.farm.name} — Farm View`;
    renderAvailability();
    renderProduction();
    renderWeather();
    renderChickenOfDay();
    factIndex = data.factIndex;
    fact();
    renderFlock();
    return data;
  }

  function usablePublicWeather(w) {
    return !!(w && typeof w === "object" && (
      w.temperature != null || w.high != null || w.low != null ||
      w.humidity != null || w.rainChance != null ||
      (typeof w.condition === "string" && w.condition && w.condition !== "Weather")
    ));
  }

  async function hydratePublicDataOnce() {
    if (publicPhotosLoaded || publicPhotosLoading) return;
    publicPhotosLoading = true;
    try {
      await import("../../customer-public-reader-v2.js");
      const reader = window.FarmPublicCustomerReaderV2;
      if (!reader?.load) return;
      const snapshot = await reader.load();
      const flock = Array.isArray(snapshot?.flock) ? snapshot.flock : [];
      publicPhotoMap = new Map(
        flock
          .filter(b => b?.id && typeof b?.photo === "string" && b.photo)
          .map(b => [String(b.id), b.photo])
      );
      publicPhotosLoaded = true;

      // The staging mirror intentionally keeps only the six authoritative farm datasets.
      // Weather is already present in the sanitized public customer summary fetched above
      // for photo hydration, so reuse it here with zero additional Firebase reads.
      const publicWeather = snapshot?.summary?.weather;
      if (data && usablePublicWeather(publicWeather)) {
        data.weather = { ...(data.weather || {}), ...publicWeather };
        if (snapshot?.summary?.farm?.location) data.farm.location = snapshot.summary.farm.location;
        renderWeather();
        setText("farmLocation", data.farm.location);
      }

      if (data) {
        renderChickenOfDay();
        renderFlock();
      }
      console.log(`🖼️🌤️ STAGING customer preview hydrated ${publicPhotoMap.size} public flock photos and sanitized public weather with one read`);
    } catch (error) {
      console.warn("STAGING customer preview public hydration unavailable:", error);
    } finally {
      publicPhotosLoading = false;
    }
  }

  $("nextFact")?.addEventListener("click", () => { factIndex += 1; fact(); });
  document.querySelectorAll(".filter").forEach(button => button.addEventListener("click", () => {
    filter = button.dataset.filter || "all";
    document.querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b === button));
    renderFlock();
  }));
  document.querySelectorAll("[data-close-profile]").forEach(el => el.addEventListener("click", closeProfile));
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeProfile(); });

  window.CustomerViewStaging = {
    version: 3,
    environment: "staging-customer-preview",
    refresh: render,
    getData: () => data,
    getFilter: () => filter,
    openProfile,
    closeProfile,
    publicPhotoCount: () => publicPhotoMap.size
  };

  render();
  void hydratePublicDataOnce();
})();