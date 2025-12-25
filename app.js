// Decision/Action ブラウザ版。localStorage に実データ保存（モック禁止の代替）。
const STORAGE_KEY = "decision-action-items";

const state = {
  items: loadItems(),
};

let form;
let titleInput;
let meetingInput;
let dueInput;
let statusInput;
let nextActionInput;
let clearFormButton;
let meetingSuggestions;
let reasonInput;

let duePresetButtons;
let urgencyPresetButtons;
let atmospherePresetButtons;
let sectionToggles;

let listToday;
let listOverdue;
let listOther;
let countToday;
let countOverdue;
let countOther;
let listDone;
let countDone;
let addCard;
let openAddButton;
let closeAddButton;

let selectedUrgency = "medium";
let selectedAtmosphere = null;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function init() {
  form = document.getElementById("quick-form");
  titleInput = document.getElementById("title");
  meetingInput = document.getElementById("meeting");
  dueInput = document.getElementById("due");
  statusInput = document.getElementById("status");
  nextActionInput = document.getElementById("nextAction");
  clearFormButton = document.getElementById("clear-form");
  meetingSuggestions = document.getElementById("meeting-suggestions");
  reasonInput = document.getElementById("reason");

  duePresetButtons = document.querySelectorAll("[data-due]");
  urgencyPresetButtons = document.querySelectorAll("[data-urgency]");
  atmospherePresetButtons = document.querySelectorAll("[data-atmosphere]");
  sectionToggles = document.querySelectorAll(".section-toggle");

  listToday = document.getElementById("list-today");
  listOverdue = document.getElementById("list-overdue");
  listOther = document.getElementById("list-other");
  countToday = document.getElementById("count-today");
  countOverdue = document.getElementById("count-overdue");
  countOther = document.getElementById("count-other");
  listDone = document.getElementById("list-done");
  countDone = document.getElementById("count-done");
  addCard = document.getElementById("add-card");
  openAddButton = document.getElementById("open-add");
  closeAddButton = document.getElementById("close-add");

  if (!form) {
    console.warn("form not found; abort init");
    return;
  }

  selectPreset("today");
  selectUrgency("medium");
  selectAtmosphere(null);
  render();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSave();
  });

  clearFormButton.addEventListener("click", () => {
    form.reset();
    selectPreset("today");
    selectUrgency("medium");
    selectAtmosphere(null);
  });

  sectionToggles.forEach((btn) => {
    btn.addEventListener("click", () => toggleSection(btn));
  });
}

function handleSave() {
  const title = titleInput.value.trim();
  if (!title) {
    alert("タイトルは必須です");
    return;
  }

  const meetingName = meetingInput.value.trim();
  const due = dueInput.value;
  if (!due) {
    alert("期限を入力してください");
    return;
  }

  const reasonValue = reasonInput.value.trim();
  if (reasonValue.length > 30) {
    alert("理由は30文字以内で入力してください");
    return;
  }

  const item = {
    id: crypto.randomUUID(),
    title,
    meetingName: meetingName || null,
    decidedAt: new Date().toISOString(),
    due,
    status: statusInput.value,
    nextAction: nextActionInput.value.trim() || null,
    urgency: selectedUrgency,
    atmosphere: selectedAtmosphere,
    reason: reasonValue || null,
  };

  state.items.unshift(item);
  saveItems();
  render();
  form.reset();
  selectPreset("today");
  selectUrgency("medium");
  selectAtmosphere(null);
  toggleAddCard(false);
}

function render() {
  const now = new Date();
  const todayItems = [];
  const overdueItems = [];
  const otherItems = [];
  const doneItems = [];

  state.items.forEach((item) => {
    if (item.status === "done") {
      doneItems.push(item);
      return;
    }
    const dueDate = new Date(item.due);
    if (isToday(dueDate, now)) {
      todayItems.push(item);
    } else if (isOverdue(dueDate, now)) {
      overdueItems.push(item);
    } else {
      otherItems.push(item);
    }
  });

  updateList(listToday, todayItems);
  updateList(listOverdue, overdueItems);
  updateList(listOther, otherItems);
  updateList(listDone, doneItems, { mode: "done" });

  countToday.textContent = todayItems.length;
  countOverdue.textContent = overdueItems.length;
  countOther.textContent = otherItems.length;
  countDone.textContent = doneItems.length;

  updateMeetingSuggestions();
}

