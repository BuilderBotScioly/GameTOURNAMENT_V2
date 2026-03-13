const STORAGE_KEY = "familyTournamentSite.v1";

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const sampleData = {
  title: "Family Game Night",
  slideSeconds: 6,
  players: [
    { id: makeId("p"), name: "Mom" },
    { id: makeId("p"), name: "Dad" },
    { id: makeId("p"), name: "Alex" },
    { id: makeId("p"), name: "Jamie" }
  ],
  games: [
    { id: makeId("g"), name: "Mario Kart" },
    { id: makeId("g"), name: "Uno" },
    { id: makeId("g"), name: "Monopoly Deal" }
  ],
  scores: {}
};

let state = loadState() || createEmptyState();
let activeGameId = null;
let displayInterval = null;
let displayIndex = 0;
let displayPaused = false;

bootstrap();

function bootstrap() {
  if (window.location.hash === "#display" && state.started && state.games.length) {
    renderDisplay();
  } else if (state.started) {
    renderControl();
  } else {
    renderSetup();
  }

  window.addEventListener("storage", () => {
    state = loadState() || state;
    if (window.location.hash === "#display" && state.started) {
      renderDisplay();
    } else if (state.started) {
      renderControl();
    } else {
      renderSetup();
    }
  });
}

function createEmptyState() {
  return {
    title: "",
    slideSeconds: 6,
    players: [],
    games: [],
    scores: {},
    started: false
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

function ensureScores() {
  for (const game of state.games) {
    if (!state.scores[game.id]) state.scores[game.id] = {};
    for (const player of state.players) {
      if (typeof state.scores[game.id][player.id] !== "number") {
        state.scores[game.id][player.id] = 0;
      }
    }
  }
}

function cloneSample() {
  const copy = JSON.parse(JSON.stringify(sampleData));
  copy.started = false;
  copy.scores = {};
  copy.games.forEach((game) => {
    copy.scores[game.id] = {};
    copy.players.forEach((player) => {
      copy.scores[game.id][player.id] = 0;
    });
  });
  return copy;
}

function renderSetup() {
  clearInterval(displayInterval);
  document.body.classList.remove("display-mode");
  const app = document.getElementById("app");
  app.innerHTML = document.getElementById("setup-template").innerHTML;

  document.getElementById("title-input").value = state.title || "";
  document.getElementById("slide-seconds-input").value = state.slideSeconds || 6;

  renderPills("players-list", state.players, "player");
  renderPills("games-list", state.games, "game");

  document.getElementById("add-player-btn").onclick = () => {
    const input = document.getElementById("player-input");
    const name = input.value.trim();
    if (!name) return;
    state.players.push({ id: makeId("p"), name });
    input.value = "";
    saveState();
    renderSetup();
  };

  document.getElementById("add-game-btn").onclick = () => {
    const input = document.getElementById("game-input");
    const name = input.value.trim();
    if (!name) return;
    state.games.push({ id: makeId("g"), name });
    input.value = "";
    saveState();
    renderSetup();
  };

  document.getElementById("load-sample").onclick = () => {
    state = cloneSample();
    saveState();
    renderSetup();
  };

  document.getElementById("start-btn").onclick = () => {
    const title = document.getElementById("title-input").value.trim();
    const slideSeconds = Math.max(3, Number(document.getElementById("slide-seconds-input").value || 6));

    if (!title || state.players.length < 2 || state.games.length < 1) {
      alert("Add a title, at least 2 players, and at least 1 game.");
      return;
    }

    state.title = title;
    state.slideSeconds = slideSeconds;
    state.started = true;
    ensureScores();
    activeGameId = state.games[0]?.id || null;
    saveState();
    renderControl();
  };
}

function renderPills(containerId, items, kind) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  items.forEach((item) => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.innerHTML = `<span>${escapeHtml(item.name)}</span>`;

    const btn = document.createElement("button");
    btn.textContent = "×";
    btn.onclick = () => {
      if (kind === "player") {
        state.players = state.players.filter((x) => x.id !== item.id);
        for (const gameId of Object.keys(state.scores)) {
          delete state.scores[gameId][item.id];
        }
      } else {
        state.games = state.games.filter((x) => x.id !== item.id);
        delete state.scores[item.id];
      }
      saveState();
      renderSetup();
    };

    pill.appendChild(btn);
    container.appendChild(pill);
  });
}

