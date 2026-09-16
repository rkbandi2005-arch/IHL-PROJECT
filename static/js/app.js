/* ==========================================================================
   PULSECAMPUS - Application Frontend Engine
   Handles REST API Calls, Dynamic Modals, Checkout & Ticket Management
   ========================================================================== */

let allEvents = [];
let currentEvent = null;
let selectedTier = 'General'; // 'General' or 'VIP'
let ticketQty = 1;
let selectedPaymentMethod = 'UPI'; // 'UPI', 'Card', 'Wallet'
let appliedDiscount = 0.0;
let currentCategoryFilter = 'All';
let upiTimerInterval = null;
let currentAdmin = null;

document.addEventListener('DOMContentLoaded', () => {
  loadAdminSession();
  fetchEvents();
  fetchDashboardStats();
  startUPITimer();
});

/* --- ADMIN AUTHENTICATION --- */

function loadAdminSession() {
  const saved = localStorage.getItem('pulseAdmin');
  if (saved) {
    try {
      currentAdmin = JSON.parse(saved);
    } catch (e) {
      currentAdmin = null;
    }
  }
  updateAdminUI();
}

function updateAdminUI() {
  const btn = document.getElementById('navAdminBtn');
  if (!btn) return;

  if (currentAdmin) {
    btn.className = 'btn btn-glass btn-sm';
    btn.innerHTML = `<i class="fa-solid fa-user-check" style="color: var(--accent-emerald);"></i> ${currentAdmin.full_name} (<span style="color: var(--accent-rose);" onclick="event.stopPropagation(); adminLogout();">Logout</span>)`;
  } else {
    btn.className = 'btn btn-outline';
    btn.innerHTML = `<i class="fa-solid fa-user-shield"></i> Admin Login`;
  }
}

function openAdminLoginModal() {
  if (currentAdmin) {
    showToast(`Logged in as ${currentAdmin.full_name} (${currentAdmin.role})`, 'success');
    return;
  }
  window.location.href = '/login';
}

function adminLogout() {
  currentAdmin = null;
  localStorage.removeItem('pulseAdmin');
  updateAdminUI();
  showToast('Logged out of Admin Session.', 'success');
}

function requireAdminAuth(callback) {
  if (!currentAdmin) {
    showToast('Admin login required. Redirecting to login page...', 'error');
    setTimeout(() => {
      window.location.href = '/login';
    }, 500);
    return false;
  }
  if (callback) callback();
  return true;
}

/* --- API CALLS --- */

async function fetchEvents() {
  try {
    const response = await fetch(`/api/events?category=${encodeURIComponent(currentCategoryFilter)}`);
    const data = await response.json();
    if (data.success) {
      allEvents = data.events;
      renderEvents(allEvents);
    }
  } catch (err) {
    console.error('Error fetching events:', err);
    showToast('Failed to load events. Make sure server is running.', 'error');
  }
}

async function fetchDashboardStats() {
  try {
    const response = await fetch('/api/stats');
    const data = await response.json();
    if (data.success) {
      const stats = data.stats;
      document.getElementById('statEventsCount').innerText = stats.total_events + '+';
      document.getElementById('statTicketsSold').innerText = stats.total_tickets_sold.toLocaleString();
      document.getElementById('anTotalRevenue').innerText = '₹' + stats.total_revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 });
      document.getElementById('anTicketsSold').innerText = stats.total_tickets_sold;
      document.getElementById('anTotalBookings').innerText = stats.total_bookings;

      renderCategoryAnalytics(stats.category_breakdown);
    }
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}

/* --- EVENT RENDERING --- */