function updateList(target, items, options = {}) {
  const mode = options.mode || "active";
  if (!target) return;
  target.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "なし";
    target.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "item";
    if (mode === "done" || item.status === "done") {
      li.classList.add("done");
    }

    const agingLevel = getAgingLevel(item);
    if (agingLevel > 0) {
      li.classList.add(`aging-${agingLevel}`);
    }

    const titleRow = document.createElement("div");
    titleRow.className = "item-title-row";

    const urgencyBadge = document.createElement("span");
    urgencyBadge.className = `urgency-badge urgency-${item.urgency || "medium"}`;
    urgencyBadge.textContent = urgencyLabel(item.urgency || "medium");

    const title = document.createElement("span");
    title.className = "item-title";
    title.textContent = item.title;

    titleRow.appendChild(urgencyBadge);
    titleRow.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "item-meta";
    const parts = [];
    if (item.meetingName) parts.push(`会議: ${item.meetingName}`);
    parts.push(`期限: ${formatDate(item.due)}`);
    parts.push(`状態: ${statusLabel(item.status)}`);
    meta.textContent = parts.join(" / ");

    const actions = document.createElement("div");
    actions.className = "item-actions";
    if (mode === "done") {
      const doneBadge = document.createElement("span");
      doneBadge.className = "done-badge";
      doneBadge.textContent = "完了済";
      actions.appendChild(doneBadge);
    } else {
      const doneBtn = document.createElement("button");
      doneBtn.textContent = "完了にする";
      doneBtn.className = "secondary";
      doneBtn.addEventListener("click", () => markDone(item.id));
      actions.appendChild(doneBtn);
    }

    li.appendChild(titleRow);
    li.appendChild(meta);
    if (item.nextAction) {
      const next = document.createElement("div");
      next.className = "item-next";
      next.textContent = `次のアクション: ${item.nextAction}`;
      li.appendChild(next);
    }
    if (item.atmosphere || item.reason) {
      const details = document.createElement("details");
      details.className = "item-context";

      const summary = document.createElement("summary");
      summary.textContent = "背景・理由を見る";
      const content = document.createElement("div");
      content.className = "context-content";
      if (item.atmosphere) {
        const atm = document.createElement("div");
        atm.className = "context-atmosphere";
        atm.textContent = `雰囲気: ${item.atmosphere}`;
        content.appendChild(atm);
      }
      if (item.reason) {
        const reason = document.createElement("div");
        reason.className = "context-reason";
        reason.textContent = `理由: ${item.reason}`;
        content.appendChild(reason);
      }
      details.appendChild(summary);
      details.appendChild(content);
      li.appendChild(details);
    }
    li.appendChild(actions);

    target.appendChild(li);
  });
}

function markDone(id) {
  const idx = state.items.findIndex((item) => item.id === id);
  if (idx === -1) return;
  state.items[idx] = { ...state.items[idx], status: "done" };
  saveItems();
  render();
}

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const items = raw ? JSON.parse(raw) : [];
    return items.map((item) => ({
      ...item,
      urgency: item.urgency || "medium",
      atmosphere: item.atmosphere || null,
      reason: item.reason || null,
    }));
  } catch (err) {
    console.error("loadItems failed", err);
    return [];
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
}

function isToday(date, reference) {
  const ref = new Date(reference);
  return (
    date.getFullYear() === ref.getFullYear() &&
    date.getMonth() === ref.getMonth() &&
    date.getDate() === ref.getDate()
  );
}

function isOverdue(date, reference) {
  const endOfRefDay = new Date(reference);
  endOfRefDay.setHours(23, 59, 59, 999);
  return date < endOfRefDay && !isToday(date, reference);
}

function formatDate(value) {
  const d = new Date(value);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function statusLabel(status) {
  switch (status) {
    case "open":
      return "未着手";
    case "inProgress":
      return "進行中";
    case "done":
      return "完了";
    default:
      return status;
  }
}

function updateMeetingSuggestions() {
  const names = new Set(
    state.items
      .map((item) => item.meetingName)
      .filter((name) => typeof name === "string" && name.trim().length > 0)
  );
  meetingSuggestions.innerHTML = "";
  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    meetingSuggestions.appendChild(option);
  });
}

function selectPreset(kind) {
  duePresetButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.due === kind);
  });
  const today = new Date();
  if (kind === "today") {
    dueInput.value = today.toISOString().slice(0, 10);
    dueInput.disabled = true;
  } else if (kind === "tomorrow") {
    const t = new Date();
    t.setDate(today.getDate() + 1);
    dueInput.value = t.toISOString().slice(0, 10);
    dueInput.disabled = true;
  } else {
    dueInput.disabled = false;
    if (!dueInput.value) {
      dueInput.value = today.toISOString().slice(0, 10);
    }
  }
}

function selectUrgency(level) {
  selectedUrgency = level;
  urgencyPresetButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.urgency === level);
  });
}

function selectAtmosphere(value) {
  selectedAtmosphere = value;
  atmospherePresetButtons.forEach((btn) => {
    const target = btn.dataset.atmosphere;
    const isClear = target === "clear" && value === null;
    const isMatch = target === value;
    btn.classList.toggle("active", isClear || isMatch);
  });
}

function getAgingLevel(item) {
  if (item.status !== "open") return 0;
  const created = new Date(item.decidedAt);
  const now = new Date();
  const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
  if (diffDays >= 3) return 3;
  if (diffDays >= 2) return 2;
  if (diffDays >= 1) return 1;
  return 0;
}

function urgencyLabel(urgency) {
  switch (urgency) {
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
      return "低";
    default:
      return "中";
  }
}

function toggleSection(button) {
  const targetId = button.dataset.target;
  if (!targetId) return;
  const list = document.getElementById(targetId);
  if (!list) return;
  const collapsed = list.classList.toggle("collapsed");
  button.setAttribute("aria-expanded", (!collapsed).toString());
}

function toggleAddCard(forceOpen) {
  // 毎回DOMから要素を取得して確実に動作させる
  const card = document.getElementById("add-card");
  const openBtn = document.getElementById("open-add");
  const titleField = document.getElementById("title");

  if (!card) {
    console.error("add-card not found");
    return;
  }

  const isHidden = card.classList.contains("hidden");
  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : isHidden;

  if (shouldOpen) {
    card.classList.remove("hidden");
    card.style.display = "block";
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (titleField) {
      titleField.focus();
    }
  } else {
    card.classList.add("hidden");
    card.style.display = "none";
    if (openBtn) {
      openBtn.focus();
    }
  }

  if (openBtn) {
    openBtn.setAttribute("aria-expanded", shouldOpen.toString());
  }
}

// グローバル公開（HTML の inline handler から呼ぶため）
window.selectPreset = selectPreset;
window.selectUrgency = selectUrgency;
window.selectAtmosphere = selectAtmosphere;
window.toggleSection = toggleSection;
window.toggleAddCard = toggleAddCard;
