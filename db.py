import sqlite3
import json
import random
import string
import os
import shutil
from datetime import datetime, timedelta

def get_db_path():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    local_db = os.path.join(base_dir, "campus_events.db")
    if os.environ.get("VERCEL"):
        tmp_db = "/tmp/campus_events.db"
        if not os.path.exists(tmp_db) and os.path.exists(local_db):
            try:
                shutil.copy2(local_db, tmp_db)
            except Exception:
                pass
        return tmp_db
    return local_db

def get_db_connection():
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create Events table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            venue TEXT NOT NULL,
            price REAL NOT NULL,
            vip_price REAL DEFAULT 0.0,
            capacity INTEGER NOT NULL,
            booked_count INTEGER DEFAULT 0,
            image_url TEXT NOT NULL,
            organizer_name TEXT NOT NULL,
            organizer_email TEXT,
            is_featured INTEGER DEFAULT 0,
            status TEXT DEFAULT 'Upcoming',
            tags TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create Bookings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_ref TEXT UNIQUE NOT NULL,
            event_id INTEGER NOT NULL,
            event_title TEXT NOT NULL,
            student_name TEXT NOT NULL,
            student_email TEXT NOT NULL,
            student_id TEXT NOT NULL,
            ticket_type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            total_amount REAL NOT NULL,
            discount_amount REAL DEFAULT 0.0,
            payment_method TEXT NOT NULL,
            payment_status TEXT NOT NULL,
            booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            qr_code_str TEXT NOT NULL,
            FOREIGN KEY (event_id) REFERENCES events (id)
        )
    ''')
    
    # Create Users/Admins table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT DEFAULT 'Admin',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    
    # Check if users table is empty, if so, seed default admins
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        seed_default_admins(conn)
    
    # Check if events table is empty, if so, seed default data
    cursor.execute("SELECT COUNT(*) FROM events")
    count = cursor.fetchone()[0]
    if count == 0:
        seed_default_events(conn)
    
    conn.close()

def seed_default_admins(conn=None):
    from werkzeug.security import generate_password_hash
    close_conn = False
    if conn is None:
        conn = get_db_connection()
        close_conn = True
        
    cursor = conn.cursor()
    admins = [
        {
            "username": "admin",
            "email": "admin@campus.edu",
            "password_hash": generate_password_hash("admin123"),
            "full_name": "Campus Chief Admin",
            "role": "Super Admin"
        },
        {
            "username": "organizer",
            "email": "organizer@campus.edu",
            "password_hash": generate_password_hash("organizer123"),
            "full_name": "Campus Event Director",
            "role": "Organizer"
        },
        {
            "username": "student",
            "email": "student@campus.edu",
            "password_hash": generate_password_hash("student123"),
            "full_name": "Alex Rivers (Student)",
            "role": "Student"
        }
    ]
    
    for a in admins:
        cursor.execute('''
            INSERT OR IGNORE INTO users (username, email, password_hash, full_name, role)
            VALUES (?, ?, ?, ?, ?)
        ''', (a["username"], a["email"], a["password_hash"], a["full_name"], a["role"]))
        
    conn.commit()
    if close_conn:
        conn.close()

def verify_user_login(email_or_username, password):
    from werkzeug.security import check_password_hash
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ? OR username = ?", (email_or_username, email_or_username))
    row = cursor.fetchone()
    conn.close()
    
    if row and check_password_hash(row["password_hash"], password):
        user_dict = dict(row)
        del user_dict["password_hash"]
        return user_dict
    return None

def seed_default_events(conn=None):
    close_conn = False
    if conn is None:
        conn = get_db_connection()
        close_conn = True
        
    cursor = conn.cursor()
    cursor.execute("DELETE FROM events")
    
    sample_events = [
        {
            "title": "AURA 2026 - National Tech & AI Summit",
            "category": "Tech & AI",
            "description": "The flagship annual tech extravaganza of Campus! Featuring keynotes by industry pioneers, AI hackathons, robotics showdowns, keynote talks on Quantum Computing, and startup pitching battlegrounds.",
            "date": "2026-10-15",
            "time": "09:00 AM - 06:00 PM",
            "venue": "Grand Auditorium & Innovation Hub",
            "price": 299.00,
            "vip_price": 599.00,
            "capacity": 500,
            "booked_count": 342,
            "image_url": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80",
            "organizer_name": "School of Computer Science & ACM Student Chapter",
            "organizer_email": "acm@campus.edu",
            "is_featured": 1,
            "status": "Upcoming",
            "tags": "AI, Hackathon, Innovation, Robotics"
        },
        {
            "title": "NEON RHYTHM - Annual Cultural Fest Night",
            "category": "Cultural & Arts",
            "description": "An electrifying night of live music bands, DJ sets, fusion dance competitions, laser displays, and celebrity star performances under the open sky!",
            "date": "2026-10-22",
            "time": "06:00 PM - 11:30 PM",
            "venue": "Campus Central Amphitheatre",
            "price": 199.00,
            "vip_price": 499.00,
            "capacity": 1200,
            "booked_count": 890,
            "image_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80",
            "organizer_name": "Cultural Committee & Student Union",
            "organizer_email": "cultural@campus.edu",
            "is_featured": 1,
            "status": "Selling Fast",
            "tags": "Concert, DJ Night, Music, Dance"
        },
        {
            "title": "CyberClash - Inter-College E-Sports League",
            "category": "Esports & Gaming",
            "description": "Battle it out in Valorant, BGMI, EA FC 26, and Rocket League for a prize pool of ₹1,50,000! Live shoutcasting, RGB gaming lounges, and pro gamer meetups.",
            "date": "2026-11-05",
            "time": "10:00 AM - 08:00 PM",
            "venue": "Student Activity Center (SAC) Arena",
            "price": 150.00,
            "vip_price": 350.00,
            "capacity": 400,
            "booked_count": 275,
            "image_url": "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
            "organizer_name": "Campus Gaming Guild",
            "organizer_email": "esports@campus.edu",
            "is_featured": 1,
            "status": "Upcoming",
            "tags": "Valorant, Gaming, Tournament, Esports"
        },
        {
            "title": "TEDxCampus: Breaking Down Horizons",
            "category": "Talks & Workshops",
            "description": "An independently organized TED event featuring 8 inspiring visionaries, founders, space scientists, and campus change-makers sharing ideas worth spreading.",
            "date": "2026-11-12",
            "time": "02:00 PM - 07:00 PM",
            "venue": "Main Senate Hall",
            "price": 250.00,
            "vip_price": 450.00,
            "capacity": 300,
            "booked_count": 210,
            "image_url": "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1200&q=80",
            "organizer_name": "TEDx Executive Team",
            "organizer_email": "tedx@campus.edu",
            "is_featured": 0,
            "status": "Upcoming",
            "tags": "TEDx, Keynote, Inspiration, Leadership"
        },
        {
            "title": "CAMPUS OLYMPICS 2026 - Sports Meet",
            "category": "Sports",
            "description": "The ultimate sports championship spanning Track & Field, Football, Basketball, Badminton, and Table Tennis with inter-department trophy cups!",
            "date": "2026-11-18",
            "time": "07:30 AM - 05:30 PM",
            "venue": "Campus Sports Complex Stadium",
            "price": 0.00,
            "vip_price": 100.00,
            "capacity": 1500,
            "booked_count": 1120,
            "image_url": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80",
            "organizer_name": "Department of Physical Education",
            "organizer_email": "sports@campus.edu",
            "is_featured": 0,
            "status": "Free Entry",
            "tags": "Football, Athletics, Tournament, Sports"
        },
        {
            "title": "UI/UX & Design Systems Masterclass",
            "category": "Talks & Workshops",
            "description": "Hands-on design sprint workshop covering Figma micro-interactions, responsive design frameworks, portfolio reviews, and certificate distribution.",
            "date": "2026-11-25",
            "time": "10:00 AM - 04:00 PM",
            "venue": "Design Studio Lab 3",
            "price": 99.00,
            "vip_price": 199.00,
            "capacity": 80,
            "booked_count": 68,
            "image_url": "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80",
            "organizer_name": "Designers Collective",
            "organizer_email": "design@campus.edu",
            "is_featured": 0,
            "status": "Selling Fast",
            "tags": "Figma, UX Design, Workshop, Certificate"
        }
    ]
    
    for event in sample_events:
        cursor.execute('''
            INSERT INTO events (title, category, description, date, time, venue, price, vip_price, capacity, booked_count, image_url, organizer_name, organizer_email, is_featured, status, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            event["title"], event["category"], event["description"], event["date"],
            event["time"], event["venue"], event["price"], event["vip_price"],
            event["capacity"], event["booked_count"], event["image_url"],
            event["organizer_name"], event["organizer_email"], event["is_featured"],
            event["status"], event["tags"]
        ))
        
    conn.commit()
    if close_conn:
        conn.close()
    print("Database seeded with sample campus events successfully.")