function renderEvents(events) {
  const grid = document.getElementById('eventsGrid');
  if (!events || events.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
        <i class="fa-solid fa-calendar-xmark" style="font-size: 3rem; margin-bottom: 1rem;"></i>
        <h3>No events found matching your criteria.</h3>
        <p>Try searching for a different keyword or category.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = events.map(event => {
    const dateObj = new Date(event.date);
    const month = dateObj.toLocaleString('en-US', { month: 'short' });
    const day = dateObj.getDate();
    const capacityPct = Math.min(100, Math.round((event.booked_count / event.capacity) * 100));

    let badgeClass = 'badge-upcoming';
    if (event.status === 'Selling Fast') badgeClass = 'badge-fast';
    if (event.price === 0) badgeClass = 'badge-free';

    return `
      <div class="event-card glass-panel">
        <div class="card-img-wrapper">
          <img src="${event.image_url}" alt="${event.title}" class="card-img" onerror="this.src='https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80'">
          <div class="card-img-overlay">
            <div class="card-badges">
              <span class="badge ${badgeClass}">${event.status}</span>
              ${event.is_featured ? '<span class="badge badge-featured"><i class="fa-solid fa-star"></i> Featured</span>' : ''}
            </div>
            <div class="card-date-chip">
              <div class="month">${month}</div>
              <div class="day">${day}</div>
            </div>
          </div>
        </div>

        <div class="card-body">
          <div class="card-category">${event.category}</div>
          <h3 class="card-title">${event.title}</h3>
          
          <div class="card-meta">
            <div class="card-meta-item"><i class="fa-regular fa-clock"></i> ${event.time}</div>
            <div class="card-meta-item"><i class="fa-solid fa-location-dot"></i> ${event.venue}</div>
          </div>

          <div class="capacity-bar-wrapper">
            <div class="capacity-info">
              <span>Booked Seats</span>
              <span>${event.booked_count} / ${event.capacity} (${capacityPct}%)</span>
            </div>
            <div class="capacity-bar">
              <div class="capacity-fill" style="width: ${capacityPct}%;"></div>
            </div>
          </div>

          <div class="card-footer">
            <div class="card-price">
              ${event.price === 0 ? '<span class="amount free">FREE</span>' : `<span class="amount">₹${event.price}</span> <span class="unit">/ pass</span>`}
            </div>
            <button class="btn btn-primary btn-sm" onclick="openEventDetail(${event.id})">
              Book Tickets <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/* --- FILTER & SEARCH --- */

function filterEvents() {
  const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();
  const filtered = allEvents.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchVal) || 
                          e.description.toLowerCase().includes(searchVal) ||
                          e.venue.toLowerCase().includes(searchVal);
    const matchesCategory = (currentCategoryFilter === 'All') || (e.category === currentCategoryFilter);
    return matchesSearch && matchesCategory;
  });
  renderEvents(filtered);
}

function selectCategory(btn) {
  document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentCategoryFilter = btn.getAttribute('data-category');
  fetchEvents();
}

function switchView(viewName) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (viewName === 'explore') document.getElementById('navExplore').classList.add('active');
  fetchEvents();
}

/* --- MODAL CONTROL --- */

function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

/* --- EVENT DETAIL & PASS SELECTION --- */

function openEventDetail(eventId) {
  currentEvent = allEvents.find(e => e.id === eventId);
  if (!currentEvent) return;

  document.getElementById('modalEventTitle').innerText = currentEvent.title;
  document.getElementById('modalEventHeading').innerText = currentEvent.title;
  document.getElementById('modalEventImg').src = currentEvent.image_url;
  document.getElementById('modalEventCategory').innerText = currentEvent.category;
  document.getElementById('modalEventBadge').innerText = currentEvent.status;
  document.getElementById('modalEventDesc').innerText = currentEvent.description;
  document.getElementById('modalEventDateTime').innerText = `${currentEvent.date} | ${currentEvent.time}`;
  document.getElementById('modalEventVenue').innerText = currentEvent.venue;
  document.getElementById('modalEventOrganizer').innerText = currentEvent.organizer_name;

  document.getElementById('modalGeneralPrice').innerText = currentEvent.price === 0 ? 'FREE' : `₹${currentEvent.price}`;
  document.getElementById('modalVIPPrice').innerText = currentEvent.vip_price ? `₹${currentEvent.vip_price}` : `₹${currentEvent.price * 2}`;

  selectedTier = 'General';
  ticketQty = 1;
  document.getElementById('tierGeneralCard').classList.add('selected');
  document.getElementById('tierVIPCard').classList.remove('selected');
  document.getElementById('ticketQtyCount').innerText = ticketQty;

  updateModalTotal();
  openModal('eventDetailModal');
}

function selectPassTier(tier) {
  selectedTier = tier;
  if (tier === 'General') {
    document.getElementById('tierGeneralCard').classList.add('selected');
    document.getElementById('tierVIPCard').classList.remove('selected');
  } else {
    document.getElementById('tierVIPCard').classList.add('selected');
    document.getElementById('tierGeneralCard').classList.remove('selected');
  }
  updateModalTotal();
}

function changeTicketQty(delta) {
  ticketQty = Math.max(1, Math.min(10, ticketQty + delta));
  document.getElementById('ticketQtyCount').innerText = ticketQty;
  updateModalTotal();
}

function getUnitPrice() {
  if (!currentEvent) return 0;
  if (selectedTier === 'VIP') {
    return currentEvent.vip_price > 0 ? currentEvent.vip_price : currentEvent.price * 2;
  }
  return currentEvent.price;
}

function updateModalTotal() {
  const unit = getUnitPrice();
  const total = unit * ticketQty;
  document.getElementById('modalTotalPrice').innerText = total === 0 ? 'FREE' : `₹${total.toFixed(2)}`;
}

/* --- PAYMENT GATEWAY & CHECKOUT --- */

function proceedToCheckoutModal() {
  if (!currentEvent) return;
  closeModal('eventDetailModal');

  appliedDiscount = 0.0;
  document.getElementById('payCouponInput').value = '';
  document.getElementById('couponFeedbackMsg').innerText = '';

  updateCheckoutSummary();
  openModal('paymentModal');
}

function updateCheckoutSummary() {
  const unit = getUnitPrice();
  const subtotal = unit * ticketQty;
  const finalTotal = Math.max(0, subtotal - appliedDiscount);

  document.getElementById('paySubtotal').innerText = subtotal === 0 ? 'FREE' : `₹${subtotal.toFixed(2)}`;
  document.getElementById('payDiscount').innerText = `-₹${appliedDiscount.toFixed(2)}`;
  document.getElementById('payFinalTotal').innerText = finalTotal === 0 ? 'FREE' : `₹${finalTotal.toFixed(2)}`;
}

function switchPaymentMethod(method) {
  selectedPaymentMethod = method;
  document.querySelectorAll('.pay-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab${method}`).classList.add('active');

  document.getElementById('payViewUPI').style.display = method === 'UPI' ? 'block' : 'none';
  document.getElementById('payViewCard').style.display = method === 'Card' ? 'block' : 'none';
  document.getElementById('payViewWallet').style.display = method === 'Wallet' ? 'block' : 'none';
}

function updateCardPreview() {
  const num = document.getElementById('cardNumInput').value || '•••• •••• •••• 4242';
  const exp = document.getElementById('cardExpInput').value || '12/28';
  const name = document.getElementById('payStudentName').value || 'ALEX MORGAN';

  document.getElementById('cardNumPreview').innerText = formatCardNumber(num);
  document.getElementById('cardExpPreview').innerText = exp;
  document.getElementById('cardHolderPreview').innerText = name.toUpperCase();
}

function formatCardNumber(value) {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  const matches = v.match(/\d{4,16}/g);
  const match = (matches && matches[0]) || '';
  const parts = [];

  for (let i = 0, len = match.length; i < len; i += 4) {
    parts.push(match.substring(i, i + 4));
  }

  if (parts.length) {
    return parts.join(' ');
  } else {
    return value;
  }
}

function applyDiscountCoupon() {
  const code = document.getElementById('payCouponInput').value.trim().toUpperCase();
  const unit = getUnitPrice();
  const subtotal = unit * ticketQty;

  if (code === 'CAMPUS2026') {
    appliedDiscount = subtotal * 0.20; // 20% off
    document.getElementById('couponFeedbackMsg').innerText = '🎉 20% Campus Discount Applied!';
  } else if (code === 'FREESTUDENT') {
    appliedDiscount = subtotal; // 100% off
    document.getElementById('couponFeedbackMsg').innerText = '🎁 100% Free Student Pass Activated!';
  } else if (code === 'VIP50') {
    appliedDiscount = 50.0;
    document.getElementById('couponFeedbackMsg').innerText = '✨ ₹50 Off Voucher Applied!';
  } else {
    appliedDiscount = 0.0;
    document.getElementById('couponFeedbackMsg').innerText = '❌ Invalid or Expired Promo Code.';
    document.getElementById('couponFeedbackMsg').style.color = 'var(--accent-rose)';
    updateCheckoutSummary();
    return;
  }

  document.getElementById('couponFeedbackMsg').style.color = 'var(--accent-emerald)';
  updateCheckoutSummary();
}

async function processPayment() {
  const name = document.getElementById('payStudentName').value.trim();
  const email = document.getElementById('payStudentEmail').value.trim();
  const studentId = document.getElementById('payStudentId').value.trim();

  if (!name || !email || !studentId) {
    showToast('Please fill in your Name, Email, and Student ID.', 'error');
    return;
  }

  const unit = getUnitPrice();
  const subtotal = unit * ticketQty;
  const finalTotal = Math.max(0, subtotal - appliedDiscount);

  // Show processing loader simulation
  const overlay = document.getElementById('paymentLoadingOverlay');
  const statusText = document.getElementById('paymentStatusText');
  overlay.style.display = 'flex';
  statusText.innerText = `Connecting to ${selectedPaymentMethod} Gateway...`;

  setTimeout(async () => {
    statusText.innerText = 'Verifying Authentication & Issuing Pass...';
  }, 1000);

  setTimeout(async () => {
    try {
      const payload = {
        event_id: currentEvent.id,
        student_name: name,
        student_email: email,
        student_id: studentId,
        ticket_type: selectedTier,
        quantity: ticketQty,
        unit_price: unit,
        total_amount: finalTotal,
        discount_amount: appliedDiscount,
        payment_method: selectedPaymentMethod
      };

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      overlay.style.display = 'none';

      if (data.success) {
        closeModal('paymentModal');
        openReceiptModal(data.booking);
        fetchEvents();
        fetchDashboardStats();
        showToast('🎉 Ticket Booked & Payment Confirmed!', 'success');
      } else {
        showToast(data.error || 'Payment failed.', 'error');
      }
    } catch (err) {
      overlay.style.display = 'none';
      showToast('Network error during checkout.', 'error');
    }
  }, 2200);
}

/* --- RECEIPT MODAL --- */

function openReceiptModal(booking) {
  document.getElementById('recEventTitle').innerText = booking.event_title;
  document.getElementById('recRefCode').innerText = booking.booking_ref;
  document.getElementById('recStudentName').innerText = booking.student_name;
  document.getElementById('recStudentId').innerText = booking.student_id;
  document.getElementById('recTicketType').innerText = `${booking.ticket_type} Pass (x${booking.quantity})`;
  document.getElementById('recVenueDate').innerText = `${booking.event_date} @ ${booking.event_venue}`;
  document.getElementById('recPayMethod').innerText = booking.payment_method;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(booking.qr_code_str)}`;
  document.getElementById('recQRImg').src = qrUrl;

  openModal('receiptModal');
}

/* --- MY TICKETS PORTAL --- */

function openMyTicketsModal() {
  openModal('myTicketsModal');
  loadUserTickets();
}

async function loadUserTickets() {
  const query = document.getElementById('myTicketsEmailInput').value.trim();
  const listContainer = document.getElementById('userTicketsList');

  if (!query) {
    listContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Please enter an email or student ID.</p>';
    return;
  }

  listContainer.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';

  try {
    const res = await fetch(`/api/bookings/user/${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.success && data.bookings.length > 0) {
      listContainer.innerHTML = data.bookings.map(b => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); padding: 1.2rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span class="badge badge-featured">${b.booking_ref}</span>
            <h4 style="color: #fff; margin: 6px 0 4px 0;">${b.event_title}</h4>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">
              <i class="fa-regular fa-clock"></i> ${b.event_date} | <i class="fa-solid fa-location-dot"></i> ${b.event_venue}
            </div>
            <div style="font-size: 0.85rem; color: var(--primary); margin-top: 4px;">
              ${b.ticket_type} Pass (${b.quantity} ticket) • ₹${b.total_amount}
            </div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="openReceiptModalByRef('${b.booking_ref}')">
            <i class="fa-solid fa-qrcode"></i> View Pass
          </button>
        </div>
      `).join('');
    } else {
      listContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
          <i class="fa-solid fa-ticket-simple" style="font-size: 2.5rem; margin-bottom: 0.8rem;"></i>
          <p>No active event bookings found for <strong>${query}</strong>.</p>
        </div>
      `;
    }
  } catch (err) {
    listContainer.innerHTML = '<p style="color: var(--accent-rose); text-align: center;">Error searching tickets.</p>';
  }
}