function renderControl() {
  clearInterval(displayInterval);
  document.body.classList.remove("display-mode");
  const app = document.getElementById("app");
  app.innerHTML = document.getElementById("control-template").innerHTML;

  ensureScores();
  if (!activeGameId || !state.games.some((g) => g.id === activeGameId)) {
    activeGameId = state.games[0]?.id || null;
  }

  document.getElementById("control-title").textContent = state.title;

  const tabs = document.getElementById("game-tabs");
  state.games.forEach((game) => {
    const btn = document.createElement("button");
    btn.className = `tab ${game.id === activeGameId ? "active" : ""}`;
    btn.textContent = game.name;
    btn.onclick = () => {
      activeGameId = game.id;
      renderControl();
    };
    tabs.appendChild(btn);
  });

  const controlBox = document.getElementById("score-controls");
  controlBox.innerHTML = "";

  const game = state.games.find((g) => g.id === activeGameId);
  const title = document.createElement("h2");
  title.textContent = game ? `${game.name} Scores` : "Scores";
  controlBox.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "score-grid";

  state.players.forEach((player) => {
    const score = state.scores[activeGameId]?.[player.id] || 0;
    const card = document.createElement("div");
    card.className = "player-card";
    card.innerHTML = `
      <h3>${escapeHtml(player.name)}</h3>
      <div class="player-score">${score}</div>
      <div class="score-actions">
        <button class="score-btn danger">-1</button>
        <button class="score-btn primary">+1</button>
      </div>
    `;

    const [minusBtn, plusBtn] = card.querySelectorAll("button");
    minusBtn.onclick = () => changeScore(activeGameId, player.id, -1);
    plusBtn.onclick = () => changeScore(activeGameId, player.id, 1);

    grid.appendChild(card);
  });

  controlBox.appendChild(grid);
  renderOverallStandings();

  document.getElementById("back-to-setup").onclick = () => {
    state.started = false;
    saveState();
    renderSetup();
  };

  document.getElementById("reset-scores-btn").onclick = () => {
    if (!confirm("Reset all scores to zero?")) return;
    ensureScores();
    state.games.forEach((game) => {
      state.players.forEach((player) => {
        state.scores[game.id][player.id] = 0;
      });
    });
    saveState();
    renderControl();
  };

  document.getElementById("open-display-btn").onclick = () => {
    window.location.hash = "#display";
    renderDisplay();
  };
}

function changeScore(gameId, playerId, delta) {
  ensureScores();
  state.scores[gameId][playerId] += delta;
  saveState();
  renderControl();
}

function computeOverallScores() {
  return state.players
    .map((player) => {
      const total = state.games.reduce((sum, game) => {
        return sum + (state.scores[game.id]?.[player.id] || 0);
      }, 0);
      return { playerId: player.id, name: player.name, score: total };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function computeGameScores(gameId) {
  return state.players
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      score: state.scores[gameId]?.[player.id] || 0
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function renderOverallStandings() {
  const box = document.getElementById("overall-standings");
  const rows = computeOverallScores();

  box.innerHTML = `
    <div class="standings-table">
      ${rows.map((row, idx) => `
        <div class="standing-row">
          <div><span class="rank-badge">#${idx + 1}</span></div>
          <div>${escapeHtml(row.name)}</div>
          <div>${row.score}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function buildSlides() {
  const slides = state.games.map((game) => ({
    type: "game",
    title: game.name,
    note: "Game scoreboard",
    rows: computeGameScores(game.id)
  }));

  slides.push({
    type: "overall",
    title: "Overall Standings",
    note: "All game scores combined",
    rows: computeOverallScores()
  });

  return slides;
}

function renderDisplay() {
  document.body.classList.add("display-mode");
  const app = document.getElementById("app");
  app.innerHTML = document.getElementById("display-template").innerHTML;

  const slides = buildSlides();
  if (!slides.length) {
    window.location.hash = "";
    renderControl();
    return;
  }

  displayIndex = displayIndex % slides.length;
  const current = slides[displayIndex];

  document.getElementById("display-title").textContent = state.title;
  document.getElementById("display-subtitle").textContent =
    `${current.title} • Auto-rotate every ${state.slideSeconds || 6}s`;

  const host = document.getElementById("display-slide");
  host.innerHTML = `
    <div class="tv-card">
      <div class="tv-note">${escapeHtml(current.note)}</div>
      <h2>${escapeHtml(current.title)}</h2>
      <div class="tv-rows">
        ${current.rows.map((row, idx) => `
          <div class="tv-row">
            <div class="tv-rank">#${idx + 1}</div>
            <div class="tv-name">${escapeHtml(row.name)}</div>
            <div class="tv-score">${row.score}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  document.getElementById("prev-slide-btn").onclick = () => {
    displayIndex = (displayIndex - 1 + slides.length) % slides.length;
    renderDisplay();
  };

  document.getElementById("next-slide-btn").onclick = () => {
    displayIndex = (displayIndex + 1) % slides.length;
    renderDisplay();
  };

  document.getElementById("pause-slide-btn").onclick = (e) => {
    displayPaused = !displayPaused;
    e.target.textContent = displayPaused ? "Resume" : "Pause";
    setupAutoplay(slides.length);
  };
  document.getElementById("pause-slide-btn").textContent = displayPaused ? "Resume" : "Pause";

  document.getElementById("exit-display-btn").onclick = () => {
    window.location.hash = "";
    renderControl();
  };

  setupAutoplay(slides.length);
}

function setupAutoplay(slideCount) {
  clearInterval(displayInterval);
  if (displayPaused) return;

  displayInterval = setInterval(() => {
    displayIndex = (displayIndex + 1) % slideCount;
    renderDisplay();
  }, (state.slideSeconds || 6) * 1000);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
