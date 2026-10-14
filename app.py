
from flask import Flask, render_template, request, jsonify, make_response
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LinearRegression

app = Flask(__name__)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/calculate", methods=["POST"])
def calculate():
    try:
        data = request.get_json(silent=True) or {}
        energy = float(data.get("energy", 0))
        intensity = float(data.get("intensity", 0))

        if not np.isfinite(energy) or not np.isfinite(intensity):
            return jsonify({"error": "Enter valid numbers."}), 400

        if energy < 0 or intensity < 0:
            return jsonify({"error": "Values cannot be negative."}), 400

        emissions = energy * intensity / 1000

        return jsonify({
            "energy": energy,
            "intensity": intensity,
            "emissions": round(emissions, 2),
            "savings": round(emissions * 0.10, 2)
        })
    except (ValueError, TypeError):
        return jsonify({"error": "Please enter valid numbers."}), 400


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(silent=True) or {}
        days = int(data.get("days", 7))

        if days < 1 or days > 30:
            return jsonify({"error": "Choose between 1 and 30 days."}), 400

        historical_energy = np.array([850, 900, 880, 920, 950, 910, 980, 1000])
        x = np.arange(1, len(historical_energy) + 1).reshape(-1, 1)

        model = LinearRegression()
        model.fit(x, historical_energy)

        future_days = np.arange(
            len(historical_energy) + 1,
            len(historical_energy) + days + 1
        ).reshape(-1, 1)

        predictions = model.predict(future_days)
        predictions = np.maximum(predictions, 0)

        results = [
            {"day": i + 1, "energy": round(float(value), 2)}
            for i, value in enumerate(predictions)
        ]

        return jsonify({
            "predictions": results,
            "notice": "Demo forecast based on sample historical data."
        })
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid forecast period."}), 400


@app.route("/detect-anomaly", methods=["POST"])
def detect_anomaly():
    try:
        data = request.get_json(silent=True) or {}
        readings = data.get("readings", [])

        if not isinstance(readings, list) or len(readings) < 5:
            return jsonify({
                "error": "Enter at least 5 energy readings."
            }), 400

        values = np.array([float(value) for value in readings])

        if not np.all(np.isfinite(values)) or np.any(values < 0):
            return jsonify({
                "error": "Readings must be finite, non-negative numbers."
            }), 400

        model = IsolationForest(
            contamination=0.15,
            random_state=42
        )
        labels = model.fit_predict(values.reshape(-1, 1))

        results = [
            {
                "reading": round(float(value), 2),
                "status": "Anomaly" if label == -1 else "Normal"
            }
            for value, label in zip(values, labels)
        ]

        return jsonify({
            "results": results,
            "notice": "Anomalies are model flags and should be reviewed."
        })
    except (ValueError, TypeError):
        return jsonify({"error": "Please enter valid numeric readings."}), 400


@app.route("/recommend", methods=["POST"])
def recommend():
    try:
        data = request.get_json(silent=True) or {}
        energy = float(data.get("energy", 0))
        intensity = float(data.get("intensity", 0))

        if not np.isfinite(energy) or not np.isfinite(intensity):
            return jsonify({"error": "Enter valid numbers."}), 400

        if energy < 0 or intensity < 0:
            return jsonify({"error": "Values cannot be negative."}), 400

        emissions = energy * intensity / 1000
        recommendations = []

        if energy > 1000:
            recommendations.append(
                "Review high energy-consuming equipment and reduce unnecessary usage."
            )
        else:
            recommendations.append(
                "Continue monitoring energy consumption and look for further savings."
            )

        if intensity > 400:
            recommendations.append(
                "Explore lower-carbon electricity sources where available."
            )
        else:
            recommendations.append(
                "Maintain a lower-carbon electricity supply where possible."
            )

        recommendations.append(
            "Measure energy consumption regularly and compare results over time."
        )

        return jsonify({
            "emissions": round(emissions, 2),
            "recommendations": recommendations
        })
    except (ValueError, TypeError):
        return jsonify({"error": "Please enter valid numbers."}), 400


if __name__ == "__main__":
    app.run(debug=True)