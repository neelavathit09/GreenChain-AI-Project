
const $ = (id) => document.getElementById(id);

async function postJSON(url, data) {
    let response;

    try {
        response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(data)
        });
    } catch (error) {
        throw new Error(
            "Cannot connect to Flask. Open this website at http://127.0.0.1:5000 and check that the server is running."
        );
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || "The request failed.");
    }

    return result;
}

function showError(element, error) {
    if (element) {
        element.textContent = "Error: " + error.message;
    }
}

function getNumber(id) {
    const value = $(id).value.trim();

    if (value === "") {
        throw new Error("Please fill in all required fields.");
    }

    const number = Number(value);

    if (!Number.isFinite(number) || number < 0) {
        throw new Error("Enter a valid non-negative number.");
    }

    return number;
}

function updateDashboard(energy, intensity) {
    const emissions = energy * intensity / 1000;

    $("dashboardEnergy").textContent =
        energy.toLocaleString() + " kWh";

    $("dashboardEmissions").textContent =
        emissions.toFixed(2) + " kg CO₂";

    $("dashboardSavings").textContent =
        (emissions * 0.10).toFixed(2) + " kg CO₂";

    const energyScore = Math.max(0, 50 * (1 - energy / 5000));
    const carbonScore = Math.max(0, 50 * (1 - intensity / 800));
    const score = Math.round(Math.min(100, energyScore + carbonScore));

    $("greenScore").textContent = score + " / 100";

    $("greenScoreLabel").textContent =
        score >= 70
            ? "Lower impact under this demo model"
            : score >= 40
                ? "Moderate impact under this demo model"
                : "Higher impact under this demo model";
}

function validInput(energy, intensity) {
    if (!Number.isFinite(energy) || energy < 0 ||
        !Number.isFinite(intensity) || intensity < 0) {
        throw new Error("Please enter valid non-negative values.");
    }
}

$("calculateBtn").addEventListener("click", async () => {
    const output = $("emissionsResult");
    const button = $("calculateBtn");

    button.disabled = true;
    output.textContent = "Calculating...";

    try {
        const energy = getNumber("energy");
        const intensity = getNumber("intensity");
        validInput(energy, intensity);

        const result = await postJSON("/calculate", {
            energy: energy,
            intensity: intensity
        });

        output.textContent =
            "Estimated emissions: " + result.emissions.toFixed(2) +
            " kg CO₂. Potential 10% savings: " +
            result.savings.toFixed(2) + " kg CO₂.";

        updateDashboard(energy, intensity);
    } catch (error) {
        showError(output, error);
    } finally {
        button.disabled = false;
    }
});

function updateSimulator() {
    const energy = getNumber("baseEnergy");
    const intensity = getNumber("baseIntensity");
    validInput(energy, intensity);

    const reduction = Number($("reductionSlider").value);
    const current = energy * intensity / 1000;
    const after = current * (1 - reduction / 100);

    $("reductionLabel").textContent = reduction + "%";
    $("currentEmissions").textContent = current.toFixed(2) + " kg CO₂";
    $("newEmissions").textContent = after.toFixed(2) + " kg CO₂";
    $("savedEmissions").textContent =
        (current - after).toFixed(2) + " kg CO₂";

    $("impactMessage").textContent =
        "Estimated reduction: " + reduction +
        "%. These are calculations, not measured savings.";
}

$("reductionSlider").addEventListener("input", () => {
    $("reductionLabel").textContent =
        $("reductionSlider").value + "%";
});

$("simulateBtn").addEventListener("click", () => {
    try {
        updateSimulator();
    } catch (error) {
        showError($("impactMessage"), error);
    }
});

let forecastChart = null;