def get_all_events(category=None, search=None, status=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM events WHERE 1=1"
    params = []
    
    if category and category != "All":
        query += " AND category = ?"
        params.append(category)
        
    if status and status != "All":
        query += " AND status = ?"
        params.append(status)
        
    if search:
        query += " AND (title LIKE ? OR description LIKE ? OR venue LIKE ? OR tags LIKE ?)"
        search_param = f"%{search}%"
        params.extend([search_param, search_param, search_param, search_param])
        
    query += " ORDER BY is_featured DESC, date ASC"
    
    cursor.execute(query, params)
    events = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return events

def get_event_by_id(event_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def create_event(data):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO events (title, category, description, date, time, venue, price, vip_price, capacity, booked_count, image_url, organizer_name, organizer_email, is_featured, status, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    ''', (
        data.get("title"), data.get("category", "General"), data.get("description"),
        data.get("date"), data.get("time"), data.get("venue"),
        float(data.get("price", 0)), float(data.get("vip_price", 0)),
        int(data.get("capacity", 100)), data.get("image_url"),
        data.get("organizer_name", "Campus Event Admin"), data.get("organizer_email", "admin@campus.edu"),
        1 if data.get("is_featured") else 0, data.get("status", "Upcoming"), data.get("tags", "")
    ))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return get_event_by_id(new_id)

def update_event(event_id, data):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE events 
        SET title = ?, category = ?, description = ?, date = ?, time = ?, venue = ?, price = ?, vip_price = ?, capacity = ?, image_url = ?, status = ?, tags = ?
        WHERE id = ?
    ''', (
        data.get("title"), data.get("category"), data.get("description"),
        data.get("date"), data.get("time"), data.get("venue"),
        float(data.get("price", 0)), float(data.get("vip_price", 0)),
        int(data.get("capacity", 100)), data.get("image_url"),
        data.get("status", "Upcoming"), data.get("tags", ""), event_id
    ))
    conn.commit()
    conn.close()
    return get_event_by_id(event_id)

def delete_event(event_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM events WHERE id = ?", (event_id,))
    conn.commit()
    conn.close()
    return True

def generate_booking_ref():
    chars = string.ascii_uppercase + string.digits
    ref = 'PULSE-' + ''.join(random.choices(chars, k=8))
    return ref

def create_booking(data):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    event_id = data["event_id"]
    event = get_event_by_id(event_id)
    if not event:
        conn.close()
        raise Exception("Event not found")
        
    qty = int(data.get("quantity", 1))
    if event["booked_count"] + qty > event["capacity"]:
        conn.close()
        raise Exception("Not enough tickets available for this event.")
        
    booking_ref = generate_booking_ref()
    qr_code_str = f"REF:{booking_ref}|EV:{event_id}|STUDENT:{data['student_id']}|TICKETS:{qty}"
    
    total_amount = float(data.get("total_amount", 0.0))
    unit_price = float(data.get("unit_price", 0.0))
    discount_amount = float(data.get("discount_amount", 0.0))
    
    cursor.execute('''
        INSERT INTO bookings (
            booking_ref, event_id, event_title, student_name, student_email, student_id,
            ticket_type, quantity, unit_price, total_amount, discount_amount, payment_method,
            payment_status, qr_code_str
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        booking_ref, event_id, event["title"], data["student_name"], data["student_email"],
        data["student_id"], data.get("ticket_type", "General"), qty, unit_price,
        total_amount, discount_amount, data.get("payment_method", "Card"), "Paid", qr_code_str
    ))
    
    # Increment booked count for the event
    new_booked_count = event["booked_count"] + qty
    status = event["status"]
    if new_booked_count >= event["capacity"]:
        status = "Sold Out"
    elif new_booked_count >= event["capacity"] * 0.8:
        status = "Selling Fast"
        
    cursor.execute("UPDATE events SET booked_count = ?, status = ? WHERE id = ?", (new_booked_count, status, event_id))
    
    conn.commit()
    conn.close()
    
    return get_booking_by_ref(booking_ref)

def get_booking_by_ref(booking_ref):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT b.*, e.date as event_date, e.time as event_time, e.venue as event_venue, e.image_url as event_image
        FROM bookings b
        JOIN events e ON b.event_id = e.id
        WHERE b.booking_ref = ?
    ''', (booking_ref,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_bookings(email):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT b.*, e.date as event_date, e.time as event_time, e.venue as event_venue, e.image_url as event_image
        FROM bookings b
        JOIN events e ON b.event_id = e.id
        WHERE b.student_email = ? OR b.student_id = ?
        ORDER BY b.booking_date DESC
    ''', (email, email))
    bookings = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return bookings

def get_dashboard_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM events")
    total_events = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM bookings")
    total_bookings = cursor.fetchone()[0]
    
    cursor.execute("SELECT SUM(quantity) FROM bookings")
    total_tickets_sold = cursor.fetchone()[0] or 0
    
    cursor.execute("SELECT SUM(total_amount) FROM bookings")
    total_revenue = cursor.fetchone()[0] or 0.0
    
    cursor.execute("SELECT category, COUNT(*) as count FROM events GROUP BY category")
    category_breakdown = [dict(row) for row in cursor.fetchall()]
    
    cursor.execute('''
        SELECT payment_method, COUNT(*) as count, SUM(total_amount) as revenue 
        FROM bookings GROUP BY payment_method
    ''')
    payment_breakdown = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    return {
        "total_events": total_events,
        "total_bookings": total_bookings,
        "total_tickets_sold": total_tickets_sold,
        "total_revenue": round(total_revenue, 2),
        "category_breakdown": category_breakdown,
        "payment_breakdown": payment_breakdown
    }

if __name__ == "__main__":
    init_db()
