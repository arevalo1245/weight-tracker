const form = document.getElementById("weight-form");
const weightInput = document.getElementById("weight");
const dateInput = document.getElementById("date");
const message = document.getElementById("message");

const STORAGE_KEY = "weightTrackEntries";

let entries = loadEntries();
let dailyChart = null;
let weeklyChart = null;

// Use today's local date, rather than UTC.
function getLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

dateInput.value = getLocalDate();

function loadEntries() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : [];

        if (
            !Array.isArray(parsed) ||
            !parsed.every(entry =>
                typeof entry.date === "string" &&
                /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
                Number.isFinite(entry.weight) &&
                entry.weight > 0
            )
        ) {
            return [];
        }

        return parsed;
    } catch {
        return [];
    }
}

function saveEntries() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// Sort entries chronologically.
function getSortedEntries() {
    return [...entries].sort((a, b) =>
        a.date.localeCompare(b.date)
    );
}

// Get the Monday of a given date's week.
function getWeekStart(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);

    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();

    const daysSinceMonday = (dayOfWeek + 6) % 7;

    date.setDate(date.getDate() - daysSinceMonday);

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
}

function formatDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);

    return new Date(year, month - 1, day)
        .toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
}

function formatWeight(weight) {
    return `${weight.toFixed(1)} lb`;
}

function updateStats(sortedEntries) {
    const starting = document.getElementById("starting-weight");
    const latest = document.getElementById("latest-weight");
    const change = document.getElementById("weight-change");

    if (sortedEntries.length === 0) {
        starting.textContent = "--";
        latest.textContent = "--";
        change.textContent = "--";
        return;
    }

    const first = sortedEntries[0].weight;
    const last = sortedEntries[sortedEntries.length - 1].weight;
    const difference = last - first;

    starting.textContent = formatWeight(first);
    latest.textContent = formatWeight(last);

    const sign = difference > 0 ? "+" : "";
    change.textContent = `${sign}${difference.toFixed(1)} lb`;
}

function getWeeklyAverages(sortedEntries) {
    const weeks = new Map();

    for (const entry of sortedEntries) {
        const weekStart = getWeekStart(entry.date);

        if (!weeks.has(weekStart)) {
            weeks.set(weekStart, []);
        }

        weeks.get(weekStart).push(entry.weight);
    }

    return [...weeks.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([weekStart, weights]) => ({
            weekStart,
            average:
                weights.reduce((total, weight) => total + weight, 0)
                / weights.length
        }));
}

function updateCharts(sortedEntries) {
    const dailyLabels = sortedEntries.map(entry =>
        formatDate(entry.date)
    );

    const dailyWeights = sortedEntries.map(entry => entry.weight);

    const weekly = getWeeklyAverages(sortedEntries);

    const weeklyLabels = weekly.map(week =>
        `Week of ${formatDate(week.weekStart)}`
    );

    const weeklyWeights = weekly.map(week => week.average);

    if (dailyChart) dailyChart.destroy();
    if (weeklyChart) weeklyChart.destroy();

    dailyChart = new Chart(
        document.getElementById("daily-chart"),
        {
            type: "line",
            data: {
                labels: dailyLabels,
                datasets: [{
                    label: "Weight (lb)",
                    data: dailyWeights,
                    borderColor: "#3157d5",
                    backgroundColor: "rgba(49, 87, 213, 0.12)",
                    fill: true,
                    tension: 0.25,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: "Weight (lb)"
                        }
                    }
                }
            }
        }
    );

    weeklyChart = new Chart(
        document.getElementById("weekly-chart"),
        {
            type: "bar",
            data: {
                labels: weeklyLabels,
                datasets: [{
                    label: "Average weight (lb)",
                    data: weeklyWeights,
                    backgroundColor: "#42a58a"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: "Average weight (lb)"
                        }
                    }
                }
            }
        }
    );
}

function updateHistory(sortedEntries) {
    const history = document.getElementById("weight-history");
    history.replaceChildren();

    if (sortedEntries.length === 0) {
        const item = document.createElement("li");
        item.textContent = "No entries yet. Record your first weight!";
        history.appendChild(item);
        return;
    }

    for (const entry of [...sortedEntries].reverse()) {
        const item = document.createElement("li");
        item.appendChild(
            document.createTextNode(
                `${formatDate(entry.date)} — ${formatWeight(entry.weight)} `
            )
        );

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.style.marginLeft = "10px";
        deleteButton.style.padding = "6px 10px";
        deleteButton.style.background = "#b42318";

        deleteButton.addEventListener("click", () => {
            const confirmed = confirm(
                `Delete the weight entry for ${formatDate(entry.date)}?`
            );

            if (!confirmed) return;

            entries = entries.filter(
                savedEntry => savedEntry.date !== entry.date
            );

            saveEntries();
            render();
            message.textContent = "Entry deleted.";
        });

        item.appendChild(deleteButton);
        history.appendChild(item);
    }
}

function render() {
    const sortedEntries = getSortedEntries();

    updateStats(sortedEntries);
    updateCharts(sortedEntries);
    updateHistory(sortedEntries);
}

form.addEventListener("submit", event => {
    event.preventDefault();

    const weight = Number(weightInput.value);
    const date = dateInput.value;

    if (!Number.isFinite(weight) || weight <= 0 || weight > 1500) {
        message.textContent = "Enter a valid weight.";
        return;
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        message.textContent = "Choose a valid date.";
        return;
    }

    const [year, month, day] = date.split("-").map(Number);
    const parsedDate = new Date(year, month - 1, day);

    if (
        parsedDate.getFullYear() !== year ||
        parsedDate.getMonth() !== month - 1 ||
        parsedDate.getDate() !== day
    ) {
        message.textContent = "Choose a valid calendar date.";
        return;
    }

    // Update the date's entry if it already exists.
    const existing = entries.find(entry => entry.date === date);

    if (existing) {
        existing.weight = weight;
    } else {
        entries.push({ date, weight });
    }

    try {
        saveEntries();
        render();
        message.textContent = `Saved ${formatWeight(weight)} for ${formatDate(date)}.`;
        weightInput.value = "";
        weightInput.focus();
    } catch {
        message.textContent =
            "Could not save the entry. Check your browser storage.";
    }
});

try {
    render();
} catch (error) {
    console.error("Could not render the weight tracker:", error);
    message.textContent =
        "The dashboard could not load. Check the browser console.";
}