$("forecastBtn").addEventListener("click", async () => {
    const output = $("forecastResult");
    const button = $("forecastBtn");

    button.disabled = true;
    output.textContent = "Generating forecast...";

    try {
        const days = Number($("forecastDays").value);

        if (!Number.isInteger(days) || days < 1 || days > 30) {
            throw new Error("Choose a whole number between 1 and 30.");
        }

        const result = await postJSON("/predict", { days: days });
        const predictions = result.predictions;

        output.textContent =
            result.notice + " First predicted value: " +
            predictions[0].energy + " kWh.";

        if (forecastChart) {
            forecastChart.destroy();
        }

        forecastChart = new Chart($("forecastChart"), {
            type: "line",
            data: {
                labels: predictions.map(item => "Day " + item.day),
                datasets: [{
                    label: "Predicted energy (kWh)",
                    data: predictions.map(item => item.energy),
                    borderColor: "#207d47",
                    backgroundColor: "rgba(32, 125, 71, 0.15)",
                    fill: true,
                    tension: 0.25
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    } catch (error) {
        showError(output, error);
    } finally {
        button.disabled = false;
    }
});

$("detectBtn").addEventListener("click", async () => {
    const output = $("anomalyResults");
    const notice = $("anomalyNotice");
    const button = $("detectBtn");

    button.disabled = true;
    output.replaceChildren();
    notice.textContent = "Checking readings...";

    try {
        const readings = $("readings").value
            .split(",")
            .map(value => value.trim())
            .map(value => {
                if (value === "") {
                    throw new Error("Remove empty readings.");
                }

                const number = Number(value);

                if (!Number.isFinite(number) || number < 0) {
                    throw new Error("Readings must be valid non-negative numbers.");
                }

                return number;
            });

        const result = await postJSON("/detect-anomaly", {
            readings: readings
        });

        result.results.forEach(item => {
            const row = document.createElement("div");
            row.className = "result-item";
            row.textContent =
                item.reading + " kWh — " + item.status;
            output.appendChild(row);
        });

        notice.textContent = result.notice;
    } catch (error) {
        notice.textContent = "Error: " + error.message;
    } finally {
        button.disabled = false;
    }
});

$("recommendBtn").addEventListener("click", async () => {
    const output = $("recommendationResults");
    const button = $("recommendBtn");

    button.disabled = true;
    output.replaceChildren();

    try {
        const energy = getNumber("recommendEnergy");
        const intensity = getNumber("recommendIntensity");

        const result = await postJSON("/recommend", {
            energy: energy,
            intensity: intensity
        });

        const heading = document.createElement("p");
        heading.textContent =
            "Estimated emissions: " + result.emissions + " kg CO₂";
        output.appendChild(heading);

        result.recommendations.forEach(item => {
            const row = document.createElement("div");
            row.className = "result-item";
            row.textContent = "💡 " + item;
            output.appendChild(row);
        });
    } catch (error) {
        showError(output, error);
    } finally {
        button.disabled = false;
    }
});

$("downloadReportBtn").addEventListener("click", () => {
    const report = [
        "GREENCHAIN AI — SUSTAINABILITY REPORT",
        "=====================================",
        "Energy consumption: " + $("dashboardEnergy").textContent,
        "Estimated emissions: " + $("dashboardEmissions").textContent,
        "Potential 10% savings: " + $("dashboardSavings").textContent,
        "Demo sustainability score: " + $("greenScore").textContent,
        "Score interpretation: " + $("greenScoreLabel").textContent,
        "",
        "Method: Energy (kWh) × carbon intensity (g CO2/kWh) / 1000.",
        "This is a prototype report, not an official sustainability assessment."
    ].join("\n");

    const blob = new Blob([report], {
        type: "text/plain;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "GreenChain_Sustainability_Report.txt";
    link.click();

    URL.revokeObjectURL(url);
});

let ethereumChart = null;

function createEthereumChart() {
    if (typeof Chart === "undefined") {
        return;
    }

    ethereumChart = new Chart($("ethereumEnergyChart"), {
        type: "bar",
        data: {
            labels: [
                "Ethereum before Merge (PoW)",
                "Ethereum after Merge (PoS)"
            ],
            datasets: [{
                label: "Illustrative annual energy use (TWh)",
                data: [78, 0.0026],
                backgroundColor: ["#9bb8a2", "#207d47"]
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    type: "logarithmic",
                    title: {
                        display: true,
                        text: "Energy (TWh, logarithmic scale)"
                    }
                }
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    updateDashboard(
        Number($("energy").value),
        Number($("intensity").value)
    );

    updateSimulator();
    createEthereumChart();
});