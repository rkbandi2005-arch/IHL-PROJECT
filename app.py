from flask import Flask, render_template, request, jsonify
import db

app = Flask(__name__, static_folder="static", template_folder="templates")

# Initialize database on launch
with app.app_context():
    db.init_db()

@app.route("/")
def index_login():
    return render_template("login.html")

@app.route("/login")
def login_page():
    return render_template("login.html")

@app.route("/main")
@app.route("/events")
def main_page():
    return render_template("index.html")

@app.route("/credentials")
def credentials_page():
    return render_template("credentials.html")


# --- API ENDPOINTS ---

@app.route("/api/events", methods=["GET"])
def get_events():
    category = request.args.get("category", None)
    search = request.args.get("search", None)
    status = request.args.get("status", None)
    events = db.get_all_events(category=category, search=search, status=status)
    return jsonify({"success": True, "events": events, "count": len(events)})

@app.route("/api/events/<int:event_id>", methods=["GET"])
def get_event(event_id):
    event = db.get_event_by_id(event_id)
    if not event:
        return jsonify({"success": False, "error": "Event not found"}), 404
    return jsonify({"success": True, "event": event})

@app.route("/api/events", methods=["POST"])
def add_event():
    try:
        data = request.json
        if not data.get("title") or not data.get("date") or not data.get("venue"):
            return jsonify({"success": False, "error": "Title, Date, and Venue are required"}), 400
        new_event = db.create_event(data)
        return jsonify({"success": True, "event": new_event, "message": "Event published successfully!"}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/events/<int:event_id>", methods=["PUT"])
def update_event_route(event_id):
    try:
        data = request.json
        updated = db.update_event(event_id, data)
        return jsonify({"success": True, "event": updated, "message": "Event updated successfully!"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/events/<int:event_id>", methods=["DELETE"])
def delete_event_route(event_id):
    try:
        db.delete_event(event_id)
        return jsonify({"success": True, "message": "Event deleted successfully."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/checkout", methods=["POST"])
def checkout():
    try:
        data = request.json
        required_fields = ["event_id", "student_name", "student_email", "student_id", "payment_method"]
        for field in required_fields:
            if not data.get(field):
                return jsonify({"success": False, "error": f"Missing required field: {field}"}), 400
                
        booking = db.create_booking(data)
        return jsonify({
            "success": True,
            "message": "Payment verified and booking confirmed!",
            "booking": booking
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route("/api/bookings/<string:booking_ref>", methods=["GET"])
def get_booking(booking_ref):
    booking = db.get_booking_by_ref(booking_ref)
    if not booking:
        return jsonify({"success": False, "error": "Booking reference not found"}), 404
    return jsonify({"success": True, "booking": booking})

@app.route("/api/bookings/user/<string:user_id>", methods=["GET"])
def get_user_bookings_route(user_id):
    bookings = db.get_user_bookings(user_id)
    return jsonify({"success": True, "bookings": bookings, "count": len(bookings)})

@app.route("/api/stats", methods=["GET"])
def get_stats():
    stats = db.get_dashboard_stats()
    return jsonify({"success": True, "stats": stats})

@app.route("/api/login", methods=["POST"])
def login_route():
    try:
        data = request.json or {}
        email_or_username = data.get("email") or data.get("username")
        password = data.get("password")
        
        if not email_or_username or not password:
            return jsonify({"success": False, "error": "Email/Username and password are required"}), 400
            
        user = db.verify_user_login(email_or_username, password)
        if user:
            return jsonify({
                "success": True,
                "message": "Login successful!",
                "user": user
            })
        else:
            return jsonify({"success": False, "error": "Invalid email/username or password"}), 401
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/seed", methods=["POST"])
def seed_events_route():
    db.seed_default_events()
    return jsonify({"success": True, "message": "Database reset and re-seeded with fresh campus events!"})

if __name__ == "__main__":
    print("PulseCampus Server starting on http://127.0.0.1:5000 ...")
    app.run(host="0.0.0.0", port=5000, debug=False)