async function openReceiptModalByRef(ref) {
  try {
    const res = await fetch(`/api/bookings/${ref}`);
    const data = await res.json();
    if (data.success) {
      closeModal('myTicketsModal');
      openReceiptModal(data.booking);
    }
  } catch (err) {
    showToast('Failed to fetch pass details.', 'error');
  }
}

/* --- ORGANIZER STUDIO --- */

function openOrganizerModal() {
  if (!requireAdminAuth()) return;
  switchOrganizerTab('publish');
  openModal('organizerModal');
}

function openCreateEventModal() {
  if (!requireAdminAuth()) return;
  switchOrganizerTab('publish');
  openModal('organizerModal');
}

function switchOrganizerTab(tab) {
  const isPublish = tab === 'publish';
  document.getElementById('orgTabPublish').classList.toggle('active', isPublish);
  document.getElementById('orgTabManage').classList.toggle('active', !isPublish);
  document.getElementById('orgViewPublish').style.display = isPublish ? 'block' : 'none';
  document.getElementById('orgViewManage').style.display = isPublish ? 'none' : 'block';

  if (!isPublish) {
    loadOrganizerEventsList();
  }
}

async function loadOrganizerEventsList() {
  const container = document.getElementById('organizerListingsContainer');
  container.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';

  try {
    const res = await fetch('/api/events');
    const data = await res.json();

    if (data.success && data.events.length > 0) {
      container.innerHTML = data.events.map(ev => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); padding: 1rem 1.2rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
            <img src="${ev.image_url}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=200&q=80'">
            <div>
              <h4 style="color: #fff; margin-bottom: 2px;">${ev.title}</h4>
              <div style="font-size: 0.8rem; color: var(--text-muted);">
                ${ev.category} • ${ev.date} • ${ev.booked_count}/${ev.capacity} Seats Booked
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge badge-upcoming">${ev.status}</span>
            <button class="btn btn-outline btn-sm" style="color: var(--accent-rose); border-color: rgba(244,63,94,0.3);" onclick="deleteEvent(${ev.id})">
              <i class="fa-solid fa-trash-can"></i> Delete
            </button>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No published events available.</p>';
    }
  } catch (err) {
    container.innerHTML = '<p style="color: var(--accent-rose); text-align: center;">Failed to load events list.</p>';
  }
}

async function deleteEvent(eventId) {
  if (!confirm('Are you sure you want to delete this event listing?')) return;

  try {
    const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      showToast('Event listing deleted.', 'success');
      loadOrganizerEventsList();
      fetchEvents();
      fetchDashboardStats();
    } else {
      showToast(data.error || 'Failed to delete event.', 'error');
    }
  } catch (err) {
    showToast('Network error while deleting event.', 'error');
  }
}

async function handleCreateEventSubmit(e) {
  e.preventDefault();

  const payload = {
    title: document.getElementById('newEventTitle').value.trim(),
    category: document.getElementById('newEventCategory').value,
    venue: document.getElementById('newEventVenue').value.trim(),
    date: document.getElementById('newEventDate').value,
    time: document.getElementById('newEventTime').value.trim(),
    price: parseFloat(document.getElementById('newEventPrice').value || 0),
    vip_price: parseFloat(document.getElementById('newEventVIPPrice').value || 0),
    capacity: parseInt(document.getElementById('newEventCapacity').value || 100),
    organizer_name: document.getElementById('newEventOrganizer').value.trim(),
    image_url: document.getElementById('newEventImgUrl').value.trim(),
    description: document.getElementById('newEventDesc').value.trim()
  };

  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      closeModal('organizerModal');
      document.getElementById('createEventForm').reset();
      fetchEvents();
      fetchDashboardStats();
      showToast('🚀 Event published successfully on PulseCampus!', 'success');
    } else {
      showToast(data.error || 'Failed to publish event.', 'error');
    }
  } catch (err) {
    showToast('Network error while publishing event.', 'error');
  }
}

/* --- ANALYTICS MODAL --- */

function openAnalyticsModal() {
  if (!requireAdminAuth()) return;
  fetchDashboardStats();
  openModal('analyticsModal');
}

function renderCategoryAnalytics(categories) {
  const container = document.getElementById('anCategoryBars');
  if (!categories || categories.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted);">No category data available.</p>';
    return;
  }

  const max = Math.max(...categories.map(c => c.count));

  container.innerHTML = categories.map(c => {
    const pct = Math.round((c.count / max) * 100);
    return `
      <div>
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #fff; margin-bottom: 4px;">
          <span>${c.category}</span>
          <span>${c.count} Event(s)</span>
        </div>
        <div style="height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
          <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, var(--primary), var(--secondary));"></div>
        </div>
      </div>
    `;
  }).join('');
}

async function reSeedData() {
  if (!confirm("Are you sure you want to reset and re-seed the sample events database?")) return;
  try {
    const res = await fetch('/api/seed', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      fetchEvents();
      fetchDashboardStats();
      showToast('Database reset and re-seeded!', 'success');
      closeModal('analyticsModal');
    }
  } catch (e) {
    showToast('Failed to re-seed database.', 'error');
  }
}

/* --- HELPERS --- */

function startUPITimer() {
  let seconds = 299;
  upiTimerInterval = setInterval(() => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const el = document.getElementById('upiTimer');
    if (el) el.innerText = formatted;
    seconds--;
    if (seconds < 0) seconds = 299;
  }, 1000);
}

function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}" style="font-size: 1.2rem; color: ${type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)'};"></i>
    <span>${msg}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
